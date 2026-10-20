"""Validate generated WOOP packages, saved blend sources and reimported GLBs."""
from pathlib import Path
import hashlib
import json
import math
import struct
import zipfile

import bpy
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
records = json.loads((HERE / "manifest.json").read_text(encoding="utf-8"))["characters"]
reports = []
for record in records:
    directory = HERE / record["id"]
    raw = (directory / record["runtime"]).read_bytes()
    size = struct.unpack_from("<I", raw, 12)[0]
    doc = json.loads(raw[20:20 + size])
    assert hashlib.sha256(raw).hexdigest() == record["runtime_sha256"]
    assert hashlib.sha256((directory / "parts-source.png").read_bytes()).hexdigest() == record["source_sha256"]
    assert len(raw) < 1_500_000, (record["id"], len(raw))
    assert len(doc["meshes"]) == 1 and len(doc["materials"]) == 1
    assert len(doc["skins"][0]["joints"]) == 16
    assert doc["materials"][0]["alphaMode"] == "MASK" and doc["materials"][0]["doubleSided"]
    assert "KHR_materials_unlit" in doc["materials"][0]["extensions"]
    assert [a["name"] for a in doc["animations"]] == ["Idle", "Walk", "RestPose"]
    with zipfile.ZipFile(directory / record["woop"]) as archive:
        woop = json.loads(archive.read("woop.json"))
        assert len(woop["parts"]) == 16 and len(woop["joints"]) == 15
        by_id = {p["id"]: p for p in woop["parts"]}
        assert all(n in by_id for n in ["body", "abdomen", "pelvis"])
        assert all(p["image"] in archive.namelist() for p in woop["parts"])
    # Fresh open verifies the actual native delivery, including packed images.
    bpy.ops.wm.open_mainfile(filepath=str(directory / record["editable"]))
    arms = [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    assert len(arms) == 1 and len(meshes) == 16
    assert len(arms[0].data.bones) == 16
    assert arms[0].data.bones["body"].parent.name == "abdomen"
    assert arms[0].data.bones["abdomen"].parent.name == "pelvis"
    assert arms[0].data.bones["thigh.front"].parent.name == "pelvis"
    assert all(i.packed_file for i in bpy.data.images if i.name.startswith("IMG_") or i.name.endswith(".png"))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 60
    bpy.ops.import_scene.gltf(filepath=str(directory / record["runtime"]))
    arm = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
    mesh = next(o for o in bpy.context.scene.objects if o.type == "MESH" and any(m.type == "ARMATURE" for m in o.modifiers))
    assert len(mesh.data.vertices) == 64
    assert sum(len(p.vertices) - 2 for p in mesh.data.polygons) == 32
    assert all(len(v.groups) == 1 and abs(v.groups[0].weight - 1.) < 1e-6 for v in mesh.data.vertices)
    atlas = next(i for i in bpy.data.images if i.size[0] == 1024)
    alpha = np.asarray(atlas.pixels[:], dtype=np.float32)[3::4]
    transparent = float((alpha < .05).mean())
    assert transparent > .55, (record["id"], transparent)
    arm.animation_data_create()
    arm.animation_data.action = bpy.data.actions["RestPose"]
    bpy.context.scene.frame_set(0)
    bpy.context.view_layer.update()
    evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
    working = evaluated.to_mesh()
    part_bounds = {}
    for part in [p["id"] for p in woop["parts"]]:
        group = mesh.vertex_groups[part].index
        points = [evaluated.matrix_world @ working.vertices[v.index].co for v in mesh.data.vertices
                  if any(g.group == group for g in v.groups)]
        part_bounds[part] = {"width": max(v.x for v in points)-min(v.x for v in points),
                             "top": max(v.z for v in points), "bottom": min(v.z for v in points)}
    evaluated.to_mesh_clear()
    anatomical = [v for k,v in part_bounds.items() if k not in ["weapon", "accessory"]]
    body_height = max(v["top"] for v in anatomical)-min(v["bottom"] for v in anatomical)
    bone_point = lambda n: arm.matrix_world @ arm.data.bones[n].head_local
    leg_length = (bone_point("thigh.front")-bone_point("shin.front")).length + (bone_point("shin.front")-bone_point("foot.front")).length
    arm_length = (bone_point("upper_arm.front")-bone_point("forearm.front")).length + (bone_point("forearm.front")-bone_point("weapon")).length
    assert abs(body_height-record["nominal_body_height"]) < .03, (record["id"], body_height)
    arm.animation_data.action = bpy.data.actions["Walk"]
    period = float(arm.animation_data.action.frame_range[1]) / 60.
    assert abs(period-record["proportions"]["period"]) < .025
    loop_poses = []
    for loop_frame in [0, round(period*60)]:
        bpy.context.scene.frame_set(loop_frame)
        bpy.context.view_layer.update()
        loop_poses.append([v for bone in arm.pose.bones for row in bone.matrix for v in row])
    loop_delta = max(abs(a-b) for a,b in zip(*loop_poses))
    assert loop_delta < .0001, (record["id"], "walk loop discontinuity", loop_delta)
    contacts, maximum, poses = 0, 0., []
    for frame in range(61):
        sample_frame = frame * period
        bpy.context.scene.frame_set(int(sample_frame), subframe=sample_frame % 1)
        bpy.context.view_layer.update()
        graph = bpy.context.evaluated_depsgraph_get()
        evaluated = mesh.evaluated_get(graph)
        working = evaluated.to_mesh()
        for side, offset in [("front", 0.), ("back", .5)]:
            group = mesh.vertex_groups["foot." + side].index
            vertices = [evaluated.matrix_world @ working.vertices[v.index].co for v in mesh.data.vertices if any(g.group == group for g in v.groups)]
            sole = min(v.z for v in vertices)
            cycle = (frame / 60 + offset) % 1
            if cycle < .4:
                contacts += 1
                maximum = max(maximum, abs(sole))
        if frame in [0, 15, 30, 45]:
            poses.append(round(arm.pose.bones["shin.front"].rotation_quaternion.angle, 3))
        evaluated.to_mesh_clear()
    # Source bounding boxes include a few transparent pixels at the sole. The
    # native importer anchors that full bounding box, so permit 2 cm of padding.
    assert maximum < .02, (record["id"], maximum)
    assert max(poses) - min(poses) > .2, (record["id"], poses)
    reports.append({"id": record["id"], "bytes": len(raw), "parts": 16, "bones": 16,
                    "triangles": 32, "materials": 1, "transparent_fraction": transparent,
                    "planted_foot_samples": contacts, "planted_sole_max_offset": maximum,
                    "body_height": body_height, "leg_length": leg_length, "arm_length": arm_length,
                    "head_height": part_bounds["head"]["top"]-part_bounds["head"]["bottom"],
                    "abdomen_width": part_bounds["abdomen"]["width"], "chest_width": part_bounds["body"]["width"],
                    "walk_period": period, "loop_matrix_max_delta": loop_delta,
                    "woop": "verified", "blend": "reopened with packed images", "glb": "reimported"})
    print("CHECKED", record["id"], maximum)
by_id = {r["id"]: r for r in reports}
assert by_id["shaseng"]["body_height"] / by_id["wukong"]["body_height"] > 1.35
assert by_id["bajie"]["abdomen_width"] / by_id["tangseng"]["abdomen_width"] > 2.
assert by_id["xiaobailong"]["leg_length"]/by_id["xiaobailong"]["body_height"] > by_id["bajie"]["leg_length"]/by_id["bajie"]["body_height"] + .15
assert by_id["tiger"]["chest_width"] / by_id["tiger"]["abdomen_width"] > 1.4
assert by_id["wukong"]["arm_length"]/by_id["wukong"]["leg_length"] > by_id["tangseng"]["arm_length"]/by_id["tangseng"]["leg_length"] + .18
assert len({round(r["walk_period"],2) for r in reports}) == 8
path = ROOT / ".local/qa/shadow-roster-v3/assets.json"
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(json.dumps({"characters": reports, "count": len(reports)}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
