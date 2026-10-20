"""Re-import the delivered GLB and check actual exported deformation in Blender."""
import bpy
import json
import math
import argparse
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--asset', choices=['wukong', 'monk', 'wolf', 'white_dragon', 'river_dragon', 'riverling'], default='wukong')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
OUT = ROOT / '.local/qa' / f'{args.asset}-runtime'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT / f'apps/website/public/games/xiyou/assets/{args.asset}.glb'))
arm = next(obj for obj in bpy.context.scene.objects if obj.type == 'ARMATURE')
shapes = {bone.custom_shape for bone in arm.pose.bones if bone.custom_shape}
meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH' and obj not in shapes]
manifest = json.loads((ROOT / 'apps/website/public/games/xiyou/assets/manifest.json').read_text(encoding='utf-8'))
assert len(arm.data.bones) == next(entry['bones'] for entry in manifest['assets'] if entry['asset'] == args.asset)
expected = next(entry['clips'] for entry in manifest['assets'] if entry['asset'] == args.asset)
assert {action.name for action in bpy.data.actions} == set(expected)
for track in arm.animation_data.nla_tracks:
    track.mute = True
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.render.resolution_x = 640
scene.render.resolution_y = 800
scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new('Runtime inspection world')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.32, .36, .33, 1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .7
target = Vector((0, 0, 1.15))
for name, position, energy in [('Key', (-3, -4, 5), 500), ('Fill', (3, -2, 3), 220)]:
    light = bpy.data.lights.new(name, 'AREA')
    light.energy, light.size = energy, 4
    obj = bpy.data.objects.new(name, light)
    scene.collection.objects.link(obj)
    obj.location = position
    obj.rotation_euler = (target - obj.location).to_track_quat('-Z', 'Y').to_euler()
camera_data = bpy.data.cameras.new('Runtime inspection camera')
camera_data.type, camera_data.ortho_scale = 'ORTHO', 6.5 if args.asset == 'river_dragon' else 3.6
camera = bpy.data.objects.new('Runtime inspection camera', camera_data)
scene.collection.objects.link(camera)
camera.location = (3, -6, 2.8)
camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
scene.camera = camera
report = []
reference = None
for name in expected:
    action = bpy.data.actions[name]
    arm.animation_data.action = action
    arm.animation_data.action_slot = action.slots[0]
    start, end = action.frame_range
    samples = []
    for fraction in (0, .25, .5, .75, 1):
        scene.frame_set(int(start + (end - start) * fraction))
        depsgraph = bpy.context.evaluated_depsgraph_get()
        positions = []
        for obj in meshes:
            evaluated = obj.evaluated_get(depsgraph)
            mesh = evaluated.to_mesh()
            positions.extend([obj.matrix_world @ vertex.co for vertex in mesh.vertices])
            evaluated.to_mesh_clear()
        assert all(math.isfinite(value) for p in positions for value in p), name
        low = [min(p[i] for p in positions) for i in range(3)]
        high = [max(p[i] for p in positions) for i in range(3)]
        assert all(high[i] - low[i] < (8. if args.asset == 'river_dragon' else 4.8) for i in range(3)), f'{name}: stretched skin'
        assert low[2] > -.12, f'{name}: penetrates floor by {low[2]}'
        if reference is None:
            reference = positions
        displacement = sum((a - b).length for a, b in zip(reference, positions)) / len(positions)
        samples.append({'fraction': fraction, 'bounds_min': low, 'bounds_max': high,
                        'mean_displacement_from_idle': displacement})
    if name != 'Idle':
        minimum = .03 if args.asset == 'wukong' else .008
        assert max(sample['mean_displacement_from_idle'] for sample in samples) > minimum, f'{name}: motion missing'
    report.append({'clip': name, 'frames': [start, end], 'samples': samples})
    scene.frame_set(int(start + (end - start) * (.5 if name != 'Idle' else 0)))
    scene.render.filepath = str(OUT / (name.lower() + '.png'))
    bpy.ops.render.render(write_still=True)
(OUT / 'motion.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print('CFGCN_RUNTIME_MOTION_OK ' + json.dumps(report, ensure_ascii=False))
