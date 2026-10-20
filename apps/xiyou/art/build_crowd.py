"""Bake accepted Studio enemies into true 3D, instanced vertex-animation LODs.

RGBA8 data PNG contains two texels per vertex/frame: XYZ16 + oct-normal8.
No per-enemy armatures, animation players, meshes or material copies at runtime.
Original Studio/Blender/rigged GLBs stay intact for bosses and future editing.
"""
import bpy,json,math,struct,hashlib,zlib
from pathlib import Path
from mathutils import Vector
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];OUT=ROOT/'apps/website/public/games/xiyou/assets'
manifest=json.loads((OUT/'manifest.json').read_text(encoding='utf-8'))
source_records={e['asset']:e for e in manifest['assets'] if e['asset'] in ['wolf','riverling']}
for entry in source_records.values():assert entry['origin'].startswith('tripo'),entry['asset']
bpy.ops.wm.read_factory_settings(use_empty=True)
binary=bytearray();views=[];accessors=[];meshes=[];metadata=[];images=[];data_pixels=bytearray();samples=[]

def view(blob,target=None):
    while len(binary)%4:binary.append(0)
    record={'buffer':0,'byteOffset':len(binary),'byteLength':len(blob)}
    if target:record['target']=target
    binary.extend(blob);views.append(record);return len(views)-1

def accessor(values,components,kind,ctype=5126,bounds=False):
    fmt={5126:'f',5123:'H'}[ctype]
    blob=struct.pack('<'+fmt*(len(values)*components),*(v for row in values for v in (row if components>1 else [row])))
    record={'bufferView':view(blob,34963 if ctype==5123 else 34962),'componentType':ctype,'count':len(values),'type':kind}
    if bounds:
        record['min']=[min(v[i] for v in values) for i in range(components)]
        record['max']=[max(v[i] for v in values) for i in range(components)]
    accessors.append(record);return len(accessors)-1

def game(v):return (v.x,v.z,-v.y)
def oct_normal(n):
    n=n.normalized();denom=abs(n[0])+abs(n[1])+abs(n[2]);x,y,z=(v/denom for v in n)
    if z<0:x,y=(1-abs(y))*(1 if x>=0 else -1),(1-abs(x))*(1 if y>=0 else -1)
    return round((x*.5+.5)*255),round((y*.5+.5)*255)

def image_from_glb(path):
    blob=path.read_bytes();length=struct.unpack_from('<I',blob,12)[0];g=json.loads(blob[20:20+length]);image=g['images'][0];v=g['bufferViews'][image['bufferView']]
    begin=28+length+v.get('byteOffset',0);payload=blob[begin:begin+v['byteLength']]
    images.append({'bufferView':view(payload),'mimeType':image['mimeType']})

for source in ['wolf','riverling']:
    path=OUT/f'{source}.glb';image_from_glb(path)
    before=set(bpy.context.scene.objects);old_actions=set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=str(path))
    new=[o for o in bpy.context.scene.objects if o not in before]
    arm=next(o for o in new if o.type=='ARMATURE');original=next(o for o in new if o.type=='MESH')
    arm.name=source+'_source_armature';original.name=source+'_source_mesh'
    actions=[a for a in bpy.data.actions if a not in old_actions]
    idle=next(a for a in actions if a.name.split('.')[0]=='Idle');walk=next(a for a in actions if a.name.split('.')[0]=='Walk');strike=next(a for a in actions if a.name.split('.')[0]=='Strike')
    for track in arm.animation_data.nla_tracks:track.mute=True
    for lod,budget in [('near',800),('far',600 if source=='wolf' else 420)]:
        arm.data.pose_position='REST';bpy.context.view_layer.update()
        obj=original.copy();obj.data=original.data.copy();bpy.context.collection.objects.link(obj);obj.name=f'{source}_{lod}'
        bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
        # GLB imports split vertices at UV/normal seams. Weld before decimation:
        # otherwise the simplifier deletes disconnected faces and tears holes.
        bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.remove_doubles(threshold=.00001);bpy.ops.object.mode_set(mode='OBJECT')
        preserve=obj.vertex_groups.new(name='Crowd body simplification')
        for v in obj.data.vertices:
            p=obj.matrix_world@v.co
            feature=p.z>1.42 or p.z<.28 or abs(p.x)>.68
            preserve.add([v.index],.02 if feature else 1.,'REPLACE')
        for attempt in range(8):
            current=sum(len(p.vertices)-2 for p in obj.data.polygons)
            if current<=budget:break
            mod=obj.modifiers.new('Crowd silhouette LOD','DECIMATE');mod.ratio=min(.95,(budget-16)/current);mod.use_collapse_triangulate=True
            mod.vertex_group=preserve.name;mod.vertex_group_factor=1.
            while obj.modifiers.find(mod.name)>0:bpy.ops.object.modifier_move_up(modifier=mod.name)
            bpy.ops.object.modifier_apply(modifier=mod.name)
        obj.data.calc_loop_triangles();uv=obj.data.uv_layers.active
        lookup={};vertex_map=[];uvs=[];indices=[]
        for tri in obj.data.loop_triangles:
            for loop_index in tri.loops:
                loop=obj.data.loops[loop_index];t=uv.data[loop_index].uv
                key=(loop.vertex_index,round(t.x,7),round(t.y,7))
                if key not in lookup:
                    lookup[key]=len(vertex_map);vertex_map.append(loop.vertex_index);uvs.append((t.x,1-t.y))
                indices.append(lookup[key])
        assert len(indices)//3<=budget and len(vertex_map)<65535,(source,lod,budget,len(indices)//3,len(vertex_map),sum(len(p.vertices)-2 for p in obj.data.polygons))
        arm.data.pose_position='POSE';frames=[];normals=[]
        for frame in range(25):
            action=idle if frame==0 else walk if frame<17 else strike
            arm.animation_data.action=action
            if action.slots:arm.animation_data.action_slot=action.slots[0]
            start,end=action.frame_range
            time=start if frame==0 else start+(end-start)*(frame-1)/16 if frame<17 else start+(end-start)*(frame-17)/7
            bpy.context.scene.frame_set(math.floor(time),subframe=time-math.floor(time))
            bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();evaluated=obj.evaluated_get(deps);mesh=evaluated.to_mesh()
            matrix=obj.matrix_world;normal_matrix=matrix.to_3x3().inverted().transposed()
            frames.append([game(matrix@mesh.vertices[i].co) for i in vertex_map])
            normals.append([game(normal_matrix@mesh.vertices[i].normal) for i in vertex_map]);evaluated.to_mesh_clear()
        lower=[min(v[i] for f in frames for v in f)-.002 for i in range(3)]
        span=[max(v[i] for f in frames for v in f)+.002-lower[i] for i in range(3)]
        offset=len(data_pixels)//4
        for frame,ns in zip(frames,normals):
            for vertex,normal in zip(frame,ns):
                q=[max(0,min(65535,round((vertex[i]-lower[i])/span[i]*65535))) for i in range(3)]
                nx,ny=oct_normal(Vector(normal))
                data_pixels.extend([q[0]>>8,q[0]&255,q[1]>>8,q[1]&255,q[2]>>8,q[2]&255,nx,ny])
        primitive={'attributes':{'POSITION':accessor(frames[0],3,'VEC3',bounds=True),'NORMAL':accessor(normals[0],3,'VEC3'),'TEXCOORD_0':accessor(uvs,2,'VEC2'),'TEXCOORD_1':accessor([(float(i),0.) for i in range(len(vertex_map))],2,'VEC2')},'indices':accessor(indices,1,'SCALAR',5123),'material':0 if source=='wolf' else 1}
        meshes.append({'name':f'{source}_{lod}','primitives':[primitive]})
        metadata.append({'asset':source,'lod':lod,'mesh':len(meshes)-1,'triangles':len(indices)//3,'vertices':len(vertex_map),'base_pixel':offset,'frames':25,'walk_fps':24.,'strike_frames':8,'lower':lower,'span':span})
        samples.append({'mesh':len(meshes)-1,'frames':frames,'normals':normals})
    for o in new:o.hide_set(True);o.hide_render=True
    source_records[source]['crowd_source_runtime_sha256']=hashlib.sha256(path.read_bytes()).hexdigest()

# Explicit PNG data encoding avoids display colour transforms and lossy JPEG.
pixel_count=len(data_pixels)//4;width=512;height=math.ceil(pixel_count/width)
data_pixels.extend(bytes(width*height*4-len(data_pixels)))
def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
scan=b''.join(b'\0'+data_pixels[y*width*4:(y+1)*width*4] for y in range(height))
png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',width,height,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(scan,9))+chunk(b'IEND',b'')
(OUT/'crowd-vat.png').write_bytes(png)
gltf={'asset':{'version':'2.0','generator':'CFGCN Studio crowd bake'},'scene':0,'scenes':[{'nodes':list(range(len(meshes)))}],'nodes':[{'name':m['name'],'mesh':i} for i,m in enumerate(meshes)],'meshes':meshes,'buffers':[{'byteLength':len(binary)}],'bufferViews':views,'accessors':accessors,'images':images,'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}],'textures':[{'source':i,'sampler':0} for i in range(2)],'materials':[{'name':source+' crowd original albedo','pbrMetallicRoughness':{'baseColorTexture':{'index':i},'metallicFactor':0,'roughnessFactor':.95},'doubleSided':True} for i,source in enumerate(['wolf','riverling'])]}
json_bytes=json.dumps(gltf,separators=(',',':')).encode();json_bytes+=b' '*((-len(json_bytes))%4);binary+=bytes((-len(binary))%4)
glb=struct.pack('<III',0x46546c67,2,28+len(json_bytes)+len(binary))+struct.pack('<II',len(json_bytes),0x4e4f534a)+json_bytes+struct.pack('<II',len(binary),0x004e4942)+binary
(OUT/'crowd.glb').write_bytes(glb)
record={'version':1,'data_width':width,'data_height':height,'position_bits':16,'normal_encoding':'octahedral8','meshes':metadata,'glb_sha256':hashlib.sha256(glb).hexdigest(),'data_sha256':hashlib.sha256(png).hexdigest(),'glb_bytes':len(glb),'data_bytes':len(png),'sources':[{'asset':name,'studio_project':e['studio_project'],'runtime_sha256':e['crowd_source_runtime_sha256']} for name,e in source_records.items()]}
(HERE/'crowd-metadata.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
# Verify the actual packed position data against every authored frame.
error=0.
for s,m in zip(samples,metadata):
    for f,vertices in enumerate(s['frames']):
        for i,expected in enumerate(vertices):
            k=(m['base_pixel']+(f*m['vertices']+i)*2)*4
            q=[data_pixels[k]*256+data_pixels[k+1],data_pixels[k+2]*256+data_pixels[k+3],data_pixels[k+4]*256+data_pixels[k+5]]
            error=max(error,max(abs(m['lower'][j]+q[j]/65535*m['span'][j]-expected[j]) for j in range(3)))
assert error<.001 and len(glb)+len(png)<1000000,(error,len(glb),len(png))
record['max_position_error_m']=error
(HERE/'crowd-metadata.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'source/crowd_lods.blend'))
delivery={'asset':'crowd','origin':'tripo-studio-blender-vat','source_blend':'crowd_lods.blend','sources':record['sources'],'triangles':sum(m['triangles'] for m in metadata),'bones':0,'clips':[],'bytes':len(glb),'triangle_budget':3000,'byte_budget':350000,'joint_budget':0,'primitive_budget':4,'texture_max':512,'animation_data':'crowd-vat.png','animation_data_budget':450000,'animation_data_sha256':record['data_sha256']}
manifest['assets']=[e for e in manifest['assets'] if e['asset']!='crowd']+[delivery]
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('CFGCN_CROWD '+json.dumps(record))
