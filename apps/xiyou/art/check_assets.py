"""Validate exported GLB structure and the Blender delivery manifest without Blender."""
import json
import math
import struct
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
ASSETS = ROOT / 'apps/website/public/games/xiyou/assets'
manifest = json.loads((ASSETS / 'manifest.json').read_text(encoding='utf-8'))


def texture_size(data):
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        return struct.unpack_from('>II', data, 16)
    if data.startswith(b'\xff\xd8'):
        cursor = 2
        while cursor < len(data):
            if data[cursor] != 0xff:
                raise ValueError('Invalid JPEG marker')
            while data[cursor] == 0xff:
                cursor += 1
            marker = data[cursor]
            cursor += 1
            if marker in (0xd8, 0xd9) or 0xd0 <= marker <= 0xd7:
                continue
            length = struct.unpack_from('>H', data, cursor)[0]
            if marker in (0xc0, 0xc1, 0xc2):
                height, width = struct.unpack_from('>HH', data, cursor + 3)
                return width, height
            cursor += length
    raise ValueError('Expected an embedded PNG or JPEG texture')


for asset in manifest['assets']:
    name = asset['asset']
    path = ASSETS / f'{name}.glb'
    blob = path.read_bytes()
    magic, version, size = struct.unpack_from('<III', blob)
    assert magic == 0x46546C67 and version == 2 and size == len(blob), name
    length, kind = struct.unpack_from('<II', blob, 12)
    assert kind == 0x4E4F534A, name
    gltf = json.loads(blob[20:20 + length])
    assert gltf.get('meshes') and gltf.get('scenes'), name
    assert not any('uri' in image and not image['uri'].startswith('data:') for image in gltf.get('images', [])), f'{name}: external image dependency'
    clips = [clip['name'] for clip in gltf.get('animations', [])]
    joints = len(gltf.get('skins', [{'joints': []}])[0]['joints'])
    assert clips == asset['clips'], f'{name}: clip order {clips}'
    assert joints == asset['bones'], f'{name}: {joints} joints != manifest'
    assert len(blob) == asset['bytes'], f'{name}: stale byte count'
    source_blend = asset.get('source_blend', f'{name}.blend')
    assert (Path(__file__).parent / 'source' / source_blend).is_file(), f'{name}: missing editable source'
    binary_offset = 20 + length + 8
    vertices = 0
    primitives = 0
    triangles = 0
    for mesh in gltf['meshes']:
        for primitive in mesh['primitives']:
            primitives += 1
            if 'indices' in primitive:
                assert primitive.get('mode', 4) == 4, f'{name}: non-triangle runtime primitive'
                triangles += gltf['accessors'][primitive['indices']]['count'] // 3
            position = gltf['accessors'][primitive['attributes']['POSITION']]
            vertices += position['count']
            view = gltf['bufferViews'][position['bufferView']]
            assert position['componentType'] == 5126
            stride = view.get('byteStride', 12)
            offset = binary_offset + view.get('byteOffset', 0) + position.get('byteOffset', 0)
            for index in range(position['count']):
                assert all(math.isfinite(v) for v in struct.unpack_from('<fff', blob, offset + index * stride)), f'{name}: invalid vertex'
            if joints:
                assert 'JOINTS_0' in primitive['attributes'] and 'WEIGHTS_0' in primitive['attributes'], f'{name}: unskinned primitive'
                weights = gltf['accessors'][primitive['attributes']['WEIGHTS_0']]
                weight_view = gltf['bufferViews'][weights['bufferView']]
                assert weights['componentType'] == 5126 and weights['type'] == 'VEC4'
                weight_offset = binary_offset + weight_view.get('byteOffset', 0) + weights.get('byteOffset', 0)
                for index in range(weights['count']):
                    values = struct.unpack_from('<4f', blob, weight_offset + index * weight_view.get('byteStride', 16))
                    assert all(math.isfinite(w) and 0 <= w <= 1.00001 for w in values), f'{name}: invalid skin weight'
                    assert abs(sum(values) - 1) < .001, f'{name}: unnormalized skin weights'
    if 'triangle_budget' in asset:
        assert triangles == asset['triangles'] and triangles <= asset['triangle_budget'], f'{name}: triangle budget exceeded'
        assert len(blob) <= asset['byte_budget'], f'{name}: download budget exceeded'
        assert joints <= asset['joint_budget'], f'{name}: joint budget exceeded'
        assert primitives <= asset['primitive_budget'], f'{name}: draw primitive budget exceeded'
        for image in gltf.get('images', []):
            view = gltf['bufferViews'][image['bufferView']]
            start = binary_offset + view.get('byteOffset', 0)
            dimensions = texture_size(blob[start:start + view['byteLength']])
            assert max(dimensions) <= asset['texture_max'], f'{name}: texture budget exceeded'
    if name in ['mountain_world','river_scene']:
        from terrain_profile import terrain_height
        ground=next(m for m in gltf['meshes'] if m['name']=='Continuous valley ground')
        attributes=ground['primitives'][0]['attributes']
        assert 'COLOR_0' in attributes and 'COLOR_1' not in attributes, f'{name}: baked shade must be active COLOR_0, not an ignored extra channel'
        colors=gltf['accessors'][attributes['COLOR_0']];cv=gltf['bufferViews'][colors['bufferView']]
        color_start=binary_offset+cv.get('byteOffset',0)+colors.get('byteOffset',0)
        cformat={5121:'B',5123:'H',5126:'f'}[colors['componentType']]
        colour=struct.unpack_from('<4'+cformat,blob,color_start)
        white={5121:255,5123:65535,5126:1.}[colors['componentType']]
        assert min(colour[:3])<white*.9, f'{name}: fake white vertex colour discarded the shadow bake'
        positions=gltf['accessors'][attributes['POSITION']];pv=gltf['bufferViews'][positions['bufferView']]
        offset=binary_offset+pv.get('byteOffset',0)+positions.get('byteOffset',0)
        for index in range(positions['count']):
            x,y,z=struct.unpack_from('<3f',blob,offset+index*pv.get('byteStride',12))
            assert abs(y-terrain_height(x,z))<.0001, f'{name}: runtime ground differs from actor/decal elevation at {x,z}'
    if name=='crowd':
        meta=json.loads((Path(__file__).parent/'crowd-metadata.json').read_text(encoding='utf-8'))
        vat=(ASSETS/asset['animation_data']).read_bytes()
        assert hashlib.sha256(blob).hexdigest()==meta['glb_sha256'], 'crowd: stale mesh metadata'
        assert hashlib.sha256(vat).hexdigest()==meta['data_sha256']==asset['animation_data_sha256'], 'crowd: stale animation texture'
        assert len(vat)<=asset['animation_data_budget'] and texture_size(vat)==(meta['data_width'],meta['data_height'])
        assert meta['max_position_error_m']<.001 and len(meta['meshes'])==4
        entries={a['asset']:a for a in manifest['assets']}
        for source in meta['sources']:
            original=(ASSETS/f"{source['asset']}.glb").read_bytes()
            assert hashlib.sha256(original).hexdigest()==source['runtime_sha256'], 'crowd: source changed; rebake animation LODs'
            assert entries[source['asset']]['origin'].startswith('tripo')
        for m in meta['meshes']:
            assert m['triangles']<=(800 if m['lod']=='near' else 600 if m['asset']=='wolf' else 420) and m['frames']==25 and m['strike_frames']==8
            primitive=gltf['meshes'][m['mesh']]['primitives'][0]
            assert 'TEXCOORD_1' in primitive['attributes'] and 'JOINTS_0' not in primitive['attributes']
            assert m['base_pixel']+(m['vertices']*m['frames']*2)<=meta['data_width']*meta['data_height']
    print(json.dumps({'asset': name, 'vertices': vertices, 'triangles': triangles, 'primitives': primitives, 'joints': joints, 'clips': clips, 'bytes': len(blob)}))
