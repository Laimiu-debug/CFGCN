"""Finish Studio retopology outputs with shared web budgets and real armature clips."""
import bpy,bmesh,hashlib,importlib.util,json,math,struct,sys
from pathlib import Path
from mathutils import Matrix,Vector
HERE=Path(__file__).parent
spec=importlib.util.spec_from_file_location('river',HERE/'build_river_assets.py')
r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
a=r.a
SOURCES={
 'monk':('6a263182-2424-49bc-abb2-8cd67fb04185','monk-studio-v31-retopo.glb',2.4,6000,1024,900000),
 'riverling':('c74414e7-0831-4597-a2e3-a09ba99a365e','riverling-studio-v31-retopo.glb',1.65,2200,512,320000),
 'wolf':('9f42d52d-6e8a-4d33-b52d-9bc155b31510','wolf-studio-v31-retopo.glb',2.,2200,512,320000),
 'pine_rock':('30cd4649-52ef-4130-b1eb-f80a2c61615b','pine-rock-studio-v31-retopo.glb',5.5,1500,512,250000),
 'seal_stone':('aa5ee5e0-2162-4ac1-88a3-a295938b3808','seal-stone-studio-v31-retopo.glb',2.4,1000,512,200000),
}
def smooth(v):
    v=max(0.,min(1.,v));return v*v*(3-2*v)
def prepare(name):
    project,file,height,budget,size,byte_budget=SOURCES[name]
    a.reset();raw=HERE/'source/raw'/file
    bpy.ops.import_scene.gltf(filepath=str(raw))
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for obj in meshes:obj.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0]
    if len(meshes)>1:bpy.ops.object.join()
    obj=bpy.context.object
    # Studio v3.1 faces +X in Blender; the game convention faces -Y.
    obj.data.transform(Matrix.Rotation(-math.pi/2,4,'Z') @ obj.matrix_world);obj.matrix_world=Matrix.Identity(4)
    low=[min(v.co[i] for v in obj.data.vertices) for i in range(3)]
    high=[max(v.co[i] for v in obj.data.vertices) for i in range(3)]
    if name=='wolf':
        # Studio added a plinth despite the prompt. Remove the base before skinning.
        bm=bmesh.new();bm.from_mesh(obj.data)
        bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
        layer=bm.loops.layers.uv.active
        image=next(n.image for n in obj.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and n.image)
        image.scale(512,512);pixels=list(image.pixels);texture_width,texture_height=image.size
        floor=[]
        for face in bm.faces:
            if max(v.co.z for v in face.verts)>low[2]+(high[2]-low[2])*.15:continue
            uv=sum((loop[layer].uv for loop in face.loops),Vector((0,0)))/len(face.loops)
            ix=max(0,min(texture_width-1,int(uv.x*texture_width)));iy=max(0,min(texture_height-1,int(uv.y*texture_height)))
            red,green,blue=pixels[(iy*texture_width+ix)*4:(iy*texture_width+ix)*4+3]
            if red>green*1.14 and green>blue*1.02:floor.append(face)
        bmesh.ops.delete(bm,geom=floor,context='FACES')
        bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),plane_co=(0,0,low[2]+(high[2]-low[2])*.058),plane_no=(0,0,1),clear_inner=True,clear_outer=False)
        remaining=set(bm.verts);groups=[]
        while remaining:
            stack=[remaining.pop()];group=[]
            while stack:
                v=stack.pop();group.append(v)
                for edge in v.link_edges:
                    other=edge.other_vert(v)
                    if other in remaining:remaining.remove(other);stack.append(other)
            groups.append(group)
        keep=set(max(groups,key=len));bmesh.ops.delete(bm,geom=[v for v in bm.verts if v not in keep],context='VERTS')
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
        bm.to_mesh(obj.data);bm.free()
        obj.data.validate(clean_customdata=True);obj.data.update()
        low=[min(v.co[i] for v in obj.data.vertices) for i in range(3)]
        high=[max(v.co[i] for v in obj.data.vertices) for i in range(3)]
    scale=height/(high[2]-low[2])
    obj.data.transform(Matrix.Scale(scale,4) @ Matrix.Translation((-(low[0]+high[0])/2,-(low[1]+high[1])/2,-low[2])))
    if name=='seal_stone':
        radius=max(math.hypot(v.co.x,v.co.y) for v in obj.data.vertices)
        obj.data.transform(Matrix.Diagonal((1/radius,1/radius,1,1)))
        # Sculpt the accepted Studio mesh instead of repeating its flat cap.
        # Keep the lower footprint used by gameplay; taper only the crown.
        for vertex in obj.data.vertices:
            x,y,z=vertex.co
            crown=smooth((z/height-.48)/.52)
            radial=max(0.,1.-x*x-y*y)
            vertex.co.x=x*(1.-.23*crown)
            vertex.co.y=y*(1.-.17*crown)
            vertex.co.z=z+crown*(.68*radial+.12*x-.08*y)
        obj.data.update()
    triangles=sum(len(f.vertices)-2 for f in obj.data.polygons)
    if triangles>budget:
        mod=obj.modifiers.new('Web budget','DECIMATE');mod.ratio=(budget-5)/triangles;bpy.ops.object.modifier_apply(modifier=mod.name)
    for face in obj.data.polygons:face.use_smooth=True
    for mat in obj.data.materials:
        shader=mat.node_tree.nodes.get('Principled BSDF');shader.inputs['Metallic'].default_value=0
        shader.inputs['Roughness'].default_value=.92;shader.inputs['Specular IOR Level'].default_value=.15
    for image in bpy.data.images:
        if image.type=='IMAGE' and image.size[0]>size:image.scale(size,size);image.pack()
    obj.name=name+' Studio finished mesh';return obj
def skin(obj,name):
    arm=a.armature();arm.name=name+' illustration rig'
    scale=SOURCES[name][2]/2.4
    if scale!=1:
        arm.data.transform(Matrix.Scale(scale,4))
    groups={b.name:obj.vertex_groups.new(name=b.name) for b in arm.data.bones}
    for v in obj.data.vertices:
        x,y,z=v.co/scale;side='L' if x<0 else 'R'
        head=smooth((z-1.72)/.16)
        upper=smooth((z-1.12)/.28)
        weights={'hips':1-upper,'chest':upper}
        if head>0:weights={k:w*(1-head) for k,w in weights.items()};weights['head']=head
        reach=smooth((abs(x)-.28)/.22)*smooth((z-.95)/.2)*(1-head)
        if reach>0:
            hand=smooth((1.48-z)/.3)
            weights={k:w*(1-reach) for k,w in weights.items()}
            weights['arm.'+side]=reach*(1-hand);weights['hand.'+side]=reach*hand
        leg=smooth((1.03-z)/.4)
        if leg>0:
            # A robe keeps a continuous hem while feet retain independent motion.
            amount=leg*(.32 if name=='monk' and z>.2 else .95)
            lower=smooth((.62-z)/.3)
            weights={k:w*(1-amount) for k,w in weights.items()}
            weights['thigh.'+side]=amount*(1-lower);weights['shin.'+side]=amount*lower
        if name=='wolf' and y>.25 and z<1.3:
            tail=smooth((y-.25)/.18);weights={k:w*(1-tail) for k,w in weights.items()};weights['tail']=tail
        weights={k:w for k,w in weights.items() if w>.00001};total=sum(weights.values())
        for key,value in weights.items():groups[key].add([v.index],value/total,'REPLACE')
    modifier=obj.modifiers.new('Studio mesh deformation','ARMATURE');modifier.object=arm;obj.parent=arm
    a.animate(arm,role='monk' if name=='monk' else '')
    return arm
def build(name):
    project,file,height,budget,size,byte_budget=SOURCES[name];obj=prepare(name)
    arm=skin(obj,name) if name in ['monk','riverling','wolf'] else None
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'source'/(name+'.blend')))
    path=a.OUT/(name+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_animations=bool(arm),export_animation_mode='NLA_TRACKS',export_skins=True,export_yup=True,export_image_format='JPEG',export_jpeg_quality=82)
    blob=path.read_bytes();gltf=json.loads(blob[20:20+struct.unpack_from('<I',blob,12)[0]])
    triangles=sum(gltf['accessors'][p['indices']]['count']//3 for mesh in gltf['meshes'] for p in mesh['primitives'])
    assert triangles<=budget and len(blob)<=byte_budget,(name,triangles,len(blob))
    entry={'asset':name,'origin':'tripo-studio-blender','studio_project':project,'source_file':file,'source_sha256':hashlib.sha256((HERE/'source/raw'/file).read_bytes()).hexdigest(),'source_blend':name+'.blend','triangles':triangles,'bones':len(arm.data.bones) if arm else 0,'clips':[clip['name'] for clip in gltf.get('animations',[])],'bytes':len(blob),'triangle_budget':budget,'byte_budget':byte_budget,'texture_max':size,'joint_budget':16,'primitive_budget':1}
    if name=='seal_stone':entry['sculpt']='tapered mineral crown; original Studio base footprint preserved'
    path=a.OUT/'manifest.json';manifest=json.loads(path.read_text(encoding='utf-8'));manifest['assets']=[e for e in manifest['assets'] if e['asset']!=name]+[entry];path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    if name=='monk':
        spec=importlib.util.spec_from_file_location('spell_motion',HERE/'build_spell_motion.py')
        spells=importlib.util.module_from_spec(spec);spec.loader.exec_module(spells);spells.spells(name)
        entry=next(e for e in json.loads(path.read_text(encoding='utf-8'))['assets'] if e['asset']==name)
    print('CFGCN_STUDIO_DELIVERY '+json.dumps(entry))
if __name__=='__main__':
    for name in sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['monk','riverling','wolf','pine_rock']:build(name)
