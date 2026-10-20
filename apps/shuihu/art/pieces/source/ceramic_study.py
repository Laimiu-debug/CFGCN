"""Glaze study on the preserved first Tripo Lin Chong; never alters raw GLB."""
import hashlib
import json
import math
import re
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[5]
ART = ROOT / "apps/shuihu/art/pieces"
RAW = ART / "source/raw/ls006.glb"
OUT = ART / "source/ceramic"
QA = ROOT / ".local/qa/shuihu-pieces/ceramic"
OUT.mkdir(parents=True, exist_ok=True)
QA.mkdir(parents=True, exist_ok=True)
source_hash = hashlib.sha256(RAW.read_bytes()).hexdigest()
tokens = (ROOT / "packages/ui/src/tokens.css").read_text(encoding="utf-8")

def color(name):
    value = re.search(r"--" + re.escape(name) + r":\s*#([0-9a-fA-F]{6})", tokens).group(1)
    values = [int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in values) + (1,)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(RAW))
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
bounds = [o.matrix_world @ Vector(v) for o in meshes for v in o.bound_box]
minimum = Vector(tuple(min(v[i] for v in bounds) for i in range(3)))
maximum = Vector(tuple(max(v[i] for v in bounds) for i in range(3)))
height = maximum.z - minimum.z
bpy.ops.object.empty_add(type="PLAIN_AXES")
pivot = bpy.context.object
pivot.name = "Original_Tripo_v1_glaze_study_no_geometry_change"
for obj in list(bpy.context.scene.objects):
    if obj != pivot and obj.parent is None:
        obj.parent = pivot
factor = 0.1 / height
pivot.scale = (factor,) * 3
pivot.location = Vector((-(minimum.x + maximum.x) / 2, -(minimum.y + maximum.y) / 2, -minimum.z)) * factor

texture = None
for obj in meshes:
    for mat in obj.data.materials:
        if mat and mat.use_nodes:
            for node in mat.node_tree.nodes:
                if node.type == "TEX_IMAGE" and node.image:
                    texture = node.image
                    break
            if texture:
                break
    if texture:
        break
if not texture:
    raise RuntimeError("Original texture missing")

mat = bpy.data.materials.new("Glazed_garments_and_matte_ivory_clay_study")
mat.use_nodes = True
nodes = mat.node_tree.nodes
links = mat.node_tree.links
nodes.clear()
def node(kind, label):
    result = nodes.new(kind)
    result.label = label
    return result
def math_node(operation, a, b):
    result = node("ShaderNodeMath", operation)
    result.operation = operation
    for index, value in enumerate([a, b]):
        if isinstance(value, (int, float)):
            result.inputs[index].default_value = value
        else:
            links.new(value, result.inputs[index])
    return result.outputs[0]
def mix_color(mode, amount, a, b, label):
    result = node("ShaderNodeMixRGB", label)
    result.blend_type = mode
    if isinstance(amount, (int, float)):
        result.inputs[0].default_value = amount
    else:
        links.new(amount, result.inputs[0])
    for index, value in [(1, a), (2, b)]:
        if isinstance(value, tuple):
            result.inputs[index].default_value = value
        else:
            links.new(value, result.inputs[index])
    return result.outputs[0]

image = node("ShaderNodeTexImage", "Retained original Tripo UV texture")
image.image = texture
separate = node("ShaderNodeSeparateColor", "Original warm / blue paint regions")
links.new(image.outputs["Color"], separate.inputs["Color"])
luminance = node("ShaderNodeRGBToBW", "Keep original carved detail shading")
links.new(image.outputs["Color"], luminance.inputs[0])
shade = math_node("ADD", math_node("MULTIPLY", luminance.outputs[0], 0.65), 0.35)
blue_mask = math_node("GREATER_THAN", math_node("SUBTRACT", separate.outputs["Blue"], separate.outputs["Red"]), 0.025)
celadon = mix_color("MULTIPLY", 1, color("jade"), shade, "Celadon garment glaze")
indigo = mix_color("MULTIPLY", 1, color("accent-shuihu"), shade, "Blue garment / cap glaze")
glaze_color = mix_color("MIX", blue_mask, celadon, indigo, "Follow original color regions")

geometry = node("ShaderNodeNewGeometry", "World height after 100 mm preview normalization")
position = node("ShaderNodeSeparateXYZ", "Height and side regions")
links.new(geometry.outputs["Position"], position.inputs[0])
side = math_node("ABSOLUTE", position.outputs["Y"], 0)
head = math_node("GREATER_THAN", position.outputs["Z"], 0.073)
head = math_node("MULTIPLY", head, math_node("LESS_THAN", side, 0.013))
head = math_node("MULTIPLY", head, math_node("GREATER_THAN", position.outputs["X"], 0.0))
hands = math_node("MULTIPLY", math_node("GREATER_THAN", side, 0.011), math_node("LESS_THAN", side, 0.034))
hands = math_node("MULTIPLY", hands, math_node("GREATER_THAN", position.outputs["Z"], 0.037))
hands = math_node("MULTIPLY", hands, math_node("LESS_THAN", position.outputs["Z"], 0.050))
warm = math_node("GREATER_THAN", math_node("SUBTRACT", separate.outputs["Red"], separate.outputs["Blue"]), 0.025)
warm = math_node("MULTIPLY", warm, math_node("GREATER_THAN", separate.outputs["Red"], 0.25))
skin_mask = math_node("MULTIPLY", math_node("MAXIMUM", head, hands), warm)
waist = math_node("MULTIPLY", math_node("GREATER_THAN", position.outputs["Z"], 0.049), math_node("LESS_THAN", position.outputs["Z"], 0.053))
waist = math_node("MULTIPLY", waist, math_node("LESS_THAN", side, 0.018))
iron_red = mix_color("MULTIPLY", 1, color("vermilion"), shade, "Restrained iron-red waist glaze")
glaze_color = mix_color("MIX", waist, glaze_color, iron_red, "Localized iron-red belt study")
ao = node("ShaderNodeAmbientOcclusion", "Approximate darker glaze in folds, not a thickness bake")
ao.inputs["Distance"].default_value = 0.0025
glaze_color = mix_color("MULTIPLY", 0.3, glaze_color, ao.outputs["Color"], "Fold pooling color study")

noise = node("ShaderNodeTexNoise", "Very fine surface variation")
noise.inputs["Scale"].default_value = 140
noise.inputs["Detail"].default_value = 2
roughness = math_node("ADD", math_node("MULTIPLY", noise.outputs["Fac"], 0.08), 0.25)
glaze = node("ShaderNodeBsdfPrincipled", "Opaque fired ceramic glaze")
links.new(glaze_color, glaze.inputs["Base Color"])
links.new(roughness, glaze.inputs["Roughness"])
glaze.inputs["Metallic"].default_value = 0
glaze.inputs["IOR"].default_value = 1.5
glaze.inputs["Transmission Weight"].default_value = 0
glaze.inputs["Specular IOR Level"].default_value = 0.35
glaze.inputs["Coat Weight"].default_value = 0.25
glaze.inputs["Coat Roughness"].default_value = 0.18
skin = node("ShaderNodeBsdfPrincipled", "Matte warm ivory clay face and hands")
skin_color = mix_color("MIX", 0.8, image.outputs["Color"], color("paper-raised"), "Retain a little original face detail")
links.new(skin_color, skin.inputs["Base Color"])
skin.inputs["Metallic"].default_value = 0
skin.inputs["Roughness"].default_value = 0.55
skin.inputs["IOR"].default_value = 1.45
skin.inputs["Coat Weight"].default_value = 0
bump = node("ShaderNodeBump", "Subtle fired surface, not stone pores")
bump.inputs["Strength"].default_value = 0.025
bump.inputs["Distance"].default_value = 0.00002
links.new(noise.outputs["Fac"], bump.inputs["Height"])
links.new(bump.outputs["Normal"], glaze.inputs["Normal"])
links.new(bump.outputs["Normal"], skin.inputs["Normal"])
mix = node("ShaderNodeMixShader", "Procedural skin mask; needs manual refinement before production")
links.new(skin_mask, mix.inputs[0])
links.new(glaze.outputs[0], mix.inputs[1])
links.new(skin.outputs[0], mix.inputs[2])
output = node("ShaderNodeOutputMaterial", "Study output")
links.new(mix.outputs[0], output.inputs["Surface"])
for index, n in enumerate(nodes):
    n.location = ((index % 8) * 240, -(index // 8) * 240)
for obj in meshes:
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    for polygon in obj.data.polygons:
        polygon.material_index = 0

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.render.resolution_x = 1000
scene.render.resolution_y = 1100
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.world = bpy.data.worlds.new("Series paper studio")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = color("paper")
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.22
scene.view_settings.view_transform = "AgX"
scene.view_settings.exposure = -0.5
bpy.ops.mesh.primitive_plane_add(size=4, location=(0, 0, -0.0001))
floor = bpy.context.object
floor.name = "Display_surface_not_part_of_model"
floor_material = bpy.data.materials.new("Shared paper surface")
floor_material.diffuse_color = color("paper-shade")
floor.data.materials.append(floor_material)
for name, location, power, size in [
    ("Large window", (0.14, -0.13, 0.20), 3, 0.14),
    ("Soft fill", (0.13, 0.16, 0.10), 1, 0.16),
    ("Glaze rim", (-0.12, 0.03, 0.16), 3, 0.10),
]:
    bpy.ops.object.light_add(type="AREA", location=location)
    lamp = bpy.context.object
    lamp.name = name
    lamp.data.energy = power
    lamp.data.shape = "RECTANGLE"
    lamp.data.size = size
    lamp.data.size_y = size * 0.55
    lamp.rotation_euler = (Vector((0, 0, 0.05)) - lamp.location).to_track_quat("-Z", "Y").to_euler()
bpy.ops.object.camera_add(location=(0.25, -0.13, 0.095))
camera = bpy.context.object
camera.data.type = "ORTHO"
camera.data.ortho_scale = 0.125
camera.data.clip_start = 0.001
target = Vector((0, 0, 0.050))
camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = camera
scene["source"] = "Original Tripo v1 Lin Chong, geometry unchanged; Blender glaze material study"
scene["source_sha256"] = source_hash
scene["acceptance"] = "Experimental procedural material masks; not final ceramic or web material acceptance"
blend_path = OUT / "ls006-first-source-glaze-study.blend"
bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
images = []
for view, location in [("front", (0.25, -0.13, 0.095)), ("back", (-0.25, 0.13, 0.095))]:
    camera.location = location
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    filename = QA / ("ls006-first-source-glaze-" + view + ".png")
    scene.render.filepath = str(filename)
    bpy.ops.render.render(write_still=True)
    images.append(str(filename.relative_to(ROOT)))
assert hashlib.sha256(RAW.read_bytes()).hexdigest() == source_hash
result = {
    "sourceRaw": str(RAW.relative_to(ROOT)), "sourceRawSha256": source_hash,
    "studioProjectId": "39920c45-8dbb-4414-975d-ee9d071d604f",
    "method": "Existing Tripo geometry plus Blender two-BSDF glaze / matte clay procedural material study",
    "geometryChanged": False, "newTripoGeneration": False,
    "blendFile": str(blend_path.relative_to(ROOT)), "previewImages": images,
    "normalization": "Full equipment bounding height 100 mm for inspection, not final body dimension",
    "webMaterialBaked": False, "glbExported": False, "approved": False,
    "limitations": ["Skin region mask is procedural and needs manual refinement", "Old spear shape and pose are unchanged", "Study shader has not been baked or validated in the web viewer"],
}
(OUT / "ls006-first-source-glaze-study.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
print("CERAMIC_STUDY_RESULT " + json.dumps(result))
