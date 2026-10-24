extends "res://shared_desktop_ui/tests/ui_controls.gd"

func run(controller: Node) -> void:
	if not prepare(controller): return
	await pause_frames(12)
	check(shell.screen == "menu", "restarted_process_uses_shared_default_entry")
	check(shell.game_info().get("has_save", false), "restarted_process_probes_real_game_save")
	check(not shell.view.controls["menu.continue"].disabled, "restarted_process_enables_continue")
	check(is_equal_approx(float(shell.store.saved.music), 0.3), "settings_survive_full_process_restart")
	await capture("menu-final")
	await click("menu.settings")
	check(not shell.is_dirty(), "restarted_settings_have_no_false_pending_state")
	await click("tabs.audio")
	check(is_equal_approx(float(shell.view.controls["settings.music"].value), 0.3), "saved_volume_is_visible_after_restart")
	await capture("settings-final")
	await click("settings.back")
	var result = {"game": shell.config.id, "scope": "Separate native process after final gameplay integration, existing isolated save and preference reload.", "checks": checks, "failed": checks.filter(func(item): return not item.ok).size()}
	var file = FileAccess.open(output.path_join(shell.config.id + "-restart.json"), FileAccess.WRITE)
	file.store_string(JSON.stringify(result, "\t") + "\n")
	file.close()
	print("UI_RESTART ", shell.config.id, " ", checks.size(), " failed=", result.failed)
	get_tree().quit(0 if result.failed == 0 else 1)
