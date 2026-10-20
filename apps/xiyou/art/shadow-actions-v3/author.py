"""Author v3 without changing accepted v4 sources or v1/v2 exports."""
from pathlib import Path
import importlib.util,json,sys,shutil,math
import bpy
from mathutils import Vector

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from catalog import ROSTER
spec=importlib.util.spec_from_file_location('previous_author',HERE.parent/'shadow-actions-v2/author.py')
previous=importlib.util.module_from_spec(spec);spec.loader.exec_module(previous)
engine=previous.engine;engine.HERE=HERE


class LoadoutPuppet(previous.ExpandedPuppet):
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
if __name__=='__main__':
    (HERE/'xiaobailong').mkdir(parents=True,exist_ok=True)
    shutil.copy2(HERE.parent/'shadow-actions-v1/xiaobailong/unsheathed-sword-source.png',HERE/'xiaobailong/unsheathed-sword-source.png')
    requested=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
    for c in ROSTER:
        if requested and c['id'] not in requested:continue
        if c['id'] in ['wolf','tiger','baigufuren']:
            shutil.copytree(HERE.parent/'shadow-actions-v2'/c['id'],HERE/c['id'],dirs_exist_ok=True)
            continue
        record=engine.build(c)
        record['arm_width_factors']=list(LoadoutPuppet.ARM_WIDTHS[c['id']])
        record['arm_review_status']='v2 widened arms and stable layers retained; user review pending'
        record['surface_sockets']['foot.front']={'bone':'foot.front','offset':[0,0,0],'meaning':'ankle; resolve terrain contact externally'}
        parts=json.loads((HERE.parent/'shadow-roster-v4'/c['id']/'woop.json').read_text(encoding='utf-8'))['parts']
        front=next(p for p in parts if p['id']=='forearm.front')
        x,y=next(a['partPx'] for a in front['anchors'] if a['id']=='distal')
        record['surface_sockets']['hand.front']={'part':'forearm.front','uv':[x/front['width'],1-y/front['height']]}
        (HERE/c['id']/'manifest.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    records=[json.loads((HERE/c['id']/'manifest.json').read_text(encoding='utf-8')) for c in ROSTER if (HERE/c['id']/'manifest.json').exists()]
    (HERE/'manifest.json').write_text(json.dumps(dict(version=3,characters=records,status='60 hero action modules and four-slot rehearsal; combat adapter pending'),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
