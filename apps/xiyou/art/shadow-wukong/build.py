"""Build the original imagegen cutout as a rigid, planar shadow-puppet rig.

No third-party add-on, Tripo regeneration or source-image repaint is involved.
UV windows select the atlas parts; foot/shin windows overlap at the ankle.
Run with Blender --background --factory-startup --python <this file>.
"""
from pathlib import Path
import hashlib
import json
import math
import struct

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
OUT = ROOT / "apps/website/public/games/xiyou/assets"
SOURCE = HERE / "parts-source.png"

# Pixel coordinates are measured on the accepted 1448 x 1086 generated atlas.
# name, parent, pivot (x,z), bone end (x,z), UV rectangle, proximal pixel,
# distal pixel (optional: aligns a limb to its bone), depth, width correction
PARTS = [
    ("tail", "body", (-.18, 1.08), (-.18, .78), (771, 735, 1073, 1018), (1041, 985), None, .045, 1.),
    ("thigh.back", "body", (-.10, 1.08), (-.10, .57), (848, 372, 1007, 688), (881, 410), (941, 653), .030, 1.),
    ("shin.back", "thigh.back", (-.10, .57), (-.10, .15), (1215, 374, 1337, 615), (1261, 409), (1264, 600), .030, 1.),
    ("foot.back", "shin.back", (-.10, .15), (.12, .15), (1222, 590, 1389, 685), (1263, 600), None, .026, 1.),
    ("upper_arm.back", "body", (-.13, 1.67), (-.13, 1.22), (844, 18, 983, 255), (875, 56), (955, 219), .022, 1.),
    ("forearm.back", "upper_arm.back", (-.13, 1.22), (-.13, .82), (1223, 9, 1341, 358), (1256, 45), (1308, 310), .018, 1.),
    ("body", "root", (0., 1.08), (0., 1.73), (451, 11, 709, 355), (579, 289), None, 0., 1.),
    ("thigh.front", "body", (.10, 1.08), (.10, .57), (122, 724, 249, 1036), (184, 759), (202, 997), -.015, 1.),
    ("shin.front", "thigh.front", (.10, .57), (.10, .15), (495, 724, 617, 970), (536, 763), (547, 958), -.020, 1.),
    ("foot.front", "shin.front", (.10, .15), (.32, .15), (500, 933, 673, 1043), (547, 958), None, -.023, 1.),
    ("head", "body", (0., 1.76), (0., 2.16), (47, 34, 345, 335), (166, 305), None, -.028, 1.),
    ("upper_arm.front", "body", (.14, 1.65), (.14, 1.20), (115, 376, 257, 611), (222, 407), (150, 566), -.036, 1.),
    ("forearm.front", "upper_arm.front", (.14, 1.20), (.14, .80), (522, 373, 616, 695), (571, 407), (576, 650), -.040, 1.),
    ("staff", "forearm.front", (.14, .80), (.14, 1.10), (1256, 720, 1296, 1053), (1276, 940), None, -.050, .34),
]
SCALES = {"head": .00235, "body": .00245, "tail": .0025,
          "foot.back": .00188, "foot.front": .00188, "staff": .00735}


def world_rotation(bone, angle):
    """Rotate about the drawing plane normal, expressed in each bone's axes."""
    axis = bone.bone.matrix_local.to_quaternion().inverted() @ Vector((0., 1., 0.))
    from mathutils import Quaternion
    bone.rotation_quaternion = Quaternion(axis, angle)


def translate(bone, value):
    bone.location = bone.bone.matrix_local.to_quaternion().inverted() @ Vector(value)


def gait_foot(phase, side):
    cycle = (phase + side * .5) % 1.
    stance = .32
    span = 3.2 * stance
    if cycle < stance:
        return span / 2 - 3.2 * cycle, .022
    u = (cycle - stance) / (1 - stance)
    ease = u * u * (3 - 2 * u)
    return -span / 2 + span * ease, .022 + .20 * math.sin(math.pi * u)


def leg_pose(arm, side, target, hip_height):
    x, z = target
    l1, l2 = .51, .42
    hip_x = .10 if side == "front" else -.10
    # The foot's painted sole lies .13 below its ankle pivot.
    dx, dz = x, z + .13 - hip_height
    d = min(math.hypot(dx, dz), l1 + l2 - .001)
    bend = math.acos(max(-1., min(1., (d * d - l1 * l1 - l2 * l2) / (2 * l1 * l2))))
    angle = math.atan2(-dx, -dz) + math.atan2(l2 * math.sin(bend), l1 + l2 * math.cos(bend))
    world_rotation(arm.pose.bones["thigh." + side], angle)
    world_rotation(arm.pose.bones["shin." + side], -bend)
    # Boots stay level during contact instead of chopping through the floor.
    world_rotation(arm.pose.bones["foot." + side], bend - angle)


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = 60
    image = bpy.data.images.load(str(SOURCE))
    width, height = image.size
    assert (width, height) == (1448, 1086), "Atlas must be remeasured after a source change"
    image.pack()
    material = bpy.data.materials.new("ShadowPuppet_Wukong")
    material.use_nodes = True
    material.diffuse_color = (1., 1., 1., 1.)
    material.use_backface_culling = False
    material.surface_render_method = "DITHERED"
    nodes = material.node_tree.nodes
    shader = nodes.get("Principled BSDF")
    shader.inputs["Roughness"].default_value = 1.
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = image
    material.node_tree.links.new(texture.outputs["Color"], shader.inputs["Base Color"])
    material.node_tree.links.new(texture.outputs["Alpha"], shader.inputs["Alpha"])

    bpy.ops.object.armature_add(enter_editmode=True)
    arm = bpy.context.object
    arm.name = "Shadow Wukong Rig"
    arm.data.name = "ShadowWukongJoints"
    arm.data.edit_bones.remove(arm.data.edit_bones[0])
    root = arm.data.edit_bones.new("root")
    root.head, root.tail = (0., 0., 0.), (0., 0., .3)
    root.align_roll(Vector((0., 1., 0.)))
    for name, _parent, pivot, tail, _rect, _prox, _dist, _depth, _width in PARTS:
        bone = arm.data.edit_bones.new(name)
        bone.head, bone.tail = (pivot[0], 0., pivot[1]), (tail[0], 0., tail[1])
        bone.align_roll(Vector((0., 1., 0.)))
    for name, parent, *_ in PARTS:
        arm.data.edit_bones[name].parent = arm.data.edit_bones[parent]
        arm.data.edit_bones[name].use_connect = False
    bpy.ops.object.mode_set(mode="OBJECT")

    vertices, faces, texcoords, groups = [], [], [], []
    for name, _parent, pivot, tail, rect, prox, dist, depth, width_factor in PARTS:
        if dist is not None:
            source = Vector((dist[0] - prox[0], -(dist[1] - prox[1])))
            target = Vector((tail[0] - pivot[0], tail[1] - pivot[1]))
            scale = target.length / source.length
            angle = math.atan2(target.y, target.x) - math.atan2(source.y, source.x)
        else:
            scale, angle = SCALES[name], 0.
        x0, y0, x1, y1 = rect
        pixels = [(x0, y1), (x1, y1), (x1, y0), (x0, y0)]
        start = len(vertices)
        for x, y in pixels:
            dx, dz = (x - prox[0]) * scale * width_factor, -(y - prox[1]) * scale
            vertices.append((pivot[0] + dx * math.cos(angle) - dz * math.sin(angle),
                             depth, pivot[1] + dx * math.sin(angle) + dz * math.cos(angle)))
            texcoords.append((x / width, 1. - y / height))
        faces.append((start, start + 1, start + 2, start + 3))
        groups.append((name, list(range(start, start + 4))))
    mesh = bpy.data.meshes.new("ShadowWukongPlanarParts")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new("Shadow puppet Wukong", mesh)
    scene.collection.objects.link(obj)
    obj.data.materials.append(material)
    uv = mesh.uv_layers.new(name="UVMap")
    for face in mesh.polygons:
        for loop_index in face.loop_indices:
            uv.data[loop_index].uv = texcoords[mesh.loops[loop_index].vertex_index]
    for name, indices in groups:
        obj.vertex_groups.new(name=name).add(indices, 1., "REPLACE")
    obj.parent = arm
    modifier = obj.modifiers.new("Rigid shadow joints", "ARMATURE")
    modifier.object = arm
    obj["asset_status"] = "Original flat shadow-puppet movement sample, pending visual review"
    obj["atlas_source_sha256"] = hashlib.sha256(SOURCE.read_bytes()).hexdigest()

    for name in ["Idle", "Walk", "RestPose"]:
        action = bpy.data.actions.new(name)
        action.use_fake_user = True
        arm.animation_data_create()
        arm.animation_data.action = action
        for frame in range(61):
            scene.frame_set(frame)
            phase = frame / 60.
            for bone in arm.pose.bones:
                bone.rotation_mode = "QUATERNION"
                bone.rotation_quaternion = (1., 0., 0., 0.)
                bone.location = (0., 0., 0.)
            if name == "Walk":
                bob = -.19 + .022 * (1 - math.cos(phase * 4 * math.pi))
                translate(arm.pose.bones["root"], (0., 0., bob))
                for side, offset in [("front", 0), ("back", 1)]:
                    leg_pose(arm, side, gait_foot(phase, offset), 1.08 + bob)
                swing = math.sin(phase * 2 * math.pi)
                world_rotation(arm.pose.bones["upper_arm.back"], -.15 - swing * .22)
                world_rotation(arm.pose.bones["forearm.back"], -.18)
                world_rotation(arm.pose.bones["upper_arm.front"], -.31 + swing * .06)
                world_rotation(arm.pose.bones["forearm.front"], .23)
                world_rotation(arm.pose.bones["head"], .025 * swing)
                world_rotation(arm.pose.bones["tail"], .075 * swing)
                world_rotation(arm.pose.bones["staff"], .22 + .025 * swing)
            else:
                breath = math.sin(phase * 2 * math.pi) if name == "Idle" else 0.
                translate(arm.pose.bones["body"], (0., 0., breath * .009))
                world_rotation(arm.pose.bones["upper_arm.front"], -.30)
                world_rotation(arm.pose.bones["forearm.front"], .23)
                world_rotation(arm.pose.bones["upper_arm.back"], -.12)
                world_rotation(arm.pose.bones["forearm.back"], -.18)
                world_rotation(arm.pose.bones["tail"], .018 * breath)
                world_rotation(arm.pose.bones["staff"], .22)
            for bone in arm.pose.bones:
                bone.keyframe_insert("rotation_quaternion", frame=frame, group=bone.name)
                bone.keyframe_insert("location", frame=frame, group=bone.name)
        arm.animation_data.action = None

    scene.frame_set(0)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    obj.select_set(True)
    scene.frame_start, scene.frame_end = 0, 60
    # The blend contains the original packed artwork and independent rigid parts.
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE / "shadow-wukong.blend"))
    runtime_image = image.copy()
    runtime_image.name = "ShadowWukongRuntimeAtlas"
    runtime_image.scale(1024, 768)
    runtime_image.filepath_raw = ""
    runtime_image.pack()
    texture.image = runtime_image
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / "shadow_wukong.glb"
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", use_selection=True,
                              export_animations=True, export_animation_mode="ACTIONS",
                              export_force_sampling=True, export_yup=True,
                              export_image_format="AUTO", export_skins=True)
    raw = path.read_bytes()
    json_length = struct.unpack_from("<I", raw, 12)[0]
    document = json.loads(raw[20:20 + json_length])
    animations = {a["name"]: a for a in document.get("animations", [])}
    document["animations"] = [animations[n] for n in ["Idle", "Walk", "RestPose"]]
    for mat in document["materials"]:
        mat["alphaMode"], mat["alphaCutoff"], mat["doubleSided"] = "MASK", .42, True
        mat.setdefault("extensions", {})["KHR_materials_unlit"] = {}
    document.setdefault("extensionsUsed", []).append("KHR_materials_unlit")
    packed_json = json.dumps(document, separators=(",", ":")).encode()
    packed_json += b" " * (-len(packed_json) % 4)
    binary = raw[20 + json_length:]
    updated = (struct.pack("<4sII", b"glTF", 2, 20 + len(packed_json) + len(binary))
               + struct.pack("<I4s", len(packed_json), b"JSON") + packed_json + binary)
    path.write_bytes(updated)
    manifest = {
        "status": "movement sample; visual review pending",
        "source": "OpenAI built-in image_gen; original generated flat artwork",
        "source_file": "parts-source.png",
        "source_sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        "prompt_file": "prompt.txt",
        "editable": "shadow-wukong.blend",
        "generator": "Blender " + bpy.app.version_string,
        "runtime": "shadow_wukong.glb",
        "runtime_sha256": hashlib.sha256(updated).hexdigest(),
        "bytes": len(updated), "triangles": len(PARTS) * 2,
        "rigid_parts": len(PARTS), "bones": len(PARTS) + 1,
        "materials": len(document["materials"]),
        "animations": [a["name"] for a in document["animations"]],
        "source_texture_size": [width, height],
        "texture_size": list(runtime_image.size),
        "tripo": "Not used: this is original 2D artwork with rigid planar parts",
        "third_party_addons": "None",
    }
    (HERE / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("SHADOW_WUKONG " + json.dumps(manifest, ensure_ascii=False))


if __name__ == "__main__":
    build()
