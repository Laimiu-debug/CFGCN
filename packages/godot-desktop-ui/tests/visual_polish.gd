extends "res://shared_desktop_ui/tests/ui_controls.gd"
## Native behavior and GPU captures for the shared visual revision.

var captures = []
var sound_evidence = {}

func ui_count(audio: Node) -> int:
	var played = audio.report().get("played", {})
	return int(played.get("ui-confirm", 0)) + int(played.get("ui-cancel", 0))

func picture(name: String, purpose: String) -> void:
	await capture(name)
	captures.append({"name": name, "purpose": purpose, "screen": shell.screen, "window": [DisplayServer.window_get_size().x, DisplayServer.window_get_size().y], "texture": [get_viewport().get_texture().get_size().x, get_viewport().get_texture().get_size().y], "viewport": [get_viewport().get_visible_rect().size.x, get_viewport().get_visible_rect().size.y]})

func wait_loaded(failure: bool = false) -> bool:
	var deadline = Time.get_ticks_msec() + 55000
	while Time.get_ticks_msec() < deadline:
		if failure and shell.loading_failed: return true
		if not failure and shell.screen == "play": return true
		if not failure and shell.loading_failed: return false
		await get_tree().process_frame
	return false

func ancestor_scroll(node: Node) -> ScrollContainer:
	var parent = node.get_parent()
	while parent != null:
		if parent is ScrollContainer: return parent
		parent = parent.get_parent()
	return null

func run(controller: Node) -> void:
	if not prepare(controller): return
	get_tree().create_timer(150.0).timeout.connect(func(): get_tree().quit(2))
	await pause_frames(2)
	check(get_viewport().gui_get_focus_owner() != null, "keyboard_focus_exists_during_entrance")
	await click("menu.settings")
	check(shell.screen == "settings", "menu_accepts_mouse_before_decorative_motion_finishes")
	await click("tabs.audio")
	shell.view.controls["settings.music"].value = 0.35
	for tab in ["controls", "interface", "display", "audio", "interface", "audio"]:
		await click("tabs." + tab)
	check(shell.settings_tab == 1 and is_equal_approx(shell.draft.music, 0.35), "rapid_tab_switches_keep_unsaved_values")
	await get_tree().create_timer(0.3).timeout
	await picture("settings-audio", "Settled real native audio settings; current game artwork retained.")
	await click("tabs.controls")
	var last = shell.view.controls["binding." + shell.config.actions[-1]]
	var scroll = ancestor_scroll(last)
	scroll.ensure_control_visible(last)
	await pause_frames(5)
	var previous_scroll = scroll.scroll_vertical
	await click("tabs.interface")
	await click("tabs.controls")
	await pause_frames(5)
	check(absi(ancestor_scroll(shell.view.controls["binding." + shell.config.actions[-1]]).scroll_vertical - previous_scroll) <= 1, "each_settings_tab_restores_its_scroll_position")
	await click("settings.cancel")
	check(not shell.is_dirty(), "discard_after_tab_switches_restores_saved_preferences")
	await click("tabs.interface")
	shell.view.controls["settings.reduced_motion"].button_pressed = true
	await click("settings.apply")
	await click("settings.back")
	await pause_frames(5)
	await RenderingServer.frame_post_draw
	var still_a = get_viewport().get_texture().get_image().get_data()
	await get_tree().create_timer(0.24).timeout
	await RenderingServer.frame_post_draw
	var still_b = get_viewport().get_texture().get_image().get_data()
	check(still_a == still_b, "reduced_motion_produces_stable_rendered_menu_frames")
	await picture("menu-reduced-motion", "Reduced-motion menu; two GPU frames were compared byte for byte.")
	var info = shell.game_info()
	var save_path = str(info.get("save_path", ""))
	var save_sha = FileAccess.get_sha256(save_path) if FileAccess.file_exists(save_path) else ""
	# A valid local scene without an adapter exercises the loader's real failure
	# branch without generating an expected ResourceLoader engine error.
	var fixture_path = OS.get_user_data_dir().path_join("ui-no-adapter.tscn")
	var node = Node.new()
	var scene = PackedScene.new()
	var packed = scene.pack(node)
	node.free()
	check(packed == OK and ResourceSaver.save(scene, fixture_path) == OK, "controlled_missing_adapter_fixture_is_saved_in_isolated_user_dir")
	var config = shell.config.duplicate(true)
	shell.config.preload_resources = []
	shell.config.gameplay_scene = fixture_path
	shell.begin_load("continue" if info.get("has_save", false) else "new")
	check(await wait_loaded(true), "missing_adapter_reaches_visible_loading_failure")
	check(shell.view.controls.has("loading.retry") and shell.view.controls.has("loading.back"), "failed_loading_has_retry_and_return_actions")
	check(save_sha.is_empty() or FileAccess.get_sha256(save_path) == save_sha, "failed_loading_preserves_the_existing_real_save")
	await get_tree().create_timer(0.35).timeout
	await picture("loading-failure", "Controlled valid scene lacking the gameplay adapter; not a failed real campaign.")
	shell.config = config
	await click("loading.back")
	check(shell.screen == "menu", "return_from_failed_loading_restores_menu")
	await click("menu.continue" if info.get("has_save", false) else "menu.new")
	if shell.screen == "new_confirm": await click("confirm.yes")
	await picture("loading-real", "Real game ResourceLoader request; no artificial percentage or wait was inserted.")
	check(await wait_loaded(), "real_game_loads_after_the_controlled_failure")
	if shell.screen == "play":
		await key(KEY_ESCAPE)
		check(shell.screen == "pause" and shell.game.process_mode == Node.PROCESS_MODE_DISABLED, "real_game_is_paused_under_the_new_presentation")
		await get_tree().create_timer(0.35).timeout
		await picture("pause", "Actual current Godot gameplay behind the shared pause menu.")
		var audio = get_node_or_null("/root/CFGCNAudio")
		check(is_instance_valid(audio) and audio.has_method("ui_event"), "shared_menu_has_the_audio_owner_event_interface")
		await get_tree().create_timer(0.2).timeout
		var initial_count = ui_count(audio)
		await click("pause.settings")
		await get_tree().create_timer(0.2).timeout
		var first_count = ui_count(audio)
		await click("tabs.audio")
		await get_tree().create_timer(0.2).timeout
		var second_count = ui_count(audio)
		check(first_count > initial_count and second_count > first_count, "separate_paused_menu_actions_each_reach_real_audio_playback")
		var original_effects = shell.draft.effects
		shell.view.controls["settings.effects"].value = 0.0
		await pause_frames(4)
		var muted_count = ui_count(audio)
		await click("tabs.interface")
		await get_tree().create_timer(0.2).timeout
		check(ui_count(audio) == muted_count, "effects_mute_suppresses_real_menu_sounds")
		await click("tabs.audio")
		shell.view.controls["settings.effects"].value = original_effects
		var original_master = shell.draft.master
		shell.view.controls["settings.master"].value = 0.0
		await pause_frames(4)
		var master_count = ui_count(audio)
		await click("tabs.interface")
		await get_tree().create_timer(0.2).timeout
		check(ui_count(audio) == master_count, "master_mute_suppresses_real_menu_sounds")
		await click("tabs.audio")
		shell.view.controls["settings.master"].value = original_master
		sound_evidence = {"paused": audio.report().paused, "before": initial_count, "after_open_settings": first_count, "after_next_tab": second_count, "effects_muted_count": muted_count, "master_muted_count": master_count, "played": audio.report().played}
		await click("tabs.interface")
		var locale = shell.view.controls["settings.locale"]
		locale.select(2)
		locale.item_selected.emit(2)
		shell.view.controls["settings.ui_scale"].value = 1.3
		await click("settings.apply")
		DisplayServer.window_set_size(Vector2i(960, 600))
		await pause_frames(12)
		check(DisplayServer.window_get_size() == Vector2i(960, 600), "minimum_window_request_is_actually_applied")
		await picture("settings-small-en", "960x600 with 130 percent English text; functional reachability also covered by edge tests.")
		await click("settings.back")
		check(shell.screen == "pause" and shell.game.process_mode == Node.PROCESS_MODE_DISABLED, "small_window_settings_return_keeps_game_paused")
		await key(KEY_ESCAPE)
		check(shell.screen == "play" and shell.game.process_mode != Node.PROCESS_MODE_DISABLED, "keyboard_resume_restores_real_game_processing")
	if fixture_path.replace("\\", "/").to_lower().begins_with("h:/codex/app-data/cfgcn-shared-ui-qa/"):
		check(DirAccess.remove_absolute(fixture_path) == OK, "own_rebuildable_failure_fixture_is_cleaned")
	var result = {"game": shell.config.id, "checks": checks, "failed": checks.filter(func(item): return not item.ok).size(), "captures": captures, "scope": "Native Control input, visual revision, reduced-motion pixels, real loading and real game pause/resume. Adapter failure is explicitly controlled."}
	result.audio = sound_evidence
	var file = FileAccess.open(output.path_join(shell.config.id + "-visual-polish.json"), FileAccess.WRITE)
	file.store_string(JSON.stringify(result, "\t") + "\n")
	file.close()
	print("VISUAL_POLISH ", shell.config.id, " ", checks.size(), " failed=", result.failed)
	get_tree().quit(0 if result.failed == 0 else 1)
