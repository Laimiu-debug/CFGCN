"""Import a traced Studio ceramic source for real Blender inspection; raw stays immutable."""
import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[5]
ART = ROOT / "apps/shuihu/art/pieces"
parser = argparse.ArgumentParser()
parser.add_argument("--id", required=True)
parser.add_argument("--source", required=True, help="Relative to the art directory")
parser.add_argument("--project", required=True)
parser.add_argument("--height-mm", type=float, required=True)
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
raw = (ART / args.source).resolve()
if not raw.is_relative_to(ART.resolve()):
    raise RuntimeError("Source outside art directory")
source_hash = hashlib.sha256(raw.read_bytes()).hexdigest()
out = ART / "source/ceramic-production"
qa = ROOT / ".local/qa/shuihu-pieces/ceramic-production"
out.mkdir(parents=True, exist_ok=True)
qa.mkdir(parents=True, exist_ok=True)
tokens = (ROOT / "packages/ui/src/tokens.css").read_text(encoding="utf-8")

def color(name):
    value = re.search(r"--" + re.escape(name) + r":\s*#([0-9a-fA-F]{6})", tokens).group(1)
    values = [int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in values) + (1,)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(raw))
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
if not meshes:
    raise RuntimeError("GLB contains no mesh")
bounds = [o.matrix_world @ Vector(v) for o in meshes for v in o.bound_box]
low = Vector(tuple(min(p[i] for p in bounds) for i in range(3)))
high = Vector(tuple(max(p[i] for p in bounds) for i in range(3)))
original_height = high.z - low.z
if original_height <= 0:
    raise RuntimeError("Invalid source extent")
height = args.height_mm / 1000
bpy.ops.object.empty_add(type="PLAIN_AXES")
pivot = bpy.context.object
pivot.name = args.id + "_ceramic_source_normalization"
for obj in list(bpy.context.scene.objects):
    if obj != pivot and obj.parent is None:
        obj.parent = pivot
factor = height / original_height
pivot.scale = (factor,) * 3
pivot.location = Vector((-(low.x + high.x) / 2, -(low.y + high.y) / 2, -low.z)) * factor
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
scene.unit_settings.length_unit = "MILLIMETERS"
scene.render.engine = "CYCLES"
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.render.resolution_x = 1000
scene.render.resolution_y = 1100
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.world = bpy.data.worlds.new("Series paper inspection studio")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = color("paper")
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = .3
scene.view_settings.view_transform = "AgX"
scene.view_settings.exposure = -.5
for name, location, power, size in [
    ("Neutral broad key", (.14, -.10, .16), 1.0, .12),
    ("Soft face fill", (.12, .12, .09), .5, .14),
    ("Ceramic edge light", (-.12, .02, .14), 1.0, .10),
]:
    bpy.ops.object.light_add(type="AREA", location=location)
    lamp = bpy.context.object
    lamp.name = name
    lamp.data.energy = power
    lamp.data.shape = "DISK"
    lamp.data.size = size
    lamp.rotation_euler = (Vector((0, 0, height * .6)) - lamp.location).to_track_quat("-Z", "Y").to_euler()
bpy.ops.object.camera_add()
camera = bpy.context.object
camera.name = args.id + "_inspection_camera"
camera.data.type = "ORTHO"
camera.data.clip_start = .0001
camera.data.clip_end = 10
scene.camera = camera
preview_paths = []
bpy.context.view_layer.update()
head_points = []
for obj in meshes:
    matrix = obj.matrix_world
    for vertex in obj.data.vertices:
        point = matrix @ vertex.co
        if height * .78 < point.z < height * .94:
            head_points.append(point)
head_y = (min(p.y for p in head_points) + max(p.y for p in head_points)) / 2
for view, location, target, scale in [
    ("whole", (.22, -.065, height * .73), (0, 0, height * .5), height * 1.35),
    ("face-front", (.18, head_y, height * .845), (0, head_y, height * .845), height * .27),
    ("face-quarter", (.16, head_y - .045, height * .845), (0, head_y, height * .845), height * .27),
]:
    camera.location = location
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.ortho_scale = scale
    output = qa / (args.id + "-import-" + view + ".png")
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    preview_paths.append(str(output.relative_to(ROOT)).replace("\\", "/"))
scene["source_studio_project"] = args.project
scene["source_sha256"] = source_hash
scene["stage"] = "Imported and normalized for inspection; no claim of face correction or finished equipment separation"
scene["front_axis_assumption"] = "+X, verify actual render before facial work"
blend_file = out / (args.id + "-source-preparation.blend")
bpy.ops.wm.save_as_mainfile(filepath=str(blend_file))
assert hashlib.sha256(raw.read_bytes()).hexdigest() == source_hash
record = {"id": args.id, "studioProjectId": args.project,
          "sourceRaw": args.source, "sourceRawSha256": source_hash,
          "blendFile": str(blend_file.relative_to(ART)).replace("\\", "/"),
          "geometryChanged": False, "normalizationHeightMm": args.height_mm,
          "normalizationScope": "Full source vertical extent, body calibration still needs review",
          "sourceMeshes": len(meshes), "vertices": sum(len(o.data.vertices) for o in meshes),
          "triangles": sum(len(p.vertices) - 2 for o in meshes for p in o.data.polygons),
          "previewImages": preview_paths, "faceRefined": False, "equipmentSeparated": False,
          "webExported": False, "approved": False}
(out / (args.id + "-source-preparation.json")).write_text(json.dumps(record, indent=2), encoding="utf-8")
print("CERAMIC_PREPARATION " + json.dumps(record))
