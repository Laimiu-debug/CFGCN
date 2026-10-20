"""Re-author the accepted Studio party rigs; no source model regeneration.

Foot targets, contact duration and distance-driven runtime cadence share
motion-profile.json. Retains the five public clip indices and web budgets.
"""
import bpy, importlib.util, json, math, struct
from pathlib import Path
from mathutils import Euler, Quaternion, Vector

HERE=Path(__file__).parent;ROOT=HERE.parents[2]
OUT=ROOT/'apps/website/public/games/xiyou/assets'
PROFILES=json.loads((HERE/'motion-profile.json').read_text(encoding='utf-8'))
spec=importlib.util.spec_from_file_location('limb_motion',HERE/'build_wukong.py')
ik=importlib.util.module_from_spec(spec);spec.loader.exec_module(ik)
TITLES={'monk':['Ward','Benediction'],'wukong':['Binding','HairClones'],'white_dragon':['WaveSurge','ScaleWard']}

def rotation(arm,name,xyz):
    bone=arm.pose.bones.get(name)
    if bone:bone.rotation_quaternion=Euler(xyz,'XYZ').to_quaternion()

def reset(arm):
    for bone in arm.pose.bones:
        bone.rotation_mode='QUATERNION';bone.rotation_quaternion=Quaternion()
        bone.location=(0,0,0);bone.scale=(1,1,1)

def root_offset(arm,xyz):
    # PoseBone.location is in the bone's rest axes, NOT Blender world axes.
    # The vertical root's local Y is up. The old local-Z bob slid along Y.
    root=arm.pose.bones['root']
    root.location=root.bone.matrix_local.to_quaternion().inverted()@Vector(xyz)

def contact(profile,cycle):
    """Constant speed planted interval; an eased high return arc."""
    stance=profile['stance'];span=profile['stride']*stance
    if cycle<stance:return -span/2+profile['stride']*cycle,0.,-.08+.18*cycle/stance
    u=(cycle-stance)/(1-stance)
    # Cubic endpoint tangents avoid the foot reversing instantly at toe-off.
    tangent=span*.32
    h=2*u*u*u-3*u*u+1
    y=h*span/2+(u*u*u-2*u*u+u)*tangent+(1-h)*(-span/2)+(u*u*u-u*u)*tangent
    return y,profile['lift']*math.sin(math.pi*u)**1.4,.35*math.sin(math.pi*u)

def flight(profile,t):
    phase=t%.5
    if phase<profile['stance']:return 0.
    return math.sin(math.pi*(phase-profile['stance'])/(.5-profile['stance']))**2

def feet_for_monk(arm):
    if 'foot.L' not in arm.data.bones:
        bpy.context.view_layer.objects.active=arm
        bpy.ops.object.mode_set(mode='EDIT')
        for side in ['L','R']:
            shin=arm.data.edit_bones['shin.'+side]
            foot=arm.data.edit_bones.new('foot.'+side)
            foot.head=shin.tail;foot.tail=shin.tail+Vector((0,-.20,-.06));foot.parent=shin
        bpy.ops.object.mode_set(mode='OBJECT')
    # Keep the robe continuous, but let the ankles/soles roll independently.
    # Repeated builds start from the same normalized lower-body weights.
    for obj in [o for o in bpy.context.scene.objects if o.type=='MESH']:
        for side in ['L','R']:
            if not obj.vertex_groups.get('foot.'+side):obj.vertex_groups.new(name='foot.'+side)
        for v in obj.data.vertices:
            if v.co.z>.33:continue
            weights={obj.vertex_groups[g.group].name:g.weight for g in v.groups}
            for side in ['L','R']:
                total=weights.get('shin.'+side,0)+weights.get('foot.'+side,0)
                foot=max(0.,min(1.,(.32-v.co.z)/.14))*total
                for name,value in [('shin.'+side,total-foot),('foot.'+side,foot)]:
                    group=obj.vertex_groups[name]
                    if value>1e-6:group.add([v.index],value,'REPLACE')
                    else:group.remove([v.index])

def biped(arm,name,clip,t):
    p=PROFILES[name];phase=t*math.tau;moving=clip=='Walk';monk=name=='monk'
    if moving:
        root_offset(arm,(.025*math.sin(phase),0,(-.15 if monk else -.19)+(.08 if monk else .10)*flight(p,t)))
        rotation(arm,'hips',(.02, .025*math.sin(phase),.06*math.sin(phase)))
        rotation(arm,'chest',(-.085 if monk else -.15,-.025*math.sin(phase),-.08*math.sin(phase)))
        rotation(arm,'head',(.04,0,.025*math.sin(phase-.3)))
    else:
        root_offset(arm,(0,0,.004*math.sin(phase)))
        rotation(arm,'chest',(.012*math.sin(phase),.008*math.cos(phase),0))
        rotation(arm,'head',(.008*math.sin(phase-.5),0,.012*math.sin(phase)))
    cast=clip not in ['Idle','Walk']
    weight=0.
    if cast:
        weight=ik.interpolate([(0.,0.),(.16,-.18),(.38,1.),(.58,.85),(.82,.28),(1.,0.)],t)
        root_offset(arm,(.035*weight,-.04*weight,-.045*max(0.,weight)))
        rotation(arm,'hips',(.025*weight,0,-.12*weight))
        rotation(arm,'chest',((.09 if monk else -.04)*weight,0,(.18 if monk else .32)*weight))
        rotation(arm,'head',((.1 if monk else .04)*weight,0,-.10*weight))
    bpy.context.view_layer.update()
    for side,offset in [('L',0.),('R',.5)]:
        foot=arm.pose.bones['foot.'+side];base=foot.bone.head_local.copy()
        y,lift,pitch=contact(p,(t+offset)%1.) if moving else (0.,0.,0.)
        target=base+Vector((0,y,lift))
        ik.solve_limb(arm,'thigh.'+side,'shin.'+side,'foot.'+side,target,(0,-1,0))
        ik.set_world_rotation(foot,Quaternion((1,0,0),pitch)@foot.bone.matrix_local.to_quaternion())
    if monk:
        # Travel with a relaxed staff hand and counter-rotating shoulders.
        rotation(arm,'arm.L',((-.28*math.sin(phase)) if moving else -.10,0,-.08))
        rotation(arm,'hand.L',(-.14,0,0))
        rotation(arm,'arm.R',(.07*math.sin(phase+.4) if moving else 0.,0,.04))
        rotation(arm,'hand.R',(-.04,0,0))
        if cast:
            variant=0 if clip in ['Strike','Ward'] else 1
            rotation(arm,'arm.L',((-.98 if not variant else -.68)*weight,(.25 if not variant else -.38)*weight,-.25*weight))
            rotation(arm,'hand.L',(-.40*weight,.05*weight,(.20 if not variant else -.35)*weight))
            rotation(arm,'arm.R',(-.18*weight,-.08*weight,.06*weight))
    else:
        for side in ['L','R']:
            sign=1 if side=='L' else -1
            wrist=Vector((sign*.44,-.17,1.24));direction=Vector((0,0,1))
            if moving:
                wrist.y+=sign*.20*math.sin(phase);wrist.z+=.035*math.cos(phase)
                direction=Vector((-.10,.14*math.sin(phase-.4),1)).normalized()
            elif cast:
                if clip=='Strike':
                    if side=='R':
                        wrist=Vector(ik.interpolate([(0.,(-.44,-.17,1.24)),(.20,(-.47,.10,1.5)),(.43,(-.10,-.48,1.43)),(.64,(.15,-.33,1.25)),(1.,(-.44,-.17,1.24))],t))
                        direction=Vector(ik.interpolate([(0.,(0,0,1)),(.20,(-.65,.10,.75)),(.43,(.84,-.48,.22)),(.64,(.85,.28,-.1)),(1.,(0,0,1))],t)).normalized()
                    else:wrist=Vector((.44,-.17-.22*weight,1.24+.20*weight))
                elif side=='L':
                    goal=Vector((.45,-.40,1.82)) if clip=='Binding' else Vector(ik.interpolate([(0.,(.20,-.24,2.05)),(.35,(.20,-.24,2.05)),(.65,(.56,-.36,1.48)),(1.,(.44,-.17,1.24))],t))
                    wrist=wrist.lerp(goal,weight)
                else:
                    wrist+=Vector((-.08*weight,.06*weight,.08*weight));direction=Vector((-.25*weight,.15*weight,1)).normalized()
            hand=ik.solve_limb(arm,'upper_arm.'+side,'forearm.'+side,'hand.'+side,wrist,(sign,-.5,-.1))
            delta=Vector((0,0,1)).rotation_difference(direction) if side=='R' else Euler((-.25*weight,0,-.15)).to_quaternion()
            ik.set_world_rotation(hand,delta@hand.bone.matrix_local.to_quaternion())
            rotation(arm,'fingers.'+side,(-.85 if side=='R' else -.25,0,0))
            rotation(arm,'thumb.'+side,(0,0,.35*sign))
        for i in range(1,7):rotation(arm,f'tail.{i}',(.025*math.sin(phase-i*.4),0,(.05 if moving else .025)*math.sin(phase-i*.55)))
        rotation(arm,'sash.1',(.11*math.sin(phase-.5)+.10*weight,0,-.08*weight))
        rotation(arm,'sash.2',(.14*math.sin(phase-1.),0,-.10*weight))

def horse(arm,clip,t):
    p=PROFILES['white_dragon'];phase=t*math.tau;moving=clip=='Walk';cast=clip not in ['Idle','Walk']
    weight=ik.interpolate([(0.,0.),(.2,-.18),(.43,1.),(.66,.65),(1.,0.)],t) if cast else 0.
    root_offset(arm,(0,0,(-.21+.08*flight(p,t)) if moving else -.035*max(0,weight)))
    rotation(arm,'body',((-.045+.025*math.sin(phase*2)) if moving else (-.09 if clip in ['Strike','WaveSurge'] else .03)*weight,.018*math.sin(phase) if moving else 0.,.022*math.sin(phase) if moving else 0.))
    rotation(arm,'neck',(.045*math.sin(phase*2-.5) if moving else (.28 if clip=='WaveSurge' else -.12)*weight,0,.018*math.sin(phase-.5)))
    rotation(arm,'head',(-.03*math.sin(phase*2-.8) if moving else -.10*weight,.08*weight if clip=='ScaleWard' else 0.,0))
    rotation(arm,'tail',(.05*math.sin(phase-.8),.07*math.sin(phase-.5),.12*math.sin(phase-1.)))
    bpy.context.view_layer.update()
    for label,offset in [('fore.L',0.),('fore.R',.5),('hind.L',.5),('hind.R',0.)]:
        hoof=arm.pose.bones['hoof.'+label];target=hoof.bone.head_local.copy()
        pitch=0.
        if moving:
            y,lift,pitch=contact(p,(t+offset)%1.);target.y+=y;target.z+=lift
        elif cast:
            # A single leading hoof rises then lands; the other three support
            # the weight. Both front legs no longer hover as a rigid pair.
            if label=='fore.L':target.y-=.30*weight;target.z+=.36*max(0.,weight)
            elif label=='fore.R':target.y+=.07*weight
            elif label.startswith('hind'):target.y+=.04*weight
        ik.solve_limb(arm,label,'knee.'+label,'hoof.'+label,target,(0,1 if label.startswith('hind') else -1,0))
        ik.set_world_rotation(hoof,Quaternion((1,0,0),pitch*.6)@hoof.bone.matrix_local.to_quaternion())

def rebuild(name):
    bpy.ops.wm.open_mainfile(filepath=str(HERE/'source'/f'{name}.blend'))
    arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
    if name=='monk':feet_for_monk(arm)
    arm.animation_data_create();tracks=arm.animation_data.nla_tracks
    for track in list(tracks):tracks.remove(track)
    arm.animation_data.action=None
    bpy.context.scene.render.fps=30
    for title,length in [('Idle',60),('Walk',30),('Strike',22)]+[(t,24) for t in TITLES[name]]:
        action=bpy.data.actions.new(title);arm.animation_data.action=action
        for frame in range(length+1):
            bpy.context.scene.frame_set(frame);reset(arm)
            if name=='white_dragon':horse(arm,title,frame/length)
            else:biped(arm,name,title,frame/length)
            for bone in arm.pose.bones:
                bone.keyframe_insert('location',frame=frame,group=bone.name)
                bone.keyframe_insert('rotation_quaternion',frame=frame,group=bone.name)
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        for key in curve.keyframe_points:key.interpolation='LINEAR'
        track=tracks.new();track.name=title;track.strips.new(title,0,action);track.mute=True
        arm.animation_data.action=None
    for track in tracks:track.mute=False
    reset(arm);bpy.context.scene.frame_set(0)
    arm['motion_profile']='motion-profile.json';arm['motion_revision']='grounded-stride-v2'
    # Remove only unused actions from this editable derivative. Raw Studio
    # originals and the pre-edit snapshots are preserved separately.
    for action in list(bpy.data.actions):
        if action.users==0:bpy.data.actions.remove(action)
    for image in bpy.data.images:
        if image.type=='IMAGE' and max(image.size)>1024:
            ratio=1024/max(image.size);image.scale(round(image.size[0]*ratio),round(image.size[1]*ratio));image.pack()
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'source'/f'{name}.blend'))
    if name=='wukong':
        for obj in [o for o in bpy.context.scene.objects if o.type=='MESH']:
            triangles=sum(len(p.vertices)-2 for p in obj.data.polygons)
            if triangles>5700:
                obj.data=obj.data.copy();bpy.context.view_layer.objects.active=obj
                mod=obj.modifiers.new('Runtime silhouette budget','DECIMATE');mod.ratio=5700/triangles
                bpy.ops.object.modifier_move_up(modifier=mod.name);bpy.ops.object.modifier_apply(modifier=mod.name)
                ik.prune_weights(obj)
    path=OUT/f'{name}.pending.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_image_format='JPEG',export_jpeg_quality=82)
    blob=path.read_bytes();gltf=json.loads(blob[20:20+struct.unpack_from('<I',blob,12)[0]])
    names=[a['name'] for a in gltf['animations']];assert names==['Idle','Walk','Strike']+TITLES[name],names
    triangles=sum(gltf['accessors'][p['indices']]['count']//3 for m in gltf['meshes'] for p in m['primitives'])
    manifest=json.loads((OUT/'manifest.json').read_text(encoding='utf-8'));entry=next(e for e in manifest['assets'] if e['asset']==name)
    assert len(blob)<=entry['byte_budget'],(name,len(blob))
    assert triangles<=entry['triangle_budget'],(name,triangles)
    path.replace(OUT/f'{name}.glb')
    entry.update(bytes=len(blob),triangles=triangles,bones=len(arm.data.bones),clips=names,motion_revision='grounded-stride-v2',motion_profile='apps/xiyou/art/motion-profile.json',spell_motion='Grounded IK feet, weight shift, counter rotation, distinct anticipation / release / recovery; accepted Studio mesh preserved')
    (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    print('CFGCN_PARTY_MOTION '+json.dumps({'asset':name,'bytes':len(blob),'bones':len(arm.data.bones),'clips':names}))

if __name__=='__main__':
    for name in PROFILES:rebuild(name)
