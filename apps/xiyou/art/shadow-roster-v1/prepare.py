"""Package original generated part sheets as WOOP resources; run with Blender.

Only crop source texture regions for asset packaging. No repainting, replacement
art, background synthesis or third-party artwork is used here.
"""
from pathlib import Path
import hashlib
import json
import math
import zipfile

import bpy
import numpy as np

HERE = Path(__file__).resolve().parent
ROSTER = json.loads((HERE / "roster.json").read_text(encoding="utf-8"))
COLUMNS = [["head", "upper_arm.front", "foot.back", "weapon"],
           ["body", "forearm.front", "thigh.front", "accessory"],
           ["upper_arm.back", "thigh.back", "shin.front"],
           ["forearm.back", "shin.back", "foot.front"]]
LAYERS = ["accessory", "upper_arm.back", "forearm.back", "thigh.back", "shin.back", "foot.back",
          "body", "thigh.front", "shin.front", "foot.front", "head", "upper_arm.front", "forearm.front", "weapon"]


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
    assert len(assigned) == 14
    (directory / "parts").mkdir(exist_ok=True)
    parts = {}
    for name in LAYERS:
        rect = assigned[name]["rect"]
        x0, y0, x1, y1 = rect
        crop = pixels[y0:y1, x0:x1]
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

    def fraction(name, x, y):
        return [parts[name]["width"] * x, parts[name]["height"] * y]

    def row_pivot(name, y):
        x0, y0, x1, y1 = parts[name]["sourceRect"]
        values = pixels[y0:y1, x0:x1, 3]
        middle = int((y1 - y0) * y)
        yy, xx = np.nonzero(values[max(0, middle - 5):middle + 6] > .42)
        return [float(xx.mean()) if len(xx) else (x1 - x0) / 2, (y1 - y0) * y]

    def place(name, pivot, target, desired_height=None, end=None, target_end=None, width_factor=1., mirror=False):
        if end is not None:
            dx, dy = end[0] - pivot[0], end[1] - pivot[1]
            tx, ty = target_end[0] - target[0], target_end[1] - target[1]
            scale = math.hypot(tx, ty) / math.hypot(dx, dy)
            angle = math.atan2(ty, tx) - math.atan2(dy, dx)
        else:
            scale, angle = desired_height / parts[name]["height"], 0.
        matrix = matrix_at(pivot, target, scale, angle, -width_factor if mirror else width_factor)
        parts[name]["rest"] = {"matrix": matrix, "zIndex": LAYERS.index(name)}
        parts[name]["anchors"].append({"id": "pivot", "partPx": pivot})

    # Virtual assembly coordinates: 100 pixels per unit, X-right/Y-down.
    place("body", fraction("body", .5, .84), [0, -104], desired_height=88,
          width_factor=character["body_width"])
    body_matrix = parts["body"]["rest"]["matrix"]
    points = {"head": transform_point(body_matrix, fraction("body", .5, .17)),
              "upper_arm.back": transform_point(body_matrix, fraction("body", .12, .19)),
              "upper_arm.front": transform_point(body_matrix, fraction("body", .86, .19)),
              "thigh.back": transform_point(body_matrix, fraction("body", .18, .88)),
              "thigh.front": transform_point(body_matrix, fraction("body", .84, .88))}
    place("head", fraction("head", .48, .94), points["head"], desired_height=character["head_height"] * 100)
    parents = {"head": "body"}
    for side in ["back", "front"]:
        upper, fore, thigh, shin, foot = [s + "." + side for s in ["upper_arm", "forearm", "thigh", "shin", "foot"]]
        shoulder = points[upper]
        elbow = [shoulder[0], shoulder[1] + 40]
        wrist = [shoulder[0], elbow[1] + 36]
        hip = points[thigh]
        knee = [hip[0], hip[1] + 44]
        ankle = [hip[0], knee[1] + 38]
        place(upper, row_pivot(upper, .10), shoulder, end=row_pivot(upper, .64), target_end=elbow)
        place(fore, row_pivot(fore, .10), elbow, end=row_pivot(fore, .83), target_end=wrist)
        place(thigh, row_pivot(thigh, .10), hip, end=row_pivot(thigh, .90), target_end=knee)
        place(shin, row_pivot(shin, .10), knee, end=row_pivot(shin, .90), target_end=ankle)
        place(foot, row_pivot(foot, .17), ankle, desired_height=20)
        parents.update({upper: "body", fore: upper, thigh: "body", shin: thigh, foot: shin})
        points.update({fore: elbow, shin: knee, foot: ankle})
        if side == "front":
            points["weapon"] = wrist
    place("weapon", fraction("weapon", *character["weapon_grip"]), points["weapon"],
          desired_height=character["weapon_height"] * 100, width_factor=character["weapon_width"])
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
                "directions": ["side-right", "mirrored-side-left"], "status": "resource study; visual review pending"}
    (directory / "woop.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with zipfile.ZipFile(directory / (character["id"] + ".woop"), "w", zipfile.ZIP_DEFLATED) as archive:
        archive.write(directory / "woop.json", "woop.json")
        for part in parts.values():
            archive.write(directory / part["image"], part["image"])
    print("PREPARED", character["id"], width, height, "parts", len(parts), "components", len(found))
    bpy.data.images.remove(image)


if __name__ == "__main__":
    for character in ROSTER:
        prepare(character)
