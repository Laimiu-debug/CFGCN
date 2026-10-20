"""Package original generated part sheets as WOOP resources; run with Blender.

Only crop source texture regions for asset packaging. No repainting, replacement
art, background synthesis or third-party artwork is used here.
"""
from pathlib import Path
import hashlib
import json
import math
import sys
import zipfile

import bpy
import numpy as np

HERE = Path(__file__).resolve().parent
ROSTER = json.loads((HERE / "roster.json").read_text(encoding="utf-8"))
COLUMNS = [["head", "upper_arm.front", "foot.back", "weapon"],
           ["body", "forearm.front", "thigh.front", "accessory"],
           ["upper_arm.back", "thigh.back", "shin.front", "abdomen"],
           ["forearm.back", "shin.back", "foot.front", "pelvis"]]
LAYERS = ["accessory", "upper_arm.back", "forearm.back", "thigh.back", "shin.back", "foot.back",
          "thigh.front", "shin.front", "foot.front", "abdomen", "body", "pelvis", "head", "upper_arm.front", "forearm.front", "weapon"]


def components(alpha):
    """Find the separate generated parts, even when layout rows are uneven."""
    step = 4
    mask = (alpha[::step, ::step] > .42).copy()
    height, width = mask.shape
    result = []
    for y, x in zip(*np.nonzero(mask)):
        if not mask[y, x]:
            continue
        pending = [(int(x), int(y))]
        mask[y, x] = False
        count, x0, y0, x1, y1 = 0, x, y, x, y
        while pending:
            px, py = pending.pop()
            count += 1
            x0, y0, x1, y1 = min(x0, px), min(y0, py), max(x1, px), max(y1, py)
            for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)]:
                nx, ny = px + dx, py + dy
                if 0 <= nx < width and 0 <= ny < height and mask[ny, nx]:
                    mask[ny, nx] = False
                    pending.append((nx, ny))
        if count > 100:
            result.append({"area": count * step * step,
                           "rect": [max(0, int(x0 * step) - 4), max(0, int(y0 * step) - 4),
                                    min(alpha.shape[1], int((x1 + 1) * step) + 4),
                                    min(alpha.shape[0], int((y1 + 1) * step) + 4)]})
    return result


def transform_point(matrix, point):
    a, b, c, d, e, f = matrix
    x, y = point
    return [a * x + c * y + e, b * x + d * y + f]


def inverse_point(matrix, point):
    a, b, c, d, e, f = matrix
    det = a * d - b * c
    x, y = point[0] - e, point[1] - f
    return [(d * x - c * y) / det, (-b * x + a * y) / det]


def matrix_at(pivot, target, scale, angle=0., width_factor=1.):
    a, b = scale * math.cos(angle) * width_factor, scale * math.sin(angle) * width_factor
    c, d = -scale * math.sin(angle), scale * math.cos(angle)
    return [a, b, c, d, target[0] - a * pivot[0] - c * pivot[1],
            target[1] - b * pivot[0] - d * pivot[1]]


def prepare(character):
    directory = HERE / character["id"]
    image = bpy.data.images.load(str(directory / "parts-source.png"), check_existing=False)
    width, height = image.size
    pixels = np.asarray(image.pixels[:], dtype=np.float32).reshape(height, width, 4)[::-1].copy()
    found = components(pixels[:, :, 3])
    assigned = {}
    for column, names in enumerate(COLUMNS):
        values = [p for p in found if min(3, int((p["rect"][0] + p["rect"][2]) / 2 / width * 4)) == column]
        values = sorted(sorted(values, key=lambda p: -p["area"])[:len(names)], key=lambda p: p["rect"][1])
        assert len(values) == len(names), (character["id"], column, len(values), found)
        assigned.update(dict(zip(names, values)))
    assert len(assigned) == 16
    (directory / "parts").mkdir(exist_ok=True)
    parts, part_pixels = {}, {}
    for name in LAYERS:
        rect = assigned[name]["rect"]
        # Abdomen owns the visible waist/sash. Trim the redundant upper band
        # of the lower garment so assembly does not stack two waist belts.
        if name == "pelvis":
            rect = [rect[0], rect[1] + round((rect[3] - rect[1]) * .34), rect[2], rect[3]]
        x0, y0, x1, y1 = rect
        crop = pixels[y0:y1, x0:x1]
        part_pixels[name] = crop
        target = bpy.data.images.new(name + "_source_crop", width=x1 - x0, height=y1 - y0, alpha=True)
        target.colorspace_settings.name = image.colorspace_settings.name
        target.pixels.foreach_set(np.ascontiguousarray(crop[::-1]).ravel())
        target.file_format = "PNG"
        target.filepath_raw = str(directory / "parts" / (name + ".png"))
        target.save()
        bpy.data.images.remove(target)
        parts[name] = {"id": name, "width": x1 - x0, "height": y1 - y0,
                       "image": "parts/" + name + ".png", "anchors": [],
                       "source": {"matrix": [1, 0, 0, 1, x0, y0], "zIndex": LAYERS.index(name)},
                       "sourceRect": rect}

    replacement_path = directory / "weapon-source.png"
    if replacement_path.exists():
        replacement = bpy.data.images.load(str(replacement_path), check_existing=False)
        ww, wh = replacement.size
        values = np.asarray(replacement.pixels[:], dtype=np.float32).reshape(wh, ww, 4)[::-1].copy()
        yy, xx = np.nonzero(values[:, :, 3] > .42)
        x0, y0, x1, y1 = max(0, int(xx.min())-3), max(0, int(yy.min())-3), min(ww, int(xx.max())+4), min(wh, int(yy.max())+4)
        crop = values[y0:y1, x0:x1]
        output = bpy.data.images.new("weapon_cutout", width=x1-x0, height=y1-y0, alpha=True)
        output.colorspace_settings.name = replacement.colorspace_settings.name
        output.pixels.foreach_set(np.ascontiguousarray(crop[::-1]).ravel())
        output.file_format = "PNG"
        output.filepath_raw = str(directory / "parts/weapon.png")
        output.save()
        bpy.data.images.remove(output)
        bpy.data.images.remove(replacement)
        part_pixels["weapon"] = crop
        parts["weapon"].update(width=x1-x0, height=y1-y0, sourceImage="weapon-source.png", sourceRect=[x0,y0,x1,y1])

    lower_path = directory / "lower-body-source.png"
    if lower_path.exists():
        lower = bpy.data.images.load(str(lower_path),check_existing=False)
        lw,lh = lower.size
        values = np.asarray(lower.pixels[:],dtype=np.float32).reshape(lh,lw,4)[::-1].copy()
        isolated = components(values[:,:,3])
        columns = [["thigh.back","foot.back","shin.front","pelvis"],
                   ["shin.back","thigh.front","foot.front"]]
        for col,names in enumerate(columns):
            choices = [v for v in isolated if min(1,int((v["rect"][0]+v["rect"][2])*.5/lw*2))==col]
            choices = sorted(sorted(choices,key=lambda v:-v["area"])[:len(names)],key=lambda v:v["rect"][1])
            assert len(choices)==len(names),(character["id"],"lower body",col,len(choices))
            for name,component in zip(names,choices):
                x0,y0,x1,y1 = component["rect"]
                crop = values[y0:y1,x0:x1]
                output = bpy.data.images.new(name+"_revised_cutout",width=x1-x0,height=y1-y0,alpha=True)
                output.colorspace_settings.name = lower.colorspace_settings.name
                output.pixels.foreach_set(np.ascontiguousarray(crop[::-1]).ravel())
                output.file_format = "PNG"
                output.filepath_raw = str(directory/"parts"/(name+".png"))
                output.save()
                bpy.data.images.remove(output)
                part_pixels[name] = crop
                parts[name].update(width=x1-x0,height=y1-y0,sourceImage="lower-body-source.png",sourceRect=[x0,y0,x1,y1])
        bpy.data.images.remove(lower)

    def fraction(name, x, y):
        return [parts[name]["width"] * x, parts[name]["height"] * y]

    def row_pivot(name, y):
        values = part_pixels[name][:, :, 3]
        middle = int(values.shape[0] * y)
        yy, xx = np.nonzero(values[max(0, middle - 5):middle + 6] > .42)
        return [float(np.median(xx)) if len(xx) else values.shape[1] / 2, values.shape[0] * y]

    def place(name, pivot, target, desired_height=None, end=None, target_end=None, width_factor=1., mirror=False, desired_width=None):
        if end is not None:
            dx, dy = end[0] - pivot[0], end[1] - pivot[1]
            tx, ty = target_end[0] - target[0], target_end[1] - target[1]
            source_length, target_length = math.hypot(dx,dy), math.hypot(tx,ty)
            ux, uy, vx, vy = dx/source_length, dy/source_length, -dy/source_length, dx/source_length
            qx, qy, rx, ry = tx/target_length, ty/target_length, -ty/target_length, tx/target_length
            longitudinal = target_length/source_length
            cross_extent = abs(vx)*parts[name]["width"] + abs(vy)*parts[name]["height"]
            transverse = desired_width/cross_extent if desired_width else longitudinal*width_factor
            # Scale in the part's longitudinal/perpendicular basis. The former
            # X-only scaling displaced the painted distal joint off its bone.
            a,b = qx*longitudinal*ux+rx*transverse*vx, qy*longitudinal*ux+ry*transverse*vx
            c,d = qx*longitudinal*uy+rx*transverse*vy, qy*longitudinal*uy+ry*transverse*vy
            matrix = [a,b,c,d,target[0]-a*pivot[0]-c*pivot[1],target[1]-b*pivot[0]-d*pivot[1]]
        else:
            scale, angle = desired_height / parts[name]["height"], 0.
            matrix = matrix_at(pivot, target, scale, angle, -width_factor if mirror else width_factor)
        parts[name]["rest"] = {"matrix": matrix, "zIndex": LAYERS.index(name)}
        parts[name]["anchors"].append({"id": "pivot", "partPx": pivot})
        if end is not None:
            parts[name]["anchors"].append({"id":"distal", "partPx":end})
            assert math.dist(transform_point(matrix,end),target_end) < .00001

    # Each native part has its own dimensions. Whole-character height is only
    # applied after assembly; it cannot substitute for anatomical differences.
    p = character["proportions"]
    long_robe = character["id"] in ["tangseng", "shaseng", "xiaobailong", "baigufuren"]
    pelvis_height, pelvis_width = p["pelvis"]
    pelvis_width_factor = pelvis_width / (pelvis_height * parts["pelvis"]["width"] / parts["pelvis"]["height"])
    pelvis_hip_y = -.08 if lower_path.exists() else (.20-.34)/.66
    hip_y = -(p["thigh"][0] + p["shin"][0] + (1-p["foot_anchor_y"])*p["foot"][0])
    place("pelvis", fraction("pelvis", .5, pelvis_hip_y), [0, hip_y], desired_height=pelvis_height,
          width_factor=pelvis_width_factor)
    pelvis_matrix = parts["pelvis"]["rest"]["matrix"]
    waist = transform_point(pelvis_matrix, fraction("pelvis", .5, pelvis_hip_y))
    abdomen_height, abdomen_width = p["abdomen"]
    abdomen_width_factor = abdomen_width / (abdomen_height * parts["abdomen"]["width"] / parts["abdomen"]["height"])
    place("abdomen", fraction("abdomen", .5, .68), waist, desired_height=abdomen_height,
          width_factor=abdomen_width_factor)
    ribs = transform_point(parts["abdomen"]["rest"]["matrix"], fraction("abdomen", .5, .20))
    chest_height, chest_width = p["chest"]
    place("body", fraction("body", .5, .92), ribs, desired_height=chest_height,
          width_factor=chest_width / (chest_height * parts["body"]["width"] / parts["body"]["height"]))
    body_matrix = parts["body"]["rest"]["matrix"]
    points = {"head": transform_point(body_matrix, fraction("body", .5, .17)),
              "upper_arm.back": transform_point(body_matrix, fraction("body", .12, .19)),
              "upper_arm.front": transform_point(body_matrix, fraction("body", .86, .19)),
              "thigh.back": [-p["hip_span"]*.5,hip_y],
              "thigh.front": [p["hip_span"]*.5,hip_y]}
    head_height, head_width = p["head"]
    place("head", fraction("head", .48, .94), points["head"], desired_height=head_height,
          width_factor=head_width / (head_height * parts["head"]["width"] / parts["head"]["height"]))
    parents = {"head": "body", "body": "abdomen", "abdomen": "pelvis"}
    for side in ["back", "front"]:
        upper, fore, thigh, shin, foot = [s + "." + side for s in ["upper_arm", "forearm", "thigh", "shin", "foot"]]
        shoulder = points[upper]
        elbow = [shoulder[0], shoulder[1] + p["upper"][0]]
        wrist = [shoulder[0], elbow[1] + p["fore"][0]]
        hip = points[thigh]
        knee = [hip[0], hip[1] + p["thigh"][0]]
        ankle = [hip[0], knee[1] + p["shin"][0]]
        for name, key, start, finish, a, b in [
            (upper, "upper", .10, .64, shoulder, elbow),
            (fore, "fore", .10, .83, elbow, wrist),
            (thigh, "thigh", .10, .90, hip, knee),
            (shin, "shin", .10, .90, knee, ankle),
        ]:
            pivot, end = row_pivot(name, start), row_pivot(name, finish)
            place(name, pivot, a, end=end, target_end=b, desired_width=p[key][1])
        foot_height, foot_width = p["foot"]
        place(foot, row_pivot(foot, p["foot_anchor_y"]), ankle, desired_height=foot_height,
              width_factor=foot_width / (foot_height * parts[foot]["width"] / parts[foot]["height"]))
        parents.update({upper: "body", fore: upper, thigh: "pelvis", shin: thigh, foot: shin})
        points.update({fore: elbow, shin: knee, foot: ankle})
        if side == "front":
            points["weapon"] = wrist
    # Weapon length follows body height; a long weapon's head/pole proportions
    # come from its new drawing, not an extreme nonuniform resize of an atlas cell.
    body_top = points["head"][1] - .94*head_height
    weapon_height = -body_top*character["weapon_body_ratio"]
    grip_y = character["weapon_grip"][1]
    if character.get("weapon_floor_clearance") is not None:
        shoulder = points["upper_arm.front"]
        lean, upper, fore = p["lean"], -.08, p["fore_angle"]
        hand_y = shoulder[1]+p["upper"][0]*math.cos(lean+upper)+p["fore"][0]*math.cos(lean+upper+fore)
        bottom_y = -character["weapon_floor_clearance"]*(-body_top)
        grip_y = 1-(bottom_y-hand_y)/(math.cos(p["weapon_tilt"])*weapon_height)
    grip_y = max(.1,min(.9,grip_y))
    place("weapon", row_pivot("weapon",grip_y), points["weapon"],
          desired_height=weapon_height, width_factor=character.get("weapon_width_scale",1.))
    parents["weapon"] = "forearm.front"
    accessory = character["accessory"]
    if accessory == "monkey_tail":
        pivot, target, size, mirror, parent = [.85, .85], points["thigh.back"], 65, False, "body"
    elif accessory in ["wolf_tail", "tiger_tail"]:
        pivot, target, size, mirror, parent = [.16, .12], points["thigh.back"], 67, True, "body"
    elif accessory == "hair":
        pivot, target, size, mirror, parent = [.13, .10], points["head"], 45, True, "head"
    elif accessory == "ribbon":
        pivot, target, size, mirror, parent = [.6, .10], points["weapon"], 45, False, "forearm.front"
    else:
        target = transform_point(body_matrix, fraction("body", .10, .30))
        pivot, size, mirror, parent = [.5, .12], 39, False, "body"
    place("accessory", fraction("accessory", *pivot), target, desired_height=size, mirror=mirror)
    parents["accessory"] = parent
    # Keep the lower cloth overlapping the abdomen during motion. Joint
    # targets remain at the anatomical hips, independently of the cloth edge.
    if not lower_path.exists():
        parts["pelvis"]["rest"]["matrix"][5] -= 12 if long_robe else 8
    joints = []
    for child, parent in parents.items():
        child_pivot = parts[child]["anchors"][0]["partPx"]
        position = transform_point(parts[child]["rest"]["matrix"], child_pivot)
        anchor = "to_" + child
        parts[parent]["anchors"].append({"id": anchor, "partPx": inverse_point(parts[parent]["rest"]["matrix"], position)})
        joints.append({"parent": {"partId": parent, "anchorId": anchor},
                       "child": {"partId": child, "anchorId": "pivot"}})
    manifest = {"schemaVersion": 1, "projectId": "cfgcn-original-" + character["id"],
                "name": character["name"], "parts": list(parts.values()), "joints": joints,
                "provenance": "Original OpenAI built-in imagegen artwork; mechanically cropped for texture packing",
                "directions": ["side-right", "mirrored-side-left"], "proportions": p,
                "status": "v4 leg joints, weapon drawings and walking revision; visual review pending"}
    (directory / "woop.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with zipfile.ZipFile(directory / (character["id"] + ".woop"), "w", zipfile.ZIP_DEFLATED) as archive:
        archive.write(directory / "woop.json", "woop.json")
        for part in parts.values():
            archive.write(directory / part["image"], part["image"])
    print("PREPARED", character["id"], width, height, "parts", len(parts), "components", len(found))
    bpy.data.images.remove(image)


if __name__ == "__main__":
    requested = set(sys.argv[sys.argv.index("--") + 1:]) if "--" in sys.argv else set()
    for character in ROSTER:
        if not requested or character["id"] in requested:
            prepare(character)
