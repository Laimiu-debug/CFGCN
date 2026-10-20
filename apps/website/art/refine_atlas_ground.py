"""Remove Studio display undersides without modifying accepted source files.

Blender --background --python-exit-code 1 --python this_file.py
The first finished .blend and immutable Studio GLB remain rebuild inputs.
"""
import hashlib
import json
import math
import struct
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix

HERE = Path(__file__).parent
ROOT = HERE.parents[2]
OUT = ROOT / "apps/website/public/art/atlas/models"
CUTS = {
    "changan": .05, "hanzhong": .05, "liangshan": .15, "jinling": .05,
    "village": .06, "ridge": 1.15, "woodland": .7, "farmland": .03,
    "riverbank": .5, "marsh": .8, "jiangnan": 1.25, "pine": .03,
}
QUALITY = set(CUTS)
FOUNDATIONS = {"farmland": (2.4, .045), "changan": (1.1, .15), "hanzhong": (.8, .2), "jinling": (1.8, .15)}


def import_quality_source(entry):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / entry["source"]))
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
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
    skirt = entry.get("skirt_compression")
    if skirt:
        cutoff = max(v.co.z for v in obj.data.vertices) * skirt["height_fraction"]
        for v in obj.data.vertices:
            v.co.z = v.co.z * skirt["ratio"] if v.co.z < cutoff else v.co.z - cutoff * (1 - skirt["ratio"])
    for image in bpy.data.images:
        if image.type == "IMAGE" and image.size[0] and image.size[1]:
            ratio = min(1, entry["texture_max"] / max(image.size))
            if ratio < 1:
                image.scale(round(image.size[0] * ratio), round(image.size[1] * ratio))
            image.pack()
    return obj


def refine(name, cutoff, manifest):
    original = HERE / "source" / f"{name}.blend"
    input_hash = hashlib.sha256(original.read_bytes()).hexdigest()
    entry = next(a for a in manifest["assets"] if a["asset"] == name)
    assert hashlib.sha256((ROOT / entry["source"]).read_bytes()).hexdigest() == entry["source_sha256"]
    if name in QUALITY:
        specification = json.loads((HERE / "sources.json").read_text(encoding="utf-8"))[name]
        entry["triangle_budget"] = specification["triangle_budget"]
        entry["byte_budget"] = specification["byte_budget"]
        entry["texture_max"] = specification["texture_max"]
        obj = import_quality_source(entry)
    else:
        bpy.ops.wm.open_mainfile(filepath=str(original))
        obj = next(o for o in bpy.context.scene.objects if o.type == "MESH")
    bpy.context.view_layer.objects.active = obj
    if name in FOUNDATIONS:
        # Thin the display platform while retaining complete structures above
        # its upper surface; never cut the scene off halfway up its walls.
        hinge, ratio = FOUNDATIONS[name]
        for v in obj.data.vertices:
            v.co.z = v.co.z * ratio if v.co.z < hinge else v.co.z - hinge * (1 - ratio)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    before = len(bm.faces)
    raw_vertices = len(bm.verts)
    # GLTF splits vertices along UV / normal seams. Decimating those islands
    # independently used to delete wall and foliage fragments. Merge positions
    # first; face-loop UVs remain separate and survive export.
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.00005)
    welded_vertices = len(bm.verts)
    bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
                          dist=.0001, plane_co=(0, 0, cutoff), plane_no=(0, 0, 1),
                          clear_inner=True, clear_outer=False)
    # Keep a shallow open root under the DEM; no vertical display wall or cap.
    for v in bm.verts:
        v.co.z -= cutoff
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    if sum(len(p.vertices) - 2 for p in obj.data.polygons) > entry["triangle_budget"]:
        modifier = obj.modifiers.new("Clipped silhouette budget", "DECIMATE")
        modifier.ratio = (entry["triangle_budget"] - 12) / sum(len(p.vertices) - 2 for p in obj.data.polygons)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    # Edge collapse can move a clipped boundary slightly below its plane.
    for vertex in obj.data.vertices:
        vertex.co.z = max(0, vertex.co.z)
    for p in obj.data.polygons:
        p.use_smooth = True
    obj.data.update()
    derived = HERE / "source" / "terrain-v2" / f"{name}.blend"
    derived.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(derived))
    runtime = OUT / f"{name}.glb"
    bpy.ops.export_scene.gltf(filepath=str(runtime), export_format="GLB", export_animations=False,
                             export_image_format="JPEG", export_jpeg_quality=82)
    blob = runtime.read_bytes()
    gltf = json.loads(blob[20:20 + struct.unpack_from("<I", blob, 12)[0]])
    triangles = sum(gltf["accessors"][p["indices"]]["count"] // 3 for m in gltf["meshes"] for p in m["primitives"])
    assert triangles <= entry["triangle_budget"] and len(blob) <= entry["byte_budget"]
    entry.update(bytes=len(blob), triangles=triangles,
                 runtime_sha256=hashlib.sha256(blob).hexdigest(),
                 editable_source=derived.relative_to(ROOT).as_posix(),
                 ground_refinement={"version": 2, "cut_height": cutoff,
                                    "input_kind": "studio-raw" if name in QUALITY else "accepted-blend",
                                    "foundation_profile": FOUNDATIONS.get(name),
                                    "input_blend": original.relative_to(ROOT).as_posix(),
                                    "input_sha256": input_hash,
                                    "weld_tolerance": .00005,
                                    "vertices_before_weld": raw_vertices,
                                    "vertices_after_weld": welded_vertices,
                                    "script": "apps/website/art/refine_atlas_ground.py"})
    print(f"ATLAS_ROOT {name}: {raw_vertices} vertices -> {welded_vertices} welded, {before} faces -> {triangles} triangles, underside cut {cutoff}")


if __name__ == "__main__":
    path = OUT / "manifest.json"
    manifest = json.loads(path.read_text(encoding="utf-8"))
    names = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else list(CUTS)
    for name in names:
        cutoff = CUTS[name]
        refine(name, cutoff, manifest)
        path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
