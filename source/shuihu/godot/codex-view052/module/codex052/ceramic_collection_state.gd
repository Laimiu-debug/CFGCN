extends RefCounted
## Permanent discoveries only. Campaign life, recruitment and deployment never enter this file.
var _known_people: Dictionary = {}
var _known_equipment: Dictionary = {}
var _people: Dictionary = {}
var _equipment: Dictionary = {}

func configure(catalog: Dictionary) -> void:
    _known_people.clear()
    _known_equipment.clear()
    for entry: Dictionary in catalog.get("entries", []):
        if entry.get("kind") == "character-body":
            _known_people[str(entry["id"])] = true
        else:
            _known_equipment[str(entry["id"])] = true
    # A temporarily smaller installed catalogue must not erase discoveries already known.
    # New discoveries still require a valid identity in the supplied full catalogue.

func merge_snapshot(snapshot: Dictionary) -> Dictionary:
    if int(snapshot.get("schemaVersion", 1)) != 1:
        return {"error": ERR_INVALID_DATA, "characters": [], "equipment": []}
    return discover(snapshot.get("characterIds", []), snapshot.get("equipmentIds", []))

func discover(character_ids: Variant, equipment_ids: Variant) -> Dictionary:
    var added_people: Array[String] = []
    var added_equipment: Array[String] = []
    if not character_ids is Array or not equipment_ids is Array:
        return {"error": ERR_INVALID_DATA, "characters": added_people, "equipment": added_equipment}
    for candidate: Variant in character_ids:
        if candidate is String and _known_people.has(candidate) and not _people.has(candidate):
            _people[candidate] = true
            added_people.append(candidate)
    for candidate: Variant in equipment_ids:
        if candidate is String and _known_equipment.has(candidate) and not _equipment.has(candidate):
            _equipment[candidate] = true
            added_equipment.append(candidate)
    return {"error": OK, "characters": added_people, "equipment": added_equipment}

func is_discovered(id: String, kind: String) -> bool:
    return _people.has(id) if kind == "character-body" else _equipment.has(id)

func snapshot() -> Dictionary:
    var people: Array = _people.keys()
    var equipment: Array = _equipment.keys()
    people.sort()
    equipment.sort()
    return {"schemaVersion": 1, "characterIds": people, "equipmentIds": equipment}

func load_from(path: String) -> int:
    if path.is_empty() or not FileAccess.file_exists(path): return ERR_FILE_NOT_FOUND
    var parser:=JSON.new()
    var parse_error:=parser.parse(FileAccess.get_file_as_string(path))
    if parse_error!=OK:return parse_error
    var parsed: Variant = parser.data
    if not parsed is Dictionary: return ERR_PARSE_ERROR
    return int(merge_snapshot(parsed)["error"])

func save_to(path: String) -> int:
    # The host explicitly chooses the permanent collection path; there is no automatic save.
    if path.is_empty(): return ERR_INVALID_PARAMETER
    var error := DirAccess.make_dir_recursive_absolute(path.get_base_dir())
    if error != OK: return error
    var temporary := path + ".pending"
    var stream := FileAccess.open(temporary, FileAccess.WRITE)
    if stream == null: return FileAccess.get_open_error()
    stream.store_string(JSON.stringify(snapshot(), "  ") + "\n")
    stream.flush()
    error = stream.get_error()
    stream.close()
    if error != OK: return error
    return DirAccess.rename_absolute(temporary, path)
