"""Render full-body Idle standees from the actual v6 GLBs, without repainting."""
from pathlib import Path
import importlib.util,json
import bpy
from mathutils import Vector
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('render_engine',HERE.parent/'shadow-actions-v1/render.py')
engine=importlib.util.module_from_spec(spec);spec.loader.exec_module(engine);engine.HERE=HERE
for record in json.loads((HERE/'manifest.json').read_text(encoding='utf-8'))['characters'][:5]:
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.scene.render.fps=60
    engine.imported(record,'Idle',.13)
    h=record['height'];engine.setup(420,600,h*1.5,h*1.5)
    scene=bpy.context.scene;scene.cycles.samples=8;scene.render.film_transparent=True
    graph=bpy.context.evaluated_depsgraph_get();points=[]
    for obj in bpy.context.scene.objects:
        if obj.type=='MESH' and any(m.type=='ARMATURE' for m in obj.modifiers):
            evaluated=obj.evaluated_get(graph);mesh=evaluated.to_mesh()
            points.extend(evaluated.matrix_world@v.co for v in mesh.vertices)
            evaluated.to_mesh_clear()
    low=Vector((min(p.x for p in points),0,min(p.z for p in points)))
    high=Vector((max(p.x for p in points),0,max(p.z for p in points)))
    scene.camera.location.x=(low.x+high.x)/2;scene.camera.location.z=(low.z+high.z)/2
    scene.camera.data.ortho_scale=max(high.z-low.z+h*.18,(high.x-low.x+h*.18)*600/420)
    print('FRAME',record['id'],list(low),list(high),scene.camera.data.ortho_scale,flush=True)
    scene.render.filepath=str(HERE/record['id']/'standee.png');bpy.ops.render.render(write_still=True)
    print('STANDEE',record['id'],flush=True)
