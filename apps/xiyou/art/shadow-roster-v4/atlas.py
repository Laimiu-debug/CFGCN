"""Mechanical texture packing; original art remains in individual PNG files."""
import json
import bpy
import numpy as np


def pack_atlas(directory, parts):
    size = 1024
    pixels = np.zeros((size,size,4),dtype=np.float32)
    regions = {}
    ordinary = [p for p in parts if p["id"] != "weapon"]
    for index,part in enumerate(ordinary+[next(p for p in parts if p["id"]=="weapon")]):
        weapon = part["id"] == "weapon"
        x,y,w,h = (768,0,256,1024) if weapon else (index%3*256,1024-(index//3+1)*204,256,204)
        source = bpy.data.images.load(str(directory/part["image"]),check_existing=False)
        ratio = min((w-8)/source.size[0],(h-8)/source.size[1])
        sw,sh = max(1,round(source.size[0]*ratio)),max(1,round(source.size[1]*ratio))
        source.scale(sw,sh)
        crop = np.asarray(source.pixels[:],dtype=np.float32).reshape(sh,sw,4)
        ox,oy = x+(w-sw)//2,y+(h-sh)//2
        pixels[oy:oy+sh,ox:ox+sw] = crop
        regions[part["id"]]=[ox,oy,ox+sw,oy+sh]
        bpy.data.images.remove(source)
    atlas = bpy.data.images.new("ShadowPuppetRuntimeAtlas",width=size,height=size,alpha=True)
    atlas.colorspace_settings.name = "sRGB"
    atlas.pixels.foreach_set(pixels.ravel())
    atlas.file_format = "PNG"
    atlas.filepath_raw = str(directory/"runtime-atlas.png")
    atlas.save()
    atlas.pack()
    (directory/"runtime-atlas.json").write_text(json.dumps({"size":[size,size],"origin":"bottom-left","regions":regions},indent=2)+"\n",encoding="utf-8")
    return atlas,regions
