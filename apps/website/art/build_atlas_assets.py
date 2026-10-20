"""Finish immutable Tripo Studio scenery for the website's actual camera.

Run with Blender, e.g. --background --python-exit-code 1 --python
apps/website/art/build_atlas_assets.py -- pine changan hanzhong liangshan jinling.
No procedural substitute is generated when a Studio source is missing.
"""
import hashlib
import json
import math
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Matrix

HERE = Path(__file__).parent
ROOT = HERE.parents[2]
OUT = ROOT / "apps/website/public/art/atlas/models"
SOURCE = HERE / "sources.json"


def finish(name, entry):
    raw = ROOT / entry["source"]
    assert raw.is_file(), f"Studio source is required: {raw}"
    digest = hashlib.sha256(raw.read_bytes()).hexdigest()
    assert digest == entry["source_sha256"], f"Immutable source changed: {name}"
    manifest_path = OUT / "manifest.json"
    if manifest_path.exists():
        recorded = json.loads(manifest_path.read_text(encoding="utf-8"))
        accepted = next((a for a in recorded["assets"] if a["asset"] == name), None)
        if accepted and (accepted.get("ground_refinement") or accepted.get("derived_from")):
            print(f"CFGCN_ATLAS_PRESERVED {name}: use its recorded derivative builder")
            return
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(raw))
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    assert meshes, name
    bpy.ops.object.select_all(action="DESELECT")
    # Freeze the imported transforms before joining. Studio's source stays intact.
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.data.transform(obj.matrix_world)
    obj.matrix_world = Matrix.Identity(4)
    if entry.get("rotation", 0):
        obj.data.transform(Matrix.Rotation(math.radians(entry["rotation"]), 4, "Z"))
    low = [min(v.co[i] for v in obj.data.vertices) for i in range(3)]
    high = [max(v.co[i] for v in obj.data.vertices) for i in range(3)]
    scale = entry["width"] / max(high[0] - low[0], high[1] - low[1])
    obj.data.transform(Matrix.Scale(scale, 4) @ Matrix.Translation(
        (-(high[0] + low[0]) / 2, -(high[1] + low[1]) / 2, -low[2])))
    # Studio may add a display slab. Compress only its lower skirt, retaining
    # all geometry above it, before making the repeatable ground-conforming LOD.
    if entry.get("skirt_compression"):
        skirt = entry["skirt_compression"]
        cutoff = max(v.co.z for v in obj.data.vertices) * skirt["height_fraction"]
        ratio = skirt["ratio"]
        for vertex in obj.data.vertices:
            z = vertex.co.z
            vertex.co.z = z * ratio if z < cutoff else z - cutoff * (1 - ratio)
    triangles = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    if triangles > entry["triangle_budget"]:
        decimate = obj.modifiers.new("Website silhouette budget", "DECIMATE")
        decimate.ratio = (entry["triangle_budget"] - 12) / triangles
        bpy.ops.object.modifier_apply(modifier=decimate.name)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    for mat in obj.data.materials:
        if not mat or not mat.use_nodes:
            continue
        shader = mat.node_tree.nodes.get("Principled BSDF")
        if shader:
            shader.inputs["Metallic"].default_value = 0
            shader.inputs["Roughness"].default_value = .94
            shader.inputs["Specular IOR Level"].default_value = .15
    for image in bpy.data.images:
        if image.type == "IMAGE" and image.size[0] and image.size[1]:
            limit = entry["texture_max"]
            if max(image.size) > limit:
                ratio = limit / max(image.size)
                image.scale(max(1, round(image.size[0] * ratio)), max(1, round(image.size[1] * ratio)))
            image.pack()
    obj.name = f"{name} Tripo Studio finished scenery"
    (HERE / "source").mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE / "source" / f"{name}.blend"))
    path = OUT / f"{name}.glb"
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", export_animations=False,
                              export_image_format="JPEG", export_jpeg_quality=82)
    blob = path.read_bytes()
    gltf = json.loads(blob[20:20 + struct.unpack_from("<I", blob, 12)[0]])
    triangles = sum(gltf["accessors"][p["indices"]]["count"] // 3
                    for mesh in gltf["meshes"] for p in mesh["primitives"])
    assert triangles <= entry["triangle_budget"], (name, triangles)
    assert len(blob) <= entry["byte_budget"], (name, len(blob))
    result = {**entry, "asset": name, "origin": "tripo-studio-blender", "bytes": len(blob),
              "triangles": triangles, "primitives": sum(len(m["primitives"]) for m in gltf["meshes"]),
              "runtime_sha256": hashlib.sha256(blob).hexdigest(),
              "editable_source": f"apps/website/art/source/{name}.blend"}
    manifest_path = OUT / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {"assets": []}
    manifest["assets"] = [a for a in manifest["assets"] if a["asset"] != name] + [result]
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("CFGCN_ATLAS_ASSET " + json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    entries = json.loads(SOURCE.read_text(encoding="utf-8"))
    names = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else list(entries)
    for name in names:
        finish(name, entries[name])
