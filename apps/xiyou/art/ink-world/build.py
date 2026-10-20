"""Make shared, depth-writing scenery cards from the Studio-derived ink artwork.

Blender remains the editable source; four glTF scenes reuse one texture/material.
"""
from pathlib import Path
import hashlib
import json
import struct
import shutil

import bpy

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
OUT = ROOT / "apps/website/public/games/xiyou/assets"
packing = json.loads((HERE / "packing.json").read_text(encoding="utf-8"))

bpy.ops.wm.read_factory_settings(use_empty=True)
image = bpy.data.images.load(str(HERE / "scenery-runtime.png"))
image.pack()
material = bpy.data.materials.new("Ink scenery shared cutout")
material.use_nodes = True
material.use_backface_culling = False
material.surface_render_method = "DITHERED"
shader = material.node_tree.nodes.get("Principled BSDF")
shader.inputs["Roughness"].default_value = 1.
texture = material.node_tree.nodes.new("ShaderNodeTexImage")
texture.image = image
material.node_tree.links.new(texture.outputs["Color"], shader.inputs["Base Color"])
material.node_tree.links.new(texture.outputs["Alpha"], shader.inputs["Alpha"])

names = []
for part in packing["parts"]:
    x0, y0, x1, y1 = part["rect"]
    ratio = (x1-x0)/(y1-y0)
    name = part["name"]
    height = {"pine": 5., "young_pine": 4.6, "shrub": 1.1}.get(name, 2.36/ratio)
    width = ratio * height
    mesh = bpy.data.meshes.new("Ink scenery " + name)
    mesh.from_pydata([(-width/2, 0., 0.), (width/2, 0., 0.),
                      (width/2, 0., height), (-width/2, 0., height)], [], [(0, 1, 2, 3)])
    mesh.update()
    obj = bpy.data.objects.new("Ink scenery " + name, mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(material)
    uv = mesh.uv_layers.new(name="UVMap")
    coordinates = [(x0, y1), (x1, y1), (x1, y0), (x0, y0)]
    for polygon in mesh.polygons:
        for index in polygon.loop_indices:
            x, y = coordinates[mesh.loops[index].vertex_index]
            uv.data[index].uv = (x/packing["width"], 1.-y/packing["height"])
    obj["origin"] = "Existing Tripo Studio projection + original imagegen ink redraw"
    obj["alpha_cutoff"] = .18
    obj["art_status"] = "Map scenery sample; final scene representation pending review"
    obj["atlas_source_sha256"] = packing["source_sha256"]
    names.append(obj.name)

blend = HERE.parent / "source/ink_scenery.blend"
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
path = OUT / "ink_scenery.glb"
bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", export_animations=False,
                          export_image_format="AUTO", export_materials="EXPORT")
blob = path.read_bytes()
size = struct.unpack_from("<I", blob, 12)[0]
g = json.loads(blob[20:20+size])
binary = blob[20+size:]
g["scenes"] = [{"name": name, "nodes": [next(i for i, node in enumerate(g["nodes"]) if node["name"] == name)]} for name in names]
g["scene"] = 0
for mat in g["materials"]:
    mat["alphaMode"] = "MASK"
    mat["alphaCutoff"] = .18
    mat["doubleSided"] = True
    mat.setdefault("extensions", {})["KHR_materials_unlit"] = {}
g.setdefault("extensionsUsed", []).append("KHR_materials_unlit")
encoded = json.dumps(g, separators=(",", ":")).encode()
encoded += b" " * (-len(encoded) % 4)
result = struct.pack("<III", 0x46546c67, 2, 20+len(encoded)+len(binary)) + struct.pack("<II", len(encoded), 0x4e4f534a) + encoded + binary
path.write_bytes(result)
shutil.copyfile(HERE / "terrain-runtime.jpg", OUT / "ink-terrain.jpg")
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
record = {"asset": "ink_scenery", "origin": "tripo-projection-imagegen-blender",
          "source_file": "ink-world/scenery-source-v2.png", "source_sha256": packing["source_sha256"],
          "source_blend": "ink_scenery.blend", "triangles": 8, "bones": 0, "clips": [],
          "bytes": len(result), "triangle_budget": 8, "byte_budget": 160000, "texture_max": 1024,
          "joint_budget": 0, "primitive_budget": 4, "runtime_sha256": sha(path)}
assert len(result) <= record["byte_budget"]
assert len(g["images"]) == 1 and len(g["materials"]) == 1 and len(g["scenes"]) == 4
manifest = json.loads((OUT / "manifest.json").read_text(encoding="utf-8"))
manifest["assets"] = [e for e in manifest["assets"] if e["asset"] != "ink_scenery"] + [record]
(OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
source_manifest = json.loads((OUT / "manifest.json").read_text(encoding="utf-8"))
upstream = [e for e in source_manifest["assets"] if e["asset"] in ["pine_tree", "seal_stone", "pine_rock", "mountain_shrub"]]
for entry in upstream:
    entry["projection_runtime_sha256"] = sha(OUT / (entry["asset"] + ".glb"))
delivery = {"version": 1, "status": "local scenery sample, pending actual game and visual review",
            "source_projection_sha256": sha(HERE / "studio-projections.png"), "upstream": upstream,
            "packing": packing, "runtime": record, "scenes": names,
            "process": "Existing accepted Studio modules -> Blender orthographic projection -> original ink redraw -> shared depth-writing cards; no new Studio generation or credit consumption"}
(HERE / "manifest.json").write_text(json.dumps(delivery, ensure_ascii=False, indent=2), encoding="utf-8")
print("CFGCN_INK_SCENERY " + json.dumps(record))
