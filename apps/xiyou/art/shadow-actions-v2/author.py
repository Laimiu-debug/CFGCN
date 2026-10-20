"""Author v2 using the preserved v1 hand/foot solver and v4 source rigs."""
from pathlib import Path
import importlib.util,json,sys,shutil,math
import bpy
from mathutils import Vector

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from catalog import ROSTER,modules
spec=importlib.util.spec_from_file_location('action_engine_v1',HERE.parent/'shadow-actions-v1/author.py')
engine=importlib.util.module_from_spec(spec);spec.loader.exec_module(engine)
engine.HERE=HERE
OriginalPuppet=engine.Puppet


class ExpandedPuppet(OriginalPuppet):
    ARM_WIDTHS={
        'wukong':(1.65,1.60),'tangseng':(1.55,1.50),
        'bajie':(1.45,1.40),'shaseng':(1.50,1.45),
        'xiaobailong':(1.75,1.70),'wolf':(1.45,1.40),
        'tiger':(1.35,1.30),'baigufuren':(1.60,1.60)}

    def __init__(self,arm,meshes,c):
        super().__init__(arm,meshes,c)
        # Widen the paper silhouette perpendicular to the shoulder-elbow /
        # elbow-palm line. Both true joint anchors stay fixed. Scaling world X
        # would move the palm on angled limbs and detach it from the shaft.
        widths=self.ARM_WIDTHS[c['id']]
        depths={'upper_arm.back':-.028,'forearm.back':-.032,
                'upper_arm.front':-.036,'forearm.front':-.040,'weapon':-.030}
        for side in ['back','front']:
            for part,factor in zip(['upper_arm','forearm'],widths):
                name=part+'.'+side;obj=meshes[name]
                start=arm.matrix_world@arm.data.bones[name].head_local
                end=arm.matrix_world@(arm.data.bones['forearm.'+side].head_local if part=='upper_arm' else self.hands[side])
                axis=end-start;axis.y=0;axis.normalize()
                for vertex in obj.data.vertices:
                    point=obj.matrix_world@vertex.co
                    delta=point-start;delta.y=0
                    perpendicular=delta-axis*delta.dot(axis)
                    point+=perpendicular*(factor-1)
                    point.y=depths[name]
                    vertex.co=obj.matrix_world.inverted()@point
        for vertex in meshes['weapon'].data.vertices:
            point=meshes['weapon'].matrix_world@vertex.co;point.y=depths['weapon']
            vertex.co=meshes['weapon'].matrix_world.inverted()@point
        self.arm['cfgcn_arm_width_factors']=json.dumps(widths)
        self.arm['cfgcn_arm_layers']='torso < rear upper < shaft < rear forearm < front upper < front forearm'
        bpy.context.view_layer.update()

    def sample(self,spec,t):
        working=dict(spec)
        if spec.get('footwork')=='two_step':working['clip']='DodgeBack'
        super().sample(working,t)
        if not 0<t<1:return
        # Geometry now has stable silhouette layers at rest and during motion.
        # Cancel v1's temporary far-arm/shaft depth migration so the near arm
        # cannot be covered when the far arm crosses the chest.
        weight=engine.smooth(t/.19)*(1-engine.smooth((t-.76)/.24))
        for name,depth in [('upper_arm.back',.0175),('weapon',-.0045)]:
            bone=self.arm.pose.bones[name]
            bone.location+=bone.bone.matrix_local.to_quaternion().inverted()@Vector((0,depth*weight,0))
        root=self.arm.pose.bones['pelvis']
        air=spec.get('airborne')
        if air and air['start']<t<air['end']:
            u=(t-air['start'])/(air['end']-air['start'])
            lift=self.h*air['height_ratio']*math.sin(math.pi*u)**1.25
            root.location+=root.bone.matrix_local.to_quaternion().inverted()@Vector((0,0,lift))
            # A jump gathers the knees rather than lifting a standing pose.
            # Different front/back amplitudes retain a readable silhouette.
            tuck=math.sin(math.pi*u)**1.5
            for side,amount in [('front',.32),('back',.21)]:
                for part,angle in [('thigh',-amount),('shin',2*amount),('foot',-amount)]:
                    bone=self.arm.pose.bones[part+'.'+side];q=bone.rotation_quaternion.copy()
                    engine.rotate(bone,angle*tuck);bone.rotation_quaternion=q@bone.rotation_quaternion
        if spec.get('stomp'):
            # Lift one foot while the other remains a support, then plant at
            # the contact event. The hand/weapon solution is not disturbed.
            u=max(0.,min(1.,(t-.15)/.40))
            amplitude=math.sin(math.pi*u)**1.5 if t<.55 else 0.
            for name,angle in [('thigh.front',-.35),('shin.front',.55),('foot.front',-.20)]:
                bone=self.arm.pose.bones[name]
                q=bone.rotation_quaternion.copy()
                engine.rotate(bone,angle*amplitude)
                bone.rotation_quaternion=q@bone.rotation_quaternion
        bpy.context.view_layer.update()


engine.Puppet=ExpandedPuppet
if __name__=='__main__':
    directory=HERE/'xiaobailong';directory.mkdir(parents=True,exist_ok=True)
    shutil.copy2(HERE.parent/'shadow-actions-v1/xiaobailong/unsheathed-sword-source.png',directory/'unsheathed-sword-source.png')
    requested=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
    for character in ROSTER:
        if not requested or character['id'] in requested:
            record=engine.build(character)
            record['arm_width_factors']=list(ExpandedPuppet.ARM_WIDTHS[character['id']])
            record['arm_review_status']='wider silhouette and stable foreground layers; user visual review pending'
            record['surface_sockets']['foot.front']={'bone':'foot.front','offset':[0,0,0],'meaning':'ankle release origin; ground contact resolved by collision'}
            (HERE/character['id']/'manifest.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    records=[json.loads((HERE/c['id']/'manifest.json').read_text(encoding='utf-8')) for c in ROSTER if (HERE/c['id']/'manifest.json').exists()]
    (HERE/'manifest.json').write_text(json.dumps(dict(version=2,characters=records,status='original expanded action candidates; game integration pending'),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
