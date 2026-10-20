"""Check the exported, reimported puppet rather than only its Blender source."""
from pathlib import Path
import hashlib
import json
import math
import struct

import bpy

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
path = ROOT / "apps/website/public/games/xiyou/assets/shadow_wukong.glb"
raw = path.read_bytes()
manifest = json.loads((HERE / "manifest.json").read_text(encoding="utf-8"))
size = struct.unpack_from("<I", raw, 12)[0]
document = json.loads(raw[20:20 + size])
assert manifest["runtime_sha256"] == hashlib.sha256(raw).hexdigest()
assert manifest["source_sha256"] == hashlib.sha256((HERE / "parts-source.png").read_bytes()).hexdigest()
assert len(raw) < 1_000_000
assert len(document["materials"]) == 1
assert all(m["alphaMode"] == "MASK" and m["doubleSided"] for m in document["materials"])
assert all("KHR_materials_unlit" in m["extensions"] for m in document["materials"])
assert [a["name"] for a in document["animations"]] == ["Idle", "Walk", "RestPose"]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps = 60
bpy.ops.import_scene.gltf(filepath=str(path))
arm = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
objects = [o for o in bpy.context.scene.objects if o.type == "MESH"
           and any(m.type == "ARMATURE" and m.object == arm for m in o.modifiers)]
assert len(objects) == 1, [(o.name, o.type) for o in bpy.context.scene.objects]
assert len(document["skins"][0]["joints"]) == 15
assert all(name in arm.data.bones for name in ["root", "body", "head", "thigh.front", "shin.front", "foot.front", "staff"]), list(arm.data.bones.keys())
mesh = objects[0]
assert all(len(v.groups) == 1 and abs(v.groups[0].weight - 1.) < 1e-6 for v in mesh.data.vertices)
assert len(mesh.data.vertices) == 56
image = next(i for i in bpy.data.images if i.size[0] == 1024)
assert list(image.size) == [1024, 768]
alpha = list(image.pixels)[3::4]
assert sum(a < .05 for a in alpha) / len(alpha) > .65
assert any(a > .95 for a in alpha)

arm.animation_data.action = bpy.data.actions["Walk"]
contacts, max_error, elevations, bends = 0, 0., [], []
for frame in range(61):
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    for side, offset in [("front", 0), ("back", .5)]:
        foot = arm.matrix_world @ arm.pose.bones["foot." + side].head
        cycle = (frame / 60 + offset) % 1.
        elevations.append(foot.z - .13)
        bends.append(arm.pose.bones["shin." + side].rotation_quaternion.angle)
        if cycle < .32:
            contacts += 1
            max_error = max(max_error, abs(foot.z - .13 - .022))
assert contacts >= 30
assert max_error < .035, f"Planted sole height error: {max_error}"
assert max(elevations) - min(elevations) > .12, "Exported feet must actually lift"
assert max(bends) - min(bends) > .4, "The walk must articulate the knees"
report = {"runtime_bytes": len(raw), "triangles": 28, "parts": 14, "bones": 15,
          "materials": 1, "texture": [1024, 768], "contacts": contacts,
          "planted_sole_max_error": max_error, "sole_height_range": [min(elevations), max(elevations)],
          "rigid_weights": True, "alpha_cutout": True, "animations": [a["name"] for a in document["animations"]]}
out = ROOT / ".local/qa/shadow-wukong-asset.json"
out.parent.mkdir(exist_ok=True, parents=True)
out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print("SHADOW_WUKONG_CHECK", json.dumps(report))
