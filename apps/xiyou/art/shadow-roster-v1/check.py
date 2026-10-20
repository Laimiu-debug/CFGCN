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
    assert len(doc["skins"][0]["joints"]) == 14
    assert doc["materials"][0]["alphaMode"] == "MASK" and doc["materials"][0]["doubleSided"]
    assert "KHR_materials_unlit" in doc["materials"][0]["extensions"]
    assert [a["name"] for a in doc["animations"]] == ["Idle", "Walk", "RestPose"]
    with zipfile.ZipFile(directory / record["woop"]) as archive:
        woop = json.loads(archive.read("woop.json"))
        assert len(woop["parts"]) == 14 and len(woop["joints"]) == 13
        assert all(p["image"] in archive.namelist() for p in woop["parts"])
    # Fresh open verifies the actual native delivery, including packed images.
    bpy.ops.wm.open_mainfile(filepath=str(directory / record["editable"]))
    arms = [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    assert len(arms) == 1 and len(meshes) == 14
    assert len(arms[0].data.bones) == 14
    assert all(i.packed_file for i in bpy.data.images if i.name.startswith("IMG_") or i.name.endswith(".png"))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 60
    bpy.ops.import_scene.gltf(filepath=str(directory / record["runtime"]))
    arm = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
    mesh = next(o for o in bpy.context.scene.objects if o.type == "MESH" and any(m.type == "ARMATURE" for m in o.modifiers))
    assert len(mesh.data.vertices) == 56
    assert sum(len(p.vertices) - 2 for p in mesh.data.polygons) == 28
    assert all(len(v.groups) == 1 and abs(v.groups[0].weight - 1.) < 1e-6 for v in mesh.data.vertices)
    atlas = next(i for i in bpy.data.images if i.size[0] == 1254)
    alpha = np.asarray(atlas.pixels[:], dtype=np.float32)[3::4]
    transparent = float((alpha < .05).mean())
    assert transparent > .55, (record["id"], transparent)
    arm.animation_data_create()
    arm.animation_data.action = bpy.data.actions["Walk"]
    contacts, maximum, poses = 0, 0., []
    for frame in range(61):
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        graph = bpy.context.evaluated_depsgraph_get()
        evaluated = mesh.evaluated_get(graph)
        working = evaluated.to_mesh()
        for side, offset in [("front", 0.), ("back", .5)]:
            group = mesh.vertex_groups["foot." + side].index
            vertices = [working.vertices[v.index].co for v in mesh.data.vertices if any(g.group == group for g in v.groups)]
            sole = min(v.y for v in vertices)
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
    reports.append({"id": record["id"], "bytes": len(raw), "parts": 14, "bones": 14,
                    "triangles": 28, "materials": 1, "transparent_fraction": transparent,
                    "planted_foot_samples": contacts, "planted_sole_max_offset": maximum,
                    "woop": "verified", "blend": "reopened with packed images", "glb": "reimported"})
    print("CHECKED", record["id"], maximum)
path = ROOT / ".local/qa/shadow-roster-v1/assets.json"
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(json.dumps({"characters": reports, "count": len(reports)}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
