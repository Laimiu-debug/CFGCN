"""Reimport each shared glTF scene in fresh Blender state and verify the delivery."""
from pathlib import Path
import hashlib
import json
import struct

import bpy

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
ASSETS = ROOT / "apps/website/public/games/xiyou/assets"
QA = ROOT / ".local/qa/ink-landmarks"
QA.mkdir(parents=True, exist_ok=True)
blob = (ASSETS / "ink_landmarks.glb").read_bytes()
length = struct.unpack_from("<I", blob, 12)[0]
g = json.loads(blob[20:20+length])
binary = blob[20+length:]
manifest = json.loads((HERE / "manifest.json").read_text(encoding="utf-8"))
assert hashlib.sha256(blob).hexdigest() == manifest["runtime"]["runtime_sha256"]
assert len(g["scenes"]) == 4 and len(g["materials"]) == 1 and len(g["images"]) == 1
assert g["materials"][0]["alphaMode"] == "MASK"
assert g["materials"][0]["alphaCutoff"] == .18
assert not any("uri" in i for i in g["images"])
for entry in manifest["upstream"]:
    assert hashlib.sha256((ASSETS / (entry["asset"]+".glb")).read_bytes()).hexdigest() == entry["projection_runtime_sha256"], "Original Studio-derived source changed"
checks = []
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ASSETS / "ink_landmarks.glb"))
all_meshes = [o for o in bpy.data.objects if o.type == "MESH"]
assert len(all_meshes) == 4
for index, scene in enumerate(g["scenes"]):
    assert len(scene["nodes"]) == 1 and g["nodes"][scene["nodes"][0]]["name"] == scene["name"]
    # Blender imports every glTF scene into separate Blender scenes, even when
    # one is marked default. Inspect the actual imported object for each root.
    meshes = [o for o in all_meshes if o.name == scene["name"]]
    assert len(meshes) == 1, (index, [o.name for o in meshes])
    mesh = meshes[0]
    from mathutils import Vector
    points = [mesh.matrix_world @ Vector(v) for v in mesh.bound_box]
    dimensions = [max(v[i] for v in points)-min(v[i] for v in points) for i in range(3)]
    assert min(abs(v.z) for v in points) < .00001
    assert dimensions[0] > .5 and dimensions[2] > .5 and dimensions[1] < .00001
    triangles = sum(len(p.vertices)-2 for p in mesh.data.polygons)
    assert triangles == 2 and mesh.data.uv_layers.active is not None
    checks.append({"scene": scene["name"], "triangles": triangles, "width": dimensions[0], "height": dimensions[2], "foot_z": min(v.z for v in points)})
(QA / "reimport.json").write_text(json.dumps(checks, indent=2), encoding="utf-8")
print("CFGCN_INK_REIMPORT " + json.dumps(checks))
