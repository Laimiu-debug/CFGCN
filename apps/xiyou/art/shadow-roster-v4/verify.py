"""Reimport actual v4 deliveries and measure visible soles, knee direction and drift."""
from pathlib import Path
import hashlib,json,math,struct,zipfile
import bpy
import numpy as np
from mathutils import Vector

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
records=json.loads((HERE/"manifest.json").read_text(encoding="utf-8"))["characters"]
reports=[]


def texture_foot_samples(mesh,atlas,side):
    group=mesh.vertex_groups["foot."+side].index
    indices=[v.index for v in mesh.data.vertices if any(g.group==group for g in v.groups)]
    uv={loop.vertex_index:tuple(mesh.data.uv_layers.active.data[loop.index].uv) for loop in mesh.data.loops if loop.vertex_index in indices}
    u0,v0=min(u for u,v in uv.values()),min(v for u,v in uv.values())
    u1,v1=max(u for u,v in uv.values()),max(v for u,v in uv.values())
    corner=lambda u,v:min(indices,key=lambda i:abs(uv[i][0]-u)+abs(uv[i][1]-v))
    corners=[corner(u0,v0),corner(u1,v0),corner(u0,v1)]
    width,height=atlas.size
    pixels=np.asarray(atlas.pixels[:],dtype=np.float32).reshape(height,width,4)
    us=np.linspace(u0+.5/width,u1-.5/width,min(96,max(4,round((u1-u0)*width))))
    vs=np.linspace(v0+.5/height,v1-.5/height,min(96,max(4,round((v1-v0)*height))))
    uu,vv=np.meshgrid(us,vs)
    valid=pixels[np.clip((vv*height).astype(int),0,height-1),np.clip((uu*width).astype(int),0,width-1),3]>.42
    u,v=(uu[valid]-u0)/(u1-u0),(vv[valid]-v0)/(v1-v0)
    # Keep the same inked sole feature throughout flat support. Re-selecting
    # argmin Z every frame can jump across a flat sole due to float rounding.
    marker=int(np.lexsort((u,v))[0])
    return corners,u,v,marker


def visible_points(evaluated,working,samples):
    corners,u,v,_=samples
    a,b,c=[np.asarray(evaluated.matrix_world@working.vertices[i].co) for i in corners]
    return a[None,:]+u[:,None]*(b-a)[None,:]+v[:,None]*(c-a)[None,:]


for record in records:
    directory=HERE/record["id"]
    raw=(directory/record["runtime"]).read_bytes()
    size=struct.unpack_from("<I",raw,12)[0]
    doc=json.loads(raw[20:20+size])
    assert len(raw)<1_500_000,(record["id"],len(raw))
    assert hashlib.sha256(raw).hexdigest()==record["runtime_sha256"]
    for key,source in [("source_sha256","parts-source.png"),("weapon_source_sha256","weapon-source.png"),("lower_body_source_sha256","lower-body-source.png")]:
        assert hashlib.sha256((directory/source).read_bytes()).hexdigest()==record[key]
    assert len(doc["meshes"])==1 and len(doc["materials"])==1 and len(doc["skins"][0]["joints"])==16
    assert doc["materials"][0]["alphaMode"]=="MASK" and doc["materials"][0]["doubleSided"]
    assert "KHR_materials_unlit" in doc["materials"][0]["extensions"]
    with zipfile.ZipFile(directory/record["woop"]) as archive:
        woop=json.loads(archive.read("woop.json"))
        assert len(woop["parts"])==16 and len(woop["joints"])==15
        assert all(p["image"] in archive.namelist() for p in woop["parts"])
    bpy.ops.wm.open_mainfile(filepath=str(directory/record["editable"]))
    native_arm=next(o for o in bpy.context.scene.objects if o.type=="ARMATURE")
    assert len(native_arm.data.bones)==16
    assert len([o for o in bpy.context.scene.objects if o.type=="MESH"])==16
    assert native_arm.data.bones["body"].parent.name=="abdomen"
    assert native_arm.data.bones["thigh.front"].parent.name=="pelvis"
    assert all(i.packed_file for i in bpy.data.images if i.name.endswith(".png"))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps=60
    bpy.ops.import_scene.gltf(filepath=str(directory/record["runtime"]))
    arm=next(o for o in bpy.context.scene.objects if o.type=="ARMATURE")
    mesh=next(o for o in bpy.context.scene.objects if o.type=="MESH" and o.vertex_groups)
    atlas=next(i for i in bpy.data.images if list(i.size)==[1024,1024])
    assert len(mesh.data.vertices)==64 and sum(len(p.vertices)-2 for p in mesh.data.polygons)==32
    assert all(len(v.groups)==1 and abs(v.groups[0].weight-1)<1e-6 for v in mesh.data.vertices)
    feet={s:texture_foot_samples(mesh,atlas,s) for s in ["front","back"]}
    arm.animation_data_create();arm.animation_data.action=bpy.data.actions["Walk"]
    duration=float(arm.animation_data.action.frame_range[1])/60
    assert abs(duration-record["walk_period"])<.001
    duty=record["walk_duty"]
    planted_max,flight,knee_min,knee_max=0.,0,1e9,0.
    drift={s:[] for s in feet};double_support=0;loop=[]
    for sample in range(121):
        phase=sample/120;frame=phase*duration*60
        bpy.context.scene.frame_set(int(frame),subframe=frame%1)
        bpy.context.view_layer.update()
        evaluated=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());working=evaluated.to_mesh()
        soles=[]
        for side,offset in [("front",0.),("back",.5)]:
            points=visible_points(evaluated,working,feet[side]);sole=float(points[:,2].min());soles.append(sole)
            cycle=(phase+offset)%1
            if cycle<duty-.01:
                planted_max=max(planted_max,abs(sole))
            if .20<cycle/duty<.70 and cycle<duty:
                # True ground travel is inferred from the exported gait's own
                # distance. A midstance sole must stay fixed on that ground.
                marker=points[feet[side][3],0]+record["walk_distance"]*phase
                drift[side].append(float(marker))
            hip,knee,ankle=[arm.matrix_world@arm.pose.bones[n+"."+side].head for n in ["thigh","shin","foot"]]
            along=(hip.z-knee.z)/max(1e-6,hip.z-ankle.z)
            knee_min=min(knee_min,knee.x-(hip.x+(ankle.x-hip.x)*along))
            a,b=(knee-hip).normalized(),(ankle-knee).normalized()
            knee_max=max(knee_max,math.acos(max(-1.,min(1.,a.dot(b)))))
        if min(soles)>.014:flight+=1
        if max(soles)<.014:double_support+=1
        if sample in [0,120]:loop.append([v for bone in arm.pose.bones for row in bone.matrix for v in row])
        evaluated.to_mesh_clear()
    loop_delta=max(abs(a-b) for a,b in zip(*loop))
    drift_max=max(max(values)-min(values) for values in drift.values())
    assert knee_min>-.002,(record["id"],"backward knee",knee_min)
    assert knee_max<1.75,(record["id"],"excessive knee lift",knee_max)
    assert planted_max<.018,(record["id"],"visible sole height",planted_max)
    assert flight==0,(record["id"],"walk flight samples",flight)
    assert double_support>=15,(record["id"],"missing double support",double_support)
    assert drift_max<.018,(record["id"],"midstance skating",drift_max)
    assert loop_delta<.0001,(record["id"],"loop discontinuity",loop_delta)
    report=dict(id=record["id"],bytes=len(raw),bones=16,triangles=32,materials=1,
                visible_sole_max_offset=planted_max,walk_flight_samples=flight,double_support_samples=double_support,
                knee_forward_min_offset=knee_min,knee_bend_max_degrees=math.degrees(knee_max),
                midstance_ground_drift=drift_max,loop_matrix_delta=loop_delta,walk_period=duration,
                walk_distance=record["walk_distance"],woop="verified",blend="reopened with packed images",glb="reimported")
    reports.append(report);print("VERIFIED",json.dumps(report))
path=ROOT/".local/qa/shadow-roster-v4/assets.json"
path.parent.mkdir(parents=True,exist_ok=True)
path.write_text(json.dumps(dict(characters=reports,count=len(reports)),ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
