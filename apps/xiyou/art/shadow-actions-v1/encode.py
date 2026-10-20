"""Encode actual GLB render frames through Blender's bundled H.264 codec."""
from pathlib import Path
import json,sys
import bpy

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
requested=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else ["wukong"]
for character in requested:
    frames=ROOT/".local/qa/shadow-actions-v1/frames"/character
    timing=json.loads((frames/"timing.json").read_text(encoding="utf-8"))
    files=[frames/("%04d.png"%i) for i in range(timing["frames"])];assert files and all(p.exists() for p in files)
    bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene
    scene.render.resolution_x=960;scene.render.resolution_y=720;scene.render.resolution_percentage=100
    scene.render.fps=24;scene.frame_start=1;scene.frame_end=len(files);scene.view_settings.view_transform="Standard"
    editor=scene.sequence_editor_create();strip=editor.strips.new_image("Actual exported skill clips",str(files[0]),channel=1,frame_start=1)
    for file in files[1:]:strip.elements.append(file.name)
    strip.frame_final_duration=len(files);scene.render.image_settings.media_type="VIDEO";scene.render.image_settings.file_format="FFMPEG"
    scene.render.ffmpeg.format="MPEG4";scene.render.ffmpeg.codec="H264";scene.render.ffmpeg.constant_rate_factor="MEDIUM"
    scene.render.filepath=str(HERE/character/"exported-glb-actions.mp4");bpy.ops.render.render(animation=True)
    print("ENCODED",character,len(files),scene.render.filepath,flush=True)
