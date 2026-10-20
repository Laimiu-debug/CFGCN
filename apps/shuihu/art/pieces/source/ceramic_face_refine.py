"""Project model-specific ceramic eyebrow/eye paint onto real Blender face geometry."""
import hashlib
import json
import math
import re
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[5]
ART = ROOT / "apps/shuihu/art/pieces"
DESIGN = ART / "ceramic/ls059-face-design.json"
design = json.loads(DESIGN.read_text(encoding="utf-8"))
prep = ART / "source/ceramic-production/ls059-source-preparation.blend"
raw = ART / "source/raw/studio-ceramic-v1/ls059.glb"
assert hashlib.sha256(raw.read_bytes()).hexdigest() == design["sourceRawSha256"]
bpy.ops.wm.open_mainfile(filepath=str(prep))
scene = bpy.context.scene
meshes = [o for o in scene.objects if o.type == "MESH"]
assert len(meshes) == 1
body = meshes[0]
bpy.context.view_layer.update()
matrix = body.matrix_world.copy()
inverse = matrix.inverted()
normal_matrix = matrix.inverted().transposed().to_3x3()
points = [matrix @ v.co for v in body.data.vertices]
height = max(p.z for p in points) - min(p.z for p in points)
head = [p for p in points if height * .78 < p.z < height * .94]
head_y = (min(p.y for p in head) + max(p.y for p in head)) / 2
center_z = height * .845
image_height = height * .27
image_width = image_height * 1000 / 1100
tokens = (ROOT / "packages/ui/src/tokens.css").read_text(encoding="utf-8")

def color(name):
    value = re.search(r"--" + re.escape(name) + r":\s*#([0-9a-fA-F]{6})", tokens).group(1)
    rgb = [int(value[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb) + (1,)

def material(name, rgba):
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    bsdf = result.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Metallic"].default_value = 0
    bsdf.inputs["Roughness"].default_value = .72
    bsdf.inputs["Specular IOR Level"].default_value = .25
    return result

ink = color("ink")
red = color("vermilion")
paper = color("paper")
brow_mat = material("Hand_painted_dark_brown_brows", tuple(ink[i]*.88 + red[i]*.12 for i in range(4)))
pupil_mat = material("Ceramic_pupil_ink", ink)
iris_mat = material("Ceramic_iris_brown", tuple(ink[i]*.72 + red[i]*.28 for i in range(4)))
white_mat = material("Warm_ivory_sclera", tuple(paper[i] * .73 if i < 3 else 1 for i in range(4)))
lip_mat = material("Subtle_lip_line", tuple(ink[i]*.70 + red[i]*.30 for i in range(4)))
detail = bpy.data.collections.new("Hu_Sanniang_model_specific_face_paint")
scene.collection.children.link(detail)

def project(pixel, lift=.000010):
    u, v = pixel[:2]
    origin_world = Vector((.2, head_y + (u/1000-.5)*image_width, center_z + (.5-v/1100)*image_height))
    origin = inverse @ origin_world
    direction = (inverse.to_3x3() @ Vector((-1,0,0))).normalized()
    hit, location, normal, _ = body.ray_cast(origin, direction)
    if not hit:
        raise RuntimeError("Face anchor misses source surface: " + repr(pixel))
    return matrix @ location + (normal_matrix @ normal).normalized() * lift

def smooth(points, closed=False, steps=7):
    result = []
    count = len(points)
    for index in range(count if closed else count-1):
        p0 = Vector(points[(index-1)%count] if closed or index else points[0])
        p1 = Vector(points[index])
        p2 = Vector(points[(index+1)%count])
        p3 = Vector(points[(index+2)%count] if closed or index+2<count else points[-1])
        for sub in range(steps):
            t = sub/steps
            result.append(tuple(.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t)))
    if not closed:
        result.append(tuple(points[-1]))
    return result

def add_mesh(name, vertices, faces, mat):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    detail.objects.link(obj)
    mesh.materials.append(mat)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    obj["kind"] = "Model-specific ceramic paint, fitted to original facial surface"
    return obj

def ribbon(name, points, mat, width=1.2, lift=.000010):
    path = smooth(points)
    vertices = []
    for index, point in enumerate(path):
        previous = Vector(path[max(0,index-1)][:2])
        following = Vector(path[min(len(path)-1,index+1)][:2])
        delta = (following-previous).normalized()
        normal = Vector((-delta.y,delta.x))
        radius = point[2] if len(point)>2 else width
        center = Vector(point[:2])
        vertices += [project(center+normal*radius,lift), project(center-normal*radius,lift)]
    return add_mesh(name,vertices,[(i*2,i*2+1,i*2+3,i*2+2) for i in range(len(path)-1)],mat)

def patch(name, outline, mat, lift=.000012, smoothing=True):
    edge = smooth(outline,closed=True,steps=5) if smoothing else outline
    center = Vector((sum(p[0] for p in edge)/len(edge),sum(p[1] for p in edge)/len(edge)))
    vertices = [project(center,lift)]
    count = len(edge)
    rings = 5
    for ring in range(1,rings+1):
        for point in edge:
            vertices.append(project(center+(Vector(point)-center)*(ring/rings),lift))
    faces = [(0,1+i,1+(i+1)%count) for i in range(count)]
    for ring in range(rings-1):
        lower = 1+ring*count
        upper = lower+count
        faces += [(lower+i,upper+i,upper+(i+1)%count,lower+(i+1)%count) for i in range(count)]
    return add_mesh(name,vertices,faces,mat)

def ellipse(center, radius_x, radius_y):
    return [(center[0]+math.cos(i*2*math.pi/24)*radius_x,center[1]+math.sin(i*2*math.pi/24)*radius_y) for i in range(24)]

def clipped_iris(polygon, outline):
    area = sum(outline[i][0]*outline[(i+1)%len(outline)][1]-outline[(i+1)%len(outline)][0]*outline[i][1] for i in range(len(outline)))
    sign = 1 if area > 0 else -1
    output = [Vector(p) for p in polygon]
    for index in range(len(outline)):
        a = Vector(outline[index])
        b = Vector(outline[(index+1)%len(outline)])
        direction = b-a
        cross = lambda p: direction.x*(p-a).y-direction.y*(p-a).x
        source = output
        output = []
        if not source:
            break
        previous = source[-1]
        for current in source:
            previous_in = sign*cross(previous) >= 0
            current_in = sign*cross(current) >= 0
            if current_in != previous_in:
                fraction = cross(previous)/(cross(previous)-cross(current))
                output.append(previous+(current-previous)*fraction)
            if current_in:
                output.append(current)
            previous = current
    if len(output)<3:
        raise RuntimeError("Eye clipping removed the iris")
    return [tuple(p) for p in output]

for brow in design["brows"]:
    ribbon("Eyebrow_"+brow["name"],brow["points"],brow_mat)
for eye in design["eyes"]:
    patch("Sclera_"+eye["name"],eye["outline"],white_mat)
    x,y,rx,ry = eye["iris"]
    patch("Iris_"+eye["name"],clipped_iris(ellipse((x,y),rx,ry),eye["outline"]),iris_mat,lift=.000023,smoothing=False)
    patch("Pupil_"+eye["name"],clipped_iris(ellipse((x,y),rx*.43,ry*.8),eye["outline"]),pupil_mat,lift=.000032,smoothing=False)
    ribbon("Upper_eyelid_"+eye["name"],eye["upperLid"],brow_mat,width=1.1,lift=.000045)
    patch("Eye_glint_"+eye["name"],ellipse((x-1.7,y-2.0),1.1,1.0),white_mat,lift=.000038)
ribbon("Lip_separation",design["lipLine"],lip_mat,width=.35)
camera = scene.camera
qa = ROOT / ".local/qa/shuihu-pieces/ceramic-production"
preview = []
for name,location,target,scale in [
    ("face-front",(.18,head_y,center_z),(0,head_y,center_z),image_height),
    ("face-quarter",(.16,head_y-.045,center_z),(0,head_y,center_z),image_height),
    ("whole",(.22,-.065,height*.73),(0,0,height*.5),height*1.35),
]:
    camera.location = location
    camera.rotation_euler = (Vector(target)-camera.location).to_track_quat("-Z","Y").to_euler()
    camera.data.ortho_scale = scale
    filename = qa/("ls059-refined-"+name+".png")
    scene.render.filepath = str(filename)
    bpy.ops.render.render(write_still=True)
    preview.append(str(filename.relative_to(ROOT)).replace("\\","/"))
scene["stage"] = "Model-specific Blender eyebrow, sclera, iris, pupil, upper-lid and lip paint geometry added; awaiting visual review"
output = ART/"source/ceramic-production/ls059-face-refined.blend"
bpy.ops.wm.save_as_mainfile(filepath=str(output))
assert hashlib.sha256(raw.read_bytes()).hexdigest() == design["sourceRawSha256"]
record = {"id":"ls059","sourceStudioProjectId":design["sourceStudioProjectId"],"sourceRawSha256":design["sourceRawSha256"],
          "method":design["method"],"facePaintObjects":len(detail.objects),"sourceGeometryChanged":False,
          "blendFile":str(output.relative_to(ART)).replace("\\","/"),"previewImages":preview,
          "faceRefinementImplemented":True,"visualAccepted":False,"equipmentSeparated":False,"webExported":False,"approved":False}
(output.with_suffix(".json")).write_text(json.dumps(record,indent=2),encoding="utf-8")
print("CERAMIC_FACE_REFINEMENT " + json.dumps(record))
