"""Render compact HUD portraits from the actual delivered game models."""
import bpy
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'apps/website/public/games/xiyou/assets'
for name, target, size in [('monk',(0,-.05,1.98),1.35),('wukong',(0,-.05,1.9),1.35),('white_dragon',(0,-1.05,2.2),1.25)]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(OUT/(name+'.glb')))
    for obj in list(bpy.data.objects):
        if obj.type == 'ARMATURE' and obj.animation_data:
            obj.animation_data.action = None
            for track in obj.animation_data.nla_tracks: track.mute = True
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 24
    scene.render.resolution_x, scene.render.resolution_y = 128,144
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.view_settings.view_transform = 'Standard'
    point = Vector(target)
    for pos,power in [((-3,-4,5),450),((3,-2,3),170)]:
        lamp=bpy.data.lights.new('Portrait soft light','AREA');lamp.energy=power;lamp.size=4
        light=bpy.data.objects.new('Portrait soft light',lamp);scene.collection.objects.link(light)
        light.location=pos;light.rotation_euler=(point-light.location).to_track_quat('-Z','Y').to_euler()
    camera=bpy.data.cameras.new('Portrait camera');camera.type='ORTHO';camera.ortho_scale=size
    view=bpy.data.objects.new('Portrait camera',camera);scene.collection.objects.link(view)
    view.location=point+Vector((1.7,-4,.55));view.rotation_euler=(point-view.location).to_track_quat('-Z','Y').to_euler();scene.camera=view
    scene.render.filepath=str(OUT/(name+'-portrait.png'))
    bpy.ops.render.render(write_still=True)
