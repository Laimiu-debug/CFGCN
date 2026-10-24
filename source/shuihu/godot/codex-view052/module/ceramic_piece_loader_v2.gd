extends RefCounted
## Static ceramic assembly adapter v2, including constant nonzero coat roughness. Source GLBs and all original image payloads stay unchanged.
## Godot 4.7.2 imports geometry/PBR but omits KHR_materials_clearcoat on these files.

static func load_piece(path: String) -> Dictionary:
    var document := GLTFDocument.new()
    var state := GLTFState.new()
    var error: int = document.append_from_file(path, state)
    if error != OK:
        return {"error": error, "scene": null, "material_repairs": []}
    var data: Dictionary = state.get("json")
    var materials: Array = state.get("materials")
    var images: Array = state.get("images")
    var repairs: Array = []
    for i in range(materials.size()):
        var source: Dictionary = data["materials"][i]
        var extension: Dictionary = source.get("extensions", {}).get("KHR_materials_clearcoat", {})
        if extension.is_empty():
            continue
        var material: BaseMaterial3D = materials[i]
        var roughness: float = float(extension.get("clearcoatRoughnessFactor", 0.0))
        # Supported sources use constant coat roughness and a red strength map.
        # Texture-varying roughness and coat normals require a separate adapter.
        if roughness < 0.0 or roughness > 1.0 or extension.has("clearcoatRoughnessTexture") or extension.has("clearcoatNormalTexture"):
            return {"error": ERR_UNAVAILABLE, "scene": null, "material_repairs": repairs, "unsupported_clearcoat_layout": source.get("name", str(i))}
        material.clearcoat_enabled = float(extension.get("clearcoatFactor", 0.0)) > 0.0
        material.clearcoat = float(extension.get("clearcoatFactor", 0.0))
        material.clearcoat_roughness = roughness
        var texture_size := Vector2i.ZERO
        if extension.has("clearcoatTexture"):
            var info: Dictionary = extension["clearcoatTexture"]
            if int(info.get("texCoord", 0)) != 0 or info.has("extensions"):
                return {"error": ERR_UNAVAILABLE, "scene": null, "unsupported_clearcoat_uv": true}
            var texture: Dictionary = data["textures"][int(info["index"])]
            var original: Texture2D = images[int(texture["source"])]
            var image: Image = original.get_image().duplicate()
            image.convert(Image.FORMAT_RGBA8)
            texture_size = image.get_size()
            var pixels: PackedByteArray = image.get_data()
            # Native generated shader multiplies the scalar roughness by texture green.
            # Keep every source red strength byte; green one retains the source constant roughness.
            for offset in range(1, pixels.size(), 4):
                pixels[offset] = 255
            var converted := Image.create_from_data(image.get_width(), image.get_height(), false, Image.FORMAT_RGBA8, pixels)
            material.clearcoat_texture = ImageTexture.create_from_image(converted)
        repairs.append({"material": source.get("name", str(i)), "source_extension": extension, "clearcoat_enabled": material.clearcoat_enabled, "strength": material.clearcoat, "roughness": material.clearcoat_roughness, "texture_size": [texture_size.x, texture_size.y], "source_red_strength_bytes_preserved": true, "base_albedo_roughness_and_geometry_untouched": true})
    var scene: Node = document.generate_scene(state)
    return {"error": OK if scene != null else ERR_CANT_CREATE, "scene": scene, "state": state, "material_repairs": repairs}
