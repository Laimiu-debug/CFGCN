"""Render the exported GLB moving on a fixed ground; not game footage."""
from pathlib import Path
import json,sys,math
import bpy

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from studies import setup,label

record=json.loads((HERE/"wukong/manifest.json").read_text(encoding="utf-8"))
out=HERE.parents[3]/".local/qa/shadow-roster-v4/runtime-frames"
out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps=60
bpy.ops.import_scene.gltf(filepath=str(HERE/"wukong/wukong.glb"))
objects=list(bpy.context.scene.objects)
arm=next(o for o in objects if o.type=="ARMATURE")
arm.animation_data.action=bpy.data.actions["Walk"]
bpy.context.scene.frame_set(0);bpy.context.view_layer.update()
center=sum((arm.matrix_world@arm.pose.bones[n].head).x for n in ["thigh.front","thigh.back"])/2
root=bpy.data.objects.new("Inspection travel root",None);bpy.context.scene.collection.objects.link(root)
for obj in objects:
    if not obj.parent:
        transform=obj.matrix_world.copy();obj.parent=root;obj.matrix_world=transform
material,font=setup(1024,768,4.4,2.50)
label("导出 GLB · 平地行走",0,-.38,material,font,.12)
curve=bpy.data.curves.new("Ground marks","CURVE");curve.dimensions="3D";curve.bevel_depth=.0015;curve.bevel_resolution=0
for start,end in [((-3,.04,0),(3,.04,0))]+[((x*.5,.04,0),(x*.5,.04,-.04)) for x in range(-6,7)]:
    spline=curve.splines.new("POLY");spline.points.add(1)
    for p,co in zip(spline.points,[start,end]):p.co=(*co,1.)
obj=bpy.data.objects.new(curve.name,curve);bpy.context.scene.collection.objects.link(obj);curve.materials.append(material)
duration=record["walk_period"]*3
for index in range(math.ceil(duration*24)):
    time=index/24
    frame=(time%record["walk_period"])*60
    bpy.context.scene.frame_set(int(frame),subframe=frame%1)
    root.location.x=-center-record["walk_distance"]*1.5+time*record["walk_distance"]/record["walk_period"]
    bpy.context.scene.render.filepath=str(out/("%04d.png"%index));bpy.ops.render.render(write_still=True)
print("RUNTIME_VIDEO_FRAMES",math.ceil(duration*24),"fps",24)
