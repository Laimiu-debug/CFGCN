extends "res://shared_desktop_ui/tests/ui_controls.gd"

class RefusingGame extends Node:
	var menu_paused = false
	var upgrade_paused = true
	func desktop_get_state() -> Dictionary:
		return {"can_save": true, "has_unsaved_changes": true}
	func desktop_save() -> Dictionary:
		return {"ok": false, "message": "QA: disk unavailable"}
	func desktop_set_menu_paused(value: bool) -> void:
		menu_paused = value

func fit_controls(prefix: String, name: String) -> void:
	var viewport_size = DisplayServer.window_get_size()
	var valid = true
	for id in shell.view.controls:
		if not id.begins_with(prefix): continue
		var control = shell.view.controls[id]
		var parent = control.get_parent()
		while parent != null:
			if parent is ScrollContainer: parent.ensure_control_visible(control)
			parent = parent.get_parent()
		await pause_frames(3)
		var rect = get_viewport().get_final_transform() * control.get_global_rect()
		var inside = rect.position.x >= -1 and rect.position.y >= -1 and rect.end.x <= viewport_size.x + 1 and rect.end.y <= viewport_size.y + 1
		if not inside: print("LAYOUT_OUTSIDE ", id, " ", rect, " viewport=", viewport_size)
		valid = valid and inside and rect.size.y >= 44
	check(valid, name)

func run(controller: Node) -> void:
	if not prepare(controller): return
	get_tree().create_timer(110.0).timeout.connect(func(): get_tree().quit(2))
	await pause_frames(12)
	await click("menu.settings")
	var selector = shell.view.controls["settings.window_mode"]
	selector.get_popup().popup()
	await pause_frames()
	await key(KEY_ESCAPE)
	check(shell.screen == "settings" and not selector.get_popup().visible, "escape_closes_dropdown_and_preserves_settings")
	await click("tabs.audio")
	var original = FileAccess.get_sha256(shell.store.config_path) if FileAccess.file_exists(shell.store.config_path) else ""
	var real_path = shell.store.config_path
	DirAccess.make_dir_recursive_absolute(real_path.get_base_dir())
	var blocker = FileAccess.open(real_path, FileAccess.WRITE)
	blocker.store_string("[format]\nversion=1\n")
	blocker.close()
	original = FileAccess.get_sha256(real_path)
	shell.store.config_path = real_path.path_join("blocked.cfg")
	shell.view.controls["settings.music"].value = 0.15
	await click("settings.apply")
	check(shell.screen == "settings" and shell.message.begins_with(shell.tr_copy("save_failed")), "settings_write_failure_stays_visible")
	check(FileAccess.get_sha256(real_path) == original, "settings_write_failure_preserves_previous_file")
	shell.store.config_path = real_path
	shell.act("cancel_settings")
	await click("tabs.display")
	shell.edit_setting("resolution", "1600x900")
	await click("settings.apply")
	check(shell.screen == "display_confirm" and shell.display_deadline > Time.get_ticks_msec(), "display_change_starts_real_fifteen_second_confirmation")
	check(shell.store.saved.resolution == "1280x720", "unconfirmed_display_change_is_not_saved")
	await get_tree().create_timer(15.3).timeout
	check(shell.screen == "settings" and shell.display_deadline == 0 and shell.store.values.resolution == "1280x720", "display_timeout_automatically_restores_previous_mode")
	shell.edit_setting("resolution", "1600x900")
	await click("settings.apply")
	await click("confirm.yes")
	check(shell.screen == "settings" and shell.store.saved.resolution == "1600x900", "keep_display_saves_the_confirmed_mode")
	shell.edit_setting("resolution", "1280x720")
	await click("settings.apply")
	await key(KEY_ESCAPE)
	check(shell.screen == "settings" and shell.store.values.resolution == "1600x900", "escape_reverts_display_confirmation")
	shell.edit_setting("resolution", "1280x720")
	await click("settings.apply")
	await click("confirm.yes")
	await click("tabs.interface")
	shell.edit_setting("ui_scale", 1.3)
	shell.edit_setting("locale", "en")
	await click("settings.apply")
	for size in [Vector2i(960, 600), Vector2i(1280, 720), Vector2i(1920, 1080)]:
		DisplayServer.window_set_size(size)
		await pause_frames(12)
		print("LAYOUT_METRICS requested=", size, " window=", DisplayServer.window_get_size(), " viewport=", get_viewport().get_visible_rect(), " final=", get_viewport().get_final_transform(), " texture=", get_viewport().get_texture().get_size())
		await fit_controls("settings.", "settings_reachable_130pct_en_%dx%d" % [size.x, size.y])
		await fit_controls("tabs.", "tabs_fit_130pct_en_%dx%d" % [size.x, size.y])
		if size.x == 960: await capture("settings-minimum-130-en")
		await click("settings.back")
		check(DisplayServer.window_get_size() == size, "settings_back_preserves_user_window_size_%dx%d" % [size.x, size.y])
		await fit_controls("menu.", "menu_reachable_130pct_en_%dx%d" % [size.x, size.y])
		if size.x == 960: await capture("menu-minimum-130-en")
		await click("menu.settings")
		check(shell.settings_tab == 3, "settings_tab_preserved_%dx%d" % [size.x, size.y])
	await click("settings.defaults")
	await click("settings.apply")
	await click("settings.back")
	await pause_frames(12)
	await capture("menu-final")
	await click("menu.load")
	if shell.view.controls.has("load.import"):
		await click("load.import")
		check(shell.file_dialog.visible, "native_save_file_dialog_opens")
		await key(KEY_ESCAPE)
		check(shell.screen == "load" and not shell.file_dialog.visible, "escape_closes_file_dialog_without_leaving_save_browser")
	await key(KEY_ESCAPE)
	var fixture = RefusingGame.new()
	shell.game_container.add_child(fixture)
	shell.game = fixture
	shell.game_active = true
	shell.show_screen("play")
	shell._window_close()
	await pause_frames()
	check(shell.screen == "pause" and shell.message.begins_with(shell.tr_copy("save_failed")), "window_close_save_failure_keeps_game_and_visible_error")
	check(shell.game_active and fixture.menu_paused, "failed_close_keeps_game_paused")
	shell.resume_game()
	check(not fixture.menu_paused and fixture.upgrade_paused, "resume_removes_only_menu_pause_reason")
	shell.open_pause()
	shell.leave_game("menu")
	var result = {"game": shell.config.id, "scope": "Native shared UI, actual display timeout, minimum window and large text, modal input and controlled save failure. Failure/pause fixture is not campaign acceptance.", "checks": checks, "failed": checks.filter(func(item): return not item.ok).size()}
	var file = FileAccess.open(output.path_join(shell.config.id + "-ui-edges.json"), FileAccess.WRITE)
	file.store_string(JSON.stringify(result, "\t") + "\n")
	file.close()
	print("UI_EDGES ", shell.config.id, " ", checks.size(), " failed=", result.failed)
	get_tree().quit(0 if result.failed == 0 else 1)
