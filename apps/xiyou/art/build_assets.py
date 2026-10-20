"""Original CFGCN blockout assets. Run with Blender --background --python this_file.

The script builds editable meshes, actual armatures and animation clips. These are
first-pass game assets, not substitutes for the final character art review.
"""
import bpy
import argparse
import math
import json
import random
import sys
import struct
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'apps/website/public/games/xiyou/assets'
SOURCE = Path(__file__).parent / 'source'
QA = ROOT / '.local/qa/xiyou'
for folder in (OUT, SOURCE, QA):
    folder.mkdir(parents=True, exist_ok=True)
REPORT = []
PARTS = []

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    PARTS.clear()

def material(name, color, metallic=0., rough=.8):
    m=bpy.data.materials.new(name)
    m.diffuse_color=(*color,1)
    m.use_nodes=True
    bsdf=m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=(*color,1)
    bsdf.inputs['Metallic'].default_value=metallic
    bsdf.inputs['Roughness'].default_value=rough
    return m

def finish(obj, mat, name, bone=None):
    obj.name=name
    obj.data.materials.append(mat)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bone:
        group=obj.vertex_groups.new(name=bone)
        group.add(list(range(len(obj.data.vertices))),1.,'REPLACE')
    for poly in obj.data.polygons: poly.use_smooth=True
    PARTS.append(obj)
    return obj

def ellipsoid(name, loc, size, mat, bone=None, segments=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=10, location=loc)
    obj=bpy.context.object
    obj.scale=size
    return finish(obj,mat,name,bone)

def box(name, loc, scale, mat, bone=None, bevel=0.):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj=bpy.context.object
    obj.scale=scale
    finish(obj,mat,name,bone)
    if bevel:
        mod=obj.modifiers.new('Soft crafted edges','BEVEL');mod.width=bevel;mod.segments=2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj

def rod(name, a, b, r1, r2, mat, bone=None, vertices=12):
    delta=Vector(b)-Vector(a)
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r1, radius2=r2, depth=delta.length, location=(Vector(a)+Vector(b))/2)
    obj=bpy.context.object
    obj.rotation_euler=delta.to_track_quat('Z','Y').to_euler()
    return finish(obj,mat,name,bone)

def tube(name, points, radius, mat, bone=None):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.resolution_u=8
    curve.bevel_depth=radius;curve.bevel_resolution=2
    spline=curve.splines.new('BEZIER');spline.bezier_points.add(len(points)-1)
    for p,co in zip(spline.bezier_points, points): p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    obj=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active=obj;obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj=bpy.context.object
    return finish(obj,mat,name,bone)

def mesh(name, verts, faces, mat, bone=None):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj)
    return finish(obj,mat,name,bone)

def ribbon(name, points, width, mat, bone):
    verts=[]
    for x,y,z in points: verts.extend([(x-width/2,y,z),(x+width/2,y,z)])
    return mesh(name,verts,[(i,i+1,i+3,i+2) for i in range(0,len(verts)-2,2)],mat,bone)

def join_parts(name):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in PARTS: obj.select_set(True)
    bpy.context.view_layer.objects.active=PARTS[0]
    bpy.ops.object.join()
    obj=bpy.context.object;obj.name=name
    return obj

def armature():
    bpy.ops.object.armature_add(location=(0,0,0))
    arm=bpy.context.object;arm.name='CharacterRig'
    bpy.ops.object.mode_set(mode='EDIT')
    bones=arm.data.edit_bones
    bones.remove(bones[0])
    definitions=[
        ('root',(0,0,0),(0,0,1),None),
        ('hips',(0,0,1.02),(0,0,1.3),'root'),
        ('chest',(0,0,1.3),(0,0,1.72),'hips'),
        ('head',(0,0,1.72),(0,0,2.35),'chest'),
        ('tail',(0,.12,1.05),(0,.7,1.05),'hips'),
    ]
    for side,sign in [('L',-1),('R',1)]:
        definitions += [
            ('thigh.'+side,(sign*.18,0,1.05),(sign*.19,0,.58),'hips'),
            ('shin.'+side,(sign*.19,0,.58),(sign*.2,0,.14),'thigh.'+side),
            ('arm.'+side,(sign*.34,0,1.66),(sign*.56,0,1.30),'chest'),
            ('hand.'+side,(sign*.56,0,1.30),(sign*.63,-.16,1.03),'arm.'+side),
        ]
    for name,head,tail,parent in definitions:
        b=bones.new(name);b.head=head;b.tail=tail
        if parent: b.parent=bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm

def animate(arm, role=''):
    arm.animation_data_create()
    for name,length in [('Idle',48),('Walk',32),('Strike',24)]:
        action=bpy.data.actions.new(name)
        arm.animation_data.action=action
        for frame in range(0,length+1,4):
            phase=frame/length*math.tau
            for b in arm.pose.bones: b.rotation_mode='XYZ';b.rotation_euler=(0,0,0);b.location=(0,0,0)
            if name=='Walk':
                for side,sign in [('L',1),('R',-1)]:
                    arm.pose.bones['thigh.'+side].rotation_euler.x=.5*math.sin(phase)*sign
                    arm.pose.bones['shin.'+side].rotation_euler.x=max(0.,-.6*math.sin(phase)*sign)
                    arm.pose.bones['arm.'+side].rotation_euler.x=-.32*math.sin(phase)*sign
                arm.pose.bones['root'].location.z=.045*(1-math.cos(phase*2))
                arm.pose.bones['tail'].rotation_euler.z=.18*math.sin(phase)
            elif name=='Strike' and role=='monk':
                # A grounded chant/ward gesture, with the staff hand steady.
                # The left palm rises to the chest; head and torso bow gently.
                prayer=math.sin(frame/length*math.pi)
                arm.pose.bones['chest'].rotation_euler.x=.06*prayer
                arm.pose.bones['head'].rotation_euler.x=.13*prayer
                arm.pose.bones['arm.L'].rotation_euler.x=-.65*prayer
                arm.pose.bones['arm.L'].rotation_euler.y=-.4*prayer
                arm.pose.bones['hand.L'].rotation_euler.x=-.35*prayer
                arm.pose.bones['arm.R'].rotation_euler.x=-.1*prayer
            elif name=='Strike':
                swing=math.sin(frame/length*math.pi)
                arm.pose.bones['chest'].rotation_euler.z=-.6+swing*1.3
                arm.pose.bones['arm.R'].rotation_euler.y=-.9*swing
                arm.pose.bones['hand.R'].rotation_euler.x=-1.2*swing
                arm.pose.bones['arm.L'].rotation_euler.x=-.5*swing
                arm.pose.bones['root'].location.z=.06*swing
            else:
                arm.pose.bones['chest'].rotation_euler.x=.025*math.sin(phase)
                arm.pose.bones['head'].rotation_euler.z=.04*math.sin(phase)
                arm.pose.bones['tail'].rotation_euler.z=.1*math.sin(phase)
            for b in arm.pose.bones:
                b.keyframe_insert(data_path='rotation_euler',frame=frame,group=b.name)
                b.keyframe_insert(data_path='location',frame=frame,group=b.name)
        track=arm.animation_data.nla_tracks.new();track.name=name
        track.strips.new(name,0,action)
        arm.animation_data.action=None
    for b in arm.pose.bones: b.rotation_euler=(0,0,0);b.location=(0,0,0)
    bpy.context.scene.frame_set(0)

def export(name, animated=False):
    obj=join_parts(name)
    triangle_budget = {'wolf': 6000, 'monk': 4000}.get(name)
    if triangle_budget:
        # Preserve the painted palette in vertex colors, reducing every enemy
        # from eight material draws to one without allocating texture images.
        colors = [tuple(mat.diffuse_color) for mat in obj.data.materials]
        palette = obj.data.color_attributes.new(name='Palette', type='FLOAT_COLOR', domain='CORNER')
        for face in obj.data.polygons:
            for loop in face.loop_indices:
                palette.data[loop].color = colors[face.material_index]
        single = material('Painted palette', (1, 1, 1), rough=.75)
        vertex = single.node_tree.nodes.new('ShaderNodeVertexColor')
        vertex.layer_name = 'Palette'
        single.node_tree.links.new(vertex.outputs['Color'], single.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
        obj.data.materials.clear()
        obj.data.materials.append(single)
        triangles = sum(len(face.vertices) - 2 for face in obj.data.polygons)
        if triangles > triangle_budget:
            reduce = obj.modifiers.new('Enemy web budget', 'DECIMATE')
            reduce.ratio = (triangle_budget - 10) / triangles
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.modifier_apply(modifier=reduce.name)
            obj.data.validate(verbose=False)
    if animated:
        arm=armature()
        mod=obj.modifiers.new('Skin','ARMATURE');mod.object=arm
        obj.parent=arm
        animate(arm,name)
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/(name+'.blend')))
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',export_animations=animated,export_animation_mode='NLA_TRACKS',export_skins=True,export_apply=False,export_yup=True)
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    entry = {'asset':name,'vertices':sum(len(o.data.vertices) for o in meshes),'faces':sum(len(o.data.polygons) for o in meshes),'bones':len(arm.data.bones) if animated else 0,'clips':['Idle','Walk','Strike'] if animated else [],'bytes':(OUT/(name+'.glb')).stat().st_size}
    if triangle_budget:
        blob = (OUT/(name+'.glb')).read_bytes()
        length = struct.unpack_from('<I', blob, 12)[0]
        gltf = json.loads(blob[20:20+length])
        triangles = sum(gltf['accessors'][p['indices']]['count']//3 for mesh in gltf['meshes'] for p in mesh['primitives'])
        entry.update({'triangles':triangles,'triangle_budget':triangle_budget,'byte_budget':800000,'joint_budget':20,'primitive_budget':1})
    REPORT.append(entry)

def character(kind):
    reset()
    fur=material('Warm fur' if kind=='wukong' else 'Dark fur',(.29,.13,.055) if kind=='wukong' else (.23,.28,.24))
    face=material('Face',(.66,.42,.23) if kind=='wukong' else (.36,.42,.34))
    cloth=material('Ochre cloth',(.72,.41,.10) if kind=='wukong' else (.18,.25,.23))
    red=material('Cinnabar silk',(.48,.075,.045))
    gold=material('Old gold',(.68,.43,.12),.5,.42)
    ink=material('Ink',(.035,.045,.035))
    linen=material('Warm linen',(.9,.78,.55))
    boot=material('Cloth boots',(.11,.16,.13))
    ellipsoid('Travel tunic',(0,0,1.4),(.34,.23,.4),cloth,'chest')
    ellipsoid('Collar',(0,-.03,1.71),(.27,.22,.09),red,'chest')
    rod('Tiger wrap',(0,0,.86),(0,0,1.17),.34,.27,cloth,'hips',18)
    rod('Waist belt',(0,0,1.12),(0,0,1.22),.29,.28,red,'hips',18)
    for i in range(4):
        box('Tunic frog button',(0,-.225,1.33+i*.07),(.1,.035,.035),gold,'chest',.015)
    for sign,side in [(-1,'L'),(1,'R')]:
        ellipsoid('Trousers',(sign*.18,0,.84),(.145,.16,.28),boot,'thigh.'+side)
        rod('Shin cloth',(sign*.19,0,.16),(sign*.19,0,.6),.11,.13,cloth,'shin.'+side)
        ellipsoid('Boot',(sign*.2,-.09,.13),(.125,.22,.12),boot,'shin.'+side)
        for height in [.22,.30,.4]:
            rod('Boot binding',(sign*.19,0,height),(sign*.19,0,height+.025),.118,.118,linen,'shin.'+side)
        rod('Short sleeve',(sign*.30,0,1.65),(sign*.48,0,1.41),.175,.145,cloth,'arm.'+side)
        rod('Forearm',(sign*.53,0,1.37),(sign*.61,-.12,1.08),.12,.09,fur,'hand.'+side)
        ellipsoid('Hand',(sign*.63,-.16,1.03),(.10,.085,.14),face,'hand.'+side)
        rod('Wrist wrap',(sign*.59,-.08,1.21),(sign*.62,-.12,1.11),.12,.11,boot,'hand.'+side)
        ellipsoid('Ear',(sign*.31,0,2.10),(.12,.09,.15),fur,'head')
        ellipsoid('Inner ear',(sign*.32,-.07,2.1),(.065,.035,.1),face,'head')
    ellipsoid('Head',(0,0,2.1),(.29,.25,.34),fur,'head',24)
    for sign in [-1,1]:
        ellipsoid('Eye mask',(sign*.115,-.218,2.15),(.14,.065,.16),face,'head')
        ellipsoid('Eye white',(sign*.12,-.275,2.18),(.066,.03,.046),linen,'head')
        ellipsoid('Pupil',(sign*.12,-.300,2.18),(.025,.016,.032),ink,'head')
        brow=box('Brow',(sign*.12,-.275,2.24),(.16,.04,.036),fur,'head',.015);brow.rotation_euler.y=sign*-.13
    ellipsoid('Muzzle',(0,-.25,2.01),(.19,.13,.12),face,'head')
    ellipsoid('Nose',(0,-.36,2.07),(.06,.03,.037),ink,'head')
    tube('Mouth',[(-.09,-.346,1.98),(0,-.37,1.967),(.09,-.346,1.98)],.009,ink,'head')
    tube('Tail',[(0,.15,1.0),(.1,.55,.92),(.55,.85,1.1),(.9,.75,1.45),(.8,.58,1.55)],.055,fur,'tail')
    if kind=='wukong':
        tube('Golden circlet',[(-.28,0,2.28),(-.22,-.23,2.29),(0,-.27,2.28),(.22,-.23,2.29),(.28,0,2.28)],.026,gold,'head')
        for i in range(7):
            a=i/6*math.pi
            rod('Fur crest',(.15*math.cos(a),.05,2.32),(.23*math.cos(a),.04,2.48+.07*math.sin(a)),.06,.005,fur,'head',7)
        for x in [-.22,.03,.21]:
            ribbon('Tiger marking',[(x,-.292,.86),(x+.06,-.31,.98),(x+.02,-.28,1.1)],.045,ink,'hips')
        ribbon('Scarf tail',[(-.16,.12,1.66),(-.35,.35,1.53),(-.52,.50,1.38),(-.60,.44,1.22)],.15,red,'chest')
        ribbon('Belt sash',[(.08,-.3,1.18),(.15,-.34,.87),(.08,-.32,.63)],.14,red,'hips')
        rod('Iron staff',(.66,-.19,.1),(.66,-.19,2.4),.033,.033,boot,'hand.R',16)
        for z in [.14,.23,2.19,2.3]: rod('Staff gold band',(.66,-.19,z),(.66,-.19,z+.08),.048,.048,gold,'hand.R',16)
    else:
        for sign in [-1,1]:
            rod('Wolf ear',(sign*.19,0,2.29),(sign*.26,-.01,2.57),.12,.005,fur,'head',7)
            ellipsoid('Long snout',(0,-.30,2.02),(.13,.19,.11),face,'head')
        rod('Club',(.66,-.16,.8),(.66,-.16,2.),.06,.10,boot,'hand.R')
        ellipsoid('Club head',(.66,-.16,1.89),(.15,.16,.25),ink,'hand.R')
    export(kind,True)

def monk():
    reset()
    linen=material('Monk linen',(.74,.58,.34));red=material('Kasaya',(.48,.11,.055));skin=material('Skin',(.68,.48,.32));gold=material('Pilgrim gold',(.69,.46,.14),.4,.45);ink=material('Ink',(.08,.085,.06))
    rod('Robe',(0,0,.12),(0,0,1.7),.38,.24,linen,'chest',24)
    for i in range(7):
        a=i/6*math.pi
        tube('Robe fold',[(math.cos(a)*.2,-.15,1.5),(math.cos(a)*.26,-.22,.8),(math.cos(a)*.37,-.03,.14)],.013,linen,'chest')
    ribbon('Red kasaya',[(-.20,-.2,1.67),(-.12,-.27,1.3),(.08,-.35,.8),(.15,-.36,.2)],.28,red,'chest')
    ellipsoid('Head',(0,0,1.98),(.22,.21,.29),skin,'head',24)
    for sign in [-1,1]:
        ellipsoid('Eye',(sign*.08,-.195,2.02),(.042,.016,.012),ink,'head')
        rod('Sleeve',(sign*.25,0,1.58),(sign*.46,-.05,1.15),.21,.18,linen,'arm.'+('L' if sign<0 else 'R'))
        ellipsoid('Hand',(sign*.47,-.06,1.15),(.09,.075,.11),skin,'hand.'+('L' if sign<0 else 'R'))
    ellipsoid('Nose',(0,-.205,1.96),(.034,.06,.06),skin,'head')
    rod('Pilgrim staff',(.53,-.09,.06),(.53,-.09,2.22),.025,.025,gold,'hand.R')
    tube('Staff finial',[(.40,-.09,2.23),(.4,-.09,2.45),(.53,-.09,2.56),(.66,-.09,2.45),(.66,-.09,2.23)],.025,gold,'hand.R')
    for x in [.41,.53,.65]:
        bpy.ops.mesh.primitive_torus_add(major_radius=.05,minor_radius=.012,major_segments=12,minor_segments=5,location=(x,-.09,2.26),rotation=(math.pi/2,0,0))
        finish(bpy.context.object,gold,'Staff ring','hand.R')
    export('monk',True)

def landscape():
    reset();rng=random.Random(8724)
    grass=material('Mineral jade earth',(.28,.39,.27));soil=material('Warm cliff',(.36,.37,.26));stone=material('Weathered limestone',(.57,.57,.41));dark=material('Stone shadow',(.32,.38,.31));wood=material('Dark red timber',(.27,.12,.075));roof=material('Grey green tiles',(.18,.29,.27));pine=material('Ink pine',(.12,.26,.20));needle=material('Pine highlights',(.23,.36,.24));mountain=material('Distant blue green',(.36,.52,.49));light=material('Bronze details',(.56,.40,.18),.2)
    box('Mountain terrace',(0,-32,-.6),(38,84,1.2),soil,bevel=.5)
    box('Grass terrace',(0,-32,-.09),(36,82,.16),grass,bevel=.2)
    for row in range(-4,73):
        for col in range(-3,4):
            x=math.sin(row*.13)*2+col*.8+rng.uniform(-.12,.12)
            y=-row+rng.uniform(-.12,.12)
            obj=box('Stone road',(x,y,.025),(.72+rng.random()*.12,.81+rng.random()*.12,.09),stone if rng.random()<.8 else dark,bevel=.07)
            obj.rotation_euler.z=rng.uniform(-.12,.12)
    for side in [-1,1]:
        for row in range(-6,78,3):
            x=side*(17+rng.random()*4);y=-row
            rock=ellipsoid('Cliff rock',(x,y,-.9),(1.4+rng.random()*2.2,2+rng.random()*2,2+rng.random()*2),soil if rng.random()<.6 else dark,segments=8)
            rock.rotation_euler=(rng.random()*.3,rng.random()*.5,rng.random())
        for row in range(-3,75,9):
            x=side*(14.7+rng.random()*2);y=-row
            height=3+rng.random()*2
            rod('Pine trunk',(x,y,0),(x+.5*side,y+.3,height),.18,.08,wood,vertices=8)
            for tier in range(3):
                z=height-.9+tier*.65
                rod('Pine bough',(x,y,z-.7),(x+side*(1.6-tier*.35),y,z),.075,.025,wood,vertices=7)
                ellipsoid('Pine crown',(x+side*.7,y,z), (2-tier*.35,1.6-tier*.25,.55),pine if tier<2 else needle,segments=10)
    # A timber pavilion with four swept eaves and bracket sets.
    px,py=-10,-4
    box('Pavilion plinth',(px,py,.18),(5.4,5.4,.4),stone,bevel=.12)
    for x in [-1.9,1.9]:
        for y in [-1.9,1.9]:
            rod('Pavilion pillar',(px+x,py+y,.3),(px+x,py+y,3.3),.13,.10,wood)
            for layer in range(3):
                box('Bracket',(px+x,py+y,3.0+layer*.12),(.65-layer*.12,.2,.15),wood,bevel=.03)
                box('Bracket cross',(px+x,py+y,3.05+layer*.12),(.18,.65-layer*.12,.12),wood,bevel=.02)
    for height in [3.1,3.35]:
        for axis in [0,1]:
            scale=(4.6,.15,.16) if axis==0 else (.15,4.6,.16)
            for sign in [-1,1]: box('Eave beam',(px+(1.9*sign if axis else 0),py+(0 if axis else 1.9*sign),height),scale,wood)
    rings=[(2.9,3.38),(2.55,3.44),(1.6,3.9),(.6,4.55),(.02,4.7)]
    verts=[]
    for half,h in rings:
        for x,y in [(-1,-1),(-1,1),(1,1),(1,-1)]: verts.append((px+x*half,py+y*half,h+(.22 if half>2.7 else 0)))
    faces=[]
    for i in range(len(rings)-1):
        for j in range(4):faces.append((i*4+j,i*4+(j+1)%4,(i+1)*4+(j+1)%4,(i+1)*4+j))
    mesh('Swept Chinese pavilion roof',verts,faces,roof)
    for j in range(4):
        points=[verts[i*4+j] for i in range(len(rings))]
        tube('Eave ridge',points,.075,roof)
    for x in [-2.65,-2.2,2.2,2.65]:
        tube('Roof tile seam',[(px+x,py-2.8,3.48),(px+x*.8,py-2.1,3.63),(px+x*.2,py-.5,4.62)],.025,dark)
    box('Pavilion bench',(px,py+1.5,.65),(3.2,.5,.16),wood,bevel=.08)
    for route in [15,36,59]:
        for side in [-1,1]:
            x=side*5.2;y=-route
            box('Stone lantern foot',(x,y,.16),(.75,.75,.3),stone,bevel=.08)
            box('Stone lantern stem',(x,y,.58),(.25,.25,.7),stone,bevel=.04)
            box('Stone lantern chamber',(x,y,1.06),(.55,.55,.45),dark,bevel=.03)
            rod('Lantern cap',(x,y,1.29),(x,y,1.52),.53,.02,stone,vertices=4)
    for i in range(20):
        x=(-1 if i%2 else 1)*(25+rng.random()*14);y=-rng.uniform(-5,90);height=rng.uniform(6,15)
        rock=ellipsoid('Layered distant peak',(x,y,height*.18-2),(4+rng.random()*3,6+rng.random()*2,height),mountain,segments=7)
        rock.rotation_euler=(0,rng.uniform(-.3,.3),rng.random())
    export('landscape')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--assets', nargs='+', choices=['wukong', 'wolf', 'monk', 'landscape'])
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    manifest_path = OUT / 'manifest.json'
    previous = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.is_file() else {'assets': []}
    entries = {asset['asset']: asset for asset in previous['assets']}
    selected = args.assets or ['wukong', 'wolf', 'monk', 'landscape']
    for name in selected:
        # Imported and hand-finished assets have their own source pipeline.
        # A routine blockout rebuild must never replace an accepted model.
        if entries.get(name, {}).get('origin', 'procedural') != 'procedural':
            print('CFGCN_ASSET_PRESERVED ' + name)
            continue
        if name in ('wukong', 'wolf'):
            character(name)
        elif name == 'monk':
            monk()
        else:
            landscape()
        entries[name] = {**REPORT[-1], 'origin': 'procedural'}
    previous.update({'version': 1, 'generator': 'Blender ' + bpy.app.version_string,
                     'assets': list(entries.values())})
    manifest_path.write_text(json.dumps(previous, ensure_ascii=False, indent=2), encoding='utf-8')
    print('CFGCN_ASSETS_COMPLETE ' + json.dumps(REPORT))


if __name__ == '__main__':
    main()
