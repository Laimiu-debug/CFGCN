extends Node
## External driver for a shipped Windows executable's normal desktop entry.
## No fixture, helper or replacement main scene is added to the player package.

var shell
var checks: Array = []
var pictures: Array = []
var output = ""
var phase = ""
var settings_target = {"master": 0.70, "music": 0.30, "effects": 0.60, "voice": 0.40}

func verify(ok: bool, label: String) -> void:
	checks.append({"name": label, "ok": ok})
	if not ok: push_error("PACKAGE_UI_CHECK: " + label)

func frames(count: int = 3) -> void:
	for index in count: await get_tree().process_frame

func inside_profile(location: String) -> bool:
	return ProjectSettings.globalize_path(location).replace("\\", "/").to_lower().begins_with("h:/codex/app-data/cfgcn-shared-ui-qa/")

func click(id: String) -> bool:
	await frames(6) # Let resize and deferred menu reconstruction settle first.
	var control = shell.view.controls.get(id)
	if not is_instance_valid(control):
		verify(false, "button_exists_" + id)
		return false
	await click_control(control)
	return true

func click_control(control: Control) -> void:
	var scroll = control.get_parent()
	while scroll != null:
		if scroll is ScrollContainer: scroll.ensure_control_visible(control)
		scroll = scroll.get_parent()
	await frames()
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
		await frames()

func visible_button(node: Node, text: String) -> Button:
	if node is Button and node.text == text and node.is_visible_in_tree(): return node
	for child in node.get_children():
		var found = visible_button(child, text)
		if found != null: return found
	return null

func key(code: int) -> void:
	for pressed in [true, false]:
		var event = InputEventKey.new()
		event.keycode = code
		event.physical_keycode = code
		event.pressed = pressed
		Input.parse_input_event(event)
		await frames()

func picture(label: String) -> void:
	await RenderingServer.frame_post_draw
	if shell.screen != "loading":
		for title in shell.view.title_reveals:
			var font = title.get_theme_font("font")
			var font_size = title.get_theme_font_size("font_size")
			var measured = 0.0
			for line in title.text.split("\n"): measured = maxf(measured, font.get_string_size(line, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x)
			verify(measured <= title.size.x + 1.0, "title_fits_visible_width_" + label)
	var name = phase + "-" + label + ".png"
	verify(get_viewport().get_texture().get_image().save_png(output.path_join(name)) == OK, "capture_" + label)
	pictures.append({"file": name, "screen": shell.screen, "window": var_to_str(DisplayServer.window_get_size()), "viewport": var_to_str(get_viewport().get_visible_rect().size), "texture": var_to_str(get_viewport().get_texture().get_size())})

func wait_play() -> bool:
	var deadline = Time.get_ticks_msec() + 120000
	while Time.get_ticks_msec() < deadline:
		if shell.screen == "play": return true
		if shell.loading_failed: return false
		if shell.screen != "loading": return false
		await get_tree().process_frame
	return false

func persisted_path() -> String:
	return str(shell.game_info().get("save_path", ""))

func rule_snapshot() -> String:
	if shell.config.id == "xiyou": return str(shell.game.core.save_json())
	return JSON.stringify(shell.game.core.state)

func ui_play_count(audio: Node) -> int:
	var count = 0
	var played = audio.report().get("played", {})
	for cue in played:
		if str(cue).begins_with("ui-"): count += int(played[cue])
	return count

func finish() -> void:
	var required = ["cold_loaded_game_can_pause"] if phase == "cold" else ["escape_freezes_actual_gameplay", "pause_save_returns_real_success", "selected_save_restores_real_game", "saved_menu_is_ready_for_independent_cold_process", "title_fits_visible_width_targeted-pause-en130"]
	for required_name in required:
		verify(checks.any(func(row): return row.name == required_name), "required_route_was_executed_" + required_name)
	var info = shell.game_info()
	var save_path = str(info.get("save_path", ""))
	var report = {"phase": phase, "game": shell.config.id, "screen": shell.screen, "ui_message": shell.message, "control_ids": shell.view.controls.keys(), "exportedWindows": not OS.has_feature("editor") and OS.get_name() == "Windows", "executable": OS.get_executable_path(), "scope": "Normal default entry of the actual package; real native Control mouse/key events and GPU captures. No OS mouse or complete-campaign claim.", "checks": checks, "failed": checks.filter(func(row): return not row.ok).size(), "settings": shell.store.saved, "settings_path": shell.store.config_path, "save_path": save_path, "save_sha256": FileAccess.get_sha256(save_path) if FileAccess.file_exists(save_path) else "", "adapter": info, "pictures": pictures}
	var file = FileAccess.open(output.path_join(phase + ".json"), FileAccess.WRITE)
	file.store_string(JSON.stringify(report, "\t") + "\n")
	file.close()
	var audio = get_node_or_null("/root/CFGCNAudio")
	if is_instance_valid(audio) and audio.has_method("prepare_shutdown"): await audio.prepare_shutdown()
	get_tree().quit(0 if report.failed == 0 else 1)

func run(controller: Node) -> void:
	shell = controller
	output = OS.get_environment("CFGCN_DESKTOP_QA_DIR").replace("\\", "/")
	phase = OS.get_environment("CFGCN_UI_PACKAGE_PHASE")
	if not output.to_lower().begins_with("g:/code/cfgcn/.local/qa/") or not phase in ["fresh", "cold"]:
		push_error("Package UI QA output/phase not authorized")
		get_tree().quit(2)
		return
	for location in [shell.store.config_path, OS.get_user_data_dir(), persisted_path()]:
		if not location.is_empty() and not inside_profile(location):
			push_error("Package UI QA storage escaped H profile: " + location)
			get_tree().quit(2)
			return
	verify(not OS.has_feature("editor") and OS.get_name() == "Windows", "actual_exported_windows_executable")
	verify(shell.config.id == OS.get_environment("CFGCN_UI_PACKAGE_GAME"), "correct_game")
	verify(str(ProjectSettings.get_setting("application/run/main_scene")) == "res://shared_desktop_ui/desktop_boot.tscn", "normal_shared_default_entry")
	verify(ResourceLoader.exists("res://shared_desktop_ui/art_button.gd"), "v2_art_button_resource_is_in_package")
	verify(shell.screen == "menu", "normal_boot_reaches_main_menu")
	await frames(8)
	await picture("menu")
	if phase == "cold":
		verify(shell.game_info().get("has_save", false), "cold_process_finds_actual_saved_journey")
		var previous = JSON.parse_string(FileAccess.get_file_as_string(output.path_join("fresh.json")))
		verify(previous != null and str(previous.save_sha256) == FileAccess.get_sha256(persisted_path()), "cold_probe_preserves_exact_saved_file")
		for bus in settings_target:
			verify(is_equal_approx(float(shell.store.saved[bus]), settings_target[bus]), "cold_saved_" + bus)
		verify(shell.store.saved.locale == "zh-CN" and is_equal_approx(float(shell.store.saved.ui_scale), 1.0), "cold_default_chinese_and_normal_type")
		await click("menu.continue")
		verify(await wait_play(), "cold_continue_loads_real_game")
		if shell.screen == "play":
			await key(KEY_ESCAPE)
			verify(shell.screen == "pause", "cold_loaded_game_can_pause")
			await picture("continued-pause")
		await finish()
		return
	verify(not shell.game_info().get("has_save", false), "fresh_profile_does_not_read_player_progress")
	verify(shell.store.saved.locale == "zh-CN", "normal_first_boot_is_chinese")
	await click("menu.settings")
	for tab in ["display", "audio", "controls", "interface"]:
		await click("tabs." + tab)
		verify(shell.screen == "settings", "settings_tab_reachable_" + tab)
	await click("tabs.audio")
	for bus in settings_target:
		shell.view.controls["settings." + bus].value = settings_target[bus]
	await click("settings.apply")
	for bus in settings_target:
		verify(is_equal_approx(float(shell.store.saved[bus]), settings_target[bus]) and is_equal_approx(db_to_linear(AudioServer.get_bus_volume_db(AudioServer.get_bus_index(bus.capitalize()))), settings_target[bus]), "saved_volume_reaches_" + bus)
	await key(KEY_TAB)
	verify(get_viewport().gui_get_focus_owner() != null, "default_settings_have_keyboard_focus")
	await click("settings.back")
	verify(shell.screen == "menu", "normal_settings_return_is_reachable")
	await click("menu.new")
	if shell.screen == "new_confirm": await click("confirm.yes")
	verify(shell.screen == "loading", "new_journey_enters_real_loading")
	await picture("loading")
	verify(await wait_play(), "package_resources_load_and_new_game_is_started")
	if shell.screen != "play":
		await picture("loading-failure")
		await finish()
		return
	if shell.config.id == "shuihu":
		verify(shell.game_info().get("save_kind", "") == "campaign_camp", "new_game_enters_actual_campaign_camp")
		await frames(8)
		var mission_tab = visible_button(shell.game.camp_view, "江湖来信")
		verify(mission_tab != null, "normal_camp_has_mission_tab")
		if mission_tab != null: await click_control(mission_tab)
		var depart = shell.game.camp_view.buttons.get("depart:M01")
		verify(is_instance_valid(depart) and not depart.disabled, "first_mission_departure_is_available_in_the_package")
		if is_instance_valid(depart) and not depart.disabled:
			await click_control(depart)
			var limit = Time.get_ticks_msec() + 60000
			while shell.game_info().get("save_kind", "") != "campaign_battle" and Time.get_ticks_msec() < limit: await get_tree().process_frame
		verify(shell.game_info().get("save_kind", "") == "campaign_battle", "normal_chinese_departure_loads_actual_first_battle")
		if shell.game_info().get("save_kind", "") != "campaign_battle":
			await picture("departure-failed")
			await finish()
			return
	await picture("normal-gameplay")
	await frames(8)
	await key(KEY_ESCAPE)
	verify(shell.screen == "pause" and shell.game.process_mode == Node.PROCESS_MODE_DISABLED, "escape_freezes_actual_gameplay")
	var before = rule_snapshot()
	await get_tree().create_timer(0.25).timeout
	verify(before == rule_snapshot(), "pause_does_not_advance_rules")
	await picture("pause")
	await click("pause.settings")
	await click("tabs.audio")
	var audio = get_node_or_null("/root/CFGCNAudio")
	verify(is_instance_valid(audio) and audio.has_method("report"), "package_audio_reports_actual_ui_events")
	if is_instance_valid(audio):
		for muted_bus in ["master", "effects"]:
			var count_before = ui_play_count(audio)
			shell.view.controls["settings." + muted_bus].value = 0.0
			await click("tabs.interface")
			await click("tabs.audio")
			verify(ui_play_count(audio) == count_before, "actual_ui_actions_respect_" + muted_bus + "_mute")
			shell.view.controls["settings." + muted_bus].value = settings_target[muted_bus]
			await click("settings.apply")
		verify(ui_play_count(audio) > 0, "normal_package_menu_actions_play_real_ui_cues")
	await picture("pause-settings-audio")
	# Only the observed title defect is checked at the enlarged English setting;
	# the main new/save/continue flow stays in the player's default Chinese UI.
	await click("tabs.interface")
	var locale = shell.view.controls["settings.locale"]
	locale.select(2)
	locale.item_selected.emit(2)
	shell.view.controls["settings.ui_scale"].value = 1.3
	shell.view.controls["settings.reduced_motion"].button_pressed = true
	await click("settings.apply")
	DisplayServer.window_set_size(Vector2i(960, 600))
	await frames(8)
	await click("settings.back")
	await picture("targeted-pause-en130")
	await click("pause.settings")
	await click("tabs.interface")
	locale = shell.view.controls["settings.locale"]
	locale.select(0)
	locale.item_selected.emit(0)
	shell.view.controls["settings.ui_scale"].value = 1.0
	shell.view.controls["settings.reduced_motion"].button_pressed = false
	await click("settings.apply")
	DisplayServer.window_set_size(Vector2i(1280, 720))
	await frames(10)
	await click("settings.back")
	verify(shell.screen == "pause" and before == rule_snapshot(), "settings_and_preview_keep_game_paused")
	if shell.screen != "pause":
		await picture("settings-return-failed")
		await finish()
		return
	await click("pause.save")
	verify(shell.message == shell.tr_copy("save_ok") and shell.game_info().get("has_save", false), "pause_save_returns_real_success")
	verify(inside_profile(persisted_path()) and FileAccess.file_exists(persisted_path()), "actual_journey_file_is_isolated_on_H")
	await click("pause.menu")
	verify(shell.screen == "menu" and not shell.game_active, "return_to_menu_unloads_game")
	await click("menu.load")
	verify(shell.screen == "load" and shell.view.controls.has("load.slot0"), "real_save_is_listed")
	await picture("save-browser")
	await click("load.slot0")
	verify(await wait_play(), "selected_save_restores_real_game")
	if shell.screen == "play":
		await key(KEY_ESCAPE)
		await click("pause.menu")
	verify(shell.screen == "menu" and not shell.view.controls["menu.continue"].disabled, "saved_menu_is_ready_for_independent_cold_process")
	await finish()
