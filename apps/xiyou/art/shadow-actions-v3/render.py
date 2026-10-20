"""Render real GLB skill contact thumbnails and an eight-move Wukong sheet."""
from pathlib import Path
import importlib.util,json,sys
import bpy
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('render_v1',HERE.parent/'shadow-actions-v1/render.py')
engine=importlib.util.module_from_spec(spec);spec.loader.exec_module(engine);engine.HERE=HERE
records=json.loads((HERE/'manifest.json').read_text(encoding='utf-8'))['characters']
requested=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
for record in records:
    if requested and record['id'] not in requested:continue
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.scene.render.fps=60
    arm,_,root=engine.imported(record,'Idle')
    h=record['height'];engine.setup(360,270,h*2.3,h*1.6);scene=bpy.context.scene;scene.cycles.samples=2
    directory=HERE/record['id']/'thumbnails';directory.mkdir(exist_ok=True)
    for action in [s for s in record['modules'] if s.get('skill_id')]:
        clip=bpy.data.actions[action['clip']];arm.animation_data.action=clip
        frame=action['windup_end']/action['duration']*clip.frame_range[1]
        scene.frame_set(int(frame),subframe=frame%1);bpy.context.view_layer.update()
        engine.fit_camera(h*.08)
        scene.render.filepath=str(directory/(action['clip']+'.png'));bpy.ops.render.render(write_still=True)
    print('THUMBNAILS',record['id'],flush=True)
