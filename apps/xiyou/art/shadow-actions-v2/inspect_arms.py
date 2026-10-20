from pathlib import Path
import json,bpy
HERE=Path(__file__).resolve().parent
records=[]
for identity in ['wukong','bajie','tangseng']:
    bpy.ops.wm.open_mainfile(filepath=str(HERE/identity/(identity+'-actions.blend')))
    arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
    arm.animation_data.action=bpy.data.actions['Idle'];bpy.context.scene.frame_set(0);bpy.context.view_layer.update()
    bones={b.name:{'head':list(b.head),'tail':list(b.tail),'rest_head':list(b.bone.head_local)} for b in arm.pose.bones if any(n in b.name for n in ['arm','body','abdomen','weapon'])}
    meshes={o['woop_part_id']:{'y':[min((o.matrix_world@v.co).y for v in o.data.vertices),max((o.matrix_world@v.co).y for v in o.data.vertices)],'bbox':[[min((o.matrix_world@v.co)[i] for v in o.data.vertices),max((o.matrix_world@v.co)[i] for v in o.data.vertices)] for i in [0,2]]} for o in bpy.context.scene.objects if o.type=='MESH' and 'woop_part_id' in o and any(n in o['woop_part_id'] for n in ['arm','body','abdomen','weapon'])}
    records.append(dict(id=identity,bones=bones,meshes=meshes))
(HERE.parents[3]/'.local/qa/shadow-actions-v2/arm-diagnosis.json').write_text(json.dumps(records,indent=2),encoding='utf-8')
print(json.dumps(records))
