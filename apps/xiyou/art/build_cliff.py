"""Finish our Studio battle-camera cliff as a small shared game module."""
import bpy,hashlib,json,math,struct
from pathlib import Path
from mathutils import Matrix
HERE=Path(__file__).parent;ROOT=HERE.parents[2];OUT=ROOT/'apps/website/public/games/xiyou/assets'
RAW=HERE/'source/raw/qinglu-cliff-studio-v31-source.glb'
RAW_HASH='0d0ca52d4ce46bd233f139385b341171b00f80c6749c3d6a9dc3c91563aa8d9f'
assert hashlib.sha256(RAW.read_bytes()).hexdigest()==RAW_HASH
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(RAW))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
bpy.ops.object.select_all(action='DESELECT')
for obj in meshes:obj.select_set(True)
bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join();obj=bpy.context.object
obj.data.transform(obj.matrix_world);obj.parent=None;obj.matrix_world=Matrix.Identity(4)
low=[min(v.co[i] for v in obj.data.vertices) for i in range(3)]
high=[max(v.co[i] for v in obj.data.vertices) for i in range(3)]
factor=8./max(high[0]-low[0],high[1]-low[1])
obj.data.transform(Matrix.Scale(factor,4)@Matrix.Translation((-(low[0]+high[0])/2,-(low[1]+high[1])/2,-low[2])))
triangles=sum(len(f.vertices)-2 for f in obj.data.polygons)
mod=obj.modifiers.new('Web cliff silhouette','DECIMATE');mod.ratio=3980/triangles
bpy.ops.object.modifier_apply(modifier=mod.name)
for face in obj.data.polygons:face.use_smooth=True
for mat in obj.data.materials:
    mat.use_backface_culling=False
    shader=mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Metallic'].default_value=0;shader.inputs['Roughness'].default_value=.94
    shader.inputs['Specular IOR Level'].default_value=.12
    normal=shader.inputs['Normal']
    for link in list(normal.links):mat.node_tree.links.remove(link)
for image in bpy.data.images:
    if image.type=='IMAGE' and max(image.size)>768:
        ratio=768/max(image.size);image.scale(round(image.size[0]*ratio),round(image.size[1]*ratio));image.pack()
obj.name='Qinglu cliff from Studio, battle-camera module'
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'source/qinglu_cliff.blend'))
path=OUT/'qinglu_cliff.glb'
bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_animations=False,export_image_format='JPEG',export_jpeg_quality=82)
blob=path.read_bytes();gltf=json.loads(blob[20:20+struct.unpack_from('<I',blob,12)[0]])
triangles=sum(gltf['accessors'][p['indices']]['count']//3 for m in gltf['meshes'] for p in m['primitives'])
assert triangles<=4000 and len(blob)<500000,(triangles,len(blob))
entry={'asset':'qinglu_cliff','origin':'tripo-studio-blender','studio_project':'ebba5268-8403-4561-b92c-fc03122bb8e1',
 'source_file':RAW.name,'source_sha256':RAW_HASH,'source_blend':'qinglu_cliff.blend','triangles':triangles,'bones':0,'clips':[],
 'bytes':len(blob),'triangle_budget':4000,'byte_budget':500000,'texture_max':768,'joint_budget':0,'primitive_budget':1,
 'runtime_sha256':hashlib.sha256(blob).hexdigest()}
manifest=json.loads((OUT/'manifest.json').read_text(encoding='utf-8'))
manifest['assets']=[e for e in manifest['assets'] if e['asset']!='qinglu_cliff']+[entry]
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('CFGCN_CLIFF '+json.dumps(entry))
