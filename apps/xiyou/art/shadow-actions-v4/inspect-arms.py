"""Same-scale close views of the actual exported elbow/hand surfaces."""
from pathlib import Path
import importlib.util,json,sys
import bpy
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
spec=importlib.util.spec_from_file_location('inspection',HERE.parent/'shadow-actions-v1/render.py')
render=importlib.util.module_from_spec(spec);spec.loader.exec_module(render)
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
version='shadow-actions-v4' if 'before' in args else 'shadow-actions-v4'
render.HERE=HERE.parent/version
records=json.loads((render.HERE/'manifest.json').read_text(encoding='utf8'))['characters']
clips=['LotusPulse','StaffSweep','RakeHook','SpadeSweep','TwinCrescent','SaberSlash','AxeCleave','BoneBolt']
out=ROOT/'.local/qa/shadow-actions-v4';out.mkdir(exist_ok=True,parents=True)
for i,r in enumerate(records):
    if args and r['id'] not in args:continue
    clip=clips[i]
    for phase in ([.43] if 'before' in args else [0,.30,.55,.83]):
        bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.scene.render.fps=60
        arm,_,_=render.imported(r,clip,phase)
        h=r['height'];render.setup(1000,800,h*.94,h*.65)
        scene=bpy.context.scene;scene.cycles.samples=2
        scene.camera.location.x=h*.12;scene.camera.location.z=h*.72
        scene.camera.data.ortho_scale=h*.94
        scene.render.filepath=str(out/(('before' if 'before' in args else 'after')+'-'+r['id']+'-'+str(phase)+'.png'))
        bpy.ops.render.render(write_still=True)
        print('ARM_VIEW',r['id'],phase,flush=True)
