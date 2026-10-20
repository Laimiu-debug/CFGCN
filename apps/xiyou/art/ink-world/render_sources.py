"""Render existing accepted Studio modules as a projection reference, preserving originals."""
from pathlib import Path
import hashlib
import json
import math

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
ASSETS = ROOT / "apps/website/public/games/xiyou/assets"
PARTS = [("pine_tree", (-3., 0., 0.), 4.5),
         ("seal_stone", (3., 0., .2), 3.),
         ("pine_rock", (-3., 0., -5.), 4.5),
         ("mountain_shrub", (3., 0., -5.), 2.7)]

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1024
scene.render.resolution_y = 1024
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = True
scene.view_settings.view_transform = "Standard"
sources = []
for name, position, height in PARTS:
    path = ASSETS / f"{name}.glb"
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    objects = [o for o in bpy.data.objects if o not in before]
    mesh_objects = [o for o in objects if o.type == "MESH"]
    corners = [o.matrix_world @ Vector(v) for o in mesh_objects for v in o.bound_box]
    lo = [min(v[i] for v in corners) for i in range(3)]
    hi = [max(v[i] for v in corners) for i in range(3)]
    factor = height / max(.001, hi[2] - lo[2])
    # glTF imports keep Blender Z up; join and normalize without rewriting sources.
    bpy.ops.object.select_all(action="DESELECT")
    for obj in mesh_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = mesh_objects[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    from mathutils import Matrix
    obj.data.transform(Matrix.Translation(position) @ Matrix.Scale(factor, 4)
                       @ Matrix.Translation((-(lo[0]+hi[0])/2, -(lo[1]+hi[1])/2, -lo[2]))
                       @ obj.matrix_world)
    obj.parent = None
    obj.matrix_world = Matrix.Identity(4)
    sources.append({"asset": name, "runtime_sha256": hashlib.sha256(path.read_bytes()).hexdigest()})

bpy.ops.object.light_add(type="AREA", location=(-4., -10., 12.))
bpy.context.object.data.energy = 1500
bpy.context.object.data.shape = "DISK"
bpy.context.object.data.size = 10
bpy.ops.object.camera_add(location=(0., -23., 14.))
camera = bpy.context.object
target = Vector((0., 0., -.4))
camera.rotation_euler = (target-camera.location).to_track_quat("-Z", "Y").to_euler()
camera.data.type = "ORTHO"
camera.data.ortho_scale = 12.8
scene.camera = camera
scene.render.filepath = str(HERE / "studio-projections.png")
bpy.ops.render.render(write_still=True)
(HERE / "projection-sources.json").write_text(json.dumps(sources, indent=2), encoding="utf-8")
print("CFGCN_INK_PROJECTIONS " + json.dumps(sources))
