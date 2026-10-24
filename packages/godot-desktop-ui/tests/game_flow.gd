extends "res://shared_desktop_ui/tests/ui_controls.gd"

func wait_for_screen(target: String, limit: float = 55.0) -> bool:
	var deadline = Time.get_ticks_msec() + int(limit * 1000)
	while shell.screen != target and Time.get_ticks_msec() < deadline:
		if shell.loading_failed: return false
		await get_tree().process_frame
	return shell.screen == target

func run(controller: Node) -> void:
	if not prepare(controller): return
	get_tree().create_timer(100.0).timeout.connect(func():
		push_error("Gameplay UI acceptance timed out")
		get_tree().quit(2))
	await pause_frames(10)
	var initial = shell.game_info()
	check(shell.screen == "menu", "real_project_starts_at_shared_menu")
	await capture("menu-integrated")
	await click("menu.new")
	if shell.screen == "new_confirm": await click("confirm.yes")
	check(shell.screen == "loading", "new_journey_enters_loading_screen")
	var ready = await wait_for_screen("play")
	check(ready, "real_gameplay_scene_loads_and_accepts_new_game")
	if not ready:
		await capture("game-load-failure")
		finish()
		return
	check(shell.game.get_meta("desktop_shell_managed"), "gameplay_is_desktop_managed")
	check(shell.game.has_method("desktop_start") and shell.game.has_method("desktop_save"), "real_game_adapter_is_connected")
	await get_tree().create_timer(0.5).timeout
	await key(KEY_ESCAPE)
	check(shell.screen == "pause", "native_escape_opens_shared_pause")
	check(shell.game.process_mode == Node.PROCESS_MODE_DISABLED, "pause_disables_gameplay_branch")
	var before = shell.game_info().duplicate(true)
	await capture("pause")
	await click("pause.settings")
	check(shell.screen == "settings", "pause_opens_shared_settings")
	await click("tabs.audio")
	shell.view.controls["settings.music"].value = 0.3
	await click("settings.apply")
	await click("settings.back")
	check(shell.screen == "pause" and shell.game.process_mode == Node.PROCESS_MODE_DISABLED, "settings_return_preserves_menu_pause")
	if shell.game_info().get("can_save", false):
		await click("pause.save")
		check(shell.message == shell.tr_copy("save_ok"), "pause_save_has_real_success_receipt")
	else:
		check(false, "game_reports_a_saveable_new_journey")
	var saved = shell.game_info().duplicate(true)
	check(saved.get("has_save", false), "game_probe_sees_real_persisted_save")
	check(saved.get("slots", []).size() > 0 or not str(saved.get("save_path", "")).is_empty(), "save_browser_has_real_entry")
	await click("pause.resume")
	check(shell.screen == "play" and shell.game.process_mode != Node.PROCESS_MODE_DISABLED, "resume_restores_original_processing")
	await key(KEY_ESCAPE)
	await click("pause.menu")
	check(shell.screen == "menu" and not shell.game_active, "save_and_return_unloads_gameplay")
	check(shell.game_info().get("has_save", false), "unloaded_probe_still_finds_save")
	check(not shell.view.controls["menu.continue"].disabled, "continue_is_enabled_after_saving")
	await capture("menu-with-save")
	await click("menu.continue")
	check(await wait_for_screen("play"), "continue_reloads_actual_saved_game")
	if shell.screen != "play":
		await capture("continue-failure")
		finish()
		return
	await key(KEY_ESCAPE)
	await click("pause.menu")
	await click("menu.load")
	check(shell.screen == "load" and shell.view.controls.has("load.slot0"), "save_browser_lists_current_game_save")
	await capture("load-with-save")
	if shell.view.controls.has("load.slot0"):
		await click("load.slot0")
		check(await wait_for_screen("play"), "selecting_save_loads_actual_game")
		if shell.screen == "play":
			await key(KEY_ESCAPE)
			await capture("pause-restored")
	finish()

func finish() -> void:
	var result = {
		"game": shell.config.id, "scope": "Shared menu integrated with current real Godot gameplay and real isolated native saves. No full-campaign completion claim.",
		"checks": checks, "failed": checks.filter(func(item): return not item.ok).size(),
		"adapter": shell.game_info(), "screen": shell.screen, "ui_message": shell.message
	}
	var file = FileAccess.open(output.path_join(shell.config.id + "-game-flow.json"), FileAccess.WRITE)
	file.store_string(JSON.stringify(result, "\t") + "\n")
	file.close()
	print("GAME_FLOW ", shell.config.id, " ", checks.size(), " failed=", result.failed)
	get_tree().quit(0 if result.failed == 0 else 1)
