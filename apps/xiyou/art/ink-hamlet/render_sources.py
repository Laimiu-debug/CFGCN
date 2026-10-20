"""Project accepted Studio village and riverside references without editing them."""
from pathlib import Path
import hashlib
import json
import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
SOURCES = ROOT / "apps/website/public/art/atlas/models"
manifest = json.loads((SOURCES / "manifest.json").read_text(encoding="utf-8"))
records = []
for name in ("village", "riverbank"):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    path = SOURCES / (name + ".glb")
    bpy.ops.import_scene.gltf(filepath=str(path))
    points = [o.matrix_world @ Vector(p) for o in bpy.context.scene.objects
              if o.type == "MESH" for p in o.bound_box]
    lower = Vector([min(p[i] for p in points) for i in range(3)])
    upper = Vector([max(p[i] for p in points) for i in range(3)])
    target = (lower + upper) * .5
    extent = max(upper - lower)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 768
    scene.render.resolution_y = 768
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "Standard"
    bpy.ops.object.light_add(type="AREA", location=target + Vector((-2, -3, 5)) * extent)
    bpy.context.object.data.energy = 750 * extent * extent
    bpy.context.object.data.size = extent * 4
    bpy.ops.object.camera_add(location=target + Vector((.28, -1, .65)) * extent * 2)
    camera = bpy.context.object
    camera.rotation_euler = (target-camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = extent * 1.48
    scene.camera = camera
    scene.render.filepath = str(HERE / (name + "-reference.png"))
    bpy.ops.render.render(write_still=True)
    record = next(a for a in manifest["assets"] if a["asset"] == name)
    records.append({"asset": name, "source": record, "runtime_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                    "projection": name + "-reference.png", "purpose": "original ink redraw reference, original asset left unchanged"})
(HERE / "projection.json").write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
print("CFGCN_HAMLET_REFERENCES " + str(len(records)))
