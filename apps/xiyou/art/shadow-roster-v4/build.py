"""Use the official installed-local WOOP importer, then author/export our assets.

Third-party importer code stays in ignored .local/tools and is not redistributed.
Run Blender with --python-exit-code 1; pass -- <id> to build one character.
"""
from pathlib import Path
import hashlib
import json
import math
import struct
import sys

import bpy
from mathutils import Vector, Quaternion

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
PLUGIN = ROOT / ".local/tools/wooo-shadow-0.8.13"
sys.path.insert(0, str(PLUGIN))
import woop_importer
woop_importer.__addon_enabled__ = False

ROSTER = json.loads((HERE / "roster.json").read_text(encoding="utf-8"))


def rotate(bone, angle):
    axis = bone.bone.matrix_local.to_quaternion().inverted() @ Vector((0., 1., 0.))
    bone.rotation_mode = "QUATERNION"
    bone.rotation_quaternion = Quaternion(axis, angle)


def translate(bone, value):
    bone.location = bone.bone.matrix_local.to_quaternion().inverted() @ Vector(value)


def flat_material(name, image):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.use_backface_culling = False
    material.surface_render_method = "DITHERED"
    nodes = material.node_tree.nodes
    nodes.clear()
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = image
    emission = nodes.new("ShaderNodeEmission")
    clear = nodes.new("ShaderNodeBsdfTransparent")
    mask = nodes.new("ShaderNodeMath")
    mask.operation = "GREATER_THAN"
    mask.inputs[1].default_value = .42
    mix = nodes.new("ShaderNodeMixShader")
    output = nodes.new("ShaderNodeOutputMaterial")
    for source, target in [(tex.outputs["Color"], emission.inputs["Color"]),
                           (tex.outputs["Alpha"], mask.inputs[0]),
                           (mask.outputs[0], mix.inputs[0]),
                           (clear.outputs[0], mix.inputs[1]),
                           (emission.outputs[0], mix.inputs[2]),
                           (mix.outputs[0], output.inputs[0])]:
        material.node_tree.links.new(source, target)
    return material


sys.path.insert(0, str(HERE))
from motion import animate
from atlas import pack_atlas


def render_studies(arm, directory, height):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 8
    scene.render.film_transparent = True
    scene.render.resolution_x, scene.render.resolution_y = 512, 768
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "Standard"
    camera = bpy.data.cameras.new("Resource inspection camera")
    camera.type = "ORTHO"
    camera.ortho_scale = height * .95
    obj = bpy.data.objects.new(camera.name, camera)
    scene.collection.objects.link(obj)
    obj.location = (0, -8, height * .50)
    obj.rotation_euler = (Vector((0, 0, height * .50)) - obj.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = obj
    bounds = []
    for action_name, frame in [("Idle", 0), ("Walk", 20)]:
        arm.animation_data.action = bpy.data.actions[action_name]
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        graph = bpy.context.evaluated_depsgraph_get()
        for mesh_obj in [o for o in scene.objects if o.type == "MESH"]:
            evaluated = mesh_obj.evaluated_get(graph)
            bounds.extend(evaluated.matrix_world @ Vector(corner) for corner in evaluated.bound_box)
    low_x, high_x = min(p.x for p in bounds), max(p.x for p in bounds)
    low_z, high_z = min(p.z for p in bounds), max(p.z for p in bounds)
    obj.location = ((low_x + high_x) / 2, -8, (low_z + high_z) / 2)
    camera.ortho_scale = max(high_z - low_z, (high_x - low_x) * 1.5) * 1.12
    for title, action_name, frame in [("preview-idle", "Idle", 0), ("preview-walk", "Walk", 20)]:
        arm.animation_data.action = bpy.data.actions[action_name]
        scene.frame_set(frame)
        scene.render.filepath = str(directory / (title + ".png"))
        bpy.ops.render.render(write_still=True)
    arm.animation_data.action = bpy.data.actions["Idle"]
    scene.frame_set(0)


def build(character):
    directory = HERE / character["id"]
    manifest = json.loads((directory / "woop.json").read_text(encoding="utf-8"))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 60
    bpy.context.preferences.filepaths.save_version = 0
    def bounds(parts):
        points = []
        for part in parts:
            a, b, c, d, e, f = part["rest"]["matrix"]
            points += [(a*x+c*y+e, b*x+d*y+f) for x,y in
                       [(0,0),(part["width"],0),(part["width"],part["height"]),(0,part["height"])]]
        return min(x for x,y in points), min(y for x,y in points), max(x for x,y in points), max(y for x,y in points)
    all_bounds = bounds(manifest["parts"])
    body_bounds = bounds([p for p in manifest["parts"] if p["id"] not in ["weapon", "accessory"]])
    # The official importer fits the whole layout. Compensate for tall weapons
    # so actual anatomy, not a staff tip, establishes the common scene scale.
    target_size = character["height"] * max(all_bounds[2]-all_bounds[0], all_bounds[3]-all_bounds[1]) / (body_bounds[3]-body_bounds[1])
    arm, warnings = woop_importer.import_woop(bpy.context, str(directory / (character["id"] + ".woop")),
                                             "rest", target_size, .0015, True)
    assert not warnings, warnings
    meshes = {o["woop_part_id"]: o for o in bpy.context.scene.objects if o.type == "MESH"}
    assert len(meshes) == 16 and len(arm.data.bones) == 16
    # Preserve the importer-generated material as an editable alternative. The
    # flat preview preserves our original alpha, including pale hair and robes.
    for name, obj in meshes.items():
        official = obj.data.materials[0]
        official.name = "OfficialPreset_" + name
        official.use_fake_user = True
        texture = next(n for n in official.node_tree.nodes if n.type == "TEX_IMAGE")
        imported_image = texture.image
        image = bpy.data.images.load(str(directory / "parts" / (name + ".png")), check_existing=False)
        image.pack()
        texture.image = image
        bpy.data.images.remove(imported_image)
        obj.data.materials.clear()
        obj.data.materials.append(flat_material("PuppetPreview_" + name, image))
    arm["cfgcn_original_art"] = True
    arm["cfgcn_direction_status"] = "Right side and mirrored left; no front/back set"
    arm["cfgcn_review_status"] = "Resource study; visual review pending"
    arm["cfgcn_proportion_profile"] = json.dumps(character["proportions"], ensure_ascii=False)
    animate(arm, meshes, character["proportions"])
    render_studies(arm, directory, character["height"])
    bpy.context.scene.frame_start, bpy.context.scene.frame_end = 0, 60
    bpy.ops.wm.save_as_mainfile(filepath=str(directory / (character["id"] + ".blend")))

    atlas, regions = pack_atlas(directory, manifest["parts"])
    source_width, source_height = 1254,1254
    # Use an exporter-recognized node arrangement; unlit + cutout are then
    # encoded explicitly in glTF rather than relying on arbitrary shader nodes.
    shared = bpy.data.materials.new("ShadowPuppet_" + character["id"])
    shared.use_nodes = True
    shared.use_backface_culling = False
    shared.surface_render_method = "DITHERED"
    shader = shared.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Roughness"].default_value = 1.
    tex = shared.node_tree.nodes.new("ShaderNodeTexImage")
    tex.image = atlas
    shared.node_tree.links.new(tex.outputs["Color"], shader.inputs["Base Color"])
    shared.node_tree.links.new(tex.outputs["Alpha"], shader.inputs["Alpha"])
    for part in manifest["parts"]:
        mesh = meshes[part["id"]].data
        x0, y0, x1, y1 = regions[part["id"]]
        for loop in mesh.uv_layers.active.data:
            u, v = loop.uv
            loop.uv = ((x0 + u * (x1 - x0)) / 1024,
                       (y0 + v * (y1 - y0)) / 1024)
        mesh.materials.clear()
        mesh.materials.append(shared)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes.values():
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes["body"]
    bpy.ops.object.join()
    joined = bpy.context.object
    joined.name = "ShadowPuppet_" + character["id"]
    arm.select_set(True)
    path = directory / (character["id"] + ".glb")
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", use_selection=True,
                              export_animations=True, export_animation_mode="ACTIONS",
                              export_force_sampling=True, export_yup=True, export_skins=True)
    raw = path.read_bytes()
    length = struct.unpack_from("<I", raw, 12)[0]
    doc = json.loads(raw[20:20 + length])
    actions = {a["name"]: a for a in doc["animations"]}
    doc["animations"] = [actions[n] for n in ["Idle", "Walk", "RestPose"]]
    assert len(doc["materials"]) == 1
    for material in doc["materials"]:
        material["alphaMode"], material["alphaCutoff"], material["doubleSided"] = "MASK", .42, True
        material.setdefault("extensions", {})["KHR_materials_unlit"] = {}
    doc["extensionsUsed"] = sorted(set(doc.get("extensionsUsed", []) + ["KHR_materials_unlit"]))
    encoded = json.dumps(doc, separators=(",", ":")).encode()
    encoded += b" " * (-len(encoded) % 4)
    binary = raw[20 + length:]
    packed = struct.pack("<4sII", b"glTF", 2, 20 + len(encoded) + len(binary))
    packed += struct.pack("<I4s", len(encoded), b"JSON") + encoded + binary
    path.write_bytes(packed)
    report = {"id": character["id"], "name": character["name"], "status": "resource study; visual review pending",
              "source": "OpenAI built-in image_gen; original art", "source_image": "parts-source.png",
              "source_sha256": hashlib.sha256((directory / "parts-source.png").read_bytes()).hexdigest(),
              "prompt": "prompt.txt", "woop": character["id"] + ".woop", "editable": character["id"] + ".blend",
              "runtime": path.name, "runtime_sha256": hashlib.sha256(packed).hexdigest(), "runtime_bytes": len(packed),
              "texture_size": list(atlas.size), "source_texture_size": [source_width, source_height],
              "parts": 16, "joints": 15, "bones": len(arm.data.bones), "anatomy": "chest -> abdomen -> pelvis -> thighs",
              "triangles": 32, "materials": 1, "clips": [a["name"] for a in doc["animations"]],
              "importer": "Official WooooShadow 0.8.13, loaded locally in an isolated Blender process",
              "importer_sha256": hashlib.sha256((PLUGIN / "woop_importer/__init__.py").read_bytes()).hexdigest(),
              "blender": bpy.app.version_string, "directions": ["side-right", "mirrored-side-left"],
              "tripo": "Not used: direct original 2D puppet artwork", "in_game": False,
              "version": 4, "nominal_body_height": character["height"], "proportions": character["proportions"],
              "weapon_source":"weapon-source.png", "weapon_prompt":"weapon-prompt.txt",
              "weapon_source_sha256":hashlib.sha256((directory/"weapon-source.png").read_bytes()).hexdigest(),
              "lower_body_source":"lower-body-source.png", "lower_body_prompt":"lower-body-prompt.txt",
              "lower_body_source_sha256":hashlib.sha256((directory/"lower-body-source.png").read_bytes()).hexdigest(),
              "weapon_body_ratio":character["weapon_body_ratio"], "runtime_atlas":"runtime-atlas.png",
              "walk_distance":float(arm["cfgcn_walk_distance"]), "walk_duty":float(arm["cfgcn_walk_duty"]),
              "walk_period":float(arm["cfgcn_walk_period"]),
              "revision": "Exact longitudinal joint mapping, forward knees, double support, heel/toe roll and individually redrawn weapons"}
    (directory / "manifest.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("BUILT", character["id"], len(packed), "bytes", len(doc["skins"][0]["joints"]), "skin joints")
    return report


if __name__ == "__main__":
    requested = set(sys.argv[sys.argv.index("--") + 1:]) if "--" in sys.argv else set()
    reports = [build(c) for c in ROSTER if not requested or c["id"] in requested]
    if not requested:
        (HERE / "manifest.json").write_text(json.dumps({"characters": reports, "status": "resource studies; review pending"},
                                                       ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
