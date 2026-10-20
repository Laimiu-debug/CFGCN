"""Compose native flat-puppet skill clips on the preserved v4 editable rigs.

Run with Blender 5.2, --python-exit-code 1. No art is painted by this script.
The source artwork and v4 blend files are read-only inputs.
"""
from pathlib import Path
import hashlib,json,math,struct,sys,shutil
import bpy
import numpy as np
from mathutils import Vector

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
sys.path.insert(0,str(HERE))
from catalog import BASE,ROSTER,UPPER,LOWER,modules
sys.path.insert(0,str(BASE))
from motion import rotate,translate,visible_foot_points
from atlas import pack_atlas


def smooth(v):
    v=max(0.,min(1.,v));return v*v*(3-2*v)


def lerp(a,b,t):return a+(b-a)*t


def world_angle(bone):
    q=bone.matrix.to_quaternion()@bone.bone.matrix_local.to_quaternion().inverted()
    v=q@Vector((0,0,1));return math.atan2(v.x,v.z)


def linear(action):
    for slot in action.slots:
        for layer in action.layers:
            for strip in layer.strips:
                bag=strip.channelbag(slot)
                if bag:
                    for curve in bag.fcurves:
                        for key in curve.keyframe_points:key.interpolation="LINEAR"


def surface_marker(mesh,point):
    """A surface marker survives glTF; Blender display-bone tails do not."""
    uv={loop.vertex_index:tuple(mesh.data.uv_layers.active.data[loop.index].uv) for loop in mesh.data.loops}
    u0,v0=min(u for u,v in uv.values()),min(v for u,v in uv.values())
    u1,v1=max(u for u,v in uv.values()),max(v for u,v in uv.values())
    corner=lambda u,v:min(uv,key=lambda i:abs(uv[i][0]-u)+abs(uv[i][1]-v))
    a,b,c=[np.asarray(mesh.matrix_world@mesh.data.vertices[corner(u,v)].co) for u,v in [(u0,v0),(u1,v0),(u0,v1)]]
    matrix=np.stack((b-a,c-a),axis=1)[[0,2],:]
    return np.linalg.solve(matrix,(np.asarray(point)-a)[[0,2]]).tolist()


def surface_point(mesh,uv):
    loops={loop.vertex_index:tuple(mesh.data.uv_layers.active.data[loop.index].uv) for loop in mesh.data.loops}
    u0,v0=min(u for u,v in loops.values()),min(v for u,v in loops.values())
    u1,v1=max(u for u,v in loops.values()),max(v for u,v in loops.values())
    corner=lambda u,v:min(loops,key=lambda i:abs(loops[i][0]-u)+abs(loops[i][1]-v))
    a,b,c=[mesh.matrix_world@mesh.data.vertices[corner(u,v)].co for u,v in [(u0,v0),(u1,v0),(u0,v1)]]
    return a+(b-a)*uv[0]+(c-a)*uv[1]


class Puppet:
    def __init__(self,arm,meshes,c):
        self.arm,self.meshes,self.c=arm,meshes,c
        self.h=c["height"];self.profile=c["proportions"]
        self.source_idle=bpy.data.actions["Idle"]
        self.source_walk=bpy.data.actions["Walk"]
        arm.animation_data.action=self.source_idle
        bpy.context.scene.frame_set(0);bpy.context.view_layer.update()
        self.idle={b.name:b.matrix_basis.copy() for b in arm.pose.bones}
        self.cx=sum(arm.pose.bones["thigh."+s].head.x for s in ["front","back"])/2
        parts=json.loads((BASE/c["id"]/"woop.json").read_text(encoding="utf-8"))["parts"]
        self.hands={};self.arm_lengths={};self.hand_uv={}
        for side in ["front","back"]:
            part=next(p for p in parts if p["id"]=="forearm."+side)
            pixel=next(a["partPx"] for a in part["anchors"] if a["id"]=="distal")
            uv=[pixel[0]/part["width"],1-pixel[1]/part["height"]];self.hand_uv[side]=uv
            hand=arm.matrix_world.inverted()@surface_point(meshes["forearm."+side],uv);self.hands[side]=hand
            a=arm.data.bones["upper_arm."+side];b=arm.data.bones["forearm."+side]
            self.arm_lengths[side]=((b.head_local-a.head_local).xz.length,(hand-b.head_local).xz.length)
        back_hand=arm.pose.bones["forearm.back"].matrix@arm.data.bones["forearm.back"].matrix_local.inverted()@self.hands["back"]
        self.base={"lean":world_angle(arm.pose.bones["body"]),"hand":[(arm.pose.bones["weapon"].head.x-self.cx)/self.h,arm.pose.bones["weapon"].head.z/self.h],
                   "weapon":world_angle(arm.pose.bones["weapon"]),"back_hand":[(back_hand.x-self.cx)/self.h,back_hand.z/self.h],"compression":0.}
        self.legs={}
        for side in ["back","front"]:
            hip,knee,ankle=[arm.data.bones[n+"."+side].head_local.copy() for n in ["thigh","shin","foot"]]
            points=visible_foot_points(meshes["foot."+side],ankle)
            idle_ankle=arm.pose.bones["foot."+side].head.copy()
            self.legs[side]=dict(hip=hip,l1=(hip-knee).xz.length,l2=(knee-ankle).xz.length,points=points,ankle=idle_ankle)
        self.arm.animation_data.action=None
        self.max_hand_error=0.
        self.hand_marker=self.hand_uv["back"]
        self.grip_marker=surface_marker(meshes["weapon"],arm.matrix_world@arm.data.bones["weapon"].head_local)
        grip=arm.matrix_world@arm.data.bones["weapon"].head_local
        points=visible_foot_points(meshes["weapon"],grip)
        tip=points[int(np.argmax(np.sum(points*points,axis=1)))]
        self.tip_marker=surface_marker(meshes["weapon"],Vector((grip.x+float(tip[0]),grip.y,grip.z+float(tip[1]))))

    def reset(self):
        for name,matrix in self.idle.items():self.arm.pose.bones[name].matrix_basis=matrix
        bpy.context.view_layer.update()

    def interpolate(self,spec,t):
        points=[dict(t=0,**self.base),*spec["poses"],dict(t=1,**self.base)]
        a,b=points[0],points[-1]
        for i in range(len(points)-1):
            if points[i]["t"]<=t<=points[i+1]["t"]:a,b=points[i:i+2];break
        u=smooth((t-a["t"])/max(1e-8,b["t"]-a["t"]))
        result={}
        for key in self.base:
            result[key]=[lerp(x,y,u) for x,y in zip(a[key],b[key])] if isinstance(a[key],list) else lerp(a[key],b[key],u)
        return result

    def solve_arm(self,side,target):
        arm=self.arm;upper=arm.pose.bones["upper_arm."+side];fore=arm.pose.bones["forearm."+side]
        shoulder=upper.head.copy();delta=target-shoulder
        a=arm.data.bones["upper_arm."+side];b=arm.data.bones["forearm."+side]
        av=b.head_local-a.head_local;bv=self.hands[side]-b.head_local
        l1,l2=av.xz.length,bv.xz.length
        distance=min(math.hypot(delta.x,delta.z),l1+l2-.00001)
        bend=-math.acos(max(-1.,min(1.,(distance*distance-l1*l1-l2*l2)/(2*l1*l2))))
        angle=math.atan2(-delta.x,-delta.z)-math.atan2(l2*math.sin(bend),l1+l2*math.cos(bend))
        rest_a,rest_b=math.atan2(-av.x,-av.z),math.atan2(-bv.x,-bv.z)
        rotate(upper,angle-rest_a-world_angle(upper.parent))
        rotate(fore,bend+rest_a-rest_b)
        bpy.context.view_layer.update()
        hand=fore.matrix@b.matrix_local.inverted()@self.hands[side]
        return (hand-target).xz.length

    def sample(self,spec,t):
        self.reset()
        if t<=0 or t>=1:return
        p=self.interpolate(spec,t);arm=self.arm;h=self.h
        compress=p["compression"]*h
        # A subtle weight transfer precedes the weapon. Feet are solved back
        # to their own ground anchors after the pelvis moves.
        shift=h*.045*(p["lean"]-self.base["lean"])
        base_loc=self.idle["pelvis"].translation
        root=arm.pose.bones["pelvis"]
        root.location=base_loc
        delta=root.bone.matrix_local.to_quaternion().inverted()@Vector((shift,0,-compress))
        root.location+=delta
        rotate(arm.pose.bones["abdomen"],p["lean"]*.40)
        rotate(arm.pose.bones["body"],p["lean"]*.60)
        rotate(arm.pose.bones["head"],-p["lean"]*.58)
        rotate(arm.pose.bones["accessory"],-.14*math.sin(math.pi*t)*p["lean"]+ .035*math.sin(3*math.pi*t)*math.sin(math.pi*t))
        # The far arm must come in front of the torso while reaching to grip
        # or cast. Keep the shaft behind both fists, instead of painting a
        # pole across the palms or hiding the second hand behind the tunic.
        layer_weight=smooth(t/.19)*(1-smooth((t-.76)/.24))
        for name,depth in [("upper_arm.back",-.0175),("weapon",.0045)]:
            bone=arm.pose.bones[name]
            bone.location+=bone.bone.matrix_local.to_quaternion().inverted()@Vector((0,depth*layer_weight,0))
        bpy.context.view_layer.update()
        for side,leg in self.legs.items():
            hip=arm.pose.bones["thigh."+side].head.copy()
            target=leg["ankle"].copy()
            if side=="front" and spec["events"][0]["type"]=="hit":
                reach=smooth((t-.08)/.18)*(1-smooth((t-.76)/.18))
                target.x+=h*.075*reach
                for start,end in [(.08,.26),(.76,.94)]:
                    if start<t<end:target.z+=h*.035*math.sin(math.pi*(t-start)/(end-start))**1.4
            if spec["clip"]=="DodgeBack":
                # Two distinct support transfers, not a floating crouch.
                start,end=(.14,.51) if side=="back" else (.52,.88)
                u=max(0.,min(1.,(t-start)/(end-start)))
                root_u=smooth((t-.14)/.74)
                dist=spec["root_motion"]["distance"]
                target.x+=dist*(smooth(u)-root_u)
                target.z+=h*.055*math.sin(math.pi*u)**1.4
            dx,dz=target.x-hip.x,target.z-hip.z
            l1,l2=leg["l1"],leg["l2"]
            distance=min(math.hypot(dx,dz),l1+l2-1e-7)
            bend=math.acos(max(-1.,min(1.,(distance*distance-l1*l1-l2*l2)/(2*l1*l2))))
            thigh=math.atan2(-dx,-dz)-math.atan2(l2*math.sin(bend),l1+l2*math.cos(bend))
            rotate(arm.pose.bones["thigh."+side],thigh)
            rotate(arm.pose.bones["shin."+side],bend)
            rotate(arm.pose.bones["foot."+side],-thigh-bend)
        bpy.context.view_layer.update()
        primary=Vector((self.cx+p["hand"][0]*h,arm.pose.bones["weapon"].head.y,p["hand"][1]*h))
        weight=0.
        if spec["two_hand"]:
            weight=smooth(t/.19)*(1-smooth((t-.76)/.24))
            offset=Vector((-math.sin(p["weapon"])*h*.105,0,-math.cos(p["weapon"])*h*.105))
            # Project a shared two-hand grip into both arms' reachable discs.
            # This keeps the secondary palm on the pole without arm scaling.
            corrected=primary.copy()
            for _ in range(8):
                for side,delta in [("front",Vector((0,0,0))),("back",offset)]:
                    a=arm.data.bones["upper_arm."+side];b=arm.data.bones["forearm."+side]
                    reach=sum(self.arm_lengths[side])-.003
                    shoulder=arm.pose.bones["upper_arm."+side].head
                    d=corrected+delta-shoulder;d.y=0
                    if d.length>reach:corrected-=d.normalized()*(d.length-reach)
            primary=primary.lerp(corrected,weight)
        self.solve_arm("front",primary)
        rotate(arm.pose.bones["weapon"],p["weapon"]-world_angle(arm.pose.bones["forearm.front"]))
        bpy.context.view_layer.update()
        free=Vector((self.cx+p["back_hand"][0]*h,arm.pose.bones["forearm.back"].tail.y,p["back_hand"][1]*h))
        if spec["two_hand"]:
            # Back hand holds the same rigid shaft. Engage during wind-up,
            # release during recovery so both ends still match the idle pose.
            grip=arm.pose.bones["weapon"].head+Vector((-math.sin(p["weapon"])*h*.105,0,-math.cos(p["weapon"])*h*.105))
            grip.y=free.y
            free=free.lerp(grip,weight)
        err=self.solve_arm("back",free)
        if spec["two_hand"] and .21<t<.74:self.max_hand_error=max(self.max_hand_error,err)

    def action(self,spec,upper=False):
        name=spec["upper_clip"] if upper else spec["clip"]
        action=bpy.data.actions.new(name);action.use_fake_user=True
        self.arm.animation_data.action=action
        end=round(spec["duration"]*60)
        times=sorted({i/120 for i in range(121)}|{p["t"] for p in spec["poses"]})
        previous={}
        for t in times:
            self.sample(spec,t)
            for bone in self.arm.pose.bones:
                if upper and bone.name not in UPPER:continue
                # q and -q encode the same pose but interpolate through zero.
                # Keep adjacent authored keys on one quaternion hemisphere.
                if bone.name in previous and bone.rotation_quaternion.dot(previous[bone.name])<0:
                    bone.rotation_quaternion.negate()
                previous[bone.name]=bone.rotation_quaternion.copy()
                bone.keyframe_insert("rotation_quaternion",frame=t*end,group=bone.name)
                bone.keyframe_insert("location",frame=t*end,group=bone.name)
        linear(action);self.arm.animation_data.action=None
        return name


def export_glb(arm,meshes,c,directory,order):
    # Crop/pack existing original parts mechanically. The sole new art is the
    # unsheathed sword, whose alpha bbox replaces the old scabbard texture.
    inputs=directory/"parts";inputs.mkdir(exist_ok=True)
    parts=json.loads((BASE/c["id"]/"woop.json").read_text(encoding="utf-8"))["parts"]
    for p in parts:shutil.copy2(BASE/c["id"]/p["image"],directory/p["image"])
    if c["id"]=="xiaobailong":
        image=bpy.data.images.load(str(directory/"unsheathed-sword-source.png"))
        w,h=image.size;pixels=np.asarray(image.pixels[:],dtype=np.float32).reshape(h,w,4)
        yy,xx=np.nonzero(pixels[:,:,3]>.42);crop=pixels[yy.min():yy.max()+1,xx.min():xx.max()+1]
        texture=bpy.data.images.new("UnsheathedSwordCrop",width=crop.shape[1],height=crop.shape[0],alpha=True)
        texture.pixels.foreach_set(crop.ravel());texture.file_format="PNG";texture.filepath_raw=str(inputs/"weapon.png");texture.save();texture.pack()
        # Same flat plane and hilt pivot; blade now uses the authored image.
        material=meshes["weapon"].data.materials[0]
        next(n for n in material.node_tree.nodes if n.type=="TEX_IMAGE").image=texture
        bpy.data.images.remove(image)
    bpy.context.scene.frame_start=0
    bpy.context.scene.frame_end=math.ceil(max(a.frame_range[1] for a in bpy.data.actions))
    bpy.ops.wm.save_as_mainfile(filepath=str(directory/(c["id"]+"-actions.blend")))
    atlas,regions=pack_atlas(directory,parts)
    shared=bpy.data.materials.new("ShadowAction_"+c["id"]);shared.use_nodes=True;shared.use_backface_culling=False;shared.surface_render_method="DITHERED"
    tex=shared.node_tree.nodes.new("ShaderNodeTexImage");tex.image=atlas
    shader=shared.node_tree.nodes.get("Principled BSDF");shader.inputs["Roughness"].default_value=1
    shared.node_tree.links.new(tex.outputs["Color"],shader.inputs["Base Color"]);shared.node_tree.links.new(tex.outputs["Alpha"],shader.inputs["Alpha"])
    for p in parts:
        mesh=meshes[p["id"]].data;x0,y0,x1,y1=regions[p["id"]]
        for loop in mesh.uv_layers.active.data:
            u,v=loop.uv;loop.uv=((x0+u*(x1-x0))/1024,(y0+v*(y1-y0))/1024)
        mesh.materials.clear();mesh.materials.append(shared)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes.values():obj.select_set(True)
    bpy.context.view_layer.objects.active=meshes["body"];bpy.ops.object.join();arm.select_set(True)
    path=directory/(c["id"]+"-actions.glb")
    bpy.ops.export_scene.gltf(filepath=str(path),export_format="GLB",use_selection=True,export_animations=True,
                              export_animation_mode="ACTIONS",export_force_sampling=True,export_yup=True,export_skins=True)
    raw=path.read_bytes();length=struct.unpack_from("<I",raw,12)[0];doc=json.loads(raw[20:20+length]);actions={a["name"]:a for a in doc["animations"]}
    doc["animations"]=[actions[n] for n in order]
    for action in doc["animations"]:
        allowed=UPPER if action["name"].endswith("_Upper") else LOWER if action["name"]=="WalkLower" else None
        if allowed:
            action["channels"]=[ch for ch in action["channels"] if doc["nodes"][ch["target"]["node"]].get("name") in allowed]
            action["extras"]={"cfgcn_mask":allowed}
    for mat in doc["materials"]:
        mat["alphaMode"],mat["alphaCutoff"],mat["doubleSided"]="MASK",.42,True
        mat.setdefault("extensions",{})["KHR_materials_unlit"]={}
    doc["extensionsUsed"]=sorted(set(doc.get("extensionsUsed",[])+["KHR_materials_unlit"]))
    data=json.dumps(doc,separators=(",",":")).encode();data+=b" "*(-len(data)%4);binary=raw[20+length:]
    path.write_bytes(struct.pack("<4sII",b"glTF",2,20+len(data)+len(binary))+struct.pack("<I4s",len(data),b"JSON")+data+binary)
    return path


def build(c):
    directory=HERE/c["id"];directory.mkdir(exist_ok=True)
    source=BASE/c["id"]/(c["id"]+".blend")
    bpy.ops.wm.open_mainfile(filepath=str(source));bpy.context.preferences.filepaths.save_version=0
    scene=bpy.context.scene;scene.render.fps=60
    arm=next(o for o in scene.objects if o.type=="ARMATURE")
    meshes={o["woop_part_id"]:o for o in scene.objects if o.type=="MESH" and "woop_part_id" in o}
    puppet=Puppet(arm,meshes,c)
    arm.animation_data.action=None
    specs=modules(c)
    for spec in specs:
        puppet.action(spec)
        if spec["upper_clip"]:puppet.action(spec,True)
    # A real lower-only walk clip can run at any phase under an upper action.
    lower=puppet.source_walk.copy();lower.name="WalkLower";lower.use_fake_user=True
    for slot in lower.slots:
        for layer in lower.layers:
            for strip in layer.strips:
                bag=strip.channelbag(slot)
                if bag:
                    for curve in list(bag.fcurves):
                        if not any('pose.bones["'+n+'"]' in curve.data_path for n in LOWER):bag.fcurves.remove(curve)
    arm["cfgcn_action_status"]="Original action candidates; game integration and visual acceptance pending"
    arm["cfgcn_upper_mask"]=json.dumps(UPPER);arm["cfgcn_lower_mask"]=json.dumps(LOWER)
    puppet.reset();arm.animation_data.action=puppet.source_idle;scene.frame_set(0)
    editable=directory/(c["id"]+"-actions.blend")
    order=["Idle","Walk",*[s["clip"] for s in specs],"WalkLower",*[s["upper_clip"] for s in specs if s["upper_clip"]],"RestPose"]
    path=export_glb(arm,meshes,c,directory,order)
    record=dict(id=c["id"],name=c["name"],height=c["height"],source=str(source.relative_to(ROOT)).replace("\\","/"),
                source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),runtime=path.name,runtime_bytes=path.stat().st_size,
                runtime_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),editable=editable.name,clips=order,
                modules=specs,upper_mask=UPPER,lower_mask=LOWER,offhand_ik_max_error=puppet.max_hand_error,
                back_hand_surface_marker=puppet.hand_marker,weapon_grip_surface_marker=puppet.grip_marker,
                surface_sockets={"hand.back":{"part":"forearm.back","uv":puppet.hand_marker},
                                 "weapon":{"part":"weapon","uv":puppet.grip_marker},
                                 "weapon.tip":{"part":"weapon","uv":puppet.tip_marker},
                                 "actor":{"bone":"pelvis","offset":[0,0,0]}},
                walk_period=float(arm["cfgcn_walk_period"]),walk_distance=float(arm["cfgcn_walk_distance"]),
                status="action resource candidate; not connected to game damage/collision",in_game=False)
    (directory/"manifest.json").write_text(json.dumps(record,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("AUTHORED",c["id"],len(order),"clips",path.stat().st_size,"bytes","offhand",puppet.max_hand_error,flush=True)
    return record


if __name__=="__main__":
    requested=set(sys.argv[sys.argv.index("--")+1:]) if "--" in sys.argv else set()
    records=[build(c) for c in ROSTER if not requested or c["id"] in requested]
    if requested:
        records=[json.loads((HERE/c["id"]/"manifest.json").read_text(encoding="utf-8")) for c in ROSTER if (HERE/c["id"]/"manifest.json").exists()]
    (HERE/"manifest.json").write_text(json.dumps(dict(version=1,characters=records,status="action candidates; visual review pending"),ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
