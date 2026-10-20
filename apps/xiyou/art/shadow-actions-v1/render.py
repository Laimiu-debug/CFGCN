"""Actual exported GLB action pose sheets and optional inspection footage.

This is model inspection, not gameplay. No source artwork is repainted here.
"""
from pathlib import Path
import json,sys,math
import bpy
from mathutils import Vector

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
sys.path.insert(0,str(HERE.parent/"shadow-roster-v4"))
from studies import setup,label
records=json.loads((HERE/"manifest.json").read_text(encoding="utf-8"))["characters"]


def imported(record,clip,phase=0,x=0):
    before=set(bpy.data.objects);actions=set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=str(HERE/record["id"]/record["runtime"]))
    objects=set(bpy.data.objects)-before;new_actions=set(bpy.data.actions)-actions
    arm=next(o for o in objects if o.type=="ARMATURE")
    action=next(a for a in new_actions if a.name.split(".")[0]==clip)
    arm.animation_data.action=action
    frame=phase*action.frame_range[1];bpy.context.scene.frame_set(int(frame),subframe=frame%1);bpy.context.view_layer.update()
    center=sum((arm.matrix_world@arm.pose.bones["thigh."+s].head).x for s in ["front","back"])/2
    root=bpy.data.objects.new("Action inspection root",None);bpy.context.scene.collection.objects.link(root)
    for obj in objects:
        if not obj.parent:
            transform=obj.matrix_world.copy();obj.parent=root;obj.matrix_world=transform
    root.location.x=x-center
    return arm,action,root


def fit_camera(padding=.15):
    bpy.context.view_layer.update();graph=bpy.context.evaluated_depsgraph_get();points=[]
    for o in bpy.context.scene.objects:
        if o.type in ["MESH","FONT"]:
            obj=o.evaluated_get(graph);points.extend(obj.matrix_world@Vector(c) for c in obj.bound_box)
    lowx,highx=min(p.x for p in points),max(p.x for p in points)
    lowz,highz=min(p.z for p in points),max(p.z for p in points)
    scene=bpy.context.scene;camera=scene.camera
    camera.data.ortho_scale=max(highx-lowx+2*padding,(highz-lowz+2*padding)*scene.render.resolution_x/scene.render.resolution_y)
    camera.location.x=(lowx+highx)/2;camera.location.z=(lowz+highz)/2


def sheet(record,all_actions=False):
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.scene.render.fps=60
    h=record["height"];spacing=h*1.65;span=spacing*3+h*3
    specs=record["modules"] if all_actions else record["modules"][:1]
    material,font=setup(2400,700*len(specs),span,h*1.82)
    for row,spec in enumerate(specs):
        z=-row*h*2.05
        for index,phase in enumerate([0,spec["poses"][0]["t"],spec["windup_end"]/spec["duration"],.87]):
            x=(index-1.5)*spacing
            arm,action,root=imported(record,spec["clip"],phase,x);root.location.z+=z
            pose={b.name:b.matrix_basis.copy() for b in arm.pose.bones};arm.animation_data_clear()
            for n,m in pose.items():arm.pose.bones[n].matrix_basis=m
            label(["备势","蓄力","接触 / 释放","收势"][index],x,z-.18*h,material,font,.075*h)
        label(record["name"]+" · "+spec["label"],0,z+h*1.65,material,font,.07*h)
    fit_camera(h*.10)
    bpy.context.scene.render.filepath=str(HERE/record["id"]/("all-actions.png" if all_actions else "action-poses.png"));bpy.ops.render.render(write_still=True)


def video(record):
    bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;scene.render.fps=60
    arm,_,root=imported(record,"Idle")
    h=record["height"];material,font=setup(960,720,h*2.25,h*1.43)
    # Flat unlit cutouts have no lighting/noise to converge; two samples keep
    # edge antialiasing without spending time on eight identical light paths.
    scene.cycles.samples=2
    title=label("",0,-.17*h,material,font,.075*h)
    # studies.label returns no object; select the text data directly.
    text=next(o for o in scene.objects if o.type=="FONT")
    items=record["modules"]
    intervals=[];at=0
    for spec in items:
        intervals.append((at,at+spec["duration"]+.35,spec));at+=spec["duration"]+.35
    out=ROOT/".local/qa/shadow-actions-v1/frames"/record["id"];out.mkdir(parents=True,exist_ok=True)
    base_x=root.location.x
    for i in range(math.ceil(at*24)):
        time=i/24
        start,end,spec=next((a,b,s) for a,b,s in intervals if a<=time<b)
        local=min(spec["duration"],time-start);phase=local/spec["duration"]
        action=bpy.data.actions[spec["clip"]];arm.animation_data.action=action
        frame=phase*action.frame_range[1];scene.frame_set(int(frame),subframe=frame%1)
        root.location.x=base_x
        if "root_motion" in spec:
            u=max(0.,min(1.,(phase-.14)/.74));root.location.x+=spec["root_motion"]["distance"]*u*u*(3-2*u)
        text.data.body=record["name"]+" · "+spec["label"]
        scene.render.filepath=str(out/("%04d.png"%i));bpy.ops.render.render(write_still=True)
    (out/"timing.json").write_text(json.dumps(dict(frames=i+1,fps=24,duration=(i+1)/24,clips=[s["clip"] for s in items]),indent=2)+"\n",encoding="utf-8")


if __name__=="__main__":
    args=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    requested={a for a in args if a not in ["video","video-only"]}
    for r in records:
        if not requested or r["id"] in requested:
            if "video-only" not in args:sheet(r);sheet(r,True)
            if "video" in args or "video-only" in args:video(r)
