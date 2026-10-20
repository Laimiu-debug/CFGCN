"""Studio tree -> coherent canopy LOD + baked original albedo -> shared shrubs."""
import bpy,bmesh,hashlib,json,struct
from pathlib import Path
from mathutils import Matrix
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];OUT=ROOT/'apps/website/public/games/xiyou/assets'
record=json.loads((HERE/'natural-pine.json').read_text(encoding='utf-8'))
raw=HERE/'source/raw'/record['source_file'];sha=hashlib.sha256(raw.read_bytes()).hexdigest()
assert record.get('source_sha256',sha)==sha
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(raw))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join();source=bpy.context.object
source.data.transform(source.matrix_world);source.parent=None;source.matrix_world=Matrix.Identity(4)
low=[min(v.co[i] for v in source.data.vertices) for i in range(3)];high=[max(v.co[i] for v in source.data.vertices) for i in range(3)]
source.data.transform(Matrix.Scale(5./(high[2]-low[2]),4)@Matrix.Translation((-(low[0]+high[0])/2,-(low[1]+high[1])/2,-low[2])))
source.name='ORIGINAL Studio tree, bake source only'
tree=source.copy();tree.data=source.data.copy();bpy.context.collection.objects.link(tree);tree.name='Living mountain tree from Studio'
bpy.context.view_layer.objects.active=tree
remesh=tree.modifiers.new('Preserve coherent foliage masses','REMESH');remesh.mode='VOXEL';remesh.voxel_size=.065;remesh.use_smooth_shade=True
bpy.ops.object.modifier_apply(modifier=remesh.name)
smooth=tree.modifiers.new('Soft foliage silhouette','SMOOTH');smooth.factor=.65;smooth.iterations=2;bpy.ops.object.modifier_apply(modifier=smooth.name)
triangles=sum(len(p.vertices)-2 for p in tree.data.polygons)
dec=tree.modifiers.new('Web canopy LOD','DECIMATE');dec.ratio=min(1.,3480/triangles);bpy.ops.object.modifier_apply(modifier=dec.name)
for p in tree.data.polygons:p.use_smooth=True
# Bake original Studio colours onto the new coherent mesh, not invented leaf colours.
bpy.ops.object.select_all(action='DESELECT');tree.select_set(True);bpy.context.view_layer.objects.active=tree
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.02);bpy.ops.object.mode_set(mode='OBJECT')
image=bpy.data.images.new('Studio tree albedo, runtime',width=768,height=768,alpha=False)
mat=bpy.data.materials.new('Matte Studio tree albedo');mat.use_nodes=True
bsdf=mat.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Roughness'].default_value=.95;bsdf.inputs['Metallic'].default_value=0.;bsdf.inputs['Specular IOR Level'].default_value=.1
node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=image;mat.node_tree.nodes.active=node
mat.node_tree.links.new(node.outputs['Color'],bsdf.inputs['Base Color'])
tree.data.materials.clear();tree.data.materials.append(mat)
for p in tree.data.polygons:p.material_index=0
for original in source.data.materials:
    original.use_nodes=True;nodes=original.node_tree.nodes;shader=nodes.get('Principled BSDF');output=nodes.get('Material Output')
    emission=nodes.new('ShaderNodeEmission')
    if shader.inputs['Base Color'].links:original.node_tree.links.new(shader.inputs['Base Color'].links[0].from_socket,emission.inputs['Color'])
    else:emission.inputs['Color'].default_value=shader.inputs['Base Color'].default_value
    original.node_tree.links.new(emission.outputs[0],output.inputs['Surface'])
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=1
source.select_set(True);tree.select_set(True);bpy.context.view_layer.objects.active=tree
bpy.ops.object.bake(type='EMIT',use_selected_to_active=True,cage_extrusion=.13,max_ray_distance=.3,margin=8)
image.pack();source.hide_render=True;source.hide_set(True)

def export(obj,name,budget):
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'source'/f'{name}.blend'))
    path=OUT/f'{name}.glb';bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=False,export_image_format='JPEG',export_jpeg_quality=82)
    blob=path.read_bytes();g=json.loads(blob[20:20+struct.unpack_from('<I',blob,12)[0]])
    tri=sum(g['accessors'][p['indices']]['count']//3 for m in g['meshes'] for p in m['primitives'])
    assert tri<=budget and len(blob)<450000,(name,tri,len(blob))
    entry={'asset':name,'origin':'tripo-studio-blender','studio_project':record['studio_project'],'source_file':raw.name,'source_sha256':sha,'source_blend':f'{name}.blend','triangles':tri,'bones':0,'clips':[],'bytes':len(blob),'triangle_budget':budget,'byte_budget':450000,'texture_max':768,'joint_budget':0,'primitive_budget':1,'runtime_sha256':hashlib.sha256(blob).hexdigest()}
    manifest=json.loads((OUT/'manifest.json').read_text(encoding='utf-8'));manifest['assets']=[e for e in manifest['assets'] if e['asset']!=name]+[entry]
    (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8');print('CFGCN_TREE '+json.dumps(entry));return entry

entries=[export(tree,'pine_tree',3500)]
shrub=tree.copy();shrub.data=tree.data.copy();bpy.context.collection.objects.link(shrub);shrub.name='Low ground shrub derived from Studio canopy'
bm=bmesh.new();bm.from_mesh(shrub.data);bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.z<2.9],context='VERTS');bm.to_mesh(shrub.data);bm.free()
minz=min(v.co.z for v in shrub.data.vertices);extent=max(max(v.co.x for v in shrub.data.vertices)-min(v.co.x for v in shrub.data.vertices),max(v.co.y for v in shrub.data.vertices)-min(v.co.y for v in shrub.data.vertices))
shrub.data.transform(Matrix.Diagonal((1.8/extent,1.8/extent,1.1/extent,1.))@Matrix.Translation((0,0,-minz)))
bpy.context.view_layer.objects.active=shrub
tri=sum(len(p.vertices)-2 for p in shrub.data.polygons);mod=shrub.modifiers.new('Groundcover LOD','DECIMATE');mod.ratio=min(1.,880/tri);bpy.ops.object.modifier_apply(modifier=mod.name)
entries.append(export(shrub,'mountain_shrub',900))
record.update(source_sha256=sha,source_bytes=len(raw.read_bytes()),runtime=entries,review='Living broadleaf mountain tree; Tripo did not reproduce pine needles. Voxel canopy LOD and original albedo bake preserve full foliage; shrubs derived from its crown. Botanical pine detail remains a refinement item.')
(HERE/'natural-pine.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
