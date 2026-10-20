"""Render the actual Tripo GLBs for inspection; never alters the original files."""
import argparse
import hashlib
import json
import math
import re
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[5]
ART = ROOT / "apps/shuihu/art/pieces"
QA = ROOT / ".local/qa/shuihu-pieces"
QA.mkdir(parents=True, exist_ok=True)
parser = argparse.ArgumentParser()
parser.add_argument("--only", default="")
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
roster = json.loads((ART / "roster.json").read_text(encoding="utf-8"))
tokens = (ROOT / "packages/ui/src/tokens.css").read_text(encoding="utf-8")

def colour(name):
    value = re.search(r"--" + re.escape(name) + r":\s*#([0-9a-fA-F]{6})", tokens).group(1)
    rgb = [int(value[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in rgb) + (1,)

results = []
for identifier in roster["prototypeIds"]:
    if args.only and identifier != args.only:
        continue
    filename = ART / "source/raw" / (identifier + ".glb")
    if not filename.exists():
        continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(filename))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    bounds = [obj.matrix_world @ Vector(v) for obj in meshes for v in obj.bound_box]
    minimum = Vector(tuple(min(v[i] for v in bounds) for i in range(3)))
    maximum = Vector(tuple(max(v[i] for v in bounds) for i in range(3)))
    raw_height = maximum.z - minimum.z
    bpy.ops.object.empty_add(type="PLAIN_AXES")
    pivot = bpy.context.object
    pivot.name = identifier + "_raw_inspection_scale"
    for obj in list(bpy.context.scene.objects):
        if obj != pivot and obj.parent is None:
            obj.parent = pivot
    pivot.location = Vector((-(minimum.x + maximum.x) / 2, -(minimum.y + maximum.y) / 2, -minimum.z)) * (0.1 / raw_height)
    pivot.scale = (0.1 / raw_height,) * 3
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 16
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 720
    scene.render.resolution_y = 960
    scene.render.resolution_percentage = 100
    scene.world = bpy.data.worlds.new("Series paper")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = colour("paper")
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.5
    scene.view_settings.view_transform = "AgX"
    for name, location, energy, size in [
        ("Key", (-0.12, -0.16, 0.2), 12, 0.16),
        ("Fill", (0.16, -0.05, 0.12), 5, 0.12),
        ("Rim", (0.03, 0.13, 0.18), 8, 0.1),
    ]:
        bpy.ops.object.light_add(type="AREA", location=location)
        lamp = bpy.context.object
        lamp.name = name
        lamp.data.energy = energy
        lamp.data.shape = "DISK"
        lamp.data.size = size
        lamp.rotation_euler = (Vector((0, 0, 0.05)) - lamp.location).to_track_quat("-Z", "Y").to_euler()
    bpy.ops.object.camera_add(location=(0, -0.4, 0.05))
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 0.12
    camera.data.clip_start = 0.001
    camera.rotation_euler = (Vector((0, 0, 0.05)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera
    for view, angle in [("front", 0), ("back", math.pi)]:
        camera.location = (math.sin(angle) * 0.4, -math.cos(angle) * 0.4, 0.05)
        camera.rotation_euler = (Vector((0, 0, 0.05)) - camera.location).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = str(QA / (identifier + "-raw-" + view + ".png"))
        bpy.ops.render.render(write_still=True)
    result = {
        "id": identifier, "file": str(filename.relative_to(ROOT)), "bytes": filename.stat().st_size,
        "sha256": hashlib.sha256(filename.read_bytes()).hexdigest(),
        "sourceHeight": raw_height, "sourceMin": list(minimum), "sourceMax": list(maximum),
        "triangles": sum(len(obj.data.polygons) for obj in meshes),
        "meshObjects": len(meshes), "armatures": sum(obj.type == "ARMATURE" for obj in scene.objects),
        "normalization": "Raw inspection only: each full equipment bounding height is 100 mm, not calibrated body height or final relative scale",
        "materials": [mat.name for obj in meshes for mat in obj.data.materials if mat],
    }
    results.append(result)
    (QA / (identifier + "-raw-inspection.json")).write_text(json.dumps(result, indent=2), encoding="utf-8")
print("SHUIHU_RAW_INSPECTION " + json.dumps(results))
