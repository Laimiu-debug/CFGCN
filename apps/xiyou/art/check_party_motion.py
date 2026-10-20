"""Verify delivered GLBs, grounded soles and contact motion after re-import.

Runs in the already installed Blender. No rendered turntable substitutes for
the separate in-game movement / spell / turn recordings.
"""
import bpy,json,math
from pathlib import Path
HERE=Path(__file__).parent;ROOT=HERE.parents[2]
PROFILES=json.loads((HERE/'motion-profile.json').read_text(encoding='utf-8'))
OUT=ROOT/'.local/qa/party-motion';OUT.mkdir(parents=True,exist_ok=True)
report=[]
for name,profile in PROFILES.items():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/f'apps/website/public/games/xiyou/assets/{name}.glb'))
    arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
    shapes={bone.custom_shape for bone in arm.pose.bones if bone.custom_shape}
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and o not in shapes]
    tracks=arm.animation_data.nla_tracks
    for track in tracks:track.mute=True
    record={'asset':name,'clips':[]}
    for track in tracks:
        action=track.strips[0].action;arm.animation_data.action=action;arm.animation_data.action_slot=action.slots[0]
        start,end=action.frame_range;clip={'name':track.name,'floor':1e6,'maximum_extent':0.}
        for i in range(25):
            t=i/24;frame=start+(end-start)*t
            bpy.context.scene.frame_set(int(frame),subframe=frame-int(frame));bpy.context.view_layer.update()
            dg=bpy.context.evaluated_depsgraph_get();points=[]
            for ob in meshes:
                evaluated=ob.evaluated_get(dg);mesh=evaluated.to_mesh()
                points.extend(evaluated.matrix_world@v.co for v in mesh.vertices);evaluated.to_mesh_clear()
            assert all(math.isfinite(v)for p in points for v in p),(name,track.name,'nonfinite')
            low=[min(p[j]for p in points)for j in range(3)];high=[max(p[j]for p in points)for j in range(3)]
            clip['floor']=min(clip['floor'],low[2]);clip['maximum_extent']=max(clip['maximum_extent'],max(b-a for a,b in zip(low,high)))
        assert clip['floor']>-.125,(name,track.name,'below floor',clip['floor'])
        assert clip['maximum_extent']<4.8,(name,track.name,'stretched mesh',clip['maximum_extent'])
        if track.name=='Walk':
            feet=[('hoof.fore.L',0.),('hoof.fore.R',.5),('hoof.hind.L',.5),('hoof.hind.R',0.)] if name=='white_dragon' else [('foot.L',0.),('foot.R',.5)]
            clip['feet']={}
            for foot_name,offset in feet:
                foot=arm.pose.bones[foot_name];contacts=[]
                for i in range(13):
                    t=offset+profile['stance']*i/12
                    frame=start+(end-start)*t;bpy.context.scene.frame_set(int(frame),subframe=frame-int(frame));bpy.context.view_layer.update()
                    position=arm.matrix_world@foot.head
                    contacts.append([position.x,position.y-profile['stride']*t,position.z])
                drift=[max(v[j]for v in contacts)-min(v[j]for v in contacts)for j in range(3)]
                clip['feet'][foot_name]={'stance_drift':drift,'contacts':contacts}
                print('STANCE_CONTACT '+json.dumps({'asset':name,'foot':foot_name,'drift':drift}))
                assert drift[1]<.075,(name,foot_name,'planted foot slides',drift)
                assert drift[2]<.055,(name,foot_name,'planted foot height varies',drift)
        record['clips'].append(clip)
    report.append(record)
(OUT/'exported-motion.json').write_text(json.dumps(report,indent=2))
print('CFGCN_PARTY_MOTION_CHECK '+json.dumps(report))
