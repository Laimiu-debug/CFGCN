"""Puppet walk authored from visible soles, forward knees and double support."""
import math
import bpy
import numpy as np
from mathutils import Vector, Quaternion


def rotate(bone, angle):
    axis = bone.bone.matrix_local.to_quaternion().inverted() @ Vector((0., 1., 0.))
    bone.rotation_mode = "QUATERNION"
    bone.rotation_quaternion = Quaternion(axis, angle)


def translate(bone, value):
    bone.location = bone.bone.matrix_local.to_quaternion().inverted() @ Vector(value)


def visible_foot_points(obj, ankle):
    """Sample actual alpha, not the empty corners of a rectangular sprite."""
    tex = next(n for n in obj.data.materials[0].node_tree.nodes if n.type == "TEX_IMAGE")
    image = tex.image
    width, height = image.size
    pixels = np.asarray(image.pixels[:], dtype=np.float32).reshape(height, width, 4)
    yy, xx = np.nonzero(pixels[::2, ::2, 3] > .42)
    u, v = xx*2/max(1,width-1), yy*2/max(1,height-1)
    a,b,_,d = [np.asarray(obj.matrix_world @ p.co) for p in obj.data.vertices]
    points = a[None,:] + u[:,None]*(b-a)[None,:] + (1-v[:,None])*(d-a)[None,:]
    return points[:,[0,2]] - np.asarray(ankle)[None,[0,2]]


def animate(arm, meshes, profile):
    scale = float(arm["woop_pixel_scale"]) * 100
    duty = profile["duty"]
    legs = {}
    for side in ["back", "front"]:
        hip, knee, ankle = [arm.data.bones[n+"."+side].head_local.copy() for n in ["thigh","shin","foot"]]
        points = visible_foot_points(meshes["foot."+side], ankle)
        legs[side] = dict(hip=hip, ankle=ankle, points=points,
                          l1=(hip-knee).xz.length, l2=(knee-ankle).xz.length,
                          sole=float(points[:,1].min()))

    for name in ["Idle", "Walk", "RestPose"]:
        action = bpy.data.actions.new(name)
        action.use_fake_user = True
        arm.animation_data_create()
        arm.animation_data.action = action
        duration = profile["period"] if name == "Walk" else 1.8 if name == "Idle" else 1.
        end_frame = round(duration*60)
        for sample in range(121):
            phase = sample/120.
            moving, rest = name == "Walk", name == "RestPose"
            for bone in arm.pose.bones:
                bone.rotation_mode = "QUATERNION"
                bone.rotation_quaternion = (1.,0.,0.,0.)
                bone.location = (0.,0.,0.)

            lref = (legs["front"]["l1"]+legs["front"]["l2"])
            if moving:
                bob = -lref*(.014+profile["extra_compression"]+.018*(1-math.cos(4*math.pi*(phase-duty/2))))
            else:
                bob = 0. if rest else -lref*(profile["idle_compression"]+.0015*(1-math.cos(2*math.pi*phase)))
            translate(arm.pose.bones["pelvis"], (0.,0.,bob))

            for side, offset, sign in [("front",0.,1),("back",.5,-1)]:
                leg = legs[side]
                cycle = (phase+offset)%1
                x = sign*profile["idle_stance"]*(leg["l1"]+leg["l2"])
                lift, pitch = 0.,0.
                if moving:
                    stride = profile["stride"]*scale
                    if cycle < duty:
                        u = cycle/duty
                        x = stride*(1-2*u)
                        pitch = -.10*(1-u/.12) if u < .12 else .20*((u-.78)/.22) if u > .78 else 0.
                    else:
                        u = (cycle-duty)/(1-duty)
                        tangent = -2*stride*(1-duty)/duty
                        x = -stride*(1-3*u*u+2*u*u*u)+stride*(3*u*u-2*u*u*u)+tangent*(u-3*u*u+2*u*u*u)
                        lift = profile["lift"]*scale*math.sin(math.pi*u)**1.4
                        pitch = .20*(1-u)-.10*u+.07*math.sin(math.pi*u)

                # Foot roll is around the visible heel/toe. Compensate the
                # ankle so rolling does not drag that planted contact point.
                points = leg["points"]
                co, si = math.cos(pitch), math.sin(pitch)
                rotated_z = -si*points[:,0]+co*points[:,1]
                contact = int(rotated_z.argmin())
                roll_x = (co-1)*points[contact,0]+si*points[contact,1]
                x -= roll_x
                ankle_z = -float(rotated_z.min())+lift
                dx, dz = x, ankle_z-leg["hip"].z-bob
                l1,l2 = leg["l1"],leg["l2"]
                distance = min(math.hypot(dx,dz),l1+l2-1e-7)
                bend = math.acos(max(-1.,min(1.,(distance*distance-l1*l1-l2*l2)/(2*l1*l2))))
                # Forward-facing human knee. The v3 plus/minus branch folded
                # every knee behind the figure's facing direction.
                thigh = math.atan2(-dx,-dz)-math.atan2(l2*math.sin(bend),l1+l2*math.cos(bend))
                rotate(arm.pose.bones["thigh."+side],thigh)
                rotate(arm.pose.bones["shin."+side],bend)
                rotate(arm.pose.bones["foot."+side],pitch-thigh-bend)

            swing = math.cos(2*math.pi*phase) if moving else 0.
            lean = 0. if rest else profile["lean"] + (.012*math.sin(2*math.pi*phase) if moving else 0.)
            upper_front = -.08+.012*swing
            fore_front = profile["fore_angle"]
            rotate(arm.pose.bones["abdomen"],lean*.35)
            rotate(arm.pose.bones["body"],lean*.65)
            rotate(arm.pose.bones["upper_arm.back"],-.08-profile["arm_swing"]*swing)
            rotate(arm.pose.bones["forearm.back"],-.10)
            rotate(arm.pose.bones["upper_arm.front"],upper_front)
            rotate(arm.pose.bones["forearm.front"],fore_front)
            rotate(arm.pose.bones["head"],-lean*.65)
            rotate(arm.pose.bones["accessory"],.025*math.sin(2*math.pi*phase) if moving else 0.)
            rotate(arm.pose.bones["weapon"],profile["weapon_tilt"]-lean-upper_front-fore_front)
            for bone in arm.pose.bones:
                bone.keyframe_insert("rotation_quaternion",frame=phase*end_frame,group=bone.name)
                bone.keyframe_insert("location",frame=phase*end_frame,group=bone.name)
        # Dense authored samples should interpolate linearly; automatic Bezier
        # handles can overshoot the foot below ground between samples.
        for slot in action.slots:
            for layer in action.layers:
                for strip in layer.strips:
                    bag = strip.channelbag(slot)
                    if bag:
                        for curve in bag.fcurves:
                            for key in curve.keyframe_points:
                                key.interpolation = "LINEAR"
        arm.animation_data.action = None

    arm["cfgcn_walk_distance"] = 2*profile["stride"]*scale/duty
    arm["cfgcn_walk_duty"] = duty
    arm["cfgcn_walk_period"] = round(profile["period"]*60)/60
