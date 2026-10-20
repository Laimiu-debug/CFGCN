"""Render actual saved puppet rigs in a common-scale lineup and four walk poses."""
from pathlib import Path
import json,re,math
import bpy
from mathutils import Vector

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
ROSTER=json.loads((HERE/"roster.json").read_text(encoding="utf-8"))
tokens=(ROOT/"packages/ui/src/tokens.css").read_text(encoding="utf-8")


def color(name):
    value=re.search(r"--"+name+r":\s*(#[0-9a-fA-F]{6})",tokens).group(1)
    rgb=[int(value[i:i+2],16)/255 for i in [1,3,5]]
    return tuple(v/12.92 if v<.04045 else ((v+.055)/1.055)**2.4 for v in rgb)+(1.,)


def setup(width,height,span,top):
    scene=bpy.context.scene
    scene.render.engine="CYCLES";scene.cycles.samples=8
    scene.render.film_transparent=False
    scene.render.resolution_x=width;scene.render.resolution_y=height;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG";scene.view_settings.view_transform="Standard"
    world=bpy.data.worlds.new("Shared paper background");world.use_nodes=True
    world.node_tree.nodes["Background"].inputs[0].default_value=color("paper")
    scene.world=world
    camera=bpy.data.cameras.new("Same scale inspection");camera.type="ORTHO"
    # Blender AUTO sensor fit uses the landscape frame's horizontal span.
    camera.ortho_scale=span
    obj=bpy.data.objects.new(camera.name,camera);scene.collection.objects.link(obj)
    center=top-span*height/width/2
    obj.location=(0,-15,center);obj.rotation_euler=(Vector((0,0,center))-obj.location).to_track_quat("-Z","Y").to_euler();scene.camera=obj
    material=bpy.data.materials.new("Shared ink annotations");material.use_nodes=True
    nodes=material.node_tree.nodes;nodes.clear();shader=nodes.new("ShaderNodeEmission");shader.inputs[0].default_value=color("ink");output=nodes.new("ShaderNodeOutputMaterial");material.node_tree.links.new(shader.outputs[0],output.inputs[0])
    font_path=Path("C:/Windows/Fonts/simsun.ttc")
    font=bpy.data.fonts.load(str(font_path)) if font_path.exists() else None
    return material,font


def label(text,x,z,material,font,size=.14):
    data=bpy.data.curves.new(text,"FONT");data.body=text;data.align_x="CENTER";data.size=size
    if font:data.font=font
    obj=bpy.data.objects.new(text,data);bpy.context.scene.collection.objects.link(obj)
    obj.location=(x,-.1,z);obj.rotation_euler=(math.pi/2,0,0);obj.data.materials.append(material)


def append_character(character,x,phase=0.,mode="Idle"):
    path=HERE/character["id"]/(character["id"]+".blend")
    with bpy.data.libraries.load(str(path),link=False) as (source,target):
        target.objects=[n for n in source.objects if n.startswith("RIG_") or n.startswith("PART_")]
        target.actions=[n for n in source.actions if n==mode]
    objects=[o for o in target.objects if o]
    selected_action=next((a for a in target.actions if a),None)
    # Official names differ between importer releases; fall back to native objects.
    if not objects:
        with bpy.data.libraries.load(str(path),link=False) as (source,target):
            target.objects=[n for n in source.objects if "camera" not in n.lower()]
            target.actions=[n for n in source.actions if n==mode]
        objects=[o for o in target.objects if o and o.type in ["ARMATURE","MESH"]]
        selected_action=next((a for a in target.actions if a),None)
    for obj in objects:bpy.context.scene.collection.objects.link(obj)
    arm=next(o for o in objects if o.type=="ARMATURE")
    # Read the imported action objects by reference, before their names acquire
    # numeric suffixes from other characters in this study scene.
    action=selected_action
    assert action is not None,(character["id"],mode)
    if action:
        arm.animation_data.action=action
        frame=phase*float(action.frame_range[1]);bpy.context.scene.frame_set(int(frame),subframe=frame%1)
        bpy.context.view_layer.update()
    pose={b.name:b.matrix_basis.copy() for b in arm.pose.bones}
    center=sum((arm.matrix_world@arm.pose.bones[n].head).x for n in ["thigh.front","thigh.back"])/2
    arm.animation_data_clear()
    for name,matrix in pose.items():arm.pose.bones[name].matrix_basis=matrix
    arm.location.x+=x-center
    return arm


def lineup():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    material,font=setup(2400,680,14.7,3.40)
    for index,c in enumerate(ROSTER):
        x=(index-3.5)*1.78;append_character(c,x);label(c["name"],x,-.24,material,font,.16)
    bpy.context.scene.frame_set(0)
    bpy.context.scene.render.filepath=str(HERE/"lineup.png");bpy.ops.render.render(write_still=True)


def cycle(character):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    spacing=max(1.4,character["height"]*.76)
    span=spacing*4+.3
    top=character["height"]*1.34+.08
    material,font=setup(1800,900,span,top)
    for index,phase in enumerate([0.,.25,.5,.75]):
        x=(index-1.5)*spacing;append_character(character,x,phase,"Walk");label(str(round(phase*100))+"%",x,-.24,material,font,.15)
    bpy.context.scene.frame_set(0)
    bpy.context.scene.render.filepath=str(HERE/character["id"]/"walk-cycle.png");bpy.ops.render.render(write_still=True)


if __name__=="__main__":
    lineup()
    for c in ROSTER:cycle(c)
