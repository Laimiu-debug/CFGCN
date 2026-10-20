"""Measure the actual exported models, not merely animation names.

Checks cutout soles, two-hand contact, motion amplitude, endpoints and masks.
Moving casts are evaluated at unrelated gait phases to catch phase resets.
"""
from pathlib import Path
import hashlib,json,math,struct,sys
import bpy
import numpy as np
from mathutils import Vector

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
records=json.loads((HERE/"manifest.json").read_text(encoding="utf-8"))["characters"]
reports=[]


def samples(mesh,atlas,name):
    group=mesh.vertex_groups[name].index
    indices=[v.index for v in mesh.data.vertices if any(g.group==group for g in v.groups)]
    uv={loop.vertex_index:tuple(mesh.data.uv_layers.active.data[loop.index].uv) for loop in mesh.data.loops if loop.vertex_index in indices}
    u0,v0=min(u for u,v in uv.values()),min(v for u,v in uv.values())
    u1,v1=max(u for u,v in uv.values()),max(v for u,v in uv.values())
    corner=lambda u,v:min(indices,key=lambda i:abs(uv[i][0]-u)+abs(uv[i][1]-v))
    corners=[corner(u0,v0),corner(u1,v0),corner(u0,v1)]
    width,height=atlas.size;pixels=np.asarray(atlas.pixels[:],dtype=np.float32).reshape(height,width,4)
    us=np.linspace(u0+.5/width,u1-.5/width,min(72,max(4,round((u1-u0)*width))))
    vs=np.linspace(v0+.5/height,v1-.5/height,min(96,max(4,round((v1-v0)*height))))
    uu,vv=np.meshgrid(us,vs);valid=pixels[np.clip((vv*height).astype(int),0,height-1),np.clip((uu*width).astype(int),0,width-1),3]>.42
    u,v=(uu[valid]-u0)/(u1-u0),(vv[valid]-v0)/(v1-v0)
    return corners,u,v


def visible(evaluated,working,sample):
    corners,u,v=sample;a,b,c=[np.asarray(evaluated.matrix_world@working.vertices[i].co) for i in corners]
    return a[None,:]+u[:,None]*(b-a)[None,:]+v[:,None]*(c-a)[None,:]


def marker(evaluated,working,sample,uv):
    a,b,c=[evaluated.matrix_world@working.vertices[i].co for i in sample[0]]
    return a+(b-a)*uv[0]+(c-a)*uv[1]


def at(arm,action,frame):
    arm.animation_data.action=action
    bpy.context.scene.frame_set(int(frame),subframe=frame%1);bpy.context.view_layer.update()


def matrices(arm,names):return np.asarray([v for n in names for row in arm.pose.bones[n].matrix for v in row])


for record in records:
    directory=HERE/record["id"];h=record["height"]
    raw=(directory/record["runtime"]).read_bytes();length=struct.unpack_from("<I",raw,12)[0];doc=json.loads(raw[20:20+length])
    assert hashlib.sha256(raw).hexdigest()==record["runtime_sha256"]
    assert hashlib.sha256((ROOT/record["source"]).read_bytes()).hexdigest()==record["source_sha256"],"v4 source changed"
    assert [a["name"] for a in doc["animations"]]==record["clips"]
    assert len(doc["meshes"])==1 and len(doc["materials"])==1 and len(doc["skins"][0]["joints"])==16
    material=doc["materials"][0];assert material["alphaMode"]=="MASK" and material["doubleSided"] and "KHR_materials_unlit" in material["extensions"]
    for a in doc["animations"]:
        allowed=record["upper_mask"] if a["name"].endswith("_Upper") else record["lower_mask"] if a["name"]=="WalkLower" else None
        if allowed:
            targets={doc["nodes"][ch["target"]["node"]]["name"] for ch in a["channels"]}
            assert targets and targets<=set(allowed),(record["id"],a["name"],targets)
    bpy.ops.wm.open_mainfile(filepath=str(directory/record["editable"]))
    native=next(o for o in bpy.context.scene.objects if o.type=="ARMATURE")
    assert len([o for o in bpy.context.scene.objects if o.type=="MESH"])==16
    assert len(native.data.bones)==16 and native.data.bones["body"].parent.name=="abdomen"
    assert all(i.packed_file for i in bpy.data.images if i.name.endswith(".png")),"unpacked texture"
    assert set(record["clips"])<=set(a.name for a in bpy.data.actions)
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.scene.render.fps=60
    bpy.ops.import_scene.gltf(filepath=str(directory/record["runtime"]))
    arm=next(o for o in bpy.context.scene.objects if o.type=="ARMATURE")
    mesh=next(o for o in bpy.context.scene.objects if o.type=="MESH" and o.vertex_groups)
    atlas=next(i for i in bpy.data.images if list(i.size)==[1024,1024])
    assert len(mesh.data.vertices)==64 and sum(len(p.vertices)-2 for p in mesh.data.polygons)==32
    assert all(len(v.groups)==1 and abs(v.groups[0].weight-1)<1e-6 for v in mesh.data.vertices)
    parts={name:samples(mesh,atlas,name) for name in ["foot.front","foot.back","weapon","forearm.back","upper_arm.back","upper_arm.front","forearm.front","body"]}
    names=[b.name for b in arm.pose.bones]
    at(arm,bpy.data.actions["Idle"],0);idle=matrices(arm,names)
    center=(arm.matrix_world@arm.pose.bones["pelvis"].head).x
    record["inspection_bounds"]={}
    result=[];max_sole,max_grip,max_loop,max_layer=0.,0.,0.,0.
    for spec in record["modules"]:
        action=bpy.data.actions[spec["clip"]];duration=float(action.frame_range[1])/60
        assert abs(duration-spec["duration"])<.001
        assert 0<spec["windup_end"]<spec["release_end"]<duration
        assert all(0<e["time"]<duration for e in spec["events"])
        at(arm,action,0);start=matrices(arm,names)
        at(arm,action,action.frame_range[1]);end=matrices(arm,names)
        loop_error=max(float(np.max(np.abs(start-end))),float(np.max(np.abs(start-idle))))
        assert loop_error<.001,(record["id"],spec["clip"],"discontinuous endpoints",loop_error)
        max_loop=max(max_loop,loop_error)
        arm_depth_clearance=1e9
        weapon_path=[];hand_path=[];sole_error=0.;grip_error=0.;flight=0;motion=0.;intentional_flight=0
        planted={"front":[],"back":[]};bounds=[1e9,1e9,-1e9,-1e9]
        for i in range(121):
            phase=i/120;at(arm,action,phase*action.frame_range[1])
            values=matrices(arm,names);assert np.isfinite(values).all()
            motion=max(motion,float(np.max(np.abs(values-start))))
            evaluated=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());working=evaluated.to_mesh()
            coordinates=np.asarray([tuple(evaluated.matrix_world@v.co) for v in working.vertices])
            bounds=[min(bounds[0],float(coordinates[:,0].min())-center),min(bounds[1],float(coordinates[:,2].min())),
                    max(bounds[2],float(coordinates[:,0].max())-center),max(bounds[3],float(coordinates[:,2].max()))]
            body_y=float(visible(evaluated,working,parts["body"])[:,1].min())
            for name in ["upper_arm.back","forearm.back","upper_arm.front","forearm.front"]:
                arm_y=float(visible(evaluated,working,parts[name])[:,1].max())
                arm_depth_clearance=min(arm_depth_clearance,body_y-arm_y)
                assert body_y-arm_y>.003,(record["id"],spec["clip"],name,"torso occludes arm",body_y-arm_y)
            soles=[]
            for side in ["front","back"]:
                p=visible(evaluated,working,parts["foot."+side]);sole=float(p[:,2].min());soles.append(sole)
                # During non-dodge skills the rear sole remains a support.
                air=spec.get("airborne",{});in_air=air.get("start",2)<phase<air.get("end",-1)
                if side=="back" and spec["clip"]!="DodgeBack" and not spec.get("footwork") and not in_air:sole_error=max(sole_error,abs(sole))
                if side=="back" and air and not in_air:sole_error=max(sole_error,abs(sole))
                if phase>.28 and phase<.72 and spec["clip"]!="DodgeBack":planted[side].append(float(p[:,0].min()))
            if min(soles)>.025*h:
                if in_air:intentional_flight+=1
                else:flight+=1
            p=visible(evaluated,working,parts["weapon"]);weapon_path.append(np.mean(p[:,[0,2]],axis=0))
            hand_path.append(tuple(marker(evaluated,working,parts["forearm.back"],record["back_hand_surface_marker"]).xz))
            assert float(p[:,2].min())>-.10*h,(record["id"],spec["clip"],"weapon through ground",float(p[:,2].min()))
            if spec["two_hand"] and .21<phase<.74:
                grip=marker(evaluated,working,parts["weapon"],record["weapon_grip_surface_marker"])
                a,_,c=[evaluated.matrix_world@working.vertices[j].co for j in parts["weapon"][0]]
                target=grip-(c-a).normalized()*h*.105
                hand=marker(evaluated,working,parts["forearm.back"],record["back_hand_surface_marker"])
                grip_error=max(grip_error,(hand-target).xz.length)
            evaluated.to_mesh_clear()
        assert sole_error<.018*h,(record["id"],spec["clip"],"rear sole",sole_error)
        if spec.get("airborne"):assert intentional_flight>3,(record["id"],spec["clip"],"missing intended leap")
        assert flight==0,(record["id"],spec["clip"],"unsupported flight",flight)
        assert grip_error<.008*h,(record["id"],spec["clip"],"secondary grip",grip_error)
        assert motion>.08,(record["id"],spec["clip"],"static action",motion)
        path_span=float(np.linalg.norm(np.ptp(np.asarray(weapon_path),axis=0)))
        hand_span=float(np.linalg.norm(np.ptp(np.asarray(hand_path),axis=0)))
        assert max(path_span,hand_span)>.045*h,(record["id"],spec["clip"],"no spatial gesture")
        if spec["upper_clip"]:
            upper=bpy.data.actions[spec["upper_clip"]]
            for i in range(37):
                phase=i/36;gait_phase=(.137+phase*1.73)%1
                at(arm,bpy.data.actions["Walk"],gait_phase*record["walk_period"]*60)
                reference=matrices(arm,record["lower_mask"])
                at(arm,bpy.data.actions["WalkLower"],gait_phase*record["walk_period"]*60)
                lower={n:arm.pose.bones[n].matrix_basis.copy() for n in record["lower_mask"]}
                at(arm,upper,phase*upper.frame_range[1])
                for n,m in lower.items():arm.pose.bones[n].matrix_basis=m
                bpy.context.view_layer.update()
                error=float(np.max(np.abs(matrices(arm,record["lower_mask"])-reference)))
                max_layer=max(max_layer,error)
                assert error<.001,(record["id"],spec["clip"],"moving legs overwritten",error)
        max_sole=max(max_sole,sole_error);max_grip=max(max_grip,grip_error)
        record["inspection_bounds"][spec["clip"]]=bounds
        result.append(dict(clip=spec["clip"],duration=duration,events=spec["events"],weapon_centroid_span=path_span,
                           free_hand_span=hand_span,full_body_matrix_change=motion,rear_sole_error=sole_error,grip_error=grip_error,flight_samples=flight,intentional_air_samples=intentional_flight,arm_depth_clearance=arm_depth_clearance))
    report=dict(id=record["id"],clips=len(record["clips"]),modules=result,source_unchanged=True,native_reopened=True,
                glb_reimported=True,sole_error_max=max_sole,secondary_grip_error_max=max_grip,endpoint_matrix_error=max_loop,
                moving_lower_matrix_error=max_layer,full_action_samples=121*len(record["modules"]),moving_cast_samples=37*sum(bool(s["upper_clip"]) for s in record["modules"]),runtime_bytes=len(raw))
    reports.append(report);print("CHECKED",json.dumps(report,ensure_ascii=False),flush=True)
    (directory/"manifest.json").write_text(json.dumps(record,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
out=ROOT/".local/qa/shadow-actions-v2/assets.json"
out.write_text(json.dumps(dict(characters=reports,characters_checked=len(reports),clips_checked=sum(r["clips"] for r in reports)),ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
manifest=json.loads((HERE/"manifest.json").read_text(encoding="utf-8"));manifest["characters"]=records
(HERE/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
