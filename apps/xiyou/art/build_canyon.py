"""Retain the exact Studio canyon source, finish one small matte runtime mesh."""
import bpy,bmesh,hashlib,json,struct
from pathlib import Path
from mathutils import Matrix
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];OUT=ROOT/'apps/website/public/games/xiyou/assets'
record=json.loads((HERE/'natural-canyon.json').read_text(encoding='utf-8'))
raw=HERE/'source/raw'/record['source_file'];source_hash=hashlib.sha256(raw.read_bytes()).hexdigest()
assert source_hash!='0d0ca52d4ce46bd233f139385b341171b00f80c6749c3d6a9dc3c91563aa8d9f','old ornamental cliff is not the canyon source'
assert record.get('source_sha256',source_hash)==source_hash
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(raw))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
bpy.ops.object.select_all(action='DESELECT')
for obj in meshes:obj.select_set(True)
bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join();obj=bpy.context.object
obj.data.transform(obj.matrix_world);obj.parent=None;obj.matrix_world=Matrix.Identity(4)
low=[min(v.co[i] for v in obj.data.vertices) for i in range(3)];high=[max(v.co[i] for v in obj.data.vertices) for i in range(3)]
if high[1]-low[1]>high[0]-low[0]:
    obj.data.transform(Matrix.Rotation(1.57079632679,4,'Z'))
    low=[min(v.co[i] for v in obj.data.vertices) for i in range(3)];high=[max(v.co[i] for v in obj.data.vertices) for i in range(3)]
factor=12./max(high[0]-low[0],high[1]-low[1])
obj.data.transform(Matrix.Scale(factor,4)@Matrix.Translation((-(low[0]+high[0])/2,-(low[1]+high[1])/2,-low[2])))
# Weld geometry while preserving corner UVs before aggressive web LOD.
bm=bmesh.new();bm.from_mesh(obj.data);original_vertices=len(bm.verts)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.002)
bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.0001)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
print('CANYON_WELD',original_vertices,len(bm.verts))
bm.to_mesh(obj.data);bm.free();obj.data.update()
triangles=sum(len(f.vertices)-2 for f in obj.data.polygons)
mod=obj.modifiers.new('Battle camera geological silhouette','DECIMATE');mod.ratio=5980/triangles
bpy.ops.object.modifier_apply(modifier=mod.name)
for face in obj.data.polygons:face.use_smooth=True
for mat in obj.data.materials:
    mat.use_backface_culling=False;bsdf=mat.node_tree.nodes.get('Principled BSDF')
    for name,value in [('Metallic',0.),('Roughness',.95),('Specular IOR Level',.12)]:
        for link in list(bsdf.inputs[name].links):mat.node_tree.links.remove(link)
        bsdf.inputs[name].default_value=value
    for link in list(bsdf.inputs['Normal'].links):mat.node_tree.links.remove(link)
for image in bpy.data.images:
    if image.type=='IMAGE' and max(image.size)>768:
        scale=768/max(image.size);image.scale(round(image.size[0]*scale),round(image.size[1]*scale));image.pack()
obj.name='Natural limestone canyon wall from Studio'
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'source/canyon_wall.blend'))
path=OUT/'canyon_wall.glb'
bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_animations=False,export_image_format='JPEG',export_jpeg_quality=82)
blob=path.read_bytes();gltf=json.loads(blob[20:20+struct.unpack_from('<I',blob,12)[0]])
triangles=sum(gltf['accessors'][p['indices']]['count']//3 for m in gltf['meshes'] for p in m['primitives'])
assert triangles<=6000 and len(blob)<600000,(triangles,len(blob))
entry={'asset':'canyon_wall','origin':'tripo-studio-blender','studio_project':record['studio_project'],'source_file':raw.name,'source_sha256':source_hash,'source_blend':'canyon_wall.blend',
 'triangles':triangles,'bones':0,'clips':[],'bytes':len(blob),'triangle_budget':6000,'byte_budget':600000,'texture_max':768,'joint_budget':0,'primitive_budget':1,'runtime_sha256':hashlib.sha256(blob).hexdigest()}
manifest=json.loads((OUT/'manifest.json').read_text(encoding='utf-8'))
manifest['assets']=[e for e in manifest['assets'] if e['asset']!='canyon_wall']+[entry]
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
record.update(source_sha256=source_hash,source_bytes=len(raw.read_bytes()),runtime=entry)
(HERE/'natural-canyon.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
print('CFGCN_CANYON '+json.dumps(entry))
