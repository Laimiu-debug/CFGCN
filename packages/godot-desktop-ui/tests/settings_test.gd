extends SceneTree

const Settings = preload("res://shared_desktop_ui/settings_store.gd")
var checks = []

func check(value: bool, name: String) -> void:
	checks.append({"name": name, "ok": value})
	if not value: push_error("SETTINGS_CHECK_FAILED: " + name)

func _initialize() -> void:
	var store = Settings.new()
	store.configure("unit-" + str(Time.get_ticks_usec()))
	var original_path = store.config_path
	check(store.values == store.saved, "defaults_are_not_unsaved_changes")
	check(store.saved.bindings.cfg_interact == KEY_E, "default_binding_is_registered")
	check(InputMap.action_get_events("cfg_interact")[0].physical_keycode == KEY_E, "input_map_is_live")
	var candidate = store.saved.duplicate(true)
	candidate.music = 0.25
	candidate.master = 0.65
	candidate.fps = 30
	candidate.locale = "en"
	candidate.ui_scale = 1.2
	candidate.bindings.cfg_interact = KEY_R
	var result = store.persist(candidate)
	check(result.ok, "settings_write_succeeds")
	store.apply(candidate, false)
	check(Engine.max_fps == 30, "frame_cap_is_live")
	check(is_equal_approx(AudioServer.get_bus_volume_db(AudioServer.get_bus_index("Music")), linear_to_db(0.25)), "music_bus_gain_is_live")
	check(InputMap.action_get_events("cfg_interact")[0].physical_keycode == KEY_R, "rebound_action_is_live")
	var reloaded = Settings.new()
	reloaded.config_path = original_path
	reloaded.load_settings()
	check(reloaded.saved.locale == "en" and reloaded.saved.fps == 30, "settings_survive_store_reload")
	check(reloaded.saved.ui_scale == 1.2 and reloaded.saved.bindings.cfg_interact == KEY_R, "scale_and_bindings_survive_reload")
	var second = candidate.duplicate(true)
	second.music = 0.5
	check(store.persist(second).ok, "second_transaction_succeeds")
	check(FileAccess.file_exists(original_path + ".bak"), "previous_valid_settings_are_backed_up")
	var old_bytes = FileAccess.get_file_as_bytes(original_path)
	var directory = original_path.get_base_dir()
	var blocked = directory.path_join("blocked")
	var block_file = FileAccess.open(blocked, FileAccess.WRITE)
	block_file.store_string("known QA blocker")
	block_file.close()
	store.config_path = blocked.path_join("settings.cfg")
	check(not store.persist(candidate).ok, "write_failure_is_reported")
	check(FileAccess.get_file_as_bytes(original_path) == old_bytes, "write_failure_preserves_previous_file")
	store.config_path = original_path
	var broken = FileAccess.open(original_path, FileAccess.WRITE)
	broken.store_string("invalid configuration [")
	broken.close()
	var recover = Settings.new()
	recover.config_path = original_path
	recover.load_settings()
	check(recover.notice == "settings_recovery", "corrupt_settings_have_visible_recovery_status")
	check(recover.saved.music == 0.25, "corrupt_settings_recover_last_valid_backup")
	check(FileAccess.get_file_as_string(original_path) == "invalid configuration [", "recovery_does_not_silently_overwrite_original")
	check(recover.persist(recover.saved).ok, "explicit_save_after_recovery_succeeds")
	var preserved = Array(DirAccess.get_files_at(directory)).filter(func(file): return file.begins_with("settings.cfg.unreadable-"))
	check(preserved.size() == 1, "unreadable_original_is_retained_before_replacement")
	var invalid = candidate.duplicate(true)
	invalid.window_mode = "unexpected"
	invalid.fps = 777
	invalid.locale = "unknown"
	invalid.music = -3.0
	invalid.voice = 9.0
	var clean = store.sanitize(invalid)
	check(clean.window_mode == "windowed" and clean.fps == 60 and clean.locale == "zh-CN", "unsupported_options_fall_back")
	check(clean.music == 0.0 and clean.voice == 1.0, "audio_values_are_bounded")
	store.apply(store.saved, false)
	var report = {
		"scope": "Real preference files, recovery, failure, AudioServer and InputMap; no campaign save claims.",
		"checks": checks, "failed": checks.filter(func(item): return not item.ok).size(),
		"qa_profile": directory, "settings_file": original_path
	}
	var qa_output = OS.get_environment("CFGCN_DESKTOP_QA_DIR")
	if qa_output.is_empty(): qa_output = "G:/CODE/CFGCN/.local/qa/godot-desktop-ui"
	var output = qa_output.path_join("settings-tests.json")
	var file = FileAccess.open(output, FileAccess.WRITE)
	file.store_string(JSON.stringify(report, "\t") + "\n")
	file.close()
	print("SETTINGS_TESTS ", checks.size(), " failed=", report.failed)
	quit(0 if report.failed == 0 else 1)
