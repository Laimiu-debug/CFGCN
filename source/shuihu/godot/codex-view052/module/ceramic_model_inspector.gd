extends SubViewportContainer
## Embeddable ceramic asset viewport. The host supplies collection controls/theme.
## Coordinates stay in source glTF metres; framing never changes a model transform.
const CeramicLoader = preload("ceramic_piece_loader_v2.gd")

signal asset_loaded(id: String, tier: String)
signal asset_failed(id: String, error: int)
signal view_changed(state: Dictionary)

@export var render_pixels := Vector2i(768, 768)
@export var transparent_background := true
@export var input_enabled := true
@export var continuous_rendering := false

var viewport: SubViewport
var world: Node3D
var camera: Camera3D
var model: Node3D
var current_id := ""
var current_tier := ""
var regions: Dictionary = {}
var region_view_angles: Dictionary = {}
var region_name := "whole"
var yaw := 0.0
var pitch := 0.0
var magnification := 1.0
var pan_metres := Vector3.ZERO
var _drag_button := 0
var _pending_draw_frames := 6

func _ready() -> void:
    stretch = true
    mouse_filter = Control.MOUSE_FILTER_STOP
    focus_mode = Control.FOCUS_ALL
    viewport = SubViewport.new()
    viewport.name = "CeramicViewport"
    viewport.size = render_pixels
    viewport.own_world_3d = true
    viewport.transparent_bg = transparent_background
    viewport.msaa_3d = Viewport.MSAA_4X
    viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
    add_child(viewport)
    world = Node3D.new()
    viewport.add_child(world)
    var env := Environment.new()
    env.background_mode = Environment.BG_COLOR
    env.background_color = Color(0.47, 0.46, 0.44, 0.0 if transparent_background else 1.0)
    env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
    env.ambient_light_color = Color.WHITE
    env.ambient_light_energy = 0.55
    var world_env := WorldEnvironment.new()
    world_env.environment = env
    world.add_child(world_env)
    for entry in [[Vector3(3, 4, -3), 1.0], [Vector3(1, 1.5, 3), 0.35]]:
        var light := DirectionalLight3D.new()
        light.light_energy = float(entry[1])
        world.add_child(light)
        light.position = entry[0]
        light.look_at(Vector3(0, 0.035, 0), Vector3.UP)
    camera = Camera3D.new()
    camera.projection = Camera3D.PROJECTION_ORTHOGONAL
    camera.keep_aspect = Camera3D.KEEP_HEIGHT
    camera.near = 0.00001
    camera.far = 10.0
    world.add_child(camera)
    camera.make_current()
    resized.connect(_update_camera)

func load_record(record: Dictionary, tier: String, asset_root: String, keep_view := false) -> int:
    if viewport == null or not record.has("files") or not record["files"].has(tier):
        asset_failed.emit(str(record.get("id", "")), ERR_INVALID_PARAMETER)
        return ERR_INVALID_PARAMETER
    var path := asset_root.path_join(str(record["files"][tier]["file"]))
    if not FileAccess.file_exists(path):
        asset_failed.emit(str(record["id"]), ERR_FILE_NOT_FOUND)
        return ERR_FILE_NOT_FOUND
    var loaded: Dictionary = CeramicLoader.load_piece(path)
    var error := int(loaded.get("error", ERR_CANT_CREATE))
    if error != OK:
        asset_failed.emit(str(record["id"]), error)
        return error
    var replacement: Node3D = loaded["scene"]
    world.add_child(replacement)
    if model != null:
        model.free()
    model = replacement
    var previous_id := current_id
    current_id = str(record["id"])
    current_tier = tier
    regions = record.get("inspectionRegionsGodotMetres", {}).duplicate(true)
    region_view_angles = record.get("inspectionViewAnglesGodotRadians", {}).duplicate(true)
    if not regions.has("whole"):
        regions["whole"] = record["files"][tier]["boundsGodotMetres"]
    if not keep_view or previous_id != current_id or not regions.has(region_name):
        yaw = 0.0
        pitch = 0.0
        focus_region("body" if regions.has("body") else "whole")
    else:
        _update_camera()
    asset_loaded.emit(current_id, current_tier)
    return OK

func focus_region(part: String) -> bool:
    if not regions.has(part):
        return false
    region_name = part
    var suggested: Dictionary = region_view_angles.get(part, {})
    if suggested.has("yaw"):
        yaw = float(suggested["yaw"])
    if suggested.has("pitch"):
        pitch = clampf(float(suggested["pitch"]), -1.35, 1.35)
    pan_metres = Vector3.ZERO
    magnification = 1.0
    _update_camera()
    return true

func reset_view() -> void:
    yaw = 0.0
    pitch = 0.0
    focus_region("body" if regions.has("body") else "whole")

func zoom(factor: float) -> void:
    if not is_finite(factor) or factor <= 0:
        return
    magnification = clampf(magnification * factor, 0.25, 24.0)
    _update_camera()

func pan_pixels(delta: Vector2) -> void:
    if camera == null:
        return
    var metres_per_pixel := camera.size / maxf(size.y, 1.0)
    pan_metres += (-camera.global_basis.x * delta.x + camera.global_basis.y * delta.y) * metres_per_pixel
    _update_camera()

func orbit_pixels(delta: Vector2) -> void:
    yaw -= delta.x * 0.008
    pitch = clampf(pitch + delta.y * 0.008, -1.35, 1.35)
    _update_camera()

func view_state() -> Dictionary:
    return {"id": current_id, "tier": current_tier, "region": region_name, "yaw": yaw, "pitch": pitch, "magnification": magnification, "panMetres": [pan_metres.x, pan_metres.y, pan_metres.z], "cameraSizeMetres": camera.size if camera != null else 0.0, "liveModelChildren": world.get_child_count() - 4 if world != null else 0}

func _update_camera() -> void:
    if camera == null or not regions.has(region_name):
        return
    var region: Dictionary = regions[region_name]
    var lo := Vector3(float(region["min"][0]), float(region["min"][1]), float(region["min"][2]))
    var hi := Vector3(float(region["max"][0]), float(region["max"][1]), float(region["max"][2]))
    var target := (lo + hi) * 0.5 + pan_metres
    var direction := Vector3(cos(pitch) * cos(yaw), sin(pitch), cos(pitch) * sin(yaw))
    camera.position = target + direction * maxf(0.2, (hi - lo).length() * 3.0)
    camera.look_at(target, Vector3.UP)
    var extent := Vector2.ZERO
    for i in range(8):
        var corner := Vector3(hi.x if i & 1 else lo.x, hi.y if i & 2 else lo.y, hi.z if i & 4 else lo.z) - (lo + hi) * 0.5
        extent.x = maxf(extent.x, absf(corner.dot(camera.global_basis.x)) * 2)
        extent.y = maxf(extent.y, absf(corner.dot(camera.global_basis.y)) * 2)
    var aspect := maxf(size.x, 1.0) / maxf(size.y, 1.0)
    camera.size = maxf(extent.y, extent.x / aspect) * 1.12 / magnification
    camera.size = maxf(camera.size, 0.0001)
    _pending_draw_frames = 6
    viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
    view_changed.emit(view_state())

func _process(_delta: float) -> void:
    if viewport == null or continuous_rendering:
        return
    if _pending_draw_frames > 0:
        _pending_draw_frames -= 1
    else:
        # Hold the completed image while idle; no character is animated here.
        viewport.render_target_update_mode = SubViewport.UPDATE_DISABLED

func _gui_input(event: InputEvent) -> void:
    if not input_enabled or model == null:
        return
    if event is InputEventMouseButton:
        if event.pressed:
            grab_focus()
            if event.button_index == MOUSE_BUTTON_WHEEL_UP:
                zoom(pow(1.12, maxf(event.factor, 1)))
            elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
                zoom(pow(1.12, -maxf(event.factor, 1)))
            elif event.button_index in [MOUSE_BUTTON_LEFT, MOUSE_BUTTON_MIDDLE, MOUSE_BUTTON_RIGHT]:
                _drag_button = event.button_index
        elif event.button_index == _drag_button:
            _drag_button = 0
    elif event is InputEventMouseMotion and _drag_button != 0:
        if _drag_button == MOUSE_BUTTON_LEFT and not event.shift_pressed:
            orbit_pixels(event.relative)
        else:
            pan_pixels(event.relative)
    elif event is InputEventMagnifyGesture:
        zoom(event.factor)
    elif event is InputEventPanGesture:
        pan_pixels(event.delta * 20.0)
    elif event is InputEventKey and event.pressed and not event.echo:
        match event.keycode:
            KEY_F: reset_view()
            KEY_1: focus_region("head")
            KEY_2: focus_region("hands")
            KEY_3: focus_region("feet")
    else:
        return
    accept_event()

func _notification(what: int) -> void:
    if what == NOTIFICATION_WM_WINDOW_FOCUS_OUT:
        _drag_button = 0
