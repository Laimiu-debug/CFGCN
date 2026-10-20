"""Render the twenty new native actions, including release and recovery.

These are exported-model inspection films, not footage from combat.
"""
from pathlib import Path
import importlib.util,json,math,sys
import bpy
from mathutils import Vector
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
spec=importlib.util.spec_from_file_location('native_render',HERE.parent/'shadow-actions-v1/render.py')
engine=importlib.util.module_from_spec(spec);spec.loader.exec_module(engine);engine.HERE=HERE
records=json.loads((HERE/'manifest.json').read_text(encoding='utf-8'))['characters']
requested=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
for record in records[:5]:
    if requested and record['id'] not in requested:continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene=bpy.context.scene;scene.render.fps=60
    arm,_,root=engine.imported(record,'Idle');base_x=root.location.x
    h=record['height'];items=record['modules'][8:12]
    left,right,bottom,top=0.,0.,0.,h
    for item in items:
        b=record['inspection_bounds'][item['clip']];dist=item.get('root_motion',{}).get('distance',0)
        left=min(left,b[0]+min(0,dist));right=max(right,b[2]+max(0,dist));bottom=min(bottom,b[1]);top=max(top,b[3])
    width=max(right-left+h*.35,(top-bottom+h*.35)*4/3)
    material,font=engine.setup(800,600,width,top+h*.15)
    scene.cycles.samples=2
    center=Vector(((left+right)/2,0,(top+bottom)/2))
    scene.camera.location=(center.x,-15,center.z)
    scene.camera.rotation_euler=(center-Vector(scene.camera.location)).to_track_quat('-Z','Y').to_euler()
    engine.label(record['name']+' · 新增四招 · GLB 动作检视',center.x,bottom-h*.12,material,font,h*.065)
    label=next(o for o in scene.objects if o.type=='FONT')
    directory=ROOT/'.local/qa/shadow-actions-v6/frames'/record['id'];directory.mkdir(parents=True,exist_ok=True)
    intervals=[];end=0.
    for item in items:
        intervals.append((end,end+item['duration']+.28,item));end+=item['duration']+.28
    for frame_index in range(math.ceil(end*24)):
        at=frame_index/24
        start,_,item=next(v for v in intervals if v[0]<=at<v[1])
        phase=min(1.,(at-start)/item['duration']);action=bpy.data.actions[item['clip']]
        arm.animation_data.action=action;frame=phase*action.frame_range[1]
        scene.frame_set(int(frame),subframe=frame%1)
        root.location.x=base_x
        motion=item.get('root_motion')
        if motion:
            keys=motion['keys'];a,b=keys[0],keys[-1]
            for i in range(len(keys)-1):
                if keys[i][0]<=phase<=keys[i+1][0]:a,b=keys[i:i+2];break
            u=max(0.,min(1.,(phase-a[0])/max(.0001,b[0]-a[0])))
            root.location.x+=motion['distance']*(a[1]+(b[1]-a[1])*u*u*(3-2*u))
        stage='起手' if at-start<item['windup_end'] else '发力' if at-start<item['release_end'] else '收势'
        label.data.body=record['name']+' · '+item['label']+' · '+stage
        scene.render.filepath=str(directory/(f'{frame_index:04d}.png'));bpy.ops.render.render(write_still=True)
    timing=dict(frames=frame_index+1,fps=24,duration=(frame_index+1)/24,clips=[s['clip'] for s in items],source='actual exported GLB',combat_footage=False)
    (directory/'timing.json').write_text(json.dumps(timing,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('FILMED',record['id'],timing,flush=True)
