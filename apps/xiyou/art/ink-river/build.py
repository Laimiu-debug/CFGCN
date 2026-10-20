"""Three original riverside drawings, shared atlas, editable Blender source."""
from pathlib import Path
import hashlib
import json
import struct
import bpy

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
OUT = ROOT / "apps/website/public/games/xiyou/assets"
packing = json.loads((HERE / "packing.json").read_text(encoding="utf-8"))
bpy.ops.wm.read_factory_settings(use_empty=True)
image = bpy.data.images.load(str(HERE / "runtime.png"))
image.pack()
material = bpy.data.materials.new("Ink scenery river shared cutout")
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
    width = part["metres"]
    height = width * (y1 - y0) / (x1 - x0)
    left = (x0 - part["anchorX"]) / (x1 - x0) * width
    name = "Ink scenery river " + part["id"]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([(left, 0., 0.), (left + width, 0., 0.), (left + width, 0., height), (left, 0., height)], [], [(0, 1, 2, 3)])
    mesh.update()
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    uv = mesh.uv_layers.new(name="UVMap")
    coordinates = [(x0, y1), (x1, y1), (x1, y0), (x0, y0)]
    for polygon in mesh.polygons:
        for index in polygon.loop_indices:
            x, y = coordinates[mesh.loops[index].vertex_index]
            uv.data[index].uv = (x / packing["width"], 1. - y / packing["height"])
    obj["origin"] = "Accepted Tripo category references -> original ink redraw -> Blender scenery"
    obj["source_sha256"] = part["source_sha256"]
    names.append(name)
bpy.ops.wm.save_as_mainfile(filepath=str(HERE.parent / "source/ink_river.blend"))
path = OUT / "ink_river.glb"
bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", export_animations=False, export_image_format="AUTO", export_materials="EXPORT")
blob = path.read_bytes()
size = struct.unpack_from("<I", blob, 12)[0]
g = json.loads(blob[20:20 + size])
binary = blob[20 + size:]
g["scenes"] = [{"name": name, "nodes": [next(i for i, node in enumerate(g["nodes"]) if node["name"] == name)]} for name in names]
g["scene"] = 0
for mat in g["materials"]:
    mat.update(alphaMode="MASK", alphaCutoff=.18, doubleSided=True)
    mat.setdefault("extensions", {})["KHR_materials_unlit"] = {}
g.setdefault("extensionsUsed", []).append("KHR_materials_unlit")
encoded = json.dumps(g, separators=(",", ":")).encode()
encoded += b" " * (-len(encoded) % 4)
result = struct.pack("<III", 0x46546c67, 2, 20 + len(encoded) + len(binary)) + struct.pack("<II", len(encoded), 0x4e4f534a) + encoded + binary
path.write_bytes(result)
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
record = {"asset": "ink_river", "origin": "tripo-projection-imagegen-blender", "source_file": "ink-river/runtime.png", "source_sha256": sha(HERE / "runtime.png"), "source_blend": "ink_river.blend", "triangles": 6, "bones": 0, "clips": [], "bytes": len(result), "triangle_budget": 6, "byte_budget": 24000000, "texture_max": 2048, "joint_budget": 0, "primitive_budget": 3, "runtime_sha256": sha(path)}
assert len(g["images"]) == len(g["materials"]) == 1 and len(result) < record["byte_budget"]
manifest = json.loads((OUT / "manifest.json").read_text(encoding="utf-8"))
manifest["assets"] = [a for a in manifest["assets"] if a["asset"] != "ink_river"] + [record]
(OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
delivery = {"status": "local riverside scenery sample; actual game and visual review pending", "references": [json.loads((HERE.parent / "ink-world/projection-sources.json").read_text(encoding="utf-8")), {"source": "ink-hamlet/willow-source-v1.png", "sha256": sha(HERE.parent / "ink-hamlet/willow-source-v1.png"), "provenance": "ink-hamlet/manifest.json"}], "packing": packing, "runtime": record, "scenes": names, "process": "Existing accepted Studio vegetation / stone category prototypes retained; three original imagegen ink drawings; no new Studio generation or credits; no modelling software installed"}
(HERE / "manifest.json").write_text(json.dumps(delivery, ensure_ascii=False, indent=2), encoding="utf-8")
print("CFGCN_RIVER " + json.dumps(record))
