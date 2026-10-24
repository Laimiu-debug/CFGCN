extends Node
## Persistent desktop entry. The gameplay scene and its save format stay game-owned.

const Settings = preload("res://shared_desktop_ui/settings_store.gd")
const View = preload("res://shared_desktop_ui/desktop_view.gd")
const Copy = preload("res://shared_desktop_ui/copy.gd")
const GameData = preload("res://shared_desktop_ui/game_data.gd")
var config = {}
var store
var view
var game: Node
var probe: Node
var game_container: Node
var game_active = false
var screen = "menu"
var previous_screen = "menu"
var settings_return = "menu"
var settings_tab = 0
var draft = {}
var message = ""
var loading_failed = false
var loading = false
var load_discard = false
var requested_mode = "new"
var requested_path = ""
var gameplay_process_mode = Node.PROCESS_MODE_INHERIT
var menu_pause = false
var display_deadline = 0
var capture_action = ""
var leaving_action = ""
var _ready_for_qa = false
var _load_token = 0
var _window_suppressed = false
var file_dialog: FileDialog
var window_label = ""
var loading_paths = []
var loading_index = 0
var loaded_resources = []
var loaded_scene

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	get_tree().auto_accept_quit = false
	config = GameData.CONFIG.duplicate(true)
	store = Settings.new()
	store.configure(config.id)
	store.apply(store.values)
	get_window().min_size = Vector2i(960, 600)
	game_container = Node.new()
	game_container.name = "Gameplay"
	add_child(game_container)
	var script = load(config.get("probe_script", "res://scripts/main.gd"))
	if script != null and script.can_instantiate():
		probe = script.new()
	view = View.new()
	view.name = "DesktopView"
	add_child(view)
	view.initialize(self)
	file_dialog = FileDialog.new()
	file_dialog.file_mode = FileDialog.FILE_MODE_OPEN_FILE
	file_dialog.access = FileDialog.ACCESS_FILESYSTEM
	file_dialog.filters = PackedStringArray(["*.json ; JSON"])
	file_dialog.process_mode = Node.PROCESS_MODE_ALWAYS
	file_dialog.file_selected.connect(func(path): begin_load("load", path))
	add_child(file_dialog)
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--desktop-window-label="): window_label = arg.trim_prefix("--desktop-window-label=")
	message = tr_copy(store.notice) if not store.notice.is_empty() else ""
	view.render("menu")
	get_window().close_requested.connect(_window_close)
	_update_window_title()
	_ready_for_qa = true
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--desktop-qa="):
			var path = arg.trim_prefix("--desktop-qa=")
			var script_qa = load(path)
			if script_qa != null:
				var qa = script_qa.new()
				qa.name = "DesktopQA"
				add_child(qa)
				qa.run.call_deferred(self)

func _exit_tree() -> void:
	if is_instance_valid(probe): probe.free()

func localized(key: String) -> String:
	var locale = store.values.locale
	return str(config.get(key + "_i18n", {}).get(locale, config.get(key, "")))

func tr_copy(key: String) -> String:
	return Copy.text(key, store.values.locale)

func game_info() -> Dictionary:
	var target = game if is_instance_valid(game) else probe
	if is_instance_valid(target) and target.has_method("desktop_get_state"):
		var result = target.call("desktop_get_state")
		if result is Dictionary:
			if not result.has("slots") and result.get("has_save", false) and result.has("save_path"):
				result.slots = [{"path": result.save_path, "label": result.get("save_summary", tr_copy("local_save"))}]
			return result
	return {"has_save": false, "can_save": false, "slots": [], "pause_locked": false}

func is_dirty() -> bool:
	return store.sanitize(draft) != store.saved

func show_screen(next: String, text: String = "") -> void:
	screen = next
	message = text
	view.render(screen)
	if next == "loading" and loading_failed: ui_sound("error")

func ui_sound(event: String) -> bool:
	var audio = get_node_or_null("/root/CFGCNAudio")
	return bool(audio.call("ui_event", event)) if is_instance_valid(audio) and audio.has_method("ui_event") else false

func act(action: String, payload = null) -> void:
	if action in ["show_load", "show_settings", "credits", "defaults", "capture"]: ui_sound("confirm")
	elif action in ["cancel_settings", "back_settings", "cancel_loading", "back"]: ui_sound("cancel")
	elif action == "settings_tab" and int(payload) != settings_tab: ui_sound("confirm")
	match action:
		"continue": begin_load("continue")
		"new":
			if game_info().get("has_save", false):
				previous_screen = screen
				show_screen("new_confirm")
			else: begin_load("new")
		"new_confirmed": begin_load("new")
		"show_load":
			previous_screen = screen
			show_screen("load")
		"load_slot": begin_load("load", str(payload))
		"import":
			file_dialog.current_dir = ProjectSettings.globalize_path("user://")
			file_dialog.popup_centered_ratio(0.72)
		"resume": resume_game()
		"show_settings": open_settings()
		"settings_tab":
			settings_tab = int(payload)
			show_screen("settings", message)
		"defaults":
			draft = Settings.DEFAULTS.duplicate(true)
			store.apply(draft, false)
			show_screen("settings", tr_copy("pending"))
		"cancel_settings":
			draft = store.saved.duplicate(true)
			store.rollback()
			apply_to_game(store.values)
			show_screen("settings")
		"back_settings":
			store.rollback()
			apply_to_game(store.values)
			show_screen(settings_return)
		"apply_settings": apply_settings()
		"keep_display": commit_settings()
		"revert_display": revert_display()
		"capture":
			capture_action = str(payload)
			view.set_status(tr_copy("press_key"))
		"save": save_game()
		"main_menu": save_then_leave("menu")
		"quit": save_then_leave("quit")
		"leave_confirmed": leave_game(leaving_action)
		"credits":
			previous_screen = screen
			show_screen("credits")
		"retry": begin_load(requested_mode, requested_path)
		"cancel_loading": cancel_loading()
		"back":
			capture_action = ""
			show_screen(previous_screen)

func _input(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed or event.echo: return
	if is_instance_valid(file_dialog) and file_dialog.visible: return
	for control in view.controls.values():
		if control is OptionButton and control.get_popup().visible: return
	if not capture_action.is_empty():
		get_viewport().set_input_as_handled()
		if event.physical_keycode == KEY_ESCAPE:
			capture_action = ""
			view.set_status("")
			return
		if event.ctrl_pressed or event.alt_pressed or event.meta_pressed or event.physical_keycode in [KEY_TAB, KEY_NONE, KEY_SHIFT, KEY_CTRL, KEY_ALT, KEY_META]:
			view.set_status(tr_copy("key_reserved"))
			return
		for other in config.actions:
			if other != capture_action and int(draft.bindings.get(other, Settings.KEY_DEFAULTS[other])) == int(event.physical_keycode):
				view.set_status(tr_copy("key_conflict"))
				return
		draft.bindings[capture_action] = int(event.physical_keycode)
		capture_action = ""
		store.apply(draft, false)
		show_screen("settings", tr_copy("pending"))
		return
	if event.physical_keycode != KEY_ESCAPE: return
	get_viewport().set_input_as_handled()
	if screen == "play": open_pause()
	elif screen == "pause": resume_game()
	elif screen == "settings": act("back_settings")
	elif screen == "display_confirm": revert_display()
	elif screen == "loading": cancel_loading()
	elif screen != "menu": show_screen(previous_screen)

func _process(_delta: float) -> void:
	if display_deadline > 0:
		var remaining = ceili(float(display_deadline - Time.get_ticks_msec()) / 1000.0)
		if remaining <= 0: revert_display()
		elif is_instance_valid(view.display_countdown):
			view.display_countdown.text = tr_copy("revert_countdown") % remaining
	if not loading and not load_discard: return
	var progress = []
	var path = str(loading_paths[loading_index])
	var status = ResourceLoader.load_threaded_get_status(path, progress)
	if status == ResourceLoader.THREAD_LOAD_LOADED:
		var packed = ResourceLoader.load_threaded_get(path)
		if load_discard:
			load_discard = false
			loaded_resources.clear()
			return
		loaded_resources.append(packed)
		if path == str(config.gameplay_scene): loaded_scene = packed
		loading_index += 1
		if loading_index < loading_paths.size():
			_request_next_resource()
		else:
			loading = false
			view.update_loading(100.0, tr_copy("preparing"))
			_finish_loading.call_deferred(loaded_scene, _load_token)
	elif status == ResourceLoader.THREAD_LOAD_FAILED or status == ResourceLoader.THREAD_LOAD_INVALID_RESOURCE:
		loading = false
		load_discard = false
		loading_failed = true
		show_screen("loading", tr_copy("loading_failed"))
	elif loading:
		var fraction = float(progress[0]) if progress.size() else 0.0
		view.update_loading((loading_index + fraction) / loading_paths.size() * 100.0, tr_copy("loading_detail") + " · %d/%d" % [loading_index + 1, loading_paths.size()])

func begin_load(mode: String, path: String = "") -> void:
	if loading or load_discard: return
	requested_mode = mode
	requested_path = path
	loading_failed = false
	_load_token += 1
	show_screen("loading")
	await get_tree().process_frame
	if screen != "loading": return
	loading_paths = config.get("preload_resources", []).duplicate()
	if not str(config.gameplay_scene) in loading_paths: loading_paths.append(str(config.gameplay_scene))
	loading_index = 0
	loaded_scene = null
	_request_next_resource()

func _request_next_resource() -> void:
	var path = str(loading_paths[loading_index])
	var error = ResourceLoader.load_threaded_request(path, "", true)
	if error != OK:
		loading_failed = true
		show_screen("loading", tr_copy("loading_failed"))
		return
	loading = true

func _finish_loading(packed, token: int) -> void:
	if token != _load_token or screen != "loading": return
	await get_tree().process_frame
	if token != _load_token: return
	var candidate: Node
	var created = not is_instance_valid(game)
	if created:
		if not packed is PackedScene:
			loading_failed = true
			show_screen("loading", tr_copy("loading_failed"))
			return
		candidate = packed.instantiate()
		candidate.set_meta("desktop_shell_managed", true)
		candidate.set_meta("desktop_start_mode", config.get("start_modes", {}).get(requested_mode, requested_mode))
		candidate.set_meta("desktop_save_path", requested_path)
		game_container.add_child(candidate)
		await get_tree().process_frame
	else:
		candidate = game
	if token != _load_token:
		if created: candidate.queue_free()
		return
	var ready_deadline = Time.get_ticks_msec() + 60000
	while candidate.has_method("desktop_get_state") and not candidate.call("desktop_get_state").get("ready", true):
		if token != _load_token or Time.get_ticks_msec() > ready_deadline:
			if created: candidate.queue_free()
			if token == _load_token:
				loading_failed = true
				show_screen("loading", tr_copy("loading_failed"))
			return
		await get_tree().process_frame
	if not candidate.has_method("desktop_start"):
		if created: candidate.queue_free()
		loading_failed = true
		show_screen("loading", tr_copy("loading_failed"))
		return
	var mode = str(config.get("start_modes", {}).get(requested_mode, requested_mode))
	var result = candidate.call("desktop_start", mode, requested_path)
	if not result is Dictionary or not result.get("ok", false):
		if created: candidate.queue_free()
		loading_failed = true
		var detail = str(result.get("message", "")) if result is Dictionary else ""
		show_screen("loading", tr_copy("loading_failed") + ("\n" + detail if detail != "" else ""))
		return
	game = candidate
	game_active = true
	store.apply(store.values, false)
	apply_to_game(store.values)
	# Desktop-managed gameplay resumes only after the host has accepted the start.
	if menu_pause:
		_set_menu_pause(false)
	else:
		if game.has_method("desktop_set_menu_paused"): game.call("desktop_set_menu_paused", false)
	show_screen("play")
	ui_sound("confirm")
	_update_window_title()
	if game.has_signal("desktop_menu_requested") and not game.is_connected("desktop_menu_requested", open_pause):
		game.connect("desktop_menu_requested", open_pause)

func _update_window_title() -> void:
	get_window().title = localized("title") + " · 四大名著" + (" · " + window_label if window_label != "" else "")

func cancel_loading() -> void:
	_load_token += 1
	if loading:
		loading = false
		load_discard = true
	loading_failed = false
	show_screen("pause" if game_active else "menu")

func _set_menu_pause(value: bool) -> void:
	if not is_instance_valid(game) or menu_pause == value: return
	if value:
		if game.has_method("desktop_set_menu_paused"): game.call("desktop_set_menu_paused", true)
		gameplay_process_mode = game.process_mode
		game.process_mode = Node.PROCESS_MODE_DISABLED
	else:
		game.process_mode = gameplay_process_mode
		if game.has_method("desktop_set_menu_paused"): game.call("desktop_set_menu_paused", false)
	menu_pause = value

func open_pause() -> void:
	if not game_active or screen != "play": return
	_set_menu_pause(true)
	show_screen("pause")
	ui_sound("confirm")

func resume_game() -> void:
	if not game_active: return
	ui_sound("cancel")
	_set_menu_pause(false)
	show_screen("play")

func open_settings() -> void:
	settings_return = "pause" if game_active else "menu"
	draft = store.saved.duplicate(true)
	capture_action = ""
	show_screen("settings")

func edit_setting(key: String, value) -> void:
	draft[key] = value
	store.apply(draft, false)
	if key == "reduced_motion": view.motion_preferences_changed()
	apply_to_game(store.values)
	message = tr_copy("pending")
	view.set_status(message)

func apply_settings() -> void:
	if store.display_changed(draft) and DisplayServer.get_name() != "headless":
		store.apply(draft)
		apply_to_game(store.values)
		display_deadline = Time.get_ticks_msec() + 15000
		show_screen("display_confirm")
	else: commit_settings()

func commit_settings() -> void:
	var display_was_changed = display_deadline > 0
	display_deadline = 0
	var result = store.persist(draft)
	if result.ok:
		store.apply(store.values, false)
		apply_to_game(store.values)
		show_screen("settings", tr_copy("saved"))
		ui_sound("confirm")
		_update_window_title()
	else:
		store.rollback(display_was_changed)
		apply_to_game(store.values)
		show_screen("settings", tr_copy("save_failed") + " · " + str(result.message))
		ui_sound("error")

func revert_display() -> void:
	display_deadline = 0
	store.rollback(true)
	draft.window_mode = store.saved.window_mode
	draft.resolution = store.saved.resolution
	store.apply(draft, false)
	apply_to_game(store.values)
	show_screen("settings", tr_copy("pending") if is_dirty() else "")

func apply_to_game(values: Dictionary) -> void:
	if is_instance_valid(game) and game.has_method("desktop_apply_settings"):
		game.call("desktop_apply_settings", values.duplicate(true))

func save_game() -> Dictionary:
	if not is_instance_valid(game) or not game_info().get("can_save", false) or not game.has_method("desktop_save"):
		var failed = {"ok": false, "message": tr_copy("unavailable")}
		message = failed.message
		view.set_status(message)
		return failed
	var result = game.call("desktop_save")
	if not result is Dictionary: result = {"ok": false, "message": tr_copy("save_failed")}
	message = tr_copy("save_ok") if result.get("ok", false) else tr_copy("save_failed") + " · " + str(result.get("message", ""))
	view.set_status(message)
	ui_sound("confirm" if result.get("ok", false) else "error")
	return result

func save_then_leave(destination: String) -> void:
	if game_active:
		if game_info().get("can_save", false):
			if not save_game().get("ok", false): return
		elif game_info().get("has_unsaved_changes", true):
			leaving_action = destination
			previous_screen = screen
			show_screen("leave_confirm")
			return
	leave_game(destination)

func leave_game(destination: String) -> void:
	if destination == "quit":
		get_tree().quit()
		return
	_set_menu_pause(false)
	if is_instance_valid(game):
		game_container.remove_child(game)
		game.queue_free()
	game = null
	game_active = false
	menu_pause = false
	loaded_resources.clear()
	loaded_scene = null
	show_screen("menu")

func _window_close() -> void:
	if game_active and screen == "play": open_pause()
	if screen == "display_confirm": revert_display()
	if screen == "settings":
		store.rollback()
		apply_to_game(store.values)
	save_then_leave("quit")
