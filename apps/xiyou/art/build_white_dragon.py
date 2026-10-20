"""Finish the actual Tripo Studio White Dragon Horse for the browser game.

The immutable textured FBX is retained. Blender normalizes, reduces, skins and
authors three motions; runtime GLB stays under 6,000 triangles and 1 MB.
"""
import bpy
import bmesh
import hashlib
import importlib.util
import json
import math
import struct
from pathlib import Path
from mathutils import Matrix, Quaternion, Vector

HERE=Path(__file__).parent
ROOT=HERE.parents[2]
RAW=HERE/'source/raw/white-dragon-studio-p2-source.fbx'
RAW_HASH='3ee50608a8e050b418ab54f8f6e71be65e7d837ad02783001d3ed9d95ad25d9c'
OUT=ROOT/'apps/website/public/games/xiyou/assets'
spec=importlib.util.spec_from_file_location('cfgcn_motion',HERE/'build_wukong.py')
motion=importlib.util.module_from_spec(spec);spec.loader.exec_module(motion)
spec=importlib.util.spec_from_file_location('cfgcn_river',HERE/'build_river_assets.py')
river=importlib.util.module_from_spec(spec);spec.loader.exec_module(river)

def smooth(v):
    t=max(0.,min(1.,v));return t*t*(3-2*t)

def prepare():
    assert hashlib.sha256(RAW.read_bytes()).hexdigest()==RAW_HASH
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(RAW))
    obj=next(o for o in bpy.context.scene.objects if o.type=='MESH');obj.name='White Dragon Horse'
    obj.data.transform(obj.matrix_world);obj.parent=None;obj.matrix_world=Matrix.Identity(4)
    floor=min(v.co.z for v in obj.data.vertices);scale=2.7/(max(v.co.z for v in obj.data.vertices)-floor)
    obj.data.transform(Matrix.Scale(scale,4) @ Matrix.Translation((0,0,-floor)))
    bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00002)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
    bpy.context.view_layer.objects.active=obj
    triangles=sum(len(f.vertices)-2 for f in obj.data.polygons)
    decimate=obj.modifiers.new('Web silhouette budget','DECIMATE');decimate.ratio=5960/triangles
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    for face in obj.data.polygons:face.use_smooth=True
    for mat in obj.data.materials:
        shader=mat.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Metallic'].default_value=0;shader.inputs['Roughness'].default_value=.88
        shader.inputs['Specular IOR Level'].default_value=.2
    for image in bpy.data.images:
        if image.type=='IMAGE' and image.size[0]>1024:
            image.scale(1024,1024)
            image.pack()
    return obj

def skeleton(obj):
    definitions=[('root',(0,0,0),(0,0,.8),None),('body',(0,0,1.25),(0,-.25,1.65),'root'),
                 ('neck',(0,-.62,1.55),(0,-.82,2.14),'body'),('head',(0,-.82,2.14),(0,-1.28,2.09),'neck'),
                 ('tail',(0,.87,1.61),(0,1.38,.85),'body')]
    for side,x in [('L',-.31),('R',.31)]:
        for label,y,knee_y,hoof_y in [('fore',-.67,-.69,-.77),('hind',.66,.92,.72)]:
            name=label+'.'+side
            definitions.extend([(name,(x,y,1.36),(x,knee_y,.69),'body'),
                                ('knee.'+name,(x,knee_y,.69),(x,hoof_y,.16),name),
                                ('hoof.'+name,(x,hoof_y,.16),(x,hoof_y-.12,.1),'knee.'+name)])
    arm=river.rig(definitions);arm.name='White Dragon Horse rig'
    groups={bone.name:obj.vertex_groups.new(name=bone.name) for bone in arm.data.bones}
    for vertex in obj.data.vertices:
        x,y,z=vertex.co;weights={'body':1.}
        leg=smooth((1.38-z)/.3)*smooth((abs(x)-.06)/.12)
        if leg>0:
            label=('fore' if y<0 else 'hind')+('.L' if x<0 else '.R')
            candidates=[label,'knee.'+label,'hoof.'+label]
            nearby=sorted([(name,motion.segment_distance(vertex.co,arm.data.bones[name].head_local,arm.data.bones[name].tail_local)) for name in candidates],key=lambda item:item[1])[:2]
            values=[math.exp(-distance*distance/.04) for _,distance in nearby];total=sum(values) or 1.
            weights={'body':1-leg,**{name:leg*value/total for (name,_),value in zip(nearby,values)}}
        if y<-.45 and z>1.38:
            neck=smooth((z-1.38)/.35)*smooth((-.4-y)/.25)
            head=smooth((-.74-y)/.32)
            weights={'body':1-neck,'neck':neck*(1-head),'head':neck*head}
        if y>.9 and abs(x)<.28:
            tail=smooth((y-.85)/.25)
            weights={'body':1-tail,'tail':tail}
        weights={name:weight for name,weight in weights.items() if weight>.00001}
        total=sum(weights.values())
        for name,weight in weights.items():groups[name].add([vertex.index],weight/total,'REPLACE')
    skin=obj.modifiers.new('Studio horse skin','ARMATURE');skin.object=arm;obj.parent=arm
    return arm

def animate(arm):
    bpy.context.scene.render.fps=48;arm.animation_data_create()
    for name,length in [('Idle',96),('Walk',32),('Strike',32)]:
        action=bpy.data.actions.new(name);arm.animation_data.action=action
        for frame in range(length+1):
            t=frame/length;phase=t*math.tau;stroke=math.sin(t*math.pi)
            for bone in arm.pose.bones:
                bone.rotation_mode='QUATERNION';bone.rotation_quaternion=Quaternion();bone.location=(0,0,0)
            arm.pose.bones['neck'].rotation_quaternion=Quaternion((1,0,0),.014*math.sin(phase) if name!='Strike' else -.1*stroke)
            arm.pose.bones['tail'].rotation_quaternion=Quaternion((0,0,1),.08*math.sin(phase))
            bpy.context.view_layer.update()
            for label,offset in [('fore.L',0),('fore.R',.5),('hind.L',.5),('hind.R',0)]:
                end=arm.pose.bones['hoof.'+label]
                target=end.bone.head_local.copy()
                if name=='Walk':
                    cycle=(t+offset)%1
                    target.y+=-.22+cycle*.88 if cycle<.5 else .22-(cycle-.5)*.88
                    target.z+=0 if cycle<.5 else .18*math.sin((cycle-.5)*math.tau)
                elif name=='Strike' and label.startswith('fore'):
                    target.y-=.38*stroke;target.z+=.48*stroke
                motion.solve_limb(arm,label,'knee.'+label,'hoof.'+label,target,(0,1 if label.startswith('hind') else -1,0))
                motion.set_world_rotation(end,end.bone.matrix_local.to_quaternion())
            for bone in arm.pose.bones:
                bone.keyframe_insert('rotation_quaternion',frame=frame,group=bone.name)
                bone.keyframe_insert('location',frame=frame,group=bone.name)
        track=arm.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,0,action)
        track.mute=True;arm.animation_data.action=None
    for track in arm.animation_data.nla_tracks:track.mute=False
    for bone in arm.pose.bones:bone.rotation_quaternion=Quaternion();bone.location=(0,0,0)
    bpy.context.scene.frame_set(0)

def main():
    obj=prepare();arm=skeleton(obj);animate(arm)
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'source/white_dragon.blend'))
    bpy.ops.export_scene.gltf(filepath=str(OUT/'white_dragon.glb'),export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_yup=True,export_image_format='JPEG',export_jpeg_quality=85)
    blob=(OUT/'white_dragon.glb').read_bytes();length=struct.unpack_from('<I',blob,12)[0];gltf=json.loads(blob[20:20+length])
    triangles=sum(gltf['accessors'][p['indices']]['count']//3 for mesh in gltf['meshes'] for p in mesh['primitives'])
    assert triangles<=6000 and len(blob)<1_000_000
    entry={'asset':'white_dragon','origin':'tripo-studio-blender','studio_project':'dbcfe539-3d0f-491b-af54-e523d218de08',
           'source_file':RAW.name,'source_sha256':RAW_HASH,'source_blend':'white_dragon.blend','triangles':triangles,'bones':17,
           'clips':[clip['name'] for clip in gltf['animations']],'bytes':len(blob),'triangle_budget':6000,'byte_budget':1_000_000,
           'joint_budget':24,'primitive_budget':1,'texture_max':1024}
    path=OUT/'manifest.json';manifest=json.loads(path.read_text(encoding='utf-8'))
    manifest['assets']=[entry if item['asset']=='white_dragon' else item for item in manifest['assets']]
    path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    spec=importlib.util.spec_from_file_location('spell_motion',HERE/'build_spell_motion.py')
    spells=importlib.util.module_from_spec(spec);spec.loader.exec_module(spells);spells.spells('white_dragon')
    entry=next(e for e in json.loads(path.read_text(encoding='utf-8'))['assets'] if e['asset']=='white_dragon')
    print('CFGCN_STUDIO_HORSE '+json.dumps(entry))

if __name__=='__main__':main()
