"""Original Eagle Grief Stream assets; use the series palette and existing Blender.

Blender --background --python apps/xiyou/art/build_river_assets.py
Creates editable source, rigged runtime GLBs, and bounded manifest entries.
"""
import bpy
import importlib.util
import json
import math
import re
import struct
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).parent
spec = importlib.util.spec_from_file_location('cfgcn_asset_builder', HERE / 'build_assets.py')
a = importlib.util.module_from_spec(spec)
spec.loader.exec_module(a)
TOKENS = dict(re.findall(r'--([\w-]+):\s*(#[a-fA-F0-9]{6});', (ROOT / 'packages/ui/src/tokens.css').read_text(encoding='utf-8')))

def color(name):
    v = TOKENS[name].lstrip('#')
    srgb = [int(v[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c < .04045 else ((c+.055)/1.055)**2.4 for c in srgb)

def palette():
    return {name: a.material(name, color(name), rough=.88) for name in ['paper','paper-raised','jade','ink','gold','gold-ink','scene-mist','accent-shuihu','line-ink','paper-shade']}

def loft(name, rows, mat, sides=12):
    verts=[]
    for i,(co,rx,rz,bone) in enumerate(rows):
        before=Vector(rows[max(0,i-1)][0]); after=Vector(rows[min(len(rows)-1,i+1)][0])
        tangent=(after-before).normalized(); side=Vector((1,0,0)); up=tangent.cross(side).normalized()
        for k in range(sides):
            angle=k/sides*math.tau
            verts.append(tuple(Vector(co)+side*math.cos(angle)*rx+up*math.sin(angle)*rz))
    faces=[]
    for i in range(len(rows)-1):
        for k in range(sides): faces.append((i*sides+k,i*sides+(k+1)%sides,(i+1)*sides+(k+1)%sides,(i+1)*sides+k))
    faces += [tuple(reversed(range(sides))),tuple((len(rows)-1)*sides+k for k in range(sides))]
    obj=a.mesh(name,verts,faces,mat)
    for i,(_,_,_,bone) in enumerate(rows):
        if bone:
            group=obj.vertex_groups.get(bone) or obj.vertex_groups.new(name=bone)
            group.add(list(range(i*sides,(i+1)*sides)),1.,'REPLACE')
    return obj

def rig(definitions):
    bpy.ops.object.armature_add();arm=bpy.context.object;arm.name='RiverRig'
    bpy.ops.object.mode_set(mode='EDIT');bones=arm.data.edit_bones;bones.remove(bones[0])
    for name,head,tail,parent in definitions:
        bone=bones.new(name);bone.head=head;bone.tail=tail
        if parent:bone.parent=bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT');return arm

def actions(arm,kind):
    arm.animation_data_create()
    for name,length in [('Idle',64),('Walk',32),('Strike',32)]:
        action=bpy.data.actions.new(name);arm.animation_data.action=action
        for frame in range(0,length+1,4):
            phase=frame/length*math.tau;stroke=math.sin(frame/length*math.pi)
            for bone in arm.pose.bones:bone.rotation_mode='XYZ';bone.rotation_euler=(0,0,0);bone.location=(0,0,0)
            if kind=='horse':
                arm.pose.bones['neck'].rotation_euler.x=.02*math.sin(phase)
                arm.pose.bones['tail'].rotation_euler.z=.13*math.sin(phase)
                if name=='Walk':
                    for label,offset in [('fore.L',0),('fore.R',math.pi),('hind.L',math.pi),('hind.R',0)]:
                        arm.pose.bones[label].rotation_euler.x=.42*math.sin(phase+offset)
                        arm.pose.bones['knee.'+label].rotation_euler.x=max(0.,.6*math.sin(phase+offset))
                    arm.pose.bones['root'].location.z=.045*(1-math.cos(phase*2))
                elif name=='Strike':
                    for side in ['L','R']:
                        arm.pose.bones['fore.'+side].rotation_euler.x=-.85*stroke
                        arm.pose.bones['knee.fore.'+side].rotation_euler.x=.5*stroke
                    arm.pose.bones['neck'].rotation_euler.x=-.16*stroke
                    arm.pose.bones['root'].location.z=.06*stroke
            else:
                for i in range(8):
                    bone=arm.pose.bones['spine'+str(i)]
                    bone.rotation_euler.y=(.035 if name=='Idle' else .075)*math.sin(phase-i*.65)
                    bone.rotation_euler.z=(.04 if name!='Strike' else .13)*math.sin(phase-i*.5)
                if name=='Strike':arm.pose.bones['head'].rotation_euler.x=-.28*stroke
            for bone in arm.pose.bones:
                bone.keyframe_insert(data_path='rotation_euler',frame=frame,group=bone.name)
                bone.keyframe_insert(data_path='location',frame=frame,group=bone.name)
        track=arm.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,0,action);arm.animation_data.action=None
    for bone in arm.pose.bones:bone.rotation_euler=(0,0,0);bone.location=(0,0,0)
    bpy.context.scene.frame_set(0)

def export(name,arm,budget):
    obj=a.join_parts(name)
    colors=[tuple(mat.diffuse_color) for mat in obj.data.materials]
    attribute=obj.data.color_attributes.new(name='Palette',type='FLOAT_COLOR',domain='CORNER')
    for face in obj.data.polygons:
        for loop in face.loop_indices:attribute.data[loop].color=colors[face.material_index]
    mat=a.material('Series painted surface',(1,1,1),rough=.88)
    node=mat.node_tree.nodes.new('ShaderNodeVertexColor');node.layer_name='Palette'
    mat.node_tree.links.new(node.outputs['Color'],mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
    obj.data.materials.clear();obj.data.materials.append(mat)
    triangles=sum(len(f.vertices)-2 for f in obj.data.polygons)
    if triangles>budget:
        reduce=obj.modifiers.new('Web triangle budget','DECIMATE');reduce.ratio=(budget-20)/triangles
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=reduce.name)
    if arm:
        skin=obj.modifiers.new('Character skin','ARMATURE');skin.object=arm;obj.parent=arm
    bpy.ops.wm.save_as_mainfile(filepath=str(a.SOURCE/(name+'.blend')))
    path=a.OUT/(name+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_animations=bool(arm),export_animation_mode='NLA_TRACKS',export_skins=True,export_yup=True)
    blob=path.read_bytes();length=struct.unpack_from('<I',blob,12)[0];gltf=json.loads(blob[20:20+length])
    triangles=sum(gltf['accessors'][p['indices']]['count']//3 for m in gltf['meshes'] for p in m['primitives'])
    return {'asset':name,'origin':'blender-original','source_blend':name+'.blend','triangles':triangles,
            'bones':len(gltf.get('skins',[{'joints':[]}])[0]['joints']),'clips':[clip['name'] for clip in gltf.get('animations',[])],
            'bytes':len(blob),'triangle_budget':budget,'byte_budget':1200000 if not arm else 600000,'joint_budget':24,'primitive_budget':1}

def horse():
    a.reset();p=palette()
    body=[((0,y,z),rx,rz,'body') for y,z,rx,rz in [(1.,1.25,.18,.22),(.7,1.38,.37,.44),(0,1.4,.39,.46),(-.65,1.42,.32,.43),(-.9,1.5,.19,.3)]]
    loft('Barrel',body,p['paper'])
    loft('Arched neck',[((0,-.65,1.4),.25,.27,'body'),((0,-.9,1.8),.23,.28,'neck'),((0,-.95,2.15),.18,.23,'neck'),((0,-1.02,2.35),.15,.18,'head')],p['paper'])
    loft('Long equine face',[((0,-.91,2.34),.16,.22,'head'),((0,-1.15,2.32),.18,.19,'head'),((0,-1.45,2.12),.12,.12,'head'),((0,-1.58,2.09),.105,.09,'head')],p['paper'])
    definitions=[('root',(0,0,0),(0,0,.8),None),('body',(0,0,1.1),(0,-.2,1.7),'root'),('neck',(0,-.7,1.55),(0,-.95,2.15),'body'),('head',(0,-.95,2.15),(0,-1.5,2.12),'neck'),('tail',(0,.9,1.4),(0,1.5,.7),'body')]
    for side,sx in [('L',-.31),('R',.31)]:
        for label,y in [('fore',-.65),('hind',.65)]:
            bone=label+'.'+side;knee='knee.'+bone;hoof='hoof.'+bone
            definitions += [(bone,(sx,y,1.36),(sx,y,.65),'body'),(knee,(sx,y,.65),(sx,y-.03,.17),bone),(hoof,(sx,y-.03,.17),(sx,y-.14,.08),knee)]
            a.rod('Upper leg',(sx,y,1.38),(sx,y,.65),.12,.075,p['paper'],bone,10)
            a.rod('Lower leg',(sx,y,.65),(sx,y-.03,.17),.065,.05,p['paper'],knee,10)
            a.ellipsoid('Hoof',(sx,y-.08,.12),(.08,.13,.09),p['ink'],hoof,12)
        a.ellipsoid('Eye',(sx*.48,-1.13,2.4),(.035,.04,.03),p['ink'],'head',12)
        a.rod('Ear',(sx*.35,-.91,2.44),(sx*.5,-.92,2.73),.065,.012,p['paper'],'head',8)
        a.ellipsoid('Nostril',(sx*.28,-1.57,2.13),(.025,.022,.016),p['ink'],'head',10)
    for i in range(7):
        y=-.68-i*.048;z=1.75+i*.085
        a.rod('Mane',(0,y,z),(0,y+.17,z-.13),.055,.012,p['scene-mist'],'neck',8)
    a.tube('Tail',[(0,.9,1.45),(0,1.4,1.15),(0,1.55,.55)],.09,p['scene-mist'],'tail')
    a.ellipsoid('Saddle cloth',(0,.1,1.78),(.43,.48,.12),p['jade'],'body',14)
    a.ellipsoid('Saddle',(0,.1,1.86),(.27,.29,.08),p['gold-ink'],'body',14)
    for sx in [-.14,.14]:a.tube('Bridle',[(sx,-.94,2.43),(sx,-1.22,2.3),(sx,-1.5,2.15)],.016,p['gold'],'head')
    a.ellipsoid('Copper bell',(0,-.95,1.85),(.07,.07,.08),p['gold'],'neck',12)
    arm=rig(definitions);actions(arm,'horse');return export('white_dragon',arm,4000)

def dragon():
    a.reset();p=palette();rows=[];definitions=[('root',(0,0,0),(0,0,.8),None)]
    centers=[(.35*math.sin(i*.75),1.8-i*.5,1.05+i*.07) for i in range(8)]
    for i,co in enumerate(centers):
        tail=centers[min(i+1,7)] if i<7 else (co[0],co[1]-.4,co[2]+.1)
        definitions.append(('spine'+str(i),co,tail,'root' if i==0 else 'spine'+str(i-1)))
        rows.append((co,.09+min(i,5)*.035,.1+min(i,5)*.035,'spine'+str(i)))
    loft('Serpentine body',rows,p['paper'],14)
    head=centers[-1];definitions.append(('head',head,(head[0],head[1]-.5,head[2]+.2),'spine7'))
    x,y,z=head
    a.ellipsoid('Dragon skull',(x,y-.23,z+.17),(.3,.38,.26),p['paper'],'head',16)
    a.ellipsoid('Long muzzle',(x,y-.57,z+.08),(.2,.32,.13),p['paper-raised'],'head',14)
    for side in [-1,1]:
        a.ellipsoid('Eye',(x+side*.22,y-.32,z+.29),(.07,.085,.06),p['gold'],'head',12)
        a.ellipsoid('Pupil',(x+side*.25,y-.36,z+.29),(.025,.045,.03),p['ink'],'head',10)
        a.tube('Antler',[(x+side*.2,y-.04,z+.35),(x+side*.34,y+.1,z+.7),(x+side*.42,y+.28,z+.88)],.035,p['gold'],'head')
        a.rod('Antler branch',(x+side*.31,y+.08,z+.64),(x+side*.53,y-.08,z+.76),.025,.008,p['gold'],'head',8)
        a.tube('Whisker',[(x+side*.17,y-.75,z+.12),(x+side*.55,y-.9,z+.2),(x+side*.85,y-.65,z+.35)],.017,p['paper-raised'],'head')
        for i in [3,6]:
            cx,cy,cz=centers[i];bone='spine'+str(i)
            a.rod('Leg',(cx+side*.15,cy,cz),(cx+side*.55,cy-.12,cz-.35),.065,.04,p['paper'],bone,8)
            for toe in range(3):a.rod('Claw',(cx+side*.55,cy-.12,cz-.35),(cx+side*(.64+toe*.06),cy-.28+toe*.1,cz-.4),.025,.008,p['gold'],bone,7)
    for i,(cx,cy,cz) in enumerate(centers):
        a.mesh('Jade dorsal crest',[(cx-.04,cy,cz+.15),(cx,cy+.17,cz+.58),(cx+.04,cy-.15,cz+.15)],[(0,1,2)],p['jade'],'spine'+str(i))
    arm=rig(definitions);actions(arm,'dragon');return export('river_dragon',arm,4500)

def riverling():
    a.reset();p=palette()
    a.ellipsoid('River robe',(0,0,1.18),(.38,.24,.53),p['jade'],'chest',14)
    a.ellipsoid('Fish head',(0,-.04,1.98),(.3,.24,.27),p['scene-mist'],'head',14)
    a.ellipsoid('Muzzle',(0,-.24,1.9),(.22,.11,.1),p['paper-raised'],'head',12)
    for side in [-1,1]:
        a.ellipsoid('Eye',(side*.2,-.2,2.08),(.1,.075,.1),p['paper'],'head',12)
        a.ellipsoid('Pupil',(side*.2,-.265,2.08),(.04,.025,.055),p['ink'],'head',10)
        label='L' if side<0 else 'R'
        a.rod('Arm',(side*.26,0,1.55),(side*.55,-.04,1.15),.13,.09,p['jade'],'arm.'+label,8)
        a.ellipsoid('Hand',(side*.57,-.07,1.12),(.11,.11,.12),p['scene-mist'],'hand.'+label,10)
        a.rod('Leg',(side*.17,0,.94),(side*.21,-.05,.2),.13,.07,p['gold-ink'],'thigh.'+label,8)
        a.ellipsoid('Foot',(side*.2,-.14,.15),(.13,.23,.1),p['scene-mist'],'shin.'+label,10)
        a.mesh('Cheek fin',[(side*.25,.02,2.1),(side*.58,.1,2.19),(side*.31,-.06,1.87)],[(0,1,2)],p['accent-shuihu'],'head')
    a.tube('Gold sash',[(-.25,-.2,1.62),(0,-.27,1.12),(.25,-.2,.77)],.045,p['gold'],'chest')
    a.ellipsoid('Water vessel',(.58,-.12,1.18),(.16,.15,.2),p['paper-raised'],'hand.R',12)
    arm=a.armature();a.animate(arm);return export('riverling',arm,3000)

def scenery():
    spec=importlib.util.spec_from_file_location('painted_world',HERE/'build_painted_world.py')
    world=importlib.util.module_from_spec(spec);spec.loader.exec_module(world)
    return world.build('river_scene')

if __name__=='__main__':
    path=a.OUT/'manifest.json';manifest=json.loads(path.read_text(encoding='utf-8'))
    entries={entry['asset']:entry for entry in manifest['assets']}
    # Accepted Studio assets must survive routine scenery rebuilds.
    reports=[] if entries.get('white_dragon',{}).get('origin','blender-original')!='blender-original' else [horse()]
    if entries.get('river_dragon',{}).get('origin','blender-original')=='blender-original':reports.append(dragon())
    if entries.get('riverling',{}).get('origin','blender-original')=='blender-original':reports.append(riverling())
    reports.append(scenery())
    entries.update({entry['asset']:entry for entry in reports});manifest['assets']=list(entries.values())
    path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    print('CFGCN_RIVER_ASSETS '+json.dumps(reports))
