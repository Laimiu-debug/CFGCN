"""User-owned Studio shrine -> matte web LOD and editable Blender source."""
import bpy,bmesh,hashlib,json,math,struct
from pathlib import Path
from mathutils import Matrix,Vector
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
OUT=ROOT/'apps/website/public/games/xiyou/assets'
raw=HERE/'source/raw/roadside-shrine-studio-v31-source-meshopt.glb'
decoded=HERE/'source/raw/roadside-shrine-studio-v31-decoded.glb'
record=json.loads((HERE/'roadside-shrine.json').read_text(encoding='utf-8'))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(decoded))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
bpy.ops.object.select_all(action='DESELECT')
for obj in meshes:obj.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]
if len(meshes)>1:bpy.ops.object.join()
obj=bpy.context.object;obj.data.transform(Matrix.Rotation(-math.pi/2,4,'Z')@obj.matrix_world)
obj.parent=None;obj.matrix_world=Matrix.Identity(4)
lo=Vector([min(v.co[i] for v in obj.data.vertices) for i in range(3)])
hi=Vector([max(v.co[i] for v in obj.data.vertices) for i in range(3)])
factor=3.2/max(hi.x-lo.x,hi.y-lo.y)
obj.data.transform(Matrix.Scale(factor,4)@Matrix.Translation((-(lo.x+hi.x)/2,-(lo.y+hi.y)/2,-lo.z)))
bm=bmesh.new();bm.from_mesh(obj.data)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000025)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
source_triangles=sum(len(p.vertices)-2 for p in obj.data.polygons)
dec=obj.modifiers.new('Protect roof and post silhouette in web budget','DECIMATE')
dec.ratio=min(1.,2190/source_triangles);dec.use_collapse_triangulate=True
bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=dec.name)
obj.name='Roadside mountain-spirit shrine from Studio'
for face in obj.data.polygons:face.use_smooth=True
for mat in obj.data.materials:
    bsdf=mat.node_tree.nodes.get('Principled BSDF')
    if bsdf:
        bsdf.inputs['Metallic'].default_value=0.;bsdf.inputs['Roughness'].default_value=.94
        bsdf.inputs['Specular IOR Level'].default_value=.12
for image in bpy.data.images:
    if image.type=='IMAGE':
        if max(image.size)>512:image.scale(512,512)
        image.pack()
obj.data.update()
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'source/roadside_shrine.blend'),compress=True)
path=OUT/'roadside_shrine.glb'
bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=False,export_image_format='JPEG',export_jpeg_quality=84)
blob=path.read_bytes();g=json.loads(blob[20:20+struct.unpack_from('<I',blob,12)[0]])
triangles=sum(g['accessors'][p['indices']]['count']//3 for m in g['meshes'] for p in m['primitives'])
assert triangles<=2200 and len(blob)<250000,(triangles,len(blob))
bounds=[[min(v.co[i] for v in obj.data.vertices),max(v.co[i] for v in obj.data.vertices)] for i in range(3)]
entry={'asset':'roadside_shrine','origin':'tripo-studio-blender','studio_project':'c059207d-1ab2-42d2-9b18-8cd9ade0dcd9','source_file':raw.name,'source_sha256':hashlib.sha256(raw.read_bytes()).hexdigest(),'decoded_file':decoded.name,'decoded_sha256':hashlib.sha256(decoded.read_bytes()).hexdigest(),'source_blend':'roadside_shrine.blend','triangles':triangles,'source_triangles':source_triangles,'bones':0,'clips':[],'bytes':len(blob),'triangle_budget':2200,'byte_budget':250000,'texture_max':512,'joint_budget':0,'primitive_budget':1,'bounds_blender':bounds,'runtime_sha256':hashlib.sha256(blob).hexdigest()}
manifest=json.loads((OUT/'manifest.json').read_text(encoding='utf-8'))
manifest['assets']=[a for a in manifest['assets'] if a['asset']!='roadside_shrine']+[entry]
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
record.update(status='Blender web LOD exported; in-game review pending',studio_project=entry['studio_project'],studio_credits=50,runtime=entry)
(HERE/'roadside-shrine.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
print('CFGCN_SHRINE '+json.dumps(entry),flush=True)
# Studio preview is a production check, not the final in-game acceptance.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=12
scene.render.resolution_x=640;scene.render.resolution_y=640;scene.render.resolution_percentage=100
scene.world.color=(.23,.29,.25)
bpy.ops.object.light_add(type='AREA',location=(-3,-4,7));bpy.context.object.data.energy=750;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=5
bpy.ops.object.light_add(type='AREA',location=(3,1,5));bpy.context.object.data.energy=450;bpy.context.object.data.size=4
centre=Vector((0,0,(bounds[2][0]+bounds[2][1])/2))
for label,position in [('front',(4,-6,4.8)),('back',(-4,6,4.8))]:
    bpy.ops.object.camera_add(location=position);camera=bpy.context.object
    camera.rotation_euler=(centre-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=4.7;scene.camera=camera
    scene.render.filepath=str(ROOT/f'.local/qa/shrine-{label}.png');bpy.ops.render.render(write_still=True)
print('CFGCN_SHRINE_PREVIEW_COMPLETE',flush=True)
