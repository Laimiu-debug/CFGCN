"""Author independent v6 sources; preserve all earlier candidates and rasters."""
from pathlib import Path
import importlib.util,json,sys,shutil,math
import bpy
from mathutils import Vector,Matrix

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from catalog import ROSTER,COMPACT
spec=importlib.util.spec_from_file_location('previous_author',HERE.parent/'shadow-actions-v2/author.py')
previous=importlib.util.module_from_spec(spec);spec.loader.exec_module(previous)
engine=previous.engine;engine.HERE=HERE


class LoadoutPuppet(previous.ExpandedPuppet):
    GRIPS={'wukong':.16,'tangseng':.14,'bajie':.18,'shaseng':.17,
           'xiaobailong':.14,'wolf':.15,'tiger':.18,'baigufuren':.14}
    ASPECT={'wukong':(.78,.78),'tangseng':(.72,.70),'bajie':(.88,.88),
            'shaseng':(.84,.82),'xiaobailong':(.70,.72),'wolf':(.76,.76),
            'tiger':(.88,.86),'baigufuren':(.66,.68)}
    SHOULDERS={
        'wukong':{'back':(30.1,92.8),'front':(242,80)},
        'tangseng':{'back':(33.6,81.6),'front':(211,82)},
        'bajie':{'back':(47.7,72.7),'front':(245,63)},
        'shaseng':{'back':(23.6,63.6),'front':(219,64)},
        'xiaobailong':{'back':(26.8,63),'front':(212,60)},
        'wolf':{'back':(34.7,86.8),'front':(244,91)},
        'tiger':{'back':(32.7,84),'front':(258,72)},
        'baigufuren':{'back':(23.8,63.2),'front':(178,64)}}

    @classmethod
    def seat_shoulders(cls,arm,meshes,c,parts):
        arm.animation_data.action=None
        for bone in arm.pose.bones:bone.matrix_basis=Matrix.Identity(4)
        bpy.context.view_layer.update()
        body=next(p for p in parts if p['id']=='body')
        shifts={}
        for side,pixel in cls.SHOULDERS[c['id']].items():
            target=engine.surface_point(meshes['body'],[pixel[0]/body['width'],1-pixel[1]/body['height']])
            delta=target-arm.matrix_world@arm.data.bones['upper_arm.'+side].head_local
            delta.y=0;shifts[side]=delta
        names={'back':['upper_arm.back','forearm.back'],'front':['upper_arm.front','forearm.front','weapon']}
        points={name:[obj.matrix_world@v.co for v in obj.data.vertices] for group in names.values() for name in group for obj in [meshes[name]]}
        bpy.context.view_layer.objects.active=arm;arm.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        for side,group in names.items():
            delta=arm.matrix_world.to_3x3().inverted()@shifts[side]
            for name in group:
                arm.data.edit_bones[name].head+=delta
                arm.data.edit_bones[name].tail+=delta
        bpy.ops.object.mode_set(mode='OBJECT');bpy.context.view_layer.update()
        for side,group in names.items():
            for name in group:
                obj=meshes[name]
                for vertex,point in zip(obj.data.vertices,points[name]):
                    vertex.co=obj.matrix_world.inverted()@(point+shifts[side])
        arm['cfgcn_shoulder_source_pixels']=json.dumps(cls.SHOULDERS[c['id']])

    @staticmethod
    def compact(arm,meshes,c):
        arm.animation_data.action=None
        for bone in arm.pose.bones:bone.matrix_basis=Matrix.Identity(4)
        bpy.context.view_layer.update()
        leg,torso,width,weapon=COMPACT[c['id']]
        height=c['source_height'];lo=height*.42;hi=height*.78
        center=sum(arm.data.bones['thigh.'+s].head_local.x for s in ['front','back'])/2
        def warp(point):
            p=point.copy();p.x=center+(p.x-center)*width
            p.z=min(p.z,lo)*leg+max(0,min(p.z,hi)-lo)*torso+max(0,p.z-hi)*.98
            return p
        points={name:[obj.matrix_world@v.co for v in obj.data.vertices] for name,obj in meshes.items()}
        head=arm.matrix_world@arm.data.bones['head'].head_local
        grip=arm.matrix_world@arm.data.bones['weapon'].head_local
        weapon_axis=engine.surface_point(meshes['weapon'],[0,1])-engine.surface_point(meshes['weapon'],[0,0]);weapon_axis.normalize()
        weapon_bone_axis=arm.data.bones['weapon'].tail_local-arm.data.bones['weapon'].head_local
        bpy.context.view_layer.objects.active=arm;arm.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        for bone in arm.data.edit_bones:
            bone.head=warp(bone.head);bone.tail=warp(bone.tail)
        arm.data.edit_bones['weapon'].tail=arm.data.edit_bones['weapon'].head+weapon_bone_axis*weapon
        bpy.ops.object.mode_set(mode='OBJECT');bpy.context.view_layer.update()
        for name,obj in meshes.items():
            for vertex,point in zip(obj.data.vertices,points[name]):
                if name=='head':new=warp(head)+(point-head)*.98
                elif name=='weapon':
                    offset=point-grip;parallel=weapon_axis*offset.dot(weapon_axis)
                    offset=parallel*weapon+(offset-parallel)*1.02
                    new=warp(grip)+offset
                else:new=warp(point)
                vertex.co=obj.matrix_world.inverted()@new
        # Re-solve planted soles and gait from the new skeleton, rather than
        # reusing positional keys designed for longer legs.
        for action in list(bpy.data.actions):bpy.data.actions.remove(action)
        from motion import animate
        animate(arm,meshes,c['proportions'])
        arm['cfgcn_compact_body']=json.dumps(dict(leg=leg,torso=torso,width=width,face=.98,weapon=weapon))

    def __init__(self,arm,meshes,c):
        self.compact(arm,meshes,c)
        parts=json.loads((HERE.parent/'shadow-roster-v4'/c['id']/'woop.json').read_text(encoding='utf-8'))['parts']
        self.seat_shoulders(arm,meshes,c,parts)
        super().__init__(arm,meshes,c)
        landmarks=json.loads((HERE/'arm-landmarks.json').read_text(encoding='utf8'))['actors'][c['id']]
        self.arm_crops={}
        # Source placement used a sheared affine fit. Refit the existing pixels
        # along the real joint axis, with an independent thickness per actor;
        # round hinge art must not become a razor-thin diagonal oval.
        for side in ['front','back']:
            for index,part_name in enumerate(['upper_arm','forearm']):
                name=part_name+'.'+side;obj=meshes[name]
                part=next(p for p in parts if p['id']==name)
                pivot=landmarks[name]['pivot']
                distal=landmarks[name].get('distal',next(a['partPx'] for a in part['anchors'] if a['id']=='distal'))
                to_uv=lambda p:[p[0]/part['width'],1-p[1]/part['height']]
                depth=engine.surface_point(obj,to_uv(pivot)).y
                start=arm.matrix_world@arm.data.bones[name].head_local
                end=(arm.matrix_world@arm.data.bones['forearm.'+side].head_local if part_name=='upper_arm'
                     else engine.surface_point(obj,to_uv(distal)))
                start.y=end.y=depth
                source_axis=Vector((distal[0]-pivot[0],distal[1]-pivot[1]));source_length=source_axis.length;source_axis.normalize()
                source_perp=Vector((source_axis.y,-source_axis.x))
                axis=end-start;axis.y=0;length=axis.length;axis.normalize()
                perpendicular=Vector((-axis.z,0,axis.x))
                aspect=self.ASPECT[c['id']][index]
                uv={loop.vertex_index:tuple(obj.data.uv_layers.active.data[loop.index].uv) for loop in obj.data.loops}
                for i,(u,v) in uv.items():
                    delta=Vector((u*part['width']-pivot[0],(1-v)*part['height']-pivot[1]))
                    point=start+axis*(delta.dot(source_axis)*length/source_length)+perpendicular*(delta.dot(source_perp)*length/source_length*aspect)
                    point.y=start.y
                    obj.data.vertices[i].co=obj.matrix_world.inverted()@point
        # The source upper sleeve includes another cuff below its elbow.
        # Keep the original pixels; trim the native quad and its UV together
        # just beyond the elbow cap. Otherwise a bent arm grows a third limb.
        for side in ['front','back']:
            name='upper_arm.'+side;part=next(p for p in parts if p['id']==name)
            elbow=landmarks[name]['distal']
            end=min(part['height'],elbow[1]+part['width']*.22)
            minimum=1-end/part['height'];obj=meshes[name]
            original={loop.vertex_index:tuple(obj.data.uv_layers.active.data[loop.index].uv) for loop in obj.data.loops}
            points={i:obj.matrix_world@v.co for i,v in enumerate(obj.data.vertices)}
            corners=lambda u,v:min(original,key=lambda i:abs(original[i][0]-u)+abs(original[i][1]-v))
            a,b,d=[points[corners(u,v)] for u,v in [(0,0),(1,0),(0,1)]]
            for i,(u,v) in original.items():
                cropped=minimum+v*(1-minimum)
                obj.data.vertices[i].co=obj.matrix_world.inverted()@(a+(b-a)*u+(d-a)*cropped)
            for loop in obj.data.loops:
                u,v=original[loop.vertex_index]
                obj.data.uv_layers.active.data[loop.index].uv=(u,minimum+v*(1-minimum))
            self.arm_crops[name]=dict(source_height=part['height'],elbow_pixel=elbow,visible_end=end)
        arm['cfgcn_elbow_caps']=json.dumps(self.arm_crops)
        arm['cfgcn_two_hand_grip_ratio']=self.GRIPS[c['id']]
        connections={}
        for side in ['front','back']:
            point=arm.matrix_world@arm.data.bones['forearm.'+side].head_local
            connections[side]={part:engine.surface_marker(meshes[part+'.'+side],point) for part in ['upper_arm','forearm']}
            shoulder=arm.matrix_world@arm.data.bones['upper_arm.'+side].head_local
            connections[side]['body']=engine.surface_marker(meshes['body'],shoulder)
            connections[side]['shoulder']=engine.surface_marker(meshes['upper_arm.'+side],shoulder)
        arm['cfgcn_arm_connections']=json.dumps(connections)

    def interpolate(self,spec,t):
        p=super().interpolate(spec,t)
        if spec['clip'] in ['HitRecoil','DodgeBack'] or self.c['id'] in ['wolf','tiger','baigufuren']:return p
        contact=spec['windup_end']/spec['duration']
        envelope=math.sin(math.pi*t)**2
        pre=math.exp(-((t-(contact-.13))/.11)**2)
        follow=math.exp(-((t-(contact+.10))/.12)**2)
        amplitude={'tangseng':.012,'wukong':.055,'bajie':.070,'shaseng':.035,'xiaobailong':.045}[self.c['id']]
        # Torso loads before the weapon, then follows it. The existing IK
        # re-solves both hands and planted soles for these secondary keys.
        p['lean']+=amplitude*(-pre+follow*.65)*envelope
        p['compression']+=amplitude*.20*pre*envelope
        return p

    def action(self,spec,upper=False):
        # Dense samples alone may straddle a release/catch timestamp. Author
        # exact boundary keys too, so the gameplay event and visible handoff
        # share the same pose after export/reimport.
        flight=spec.get('weapon_flight')
        if flight:
            working=dict(spec);working['poses']=[dict(p) for p in spec['poses']]
            for time in [flight['start'],flight['turn'],flight['catch']]:
                if not any(abs(p['t']-time)<1e-8 for p in working['poses']):
                    working['poses'].append(dict(t=time,**self.interpolate(spec,time)))
            working['poses'].sort(key=lambda p:p['t'])
            return super().action(working,upper)
        return super().action(spec,upper)

    def sample(self,spec,t):
        super().sample(spec,t)
        if 0<t<1 and self.c['id'] not in ['wolf','tiger','baigufuren']:
            contact=spec['windup_end']/spec['duration']
            lag=math.sin((t-contact)*math.pi*3)*math.sin(math.pi*t)**2
            for name,amount in [('head',.045),('accessory',.11 if self.c['id']=='wukong' else .065)]:
                bone=self.arm.pose.bones[name];q=bone.rotation_quaternion.copy()
                engine.rotate(bone,lag*amount);bone.rotation_quaternion=q@bone.rotation_quaternion
            bpy.context.view_layer.update()
        if spec.get('two_hand') and 0<t<1:
            weight=engine.smooth(t/.19)*(1-engine.smooth((t-.76)/.24))
            hand=self.arm.pose.bones['forearm.back'].matrix@self.arm.data.bones['forearm.back'].matrix_local.inverted()@self.hands['back']
            p=self.interpolate(spec,t)
            axis=Vector((math.sin(p['weapon']),0,math.cos(p['weapon'])))
            primary=self.arm.pose.bones['weapon'].head.copy();corrected=primary.copy()
            offset=-axis*self.GRIPS[self.c['id']]*self.h
            # A wider grip must still lie in BOTH arms' reachable discs.
            # Moving only the rear fist would clamp short arms off the shaft.
            for _ in range(16):
                for side,delta in [('front',Vector()),('back',offset)]:
                    shoulder=self.arm.pose.bones['upper_arm.'+side].head
                    reach=sum(self.arm_lengths[side])-.003
                    d=corrected+delta-shoulder;d.y=0
                    if d.length>reach:corrected-=d.normalized()*(d.length-reach)
            changed=(corrected-primary)*weight
            self.solve_arm('front',primary+changed)
            engine.rotate(self.arm.pose.bones['weapon'],p['weapon']-engine.world_angle(self.arm.pose.bones['forearm.front']))
            bpy.context.view_layer.update()
            actual=(self.arm.pose.bones['weapon'].matrix@self.arm.data.bones['weapon'].matrix_local.inverted()).to_3x3()@(engine.surface_point(self.meshes['weapon'],[0,1])-engine.surface_point(self.meshes['weapon'],[0,0]))
            actual.normalize()
            target=self.arm.pose.bones['weapon'].head-actual*self.GRIPS[self.c['id']]*self.h
            hand=hand.lerp(target,weight)
            error=self.solve_arm('back',hand)
            if .21<t<.74:self.max_hand_error=max(self.max_hand_error,error)
        flight=spec.get('weapon_flight')
        if not flight or not flight['start']<t<flight['catch']:return
        bone=self.arm.pose.bones['weapon']
        held=bone.matrix.copy()
        u=(t-flight['start'])/(flight['catch']-flight['start'])
        envelope=math.sin(math.pi*u)**.75
        # Lift the rigid staff before rotating it. Rotate around the visible
        # shaft's midpoint rather than the hand, keeping the lower tip clear
        # of the ground throughout release, flight and catch.
        turn=2*math.pi*engine.smooth(u)
        points=[self.meshes['weapon'].matrix_world@v.co for v in self.meshes['weapon'].data.vertices]
        rest_center=sum(points,Vector())/len(points)
        offset=bone.bone.matrix_local.inverted()@rest_center
        pivot=held@offset
        desired=pivot+Vector((self.h*flight['distance_height_ratio']*envelope,0,self.h*flight['lift_height_ratio']*envelope))
        engine.rotate(bone,engine.world_angle(bone)-engine.world_angle(bone.parent)+turn)
        bpy.context.view_layer.update()
        delta=desired-bone.matrix@offset
        parent=bone.parent.matrix@bone.parent.bone.matrix_local.inverted()@bone.bone.matrix_local
        bone.location+=parent.to_3x3().inverted()@delta
        bpy.context.view_layer.update()


engine.Puppet=LoadoutPuppet
original_export=engine.export_glb
def export_precise(arm,meshes,c,directory,order):
    # glTF force sampling at 60 Hz used to discard the denser IK keys. Keep
    # the same durations while exporting at 120 Hz, so wrists stay on shafts
    # between sampled frames rather than opening a gap during fast turns.
    for action in bpy.data.actions:
        for slot in action.slots:
            for layer in action.layers:
                for strip in layer.strips:
                    bag=strip.channelbag(slot)
                    if bag:
                        for curve in bag.fcurves:
                            for key in curve.keyframe_points:
                                key.co.x*=2;key.handle_left.x*=2;key.handle_right.x*=2
    bpy.context.scene.render.fps=120
    return original_export(arm,meshes,c,directory,order)
engine.export_glb=export_precise
if __name__=='__main__':
    (HERE/'xiaobailong').mkdir(parents=True,exist_ok=True)
    shutil.copy2(HERE.parent/'shadow-actions-v1/xiaobailong/unsheathed-sword-source.png',HERE/'xiaobailong/unsheathed-sword-source.png')
    requested=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
    for c in ROSTER:
        if requested and c['id'] not in requested:continue
        record=engine.build(c)
        record['arm_width_factors']=list(LoadoutPuppet.ARM_WIDTHS[c['id']])
        record['arm_review_status']='v6 preserves compact body and grounded control; five signature ultimates; visual review pending'
        record['body_proportions']=dict(zip(['leg_scale','torso_scale','body_width','weapon_length'],COMPACT[c['id']]))
        record['original_height']=c['source_height']
        record['grip_distance_ratio']=LoadoutPuppet.GRIPS[c['id']]
        arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
        record['arm_surface_markers']=json.loads(arm['cfgcn_arm_connections'])
        record['elbow_caps']=json.loads(arm['cfgcn_elbow_caps'])
        record['arm_structure_revision']='upper sleeve native quad/UV trimmed beyond elbow; original raster unchanged'
        record['arm_cross_axis_aspect']=list(LoadoutPuppet.ASPECT[c['id']])
        record['shoulder_source_pixels']=LoadoutPuppet.SHOULDERS[c['id']]
        record['native_export_hz']=120
        record['surface_sockets']['foot.front']={'bone':'foot.front','offset':[0,0,0],'meaning':'ankle; resolve terrain contact externally'}
        parts=json.loads((HERE.parent/'shadow-roster-v4'/c['id']/'woop.json').read_text(encoding='utf-8'))['parts']
        front=next(p for p in parts if p['id']=='forearm.front')
        x,y=next(a['partPx'] for a in front['anchors'] if a['id']=='distal')
        record['surface_sockets']['hand.front']={'part':'forearm.front','uv':[x/front['width'],1-y/front['height']]}
        (HERE/c['id']/'manifest.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    records=[json.loads((HERE/c['id']/'manifest.json').read_text(encoding='utf-8')) for c in ROSTER if (HERE/c['id']/'manifest.json').exists()]
    (HERE/'manifest.json').write_text(json.dumps(dict(version=6,characters=records,status='manual four-slot trial with five optional ultimates; final art and balance pending'),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
