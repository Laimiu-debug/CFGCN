"""Derive atlas tree / shrub LODs from accepted Studio assets; preserve all inputs."""
import hashlib
import json
import struct
from pathlib import Path

import bpy
from mathutils import Matrix

ROOT = Path(__file__).resolve().parents[3]
HERE = ROOT / 'apps/website/art'
OUT = ROOT / 'apps/website/public/art/atlas/models'
pine = json.loads((ROOT / 'apps/xiyou/art/natural-pine.json').read_text(encoding='utf-8'))
manifest = json.loads((OUT / 'manifest.json').read_text(encoding='utf-8'))
specifications = json.loads((HERE / 'sources.json').read_text(encoding='utf-8'))
prompts = json.loads((HERE / 'prompts.json').read_text(encoding='utf-8'))

for name, original, height, budget, byte_budget in [
    ('canopy', 'pine_tree', 4.6, 1300, 300000),
    ('shrub', 'mountain_shrub', 1.0, 500, 180000),
]:
    source = ROOT / 'apps/xiyou/art/source' / (original + '.blend')
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    runtime_input = ROOT / 'apps/website/public/games/xiyou/assets' / (original + '.glb')
    runtime_input_hash = hashlib.sha256(runtime_input.read_bytes()).hexdigest()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(runtime_input))
    objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.data.transform(obj.matrix_world)
    obj.matrix_world = Matrix.Identity(4)
    low = [min(v.co[i] for v in obj.data.vertices) for i in range(3)]
    high = [max(v.co[i] for v in obj.data.vertices) for i in range(3)]
    scale = height / (high[2] - low[2])
    obj.data.transform(Matrix.Scale(scale, 4) @ Matrix.Translation((-(low[0] + high[0]) / 2, -(low[1] + high[1]) / 2, -low[2])))
    faces = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    if faces > budget:
        modifier = obj.modifiers.new('Atlas distance silhouette', 'DECIMATE')
        modifier.ratio = (budget - 12) / faces
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    for vertex in obj.data.vertices:
        vertex.co.z = max(0, vertex.co.z)
    for face in obj.data.polygons:
        face.use_smooth = True
    for image in bpy.data.images:
        if image.type == 'IMAGE' and image.size[0] and image.size[1]:
            ratio = min(1, 512 / max(image.size))
            if ratio < 1:
                image.scale(round(image.size[0] * ratio), round(image.size[1] * ratio))
            image.pack()
    derived = HERE / 'source/countryside' / (name + '.blend')
    derived.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(derived))
    runtime = OUT / (name + '.glb')
    bpy.ops.export_scene.gltf(filepath=str(runtime), export_format='GLB', use_selection=True, export_animations=False, export_image_format='JPEG', export_jpeg_quality=82)
    blob = runtime.read_bytes()
    gltf = json.loads(blob[20:20 + struct.unpack_from('<I', blob, 12)[0]])
    triangles = sum(gltf['accessors'][p['indices']]['count'] // 3 for mesh in gltf['meshes'] for p in mesh['primitives'])
    assert triangles <= budget and len(blob) <= byte_budget
    raw = 'apps/xiyou/art/source/raw/' + pine['source_file']
    assert hashlib.sha256((ROOT / raw).read_bytes()).hexdigest() == pine['source_sha256']
    assert hashlib.sha256(source.read_bytes()).hexdigest() == source_hash
    assert hashlib.sha256(runtime_input.read_bytes()).hexdigest() == runtime_input_hash
    specification = {'source': raw, 'source_sha256': pine['source_sha256'], 'studio_project': pine['studio_project'], 'triangle_budget': budget, 'byte_budget': byte_budget, 'texture_max': 512, 'usage': 'Shared Studio tree silhouette; atlas countryside connecting groves, field hedges and riverbanks. Botanical pine needles not claimed.'}
    specifications[name] = specification
    prompts[name] = pine['prompt']
    entry = {**specification, 'asset': name, 'origin': 'tripo-studio-blender', 'bytes': len(blob), 'triangles': triangles, 'primitives': 1, 'runtime_sha256': hashlib.sha256(blob).hexdigest(), 'editable_source': derived.relative_to(ROOT).as_posix(), 'derived_from': {'input_blend': source.relative_to(ROOT).as_posix(), 'input_sha256': source_hash, 'input_runtime': runtime_input.relative_to(ROOT).as_posix(), 'input_runtime_sha256': runtime_input_hash, 'script': 'apps/website/art/build_countryside_lod.py'}}
    manifest['assets'] = [a for a in manifest['assets'] if a['asset'] != name] + [entry]
    print(f'ATLAS_COUNTRYSIDE {name}: {triangles} triangles, {len(blob)} bytes', flush=True)

(OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(HERE / 'sources.json').write_text(json.dumps(specifications, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(HERE / 'prompts.json').write_text(json.dumps(prompts, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
