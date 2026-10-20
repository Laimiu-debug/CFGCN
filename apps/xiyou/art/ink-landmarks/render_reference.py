"""Project the accepted Studio building without modifying its existing delivery."""
from pathlib import Path
import json
import hashlib
import bpy
from mathutils import Vector
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
path=ROOT/'apps/website/public/games/xiyou/assets/roadside_shrine.glb'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(path))
scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=640;scene.render.resolution_y=640;scene.render.resolution_percentage=100
scene.render.film_transparent=True
scene.render.image_settings.file_format='PNG'
scene.view_settings.view_transform='Standard'
bpy.ops.object.light_add(type='AREA',location=(-3,-5,8))
bpy.context.object.data.energy=1700;bpy.context.object.data.size=8
bpy.ops.object.camera_add(location=(4,-7,5.3))
camera=bpy.context.object
camera.rotation_euler=(Vector((0,0,1.6))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=5.5;scene.camera=camera
scene.render.filepath=str(HERE/'studio-building-reference.png')
bpy.ops.render.render(write_still=True)
(HERE/'projection.json').write_text(json.dumps({'runtime_source':str(path.relative_to(ROOT)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'studio_project':'c059207d-1ab2-42d2-9b18-8cd9ade0dcd9','purpose':'roof/post silhouette reference only; no shrine modification or gameplay'},ensure_ascii=False,indent=2),encoding='utf-8')
