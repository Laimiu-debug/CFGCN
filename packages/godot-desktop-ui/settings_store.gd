extends RefCounted
## Player preferences. Campaign data belongs to the game adapter.

const VERSION = 1
const DEFAULTS = {
	"window_mode": "windowed", "resolution": "1280x720", "vsync": true, "fps": 60,
	"master": 0.8, "music": 0.45, "effects": 0.8, "voice": 0.9,
	"locale": "zh-CN", "ui_scale": 1.0, "reduced_motion": false,
	"bindings": {}
}
const KEY_DEFAULTS = {
	"cfg_move_up": KEY_W, "cfg_move_down": KEY_S,
	"cfg_move_left": KEY_A, "cfg_move_right": KEY_D,
	"cfg_interact": KEY_E, "cfg_dodge": KEY_SPACE, "cfg_party_next": KEY_Q,
	"cfg_skill_1": KEY_1, "cfg_skill_2": KEY_2, "cfg_skill_3": KEY_3,
	"cfg_skill_4": KEY_4, "cfg_end_turn": KEY_ENTER, "cfg_quick_save": KEY_F5,
	"cfg_quick_load": KEY_F9
}
const MODES = ["windowed", "borderless", "fullscreen"]
const RESOLUTIONS = ["1280x720", "1600x900", "1920x1080", "2560x1440"]
const FPS_OPTIONS = [30, 60, 120, 0]
const LOCALES = ["zh-CN", "zh-TW", "en"]

var values = DEFAULTS.duplicate(true)
var saved = DEFAULTS.duplicate(true)
var config_path = ""
var notice = ""
var last_error = ""

func configure(game_id: String) -> void:
	var directory = OS.get_environment("CFGCN_DESKTOP_PROFILE_DIR")
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--ui-profile-dir="):
			directory = arg.trim_prefix("--ui-profile-dir=")
	if directory.is_empty():
		directory = "user://desktop"
	config_path = directory.path_join(game_id).path_join("settings.cfg")
	load_settings()
	apply(values, false)

func sanitize(input: Dictionary) -> Dictionary:
	var output = DEFAULTS.duplicate(true)
	for key in output:
		if input.has(key) and typeof(input[key]) == typeof(output[key]):
			output[key] = input[key]
	if not output.window_mode in MODES: output.window_mode = "windowed"
	if not output.resolution in RESOLUTIONS: output.resolution = "1280x720"
	if not output.fps in FPS_OPTIONS: output.fps = 60
	if not output.locale in LOCALES: output.locale = "zh-CN"
	output.ui_scale = clampf(float(output.ui_scale), 0.9, 1.3) if is_finite(float(output.ui_scale)) else 1.0
	for bus in ["master", "music", "effects", "voice"]:
		output[bus] = clampf(float(output[bus]), 0.0, 1.0) if is_finite(float(output[bus])) else DEFAULTS[bus]
	var bindings = {}
	for action in KEY_DEFAULTS:
		var code = output.bindings.get(action, KEY_DEFAULTS[action])
		if (typeof(code) == TYPE_INT or typeof(code) == TYPE_FLOAT) and int(code) > 0:
			bindings[action] = int(code)
	output.bindings = bindings
	return output

func load_settings() -> void:
	var file = ConfigFile.new()
	var error = file.load(config_path)
	if error == OK and int(file.get_value("format", "version", 0)) == VERSION:
		var data = {}
		for key in DEFAULTS: data[key] = file.get_value("preferences", key, DEFAULTS[key])
		values = sanitize(data)
	elif FileAccess.file_exists(config_path):
		notice = "settings_recovery"
		var backup = ConfigFile.new()
		if backup.load(config_path + ".bak") == OK and int(backup.get_value("format", "version", 0)) == VERSION:
			var data = {}
			for key in DEFAULTS: data[key] = backup.get_value("preferences", key, DEFAULTS[key])
			values = sanitize(data)
	values = sanitize(values)
	saved = values.duplicate(true)

func persist(candidate: Dictionary) -> Dictionary:
	last_error = ""
	var clean = sanitize(candidate)
	var directory = ProjectSettings.globalize_path(config_path.get_base_dir())
	var error = DirAccess.make_dir_recursive_absolute(directory)
	if error != OK:
		last_error = error_string(error)
		return {"ok": false, "message": last_error}
	var file = ConfigFile.new()
	file.set_value("format", "version", VERSION)
	for key in clean: file.set_value("preferences", key, clean[key])
	var temporary = config_path + ".tmp"
	error = file.save(temporary)
	if error != OK:
		last_error = error_string(error)
		return {"ok": false, "message": last_error}
	# Keep the previous valid record. Never overwrite a corrupt original with defaults.
	if FileAccess.file_exists(config_path):
		var validation = ConfigFile.new()
		if validation.load(config_path) == OK and int(validation.get_value("format", "version", 0)) == VERSION:
			error = DirAccess.copy_absolute(ProjectSettings.globalize_path(config_path), ProjectSettings.globalize_path(config_path + ".bak"))
			if error != OK:
				last_error = error_string(error)
				DirAccess.remove_absolute(ProjectSettings.globalize_path(temporary))
				return {"ok": false, "message": last_error}
		else:
			var retained = config_path + ".unreadable-" + str(Time.get_unix_time_from_system()).replace(".", "-")
			error = DirAccess.copy_absolute(ProjectSettings.globalize_path(config_path), ProjectSettings.globalize_path(retained))
			if error != OK:
				last_error = error_string(error)
				DirAccess.remove_absolute(ProjectSettings.globalize_path(temporary))
				return {"ok": false, "message": last_error}
	error = DirAccess.rename_absolute(ProjectSettings.globalize_path(temporary), ProjectSettings.globalize_path(config_path))
	if error != OK:
		last_error = error_string(error)
		return {"ok": false, "message": last_error}
	values = clean
	saved = clean.duplicate(true)
	notice = ""
	return {"ok": true, "message": ""}

func apply(candidate: Dictionary, include_window: bool = true) -> void:
	var clean = sanitize(candidate)
	Engine.max_fps = int(clean.fps)
	if DisplayServer.get_name() != "headless":
		DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_ENABLED if clean.vsync else DisplayServer.VSYNC_DISABLED)
		if include_window:
			var mode = DisplayServer.WINDOW_MODE_WINDOWED
			if clean.window_mode == "fullscreen": mode = DisplayServer.WINDOW_MODE_EXCLUSIVE_FULLSCREEN
			if clean.window_mode == "borderless": mode = DisplayServer.WINDOW_MODE_FULLSCREEN
			DisplayServer.window_set_mode(mode)
			if mode == DisplayServer.WINDOW_MODE_WINDOWED:
				var dimensions = clean.resolution.split("x")
				var target = Vector2i(int(dimensions[0]), int(dimensions[1]))
				var usable = DisplayServer.screen_get_usable_rect()
				target.x = mini(target.x, usable.size.x)
				target.y = mini(target.y, usable.size.y)
				DisplayServer.window_set_size(target)
				DisplayServer.window_set_position(usable.position + (usable.size - target) / 2)
	for entry in [["master", "Master"], ["music", "Music"], ["effects", "Effects"], ["voice", "Voice"]]:
		var index = AudioServer.get_bus_index(entry[1])
		if index < 0:
			AudioServer.add_bus()
			index = AudioServer.bus_count - 1
			AudioServer.set_bus_name(index, entry[1])
			AudioServer.set_bus_send(index, "Master")
		var volume = float(clean[entry[0]])
		AudioServer.set_bus_volume_db(index, linear_to_db(maxf(0.0001, volume)))
		AudioServer.set_bus_mute(index, volume == 0.0)
	for action in KEY_DEFAULTS:
		if not InputMap.has_action(action): InputMap.add_action(action)
		InputMap.action_erase_events(action)
		var event = InputEventKey.new()
		event.physical_keycode = int(clean.bindings.get(action, KEY_DEFAULTS[action]))
		InputMap.action_add_event(action, event)
	values = clean

func display_changed(candidate: Dictionary) -> bool:
	return candidate.get("window_mode") != saved.window_mode or candidate.get("resolution") != saved.resolution

func rollback(include_window: bool = false) -> void:
	apply(saved, include_window)

func key_label(action: String, candidate: Dictionary) -> String:
	return OS.get_keycode_string(int(candidate.get("bindings", {}).get(action, KEY_DEFAULTS.get(action, KEY_NONE))))
