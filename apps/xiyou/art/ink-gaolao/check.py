"""Fresh Blender reimport, source hashes, dimensions and root anchors."""
from pathlib import Path
import hashlib
import json
import struct
import bpy
from mathutils import Vector
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
path = ROOT / "apps/website/public/games/xiyou/assets/ink_gaolao.glb"
manifest = json.loads((HERE / "manifest.json").read_text(encoding="utf-8"))
assert hashlib.sha256(path.read_bytes()).hexdigest() == manifest["runtime"]["runtime_sha256"]
for part in manifest["packing"]["parts"]:
    assert hashlib.sha256((HERE / part["source"]).read_bytes()).hexdigest() == part["source_sha256"]
for prototype in manifest["references"][0]:
    source = prototype["source"]
    assert hashlib.sha256((ROOT / source["source"]).read_bytes()).hexdigest() == source["source_sha256"], "Studio original changed"
for reference in manifest["references"][1:]:
    assert hashlib.sha256((HERE.parent / reference["source"]).read_bytes()).hexdigest() == reference["sha256"], "accepted ink reference changed"
blob = path.read_bytes()
size = struct.unpack_from("<I", blob, 12)[0]
g = json.loads(blob[20:20 + size])
assert len(g["materials"]) == len(g["images"]) == 1 and len(g["scenes"]) == 3
assert g["materials"][0]["alphaMode"] == "MASK"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(path))
checks = []
for scene, part in zip(g["scenes"], manifest["packing"]["parts"]):
    mesh = next(o for o in bpy.data.objects if o.type == "MESH" and o.name == scene["name"])
    points = [mesh.matrix_world @ Vector(v) for v in mesh.bound_box]
    dimensions = [max(v[i] for v in points) - min(v[i] for v in points) for i in range(3)]
    assert abs(dimensions[0] - part["metres"]) < .0001 and dimensions[1] < .00001
    assert abs(min(v.z for v in points)) < .00001
    assert sum(len(p.vertices) - 2 for p in mesh.data.polygons) == 2 and mesh.data.uv_layers.active
    checks.append({"scene": scene["name"], "dimensions": dimensions, "foot_z": min(v.z for v in points), "triangles": 2})
qa = ROOT / ".local/qa/ink-gaolao"
qa.mkdir(parents=True, exist_ok=True)
(qa / "reimport.json").write_text(json.dumps(checks, indent=2), encoding="utf-8")
print("CFGCN_GAOLAO_REIMPORT " + json.dumps(checks))
