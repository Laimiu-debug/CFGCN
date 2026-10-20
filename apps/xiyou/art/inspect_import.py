"""Inspect a downloaded model without changing the original file.

Blender --background --factory-startup --python inspect_import.py -- MODEL.glb
      --out .local/qa/wukong-import

The report keeps source coordinates; only the inspection copy is normalized.
Four renders expose the generated back, hands, feet and tail before rigging.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def bounds(objects):
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    return [min(p[i] for p in points) for i in range(3)], [max(p[i] for p in points) for i in range(3)]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('model', type=Path)
    parser.add_argument('--out', required=True, type=Path)
    parser.add_argument('--height', type=float, default=2.4)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    source = args.model.resolve(strict=True)
    output = args.out.resolve()
    output.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if source.suffix.lower() in ('.glb', '.gltf'):
        bpy.ops.import_scene.gltf(filepath=str(source))
    elif source.suffix.lower() == '.fbx':
        bpy.ops.import_scene.fbx(filepath=str(source))
    elif source.suffix.lower() == '.obj':
        bpy.ops.wm.obj_import(filepath=str(source))
    else:
        raise ValueError('Expected GLB, glTF, FBX or OBJ')
    bpy.context.view_layer.update()
    bone_shapes = {bone.custom_shape for obj in bpy.context.scene.objects if obj.type == 'ARMATURE'
                   for bone in obj.pose.bones if bone.custom_shape is not None}
    meshes = [obj for obj in bpy.context.scene.objects
              if obj.type == 'MESH' and obj not in bone_shapes]
    if not meshes:
        raise ValueError('No mesh in downloaded model')
    low, high = bounds(meshes)
    height = high[2] - low[2]
    if height <= 0 or not math.isfinite(height):
        raise ValueError('Invalid model bounds')
    report = {
        'source': source.name,
        'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'bytes': source.stat().st_size,
        'original_bounds': {'min': low, 'max': high},
        'meshes': [{
            'name': obj.name,
            'vertices': len(obj.data.vertices),
            'polygons': len(obj.data.polygons),
            'triangles': sum(len(face.vertices) - 2 for face in obj.data.polygons),
            'uv_maps': [uv.name for uv in obj.data.uv_layers],
            'materials': [slot.name for slot in obj.material_slots],
            'vertex_groups': [group.name for group in obj.vertex_groups],
        } for obj in meshes],
        'armatures': [{'name': obj.name, 'bones': [bone.name for bone in obj.data.bones]}
                      for obj in bpy.context.scene.objects if obj.type == 'ARMATURE'],
        'actions': [action.name for action in bpy.data.actions],
        'images': [{'name': image.name, 'size': list(image.size), 'packed': bool(image.packed_file)}
                   for image in bpy.data.images if image.type == 'IMAGE'],
    }
    (output / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    # Parent only scene roots, preserving source hierarchy and rig transforms.
    roots = [obj for obj in bpy.context.scene.objects if obj.parent is None]
    holder = bpy.data.objects.new('Inspection normalization', None)
    bpy.context.collection.objects.link(holder)
    for obj in roots:
        obj.parent = holder
    scale = args.height / height
    holder.scale = (scale,) * 3
    holder.location = (-(low[0] + high[0]) * .5 * scale,
                       -(low[1] + high[1]) * .5 * scale, -low[2] * scale)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 24
    scene.render.resolution_x = 768
    scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.world = bpy.data.worlds.new('Inspection background')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.35, .38, .42, 1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .5
    scene.view_settings.view_transform = 'AgX'
    target = Vector((0, 0, args.height * .5))
    for name, location, energy, size in [
        ('Key', (-3, -4, 5), 500, 4),
        ('Fill', (3, -1, 3), 280, 3),
        ('Rim', (0, 4, 4), 450, 3),
    ]:
        light = bpy.data.lights.new(name, 'AREA')
        light.energy = energy
        light.shape = 'DISK'
        light.size = size
        obj = bpy.data.objects.new(name, light)
        scene.collection.objects.link(obj)
        obj.location = location
        obj.rotation_euler = (target - obj.location).to_track_quat('-Z', 'Y').to_euler()
    camera_data = bpy.data.cameras.new('Inspection camera')
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = args.height * 1.18
    camera = bpy.data.objects.new('Inspection camera', camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    for name, position in [('front', (0, -6, args.height * .5)),
                           ('back', (0, 6, args.height * .5)),
                           ('side', (6, 0, args.height * .5)),
                           ('three-quarter', (4, -6, args.height * .8))]:
        camera.location = position
        camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = str(output / (name + '.png'))
        bpy.ops.render.render(write_still=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output / 'inspection.blend'))
    print('CFGCN_IMPORT_INSPECTED ' + json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
