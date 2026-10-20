"""Encode existing native GLB inspection renders using Blender's bundled codec."""
from pathlib import Path
import bpy

HERE=Path(__file__).resolve().parent
frames=HERE.parents[3]/".local/qa/shadow-roster-v4/runtime-frames"
files=sorted(frames.glob("*.png"))
assert files
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.render.resolution_x=1024;scene.render.resolution_y=768;scene.render.resolution_percentage=100
scene.render.fps=24;scene.frame_start=1;scene.frame_end=len(files)
scene.view_settings.view_transform="Standard"
editor=scene.sequence_editor_create()
strip=editor.strips.new_image("Exported GLB ground walk",str(files[0]),channel=1,frame_start=1)
for file in files[1:]:strip.elements.append(file.name)
strip.frame_final_duration=len(files)
scene.render.image_settings.media_type="VIDEO"
scene.render.image_settings.file_format="FFMPEG"
scene.render.ffmpeg.format="MPEG4";scene.render.ffmpeg.codec="H264"
scene.render.ffmpeg.constant_rate_factor="MEDIUM"
scene.render.filepath=str(HERE/"wukong/exported-glb-walk.mp4")
bpy.ops.render.render(animation=True)
print("ENCODED",len(files),"frames",scene.render.filepath)
