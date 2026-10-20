"""Finish the accepted Studio Wukong mesh, rig, animate and export web assets.

Uses the immutable Studio GLB, not a generated picture or procedural substitute.
Run with Blender --background --factory-startup --python-exit-code 1 --python
apps/xiyou/art/build_wukong.py. Output budgets are checked before publication.
"""
import bpy
import bmesh
import hashlib
import importlib.util
import json
import math
import shutil
import statistics
import struct
from pathlib import Path

from mathutils import Matrix, Quaternion, Vector

ROOT = Path(__file__).resolve().parents[3]
ART = Path(__file__).parent
SOURCE = ART / 'source'
RAW = SOURCE / 'raw/wukong-studio-p2-source.glb'
OUT = ROOT / 'apps/website/public/games/xiyou/assets'
QA = ROOT / '.local/qa/wukong-finished'
RAW_HASH = '682e7b7eb3afb530bea5f3cc9a92a4fd4c5193f63ddf85e693078bb6b451e774'
FPS = 30
CLIPS = [('Idle', 60), ('Walk', 10), ('Strike', 15)]
STATS = {}


def clamp(x, low=0., high=1.):
    return max(low, min(high, x))


def smooth(x):
    t = clamp(x)
    return t * t * (3 - 2 * t)


def segment_distance(point, a, b):
    delta = b - a
    t = clamp((point - a).dot(delta) / delta.length_squared)
    return (point - a - delta * t).length


def prepare_geometry():
    if hashlib.sha256(RAW.read_bytes()).hexdigest() != RAW_HASH:
        raise ValueError('Source changed; re-check landmarks before applying this rig')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(RAW))
    obj = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
    obj.name = 'Wukong'
    # Studio GLB has +X forward; our game uses Blender -Y forward, glTF +Z.
    obj.data.transform(obj.matrix_world)
    obj.parent = None
    obj.matrix_world = Matrix.Identity(4)
    obj.data.transform(Matrix.Rotation(-math.pi / 2, 4, 'Z'))
    verts = obj.data.vertices
    low = min(v.co.z for v in verts)
    scale = 2.4 / (max(v.co.z for v in verts) - low)
    obj.data.transform(Matrix.Scale(scale, 4))
    # The long tail biases the whole bounding box. Center on both ankle cuffs.
    ankles = [v.co for v in verts if .19 < v.co.z < .29]
    center = Vector(((min(p.x for p in ankles) + max(p.x for p in ankles)) * .5,
                     statistics.median(p.y for p in ankles), low * scale))
    STATS['normalization_center'] = list(center)
    obj.data.transform(Matrix.Translation(-center))
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.000025)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.validate(verbose=False)
    obj.data.update()
    STATS['clean_vertices'] = len(obj.data.vertices)
    STATS['source_triangles'] = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    # Shorten the generated tail gently, retaining its curl and a root blend.
    for vertex in obj.data.vertices:
        p = vertex.co
        if p.y > .32 and p.z < 1.05:
            p.y = .32 + (p.y - .32) * (1 - .24 * smooth((p.y - .32) / .25))
    mat = obj.data.materials[0]
    mat.name = 'Wukong painted cloth and fur'
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Metallic'].default_value = 0
    bsdf.inputs['Roughness'].default_value = .78
    obj.data.update()
    return obj


def make_rig():
    definitions = [
        ('root', (0, 0, 0), (0, 0, .18), None),
        ('hips', (0, 0, 1.16), (0, 0, 1.32), 'root'),
        ('spine', (0, 0, 1.32), (0, 0, 1.48), 'hips'),
        ('chest', (0, 0, 1.48), (0, .01, 1.69), 'spine'),
        ('neck', (0, .01, 1.69), (0, .015, 1.85), 'chest'),
        ('head', (0, .015, 1.85), (0, .015, 2.29), 'neck'),
    ]
    for side, sign in [('L', 1), ('R', -1)]:
        definitions.extend([
            ('shoulder.' + side, (sign * .06, 0, 1.65), (sign * .32, 0, 1.64), 'chest'),
            ('upper_arm.' + side, (sign * .32, 0, 1.64), (sign * .52, -.025, 1.44), 'shoulder.' + side),
            ('forearm.' + side, (sign * .52, -.025, 1.44), (sign * .64, -.08, 1.28), 'upper_arm.' + side),
            ('hand.' + side, (sign * .64, -.08, 1.28), (sign * .70, -.10, 1.12), 'forearm.' + side),
            ('fingers.' + side, (sign * .70, -.10, 1.12), (sign * .72, -.10, .98), 'hand.' + side),
            ('thumb.' + side, (sign * .62, -.13, 1.21), (sign * .59, -.16, 1.10), 'hand.' + side),
            ('thigh.' + side, (sign * .20, .015, 1.16), (sign * .28, -.005, .64), 'hips'),
            ('shin.' + side, (sign * .28, -.005, .64), (sign * .30, 0, .24), 'thigh.' + side),
            ('foot.' + side, (sign * .30, 0, .24), (sign * .41, -.15, .08), 'shin.' + side),
        ])
    tail = [(0, .20, .94), (0, .43, .76), (0, .72, .51),
            (0, 1.04, .36), (0, 1.35, .43), (0, 1.48, .69), (0, 1.30, .74)]
    for i in range(len(tail) - 1):
        definitions.append((f'tail.{i + 1}', tail[i], tail[i + 1], 'hips' if i == 0 else f'tail.{i}'))
    definitions.extend([
        ('sash.1', (.06, -.25, 1.25), (.10, -.27, 1.02), 'hips'),
        ('sash.2', (.10, -.27, 1.02), (.22, -.30, .79), 'sash.1'),
    ])
    data = bpy.data.armatures.new('Wukong travel rig')
    arm = bpy.data.objects.new('WukongRig', data)
    bpy.context.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for name, head, tail, parent in definitions:
        bone = data.edit_bones.new(name)
        bone.head, bone.tail = head, tail
        if parent:
            bone.parent = data.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    arm.show_in_front = True
    for bone in arm.pose.bones:
        bone.rotation_mode = 'QUATERNION'
    return arm


def weighted_segments(point, arm, names, sigma=.11):
    distances = [(name, segment_distance(point, arm.data.bones[name].head_local,
                                        arm.data.bones[name].tail_local)) for name in names]
    nearest = min(d for _, d in distances)
    weights = {name: math.exp(-((d - nearest) / sigma) ** 2) for name, d in distances}
    weights = dict(sorted(weights.items(), key=lambda pair: -pair[1])[:4])
    total = sum(weights.values())
    return {name: value / total for name, value in weights.items() if value / total > .015}


def bind_mesh(obj, arm):
    groups = {bone.name: obj.vertex_groups.new(name=bone.name) for bone in arm.data.bones}
    for vertex in obj.data.vertices:
        p = vertex.co
        side = 'L' if p.x >= 0 else 'R'
        if p.y > .32 and p.z < 1.04:
            weights = weighted_segments(p, arm, ['hips'] + [f'tail.{i}' for i in range(1, 7)], .065)
        elif p.z > 1.91:
            weights = {'head': 1.}
        elif p.z > 1.76:
            head = smooth((p.z - 1.76) / .15)
            weights = {'head': head, 'neck': 1 - head}
        elif p.z > .94 and abs(p.x) > .32 and (p.z > 1.2 or abs(p.x) > .53):
            names = [f'{part}.{side}' for part in ('shoulder', 'upper_arm', 'forearm', 'hand')]
            if p.z < 1.16 and abs(p.x) > .64:
                names = [f'hand.{side}', f'fingers.{side}']
            elif p.z < 1.23 and abs(p.x) < .64:
                names += [f'thumb.{side}']
            weights = weighted_segments(p, arm, names, .065)
        elif p.y < -.23 and .78 < p.z < 1.24 and -.13 < p.x < .34:
            weights = weighted_segments(p, arm, ['hips', 'sash.1', 'sash.2'], .07)
        elif p.z < .19:
            weights = {f'foot.{side}': 1.}
        elif p.z < .30:
            shin = smooth((p.z - .19) / .11)
            weights = {f'foot.{side}': 1 - shin, f'shin.{side}': shin}
        elif p.z < 1.16:
            names = ['hips'] + [f'{part}.{side}' for part in ('thigh', 'shin', 'foot')]
            weights = weighted_segments(p, arm, names, .07)
            if p.z > .79 and (abs(p.x) > .36 or p.y < -.18 or p.y > .22):
                # Outer tiger wrap follows the waist with a limited leg influence.
                thigh = smooth((1.16 - p.z) / .5) * .55
                weights = {'hips': 1 - thigh, f'thigh.{side}': thigh}
        else:
            weights = weighted_segments(p, arm, ['hips', 'spine', 'chest', 'neck'], .10)
        total = sum(weights.values())
        for name, weight in weights.items():
            if weight > 0:
                groups[name].add([vertex.index], weight / total, 'REPLACE')
    modifier = obj.modifiers.new('Wukong skin', 'ARMATURE')
    modifier.object = arm
    obj.parent = arm
    return obj


def material(name, color, metallic, roughness):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    return mat


def make_staff(arm):
    dark = material('Staff dark iron', (.055, .075, .060), .65, .4)
    gold = material('Staff aged gold', (.63, .36, .075), .75, .35)
    pieces = []
    for name, z, depth, radius, mat in [
        ('Iron staff', 1.16, 2.25, .026, dark),
        ('Lower gold tip', .08, .16, .038, gold),
        ('Upper gold tip', 2.24, .16, .038, gold),
        ('Lower gold ring', .24, .035, .032, gold),
        ('Upper gold ring', 2.08, .035, .032, gold),
    ]:
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=radius, depth=depth,
                                          location=(-.69, -.16, z + .05))
        obj = bpy.context.object
        obj.name = name
        obj.data.materials.append(mat)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        group = obj.vertex_groups.new(name='hand.R')
        group.add(list(range(len(obj.data.vertices))), 1., 'REPLACE')
        for face in obj.data.polygons:
            face.use_smooth = True
        pieces.append(obj)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in pieces:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = pieces[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = 'Ruyi staff'
    modifier = obj.modifiers.new('Hand attachment', 'ARMATURE')
    modifier.object = arm
    obj.parent = arm
    return obj


def set_world_rotation(bone, desired):
    rest = bone.bone.matrix_local.to_quaternion()
    if bone.parent:
        relative = bone.parent.bone.matrix_local.to_quaternion().inverted() @ rest
        bone.rotation_quaternion = relative.inverted() @ bone.parent.matrix.to_quaternion().inverted() @ desired
    else:
        bone.rotation_quaternion = rest.inverted() @ desired
    bpy.context.view_layer.update()


def aim(bone, direction):
    rest_direction = bone.bone.tail_local - bone.bone.head_local
    delta = rest_direction.rotation_difference(direction.normalized())
    set_world_rotation(bone, delta @ bone.bone.matrix_local.to_quaternion())


def solve_limb(arm, upper_name, lower_name, end_name, target, pole):
    upper, lower, end = [arm.pose.bones[name] for name in (upper_name, lower_name, end_name)]
    start = upper.head.copy()
    target = Vector(target)
    direction = target - start
    l1, l2 = upper.bone.length, lower.bone.length
    length = clamp(direction.length, abs(l1 - l2) + .001, l1 + l2 - .001)
    axis = direction.normalized()
    bend = Vector(pole)
    bend = (bend - axis * bend.dot(axis)).normalized()
    along = (l1 * l1 - l2 * l2 + length * length) / (2 * length)
    knee = start + axis * along + bend * math.sqrt(max(0, l1 * l1 - along * along))
    end_point = start + axis * length
    aim(upper, knee - start)
    aim(lower, end_point - knee)
    return end


def pose(arm, clip, t):
    for bone in arm.pose.bones:
        bone.location = (0, 0, 0)
        bone.rotation_quaternion = Quaternion()
        bone.scale = (1, 1, 1)
    phase = t * math.tau
    root = arm.pose.bones['root']
    running = clip == 'Walk'
    root.location.z = -.13 + .025 * math.cos(phase * 2) if running else .006 * math.sin(phase)
    if running:
        arm.pose.bones['chest'].rotation_quaternion = Quaternion((1, 0, 0), -.14)
    else:
        arm.pose.bones['chest'].rotation_quaternion = Quaternion((1, 0, 0), .012 * math.sin(phase))
    strike = clip == 'Strike'
    if strike:
        # Anticipation -> fast contact -> follow-through -> recovery.
        keys = [(0., -.08), (.25, -.5), (.48, .58), (.67, .8), (1., -.08)]
        yaw = interpolate(keys, t)
        arm.pose.bones['hips'].rotation_quaternion = Quaternion((0, 0, 1), yaw * .28)
        arm.pose.bones['chest'].rotation_quaternion = Quaternion((0, 0, 1), yaw * .72)
        root.location.z = -.04 * math.sin(t * math.pi)
    bpy.context.view_layer.update()
    for side, sign in [('L', 1), ('R', -1)]:
        if running:
            cycle = (t + (0 if side == 'L' else .5)) % 1
            if cycle < .5:
                y = -.53 + cycle * 2 * 1.06
                lift = 0
            else:
                swing = (cycle - .5) * 2
                y = .53 - swing * 1.06
                lift = .25 * math.sin(swing * math.pi)
            ankle = (sign * .30, y, .24 + lift)
        else:
            ankle = (sign * .30, 0, .24)
        foot = solve_limb(arm, 'thigh.' + side, 'shin.' + side, 'foot.' + side,
                          ankle, (0, -1, 0))
        foot_pitch = .13 * math.sin(phase + (0 if side == 'L' else math.pi)) if running else 0
        set_world_rotation(foot, Quaternion((1, 0, 0), foot_pitch) @ foot.bone.matrix_local.to_quaternion())
        wrist = Vector((sign * .44, -.17, 1.24))
        direction = Vector((0, 0, 1))
        if running:
            wrist.y += .13 * math.sin(phase) * sign
            wrist.z += .05 * math.cos(phase) * sign
            direction = Vector((-.10, .17 * math.sin(phase), 1)).normalized()
        elif strike:
            if side == 'R':
                wrist = Vector(interpolate([
                    (0, (-.44, -.17, 1.24)), (.25, (-.48, .05, 1.48)),
                    (.48, (-.12, -.42, 1.45)), (.67, (.14, -.37, 1.27)),
                    (1, (-.44, -.17, 1.24))], t))
                direction = Vector(interpolate([
                    (0, (0, 0, 1)), (.25, (-.62, .1, .78)),
                    (.48, (.85, -.42, .24)), (.67, (.85, .22, -.12)),
                    (1, (0, 0, 1))], t)).normalized()
            else:
                wrist = Vector(interpolate([
                    (0, (.44, -.17, 1.24)), (.25, (.40, -.18, 1.48)),
                    (.48, (.25, -.37, 1.46)), (.67, (.43, -.2, 1.35)),
                    (1, (.44, -.17, 1.24))], t))
        hand = solve_limb(arm, 'upper_arm.' + side, 'forearm.' + side, 'hand.' + side,
                          wrist, (sign, -.5, -.1))
        delta = Vector((0, 0, 1)).rotation_difference(direction) if side == 'R' else Quaternion((0, 0, 1), -.12)
        set_world_rotation(hand, delta @ hand.bone.matrix_local.to_quaternion())
        arm.pose.bones['fingers.' + side].rotation_quaternion = Quaternion((1, 0, 0), -.85 if side == 'R' else -.25)
        arm.pose.bones['thumb.' + side].rotation_quaternion = Quaternion((0, 0, 1), .35 * sign)
    for i in range(1, 7):
        arm.pose.bones[f'tail.{i}'].rotation_quaternion = Quaternion((0, 0, 1),
            (.035 if running else .022) * math.sin(phase - i * .5))
    arm.pose.bones['sash.1'].rotation_quaternion = Quaternion((1, 0, 0), .08 * math.sin(phase))
    arm.pose.bones['sash.2'].rotation_quaternion = Quaternion((1, 0, 0), .10 * math.sin(phase - .6))
    bpy.context.view_layer.update()


def interpolate(keys, t):
    for (a, first), (b, second) in zip(keys, keys[1:]):
        if a <= t <= b:
            f = smooth((t - a) / (b - a))
            if isinstance(first, tuple):
                return tuple(x * (1 - f) + y * f for x, y in zip(first, second))
            return first * (1 - f) + second * f
    return keys[-1][1]


def animate(arm):
    scene = bpy.context.scene
    scene.render.fps = FPS
    arm.animation_data_create()
    for name, length in CLIPS:
        action = bpy.data.actions.new(name)
        arm.animation_data.action = action
        for frame in range(length + 1):
            scene.frame_set(frame)
            pose(arm, name, frame / length)
            for bone in arm.pose.bones:
                bone.keyframe_insert('location', frame=frame, group=bone.name)
                bone.keyframe_insert('rotation_quaternion', frame=frame, group=bone.name)
        track = arm.animation_data.nla_tracks.new()
        track.name = name
        track.strips.new(name, 0, action)
        track.mute = True
    arm.animation_data.action = None
    for track in arm.animation_data.nla_tracks:
        track.mute = False
    scene.frame_set(0)


def prune_weights(obj):
    for vertex in obj.data.vertices:
        weights = sorted([(g.group, g.weight) for g in vertex.groups if g.weight > .001],
                         key=lambda pair: -pair[1])[:4]
        total = sum(w for _, w in weights)
        if total == 0:
            raise ValueError('Unweighted game vertex')
        for group in obj.vertex_groups:
            group.remove([vertex.index])
        for index, weight in weights:
            obj.vertex_groups[index].add([vertex.index], weight / total, 'REPLACE')


def read_glb(path):
    data = path.read_bytes()
    length = struct.unpack_from('<I', data, 12)[0]
    return json.loads(data[20:20 + length])


def export_game(obj, staff, arm, name, triangle_budget, folder=None, texture_size=2048):
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    before = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    decimate = obj.modifiers.new('Web triangle budget', 'DECIMATE')
    decimate.ratio = min(1., (triangle_budget - 250) / before)
    # Apply before the armature, preserving UVs and interpolating skin weights.
    bpy.ops.object.modifier_move_up(modifier=decimate.name)
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    prune_weights(obj)
    if obj.data.validate(verbose=False):
        STATS.setdefault('validated_decimation_repairs', []).append(name)
    obj.data.update()
    if texture_size < 2048:
        web_material = obj.data.materials[0].copy()
        web_material.name = 'Wukong web atlas'
        obj.data.materials[0] = web_material
        for node in web_material.node_tree.nodes:
            if node.type == 'TEX_IMAGE' and node.image:
                atlas = node.image.copy()
                atlas.name = 'Wukong web basecolor'
                atlas.scale(texture_size, texture_size)
                node.image = atlas
    for item in (obj, staff, arm):
        item.select_set(True)
    arm.animation_data.action = None
    for track in arm.animation_data.nla_tracks:
        track.mute = False
    bpy.context.scene.frame_set(0)
    path = (folder or OUT) / (name + '.glb')
    staged = QA / (name + '.staging.glb')
    bpy.ops.export_scene.gltf(filepath=str(staged), export_format='GLB', use_selection=True,
        export_animations=True, export_animation_mode='NLA_TRACKS', export_skins=True,
        export_apply=False, export_yup=True, export_image_format='JPEG', export_jpeg_quality=86)
    gltf = read_glb(staged)
    triangles = sum(gltf['accessors'][p['indices']]['count'] // 3 for mesh in gltf['meshes'] for p in mesh['primitives'])
    clips = [clip['name'] for clip in gltf.get('animations', [])]
    if clips != ['Idle', 'Walk', 'Strike']:
        raise ValueError('Animation order incompatible with game: ' + repr(clips))
    byte_budget = 1_000_000 if texture_size <= 1024 else 3_000_000
    if triangles > triangle_budget or staged.stat().st_size > byte_budget:
        raise ValueError('Game asset exceeds web budget')
    staged.replace(path)
    return {'asset': name, 'origin': 'tripo-studio', 'vertices': len(obj.data.vertices),
            'faces': len(obj.data.polygons), 'triangles': triangles,
            'bones': len(gltf['skins'][0]['joints']), 'clips': clips, 'bytes': path.stat().st_size,
            'source_sha256': RAW_HASH, 'texture_max': texture_size, 'triangle_budget': triangle_budget,
            'materials': len(gltf.get('materials', [])), 'source_blend': 'wukong.blend',
            'byte_budget': byte_budget, 'joint_budget': 40, 'primitive_budget': 3}


def preview(arm):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 24
    scene.render.resolution_x, scene.render.resolution_y = 640, 800
    scene.render.resolution_percentage = 100
    scene.world = bpy.data.worlds.new('Wukong preview world')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.3, .34, .32, 1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .6
    target = Vector((0, 0, 1.22))
    for name, pos, energy, size in [('Key',(-3,-4,5),450,4),('Fill',(3,-2,3),220,3),('Rim',(0,4,4),350,3)]:
        data = bpy.data.lights.new(name, 'AREA')
        data.energy, data.size = energy, size
        obj = bpy.data.objects.new(name, data)
        scene.collection.objects.link(obj)
        obj.location = pos
        obj.rotation_euler = (target - obj.location).to_track_quat('-Z','Y').to_euler()
    data = bpy.data.cameras.new('Wukong preview camera')
    data.type = 'ORTHO'
    data.ortho_scale = 3.05
    camera = bpy.data.objects.new('Wukong preview camera', data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    camera.location = (3, -6, 2.7)
    camera.rotation_euler = (target - camera.location).to_track_quat('-Z','Y').to_euler()
    for track in arm.animation_data.nla_tracks:
        track.mute = True
    for name, frame in [('Idle',0),('Walk',2),('Walk',7),('Strike',4),('Strike',7),('Strike',10)]:
        action = bpy.data.actions[name]
        arm.animation_data.action = action
        arm.animation_data.action_slot = action.slots[0]
        scene.frame_set(frame)
        scene.render.filepath = str(QA / f'{name.lower()}-{frame}.png')
        bpy.ops.render.render(write_still=True)
    arm.animation_data.action = None
    for track in arm.animation_data.nla_tracks:
        track.mute = False


def main():
    for folder in (SOURCE, OUT, QA):
        folder.mkdir(parents=True, exist_ok=True)
    # Keep the current delivery until the new export passes its structural budget.
    backup = ROOT / '.local/art-backups/wukong-blockout'
    backup.mkdir(parents=True, exist_ok=True)
    for old in (SOURCE/'wukong.blend', OUT/'wukong.glb'):
        if old.exists() and not (backup / old.name).exists():
            shutil.copy2(old, backup / old.name)
    body = prepare_geometry()
    arm = make_rig()
    bind_mesh(body, arm)
    staff = make_staff(arm)
    animate(arm)
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'wukong.blend'))
    # Keep editable full source and derive independent meshes for runtime LODs.
    source_mesh = body.data.copy()
    high = export_game(body, staff, arm, 'wukong-quality', 12_000, folder=QA)
    body.data = source_mesh.copy()
    low = export_game(body, staff, arm, 'wukong', 6_000, texture_size=1024)
    preview(arm)
    body.data = source_mesh
    bpy.data.orphans_purge(do_recursive=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'wukong.blend'))
    manifest_path = OUT / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    entries = [item for item in manifest['assets'] if item['asset'] not in ('wukong', 'wukong-lod1')]
    manifest['assets'] = [low] + entries
    manifest['generator'] = 'Blender ' + bpy.app.version_string
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    spec=importlib.util.spec_from_file_location('spell_motion',ART/'build_spell_motion.py')
    spells=importlib.util.module_from_spec(spec);spec.loader.exec_module(spells);spells.spells('wukong')
    low=next(e for e in json.loads(manifest_path.read_text(encoding='utf-8'))['assets'] if e['asset']=='wukong')
    unused_lod = OUT / 'wukong-lod1.glb'
    if unused_lod.is_file():
        unused_lod.unlink()
    report = {**STATS, 'source': RAW.name, 'sha256': RAW_HASH, 'comparison': high, 'runtime': low,
              'fps': FPS, 'clip_frames': dict(CLIPS)}
    (QA/'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print('CFGCN_WUKONG_FINISHED ' + json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
