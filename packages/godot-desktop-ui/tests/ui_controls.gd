extends Node

var checks = []
var shell
var output = "G:/CODE/CFGCN/.local/qa/godot-desktop-ui"

func prepare(controller: Node) -> bool:
	shell = controller
	if not OS.get_environment("CFGCN_DESKTOP_QA_DIR").is_empty():
		output = OS.get_environment("CFGCN_DESKTOP_QA_DIR")
	if not output.replace("\\", "/").to_lower().begins_with("g:/code/cfgcn/.local/qa/"):
		push_error("QA output must stay in the project's G drive QA folder")
		get_tree().quit(2)
		return false
	DirAccess.make_dir_recursive_absolute(output)
	var paths = [ProjectSettings.globalize_path(shell.store.config_path), OS.get_user_data_dir()]
	if shell.config.id == "shuihu": paths.append(str(shell.game_info().get("save_path", "")))
	for location in paths:
		if not location.replace("\\", "/").to_lower().begins_with("h:/codex/app-data/cfgcn-shared-ui-qa/"):
			push_error("QA storage is not isolated: " + location)
			get_tree().quit(2)
			return false
	print("QA_ISOLATED_STORAGE ", paths)
	return true

func check(value: bool, name: String) -> void:
	checks.append({"name": name, "ok": value})
	if not value: push_error("UI_CHECK_FAILED: " + name)

func pause_frames(count: int = 2) -> void:
	for i in range(count): await get_tree().process_frame

func click(id: String) -> void:
	var control = shell.view.controls.get(id)
	if control == null:
		check(false, "control_exists_" + id)
		return
	await pause_frames()
	var center = get_viewport().get_final_transform() * control.get_global_rect().get_center()
	var motion = InputEventMouseMotion.new()
	motion.position = center
	Input.parse_input_event(motion)
	for pressed in [true, false]:
		var event = InputEventMouseButton.new()
		event.button_index = MOUSE_BUTTON_LEFT
		event.pressed = pressed
		event.position = center
		Input.parse_input_event(event)
		await pause_frames()

func key(code: int) -> void:
	for pressed in [true, false]:
		var event = InputEventKey.new()
		event.physical_keycode = code
		event.keycode = code
		event.pressed = pressed
		Input.parse_input_event(event)
		await pause_frames()

func capture(name: String) -> void:
	await RenderingServer.frame_post_draw
	var path = output.path_join(shell.config.id + "-" + name + ".png")
	var error = get_viewport().get_texture().get_image().save_png(path)
	check(error == OK, "native_screenshot_" + name)

func run(controller: Node) -> void:
	if not prepare(controller): return
	get_tree().create_timer(60.0).timeout.connect(func():
		push_error("UI acceptance timed out")
		get_tree().quit(2))
	await pause_frames(10)
	check(shell.screen == "menu", "starts_at_main_menu")
	await capture("menu")
	await click("menu.settings")
	check(shell.screen == "settings", "native_click_opens_settings")
	check(not shell.is_dirty(), "fresh_settings_are_clean")
	await click("tabs.audio")
	check(shell.settings_tab == 1, "native_click_changes_settings_tab")
	var music = shell.view.controls.get("settings.music")
	music.value = 0.2
	await pause_frames()
	check(shell.is_dirty(), "changing_audio_is_pending")
	check(is_equal_approx(AudioServer.get_bus_volume_db(AudioServer.get_bus_index("Music")), linear_to_db(0.2)), "audio_preview_reaches_bus")
	await click("settings.apply")
	check(shell.message == shell.tr_copy("saved"), "apply_has_real_saved_status")
	check(FileAccess.file_exists(shell.store.config_path), "settings_file_exists")
	await click("tabs.interface")
	var locale = shell.view.controls.get("settings.locale")
	locale.select(2)
	locale.item_selected.emit(2)
	await click("settings.apply")
	check(shell.store.saved.locale == "en", "language_choice_is_saved")
	check(shell.view.controls["settings.apply"].text == "Apply & save", "language_changes_visible_ui")
	await capture("settings-en")
	locale = shell.view.controls.get("settings.locale")
	locale.select(0)
	locale.item_selected.emit(0)
	var scale = shell.view.controls.get("settings.ui_scale")
	scale.value = 1.2
	await click("settings.apply")
	check(shell.store.saved.ui_scale == 1.2, "ui_scale_is_saved")
	await capture("settings-large")
	await click("tabs.controls")
	var first = shell.config.actions[0]
	await click("binding." + first)
	await key(KEY_P)
	check(shell.draft.bindings[first] == KEY_P, "native_key_capture_updates_binding")
	await click("settings.apply")
	check(InputMap.action_get_events(first)[0].physical_keycode == KEY_P, "key_binding_applies_to_input_map")
	await click("settings.defaults")
	await click("settings.apply")
	check(shell.store.saved.music == 0.45 and shell.store.saved.ui_scale == 1.0, "defaults_are_applied_and_saved")
	await click("tabs.display")
	var fps = shell.view.controls.get("settings.fps")
	fps.select(0)
	fps.item_selected.emit(0)
	await click("settings.apply")
	check(Engine.max_fps == 30 and shell.store.saved.fps == 30, "fps_setting_is_live_and_persistent")
	await click("settings.back")
	check(shell.screen == "menu", "back_returns_to_main_menu")
	await click("menu.load")
	check(shell.screen == "load", "save_browser_opens")
	await capture("load")
	await key(KEY_ESCAPE)
	check(shell.screen == "menu", "escape_returns_from_save_browser")
	await click("menu.credits")
	check(shell.screen == "credits", "credits_open")
	await key(KEY_ESCAPE)
	check(shell.screen == "menu", "escape_returns_from_credits")
	var final = {"scope": "Native Godot window, actual Control mouse routing, preference effects and persistence. Gameplay is validated separately.", "game": shell.config.id, "checks": checks, "failed": checks.filter(func(item): return not item.ok).size(), "viewport": [get_viewport().get_visible_rect().size.x, get_viewport().get_visible_rect().size.y]}
	var file = FileAccess.open(output.path_join(shell.config.id + "-ui-controls.json"), FileAccess.WRITE)
	file.store_string(JSON.stringify(final, "\t") + "\n")
	file.close()
	print("UI_CONTROLS ", shell.config.id, " ", checks.size(), " failed=", final.failed)
	get_tree().quit(0 if final.failed == 0 else 1)
