extends CanvasLayer

const Copy = preload("res://shared_desktop_ui/copy.gd")
const UISkin = preload("res://shared_desktop_ui/theme.gd")
const GameData = preload("res://shared_desktop_ui/game_data.gd")
const ArtButton = preload("res://shared_desktop_ui/art_button.gd")
var controller
var root: Control
var content: Control
var background: TextureRect
var veil: ColorRect
var hero: TextureRect
var status_label: Label
var progress_bar: ProgressBar
var loading_label: Label
var display_countdown: Label
var controls = {}
var footer: Label
var focus_hint = ""
var resize_queued = false
var current_screen = ""
var focus_history = {}
var scroll_history = {}
var scrollers = []
var title_reveals = []
var entrance_tweens = []
var entrance_origins = []
var tab_marker: TextureRect
var tab_tween: Tween
var render_serial = 0
var last_tab = -1
var progress_number: Label
var loading_steps = []

func metric() -> float:
	var stretch = get_viewport().get_final_transform().get_scale()
	return 1.0 / maxf(0.4, minf(absf(stretch.x), absf(stretch.y)))

func initialize(owner_controller: Node) -> void:
	controller = owner_controller
	layer = 100
	process_mode = Node.PROCESS_MODE_ALWAYS
	root = Control.new()
	root.name = "DesktopInterface"
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(root)
	background = TextureRect.new()
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	background.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	background.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	background.texture = GameData.ART.background
	background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(background)
	veil = ColorRect.new()
	veil.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var shader = Shader.new()
	shader.code = "shader_type canvas_item; uniform vec4 paper : source_color; uniform float left_alpha=0.99; uniform float right_alpha=0.10; uniform float edge=0.22; void fragment(){float a=mix(left_alpha,right_alpha,smoothstep(edge,1.0,UV.x)); COLOR=vec4(paper.rgb,a);}"
	var material = ShaderMaterial.new()
	material.shader = shader
	material.set_shader_parameter("paper", UISkin.colors().paper)
	veil.material = material
	veil.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(veil)
	hero = TextureRect.new()
	hero.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hero.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	hero.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	if controller.config.get("figure", "") != "":
		hero.texture = GameData.ART.figure
	root.add_child(hero)
	content = Control.new()
	content.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.add_child(content)
	tab_marker = TextureRect.new()
	tab_marker.texture = GameData.ART.brush
	tab_marker.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tab_marker.mouse_filter = Control.MOUSE_FILTER_IGNORE
	tab_marker.modulate = UISkin.colors()[controller.config.id]
	tab_marker.hide()
	root.add_child(tab_marker)
	get_window().size_changed.connect(_window_resized)
	_layout_figure()

func _layout_figure() -> void:
	var size = get_viewport().get_visible_rect().size
	var detail = current_screen in ["settings", "load", "credits"]
	hero.position = Vector2(size.x * (0.78 if detail else 0.62), size.y * (0.28 if detail else 0.20))
	hero.size = Vector2(size.x * (0.16 if detail else 0.29), size.y * (0.57 if detail else 0.73))
	hero.modulate = Color(1, 1, 1, 0.68 if detail else 1.0)
	hero.visible = background.visible and (not detail or _has_art_space())

func _has_art_space() -> bool:
	return DisplayServer.window_get_size().x >= 1150 and controller.store.values.ui_scale <= 1.15

func _window_resized() -> void:
	_layout_figure()
	if not resize_queued:
		resize_queued = true
		_resize_render.call_deferred()

func _resize_render() -> void:
	resize_queued = false
	if controller != null and content != null: render(controller.screen, false)

func tr_copy(key: String) -> String:
	return Copy.text(key, controller.store.values.locale)

func put(id: String, node: Control) -> Control:
	node.name = id.replace(".", "_")
	controls[id] = node
	node.set_meta("desktop_control_id", id)
	return node

func label(text: String, size: int = 22, muted: bool = false) -> Label:
	var node = Label.new()
	node.text = text
	node.add_theme_font_size_override("font_size", int(size * controller.store.values.ui_scale * metric()))
	if muted: node.add_theme_color_override("font_color", UISkin.colors().muted)
	return node

func button(id: String, text: String, action: String, payload = null, primary: bool = false) -> Button:
	var node = ArtButton.new()
	node.emphasis = primary
	node.reduce_motion = controller.store.values.reduced_motion
	node.text = text
	node.accessibility_name = text
	node.custom_minimum_size = Vector2(0, 48 * metric())
	node.add_theme_font_size_override("font_size", int(22 * controller.store.values.ui_scale * metric()))
	node.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	node.pressed.connect(func(): controller.act(action, payload))
	put(id, node)
	UISkin.ink_button(node, primary)
	return node

func _rule(parent: Node, width: float = 76.0) -> void:
	var stroke = TextureRect.new()
	stroke.texture = GameData.ART.brush
	stroke.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	stroke.custom_minimum_size = Vector2(width, 3) * metric()
	stroke.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	stroke.modulate = Color(UISkin.colors()[controller.config.id], 0.56)
	stroke.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(stroke)

func _space(parent: Node, height: float) -> void:
	var spacer = Control.new()
	spacer.custom_minimum_size.y = height * metric()
	spacer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(spacer)

func _scroll(parent: Node, key: String) -> ScrollContainer:
	var scroller = ScrollContainer.new()
	scroller.set_meta("scroll_key", key)
	scroller.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroller.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroller.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	parent.add_child(scroller)
	scrollers.append(scroller)
	return scroller

func _flow(parent: Node) -> HFlowContainer:
	var flow = HFlowContainer.new()
	flow.add_theme_constant_override("h_separation", 8)
	flow.add_theme_constant_override("v_separation", 4)
	parent.add_child(flow)
	return flow

func _small_action(id: String, text: String, action: String, primary: bool = false) -> Button:
	var item = button(id, text, action, null, primary)
	item.add_theme_font_size_override("font_size", int(18 * controller.store.values.ui_scale * metric()))
	return item

func box(parent: Node, vertical: bool = true, gap: int = 10) -> BoxContainer:
	var node: BoxContainer = VBoxContainer.new() if vertical else HBoxContainer.new()
	node.add_theme_constant_override("separation", gap)
	parent.add_child(node)
	return node

func clear() -> void:
	_finish_motion()
	if tab_tween: tab_tween.kill()
	for scroller in scrollers:
		if is_instance_valid(scroller): scroll_history[scroller.get_meta("scroll_key")] = scroller.scroll_vertical
	scrollers.clear()
	title_reveals.clear()
	loading_steps.clear()
	var focused = get_viewport().gui_get_focus_owner()
	focus_hint = str(focused.get_meta("desktop_control_id", "")) if is_instance_valid(focused) else ""
	if not focus_hint.is_empty() and not current_screen.is_empty(): focus_history[current_screen] = focus_hint
	controls.clear()
	for child in content.get_children():
		content.remove_child(child)
		child.queue_free()
	status_label = null
	progress_bar = null
	loading_label = null
	progress_number = null
	display_countdown = null

func render(screen: String, animate: bool = true) -> void:
	var previous = current_screen
	var changed_tab = screen == "settings" and controller.settings_tab != last_tab
	clear()
	render_serial += 1
	focus_hint = str(focus_history.get(screen, focus_hint))
	current_screen = screen
	root.theme = UISkin.make_theme(controller.store.values.ui_scale * metric())
	root.mouse_filter = Control.MOUSE_FILTER_STOP
	# Detailed preferences use the game's own cover art, so live HUD text cannot
	# bleed through settings. Pause itself keeps the actual frozen game visible.
	background.visible = not controller.game_active or screen in ["menu", "settings", "load", "credits", "display_confirm", "new_confirm", "leave_confirm"]
	veil.visible = true
	var detail = screen in ["settings", "display_confirm", "load", "credits", "new_confirm", "leave_confirm"]
	veil.material.set_shader_parameter("left_alpha", 0.995)
	veil.material.set_shader_parameter("right_alpha", 0.70 if detail else 0.10)
	veil.material.set_shader_parameter("edge", 0.62 if detail else 0.28)
	if background.visible:
		veil.material.set_shader_parameter("paper", UISkin.colors().paper)
		veil.color = Color.WHITE
	else:
		veil.material.set_shader_parameter("paper", UISkin.colors().paper)
	root.show()
	_layout_figure()
	tab_marker.visible = screen == "settings"
	if is_instance_valid(controller.file_dialog): controller.file_dialog.theme = root.theme
	if screen in ["menu", "pause"]: _menu(screen)
	elif screen == "settings": _settings()
	elif screen == "loading": _loading()
	elif screen == "load": _load()
	elif screen == "credits": _credits()
	elif screen == "new_confirm": _confirmation("new_confirm", "new_warning", "start", "new_confirmed")
	elif screen == "leave_confirm": _confirmation("quit", "unsaved_back", "quit", "leave_confirmed")
	elif screen == "display_confirm": _display_confirmation()
	elif screen == "play":
		root.hide()
		return
	var hint = label(tr_copy("menu_hint"), 14, true)
	hint.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	hint.position = Vector2(get_viewport().get_visible_rect().size.x * 0.065, -28 * metric())
	content.add_child(hint)
	footer = hint
	_finish_layout.call_deferred(render_serial, animate and previous != screen, animate and changed_tab and previous == "settings")
	last_tab = controller.settings_tab

func _finish_motion() -> void:
	for tween in entrance_tweens:
		if tween: tween.kill()
	entrance_tweens.clear()
	for origin in entrance_origins:
		if is_instance_valid(origin.node):
			origin.node.position = origin.position
			origin.node.modulate.a = origin.get("alpha", 1.0)
	entrance_origins.clear()

func motion_preferences_changed() -> void:
	if controller.store.values.reduced_motion:
		_finish_motion()
		if tab_tween: tab_tween.kill()
	for node in controls.values():
		if is_instance_valid(node) and node is ArtButton:
			node.reduce_motion = controller.store.values.reduced_motion
			if node.reduce_motion: node.settle_motion()
	if controller.screen == "settings": _position_tab_marker(false)

func _finish_layout(serial: int, enter: bool, switch_tab: bool) -> void:
	await get_tree().process_frame
	if serial != render_serial: return
	for scroller in scrollers:
		if is_instance_valid(scroller): scroller.scroll_vertical = int(scroll_history.get(scroller.get_meta("scroll_key"), 0))
	_focus_first()
	if current_screen == "settings": _position_tab_marker(switch_tab)
	if not enter or controller.store.values.reduced_motion: return
	if background.visible:
		for art in [background, hero]:
			if not art.visible: continue
			var opacity = art.modulate.a
			entrance_origins.append({"node": art, "position": art.position, "alpha": opacity})
			art.modulate.a = opacity * 0.82
			var dissolve = create_tween().bind_node(art).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
			dissolve.tween_property(art, "modulate:a", opacity, 0.24)
			entrance_tweens.append(dissolve)
	for i in range(title_reveals.size()):
		var node = title_reveals[i]
		if not is_instance_valid(node): continue
		var original = node.position
		entrance_origins.append({"node": node, "position": original})
		node.position.y += 12 * metric()
		node.modulate.a = 0.2
		var tween = create_tween().bind_node(node).set_parallel(true).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
		tween.tween_property(node, "position", original, 0.28).set_delay(i * 0.035)
		tween.tween_property(node, "modulate:a", 1.0, 0.24).set_delay(i * 0.035)
		entrance_tweens.append(tween)

func _position_tab_marker(animate: bool) -> void:
	var key = ["display", "audio", "controls", "interface"][controller.settings_tab]
	var target = controls.get("tabs." + key)
	if not is_instance_valid(target): return
	var rect = target.get_global_rect()
	var width = target.get_theme_font("font").get_string_size(target.text, HORIZONTAL_ALIGNMENT_LEFT, -1, target.get_theme_font_size("font_size")).x + 12 * metric()
	var point = Vector2(rect.position.x + (rect.size.x - width) * 0.5, rect.end.y - 3 * metric())
	var extent = Vector2(width, 3 * metric())
	if tab_tween: tab_tween.kill()
	if not animate or controller.store.values.reduced_motion:
		tab_marker.position = point
		tab_marker.size = extent
	else:
		tab_tween = create_tween().set_parallel(true).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
		tab_tween.tween_property(tab_marker, "position", point, 0.18)
		tab_tween.tween_property(tab_marker, "size", extent, 0.18)

func _focus_first() -> void:
	if controls.has(focus_hint):
		var target = controls[focus_hint]
		if is_instance_valid(target) and target.visible and not (target is Button and target.disabled):
			target.grab_focus()
			return
	var first = null
	for node in controls.values():
		if is_instance_valid(node) and node is Button and node.visible and not node.disabled:
			if first == null: first = node
	if first != null: first.grab_focus()

func _frame(left: float, top: float, right: float, bottom: float) -> VBoxContainer:
	var margin = MarginContainer.new()
	margin.anchor_left = left
	margin.anchor_top = top
	margin.anchor_right = right
	margin.anchor_bottom = bottom
	content.add_child(margin)
	return box(margin)

func _title(parent: Node, text: String, size: int = 44) -> void:
	var title = label(text, size)
	if size >= 65 and controller.store.values.locale == "en":
		title.text = "Journey to\nthe West" if controller.config.id == "xiyou" else "Water\nMargin"
		title.add_theme_font_size_override("font_size", int(52 * controller.store.values.ui_scale * metric()))
	if controller.store.values.locale != "en": title.add_theme_font_override("font", UISkin.title_font())
	if size >= 65:
		var font = title.get_theme_font("font")
		var font_size = title.get_theme_font_size("font_size")
		var available = get_viewport().get_visible_rect().size.x * 0.31
		var measured = 0.0
		for line in title.text.split("\n"): measured = maxf(measured, font.get_string_size(line, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x)
		if measured > available: title.add_theme_font_size_override("font_size", floori(font_size * available / measured))
	var clip = Control.new()
	clip.clip_contents = true
	clip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(clip)
	clip.add_child(title)
	clip.custom_minimum_size.y = title.get_combined_minimum_size().y + 6 * metric()
	title.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	title_reveals.append(title)

func _menu(screen: String) -> void:
	var info = controller.game_info()
	var frame = _frame(0.065, 0.10, 0.435, 0.91)
	var scroller = _scroll(frame, "main." + screen)
	var column = box(scroller, true, 9)
	column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	column.add_child(label("FOUR CLASSICS  /  " + controller.config.series, 13, true))
	if screen == "pause":
		_title(column, tr_copy("pause"), 46)
		column.add_child(label(controller.config.title, 18, true))
	else:
		_title(column, controller.localized("title"), 70)
		var tagline = label(controller.localized("tagline"), 18, true)
		tagline.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		column.add_child(tagline)
		if info.has("mode_label"):
			var mode = label(str(info.mode_label), 15, true)
			mode.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			column.add_child(mode)
	_rule(column)
	_space(column, 8)
	if screen == "menu":
		var continue_button = button("menu.continue", tr_copy("continue"), "continue", null, bool(info.get("has_save", false)))
		continue_button.disabled = not info.get("has_save", false)
		continue_button.tooltip_text = tr_copy("no_save") if continue_button.disabled else str(info.get("save_summary", ""))
		continue_button.alignment = HORIZONTAL_ALIGNMENT_LEFT
		continue_button.add_theme_font_size_override("font_size", int((26 if info.get("has_save", false) else 22) * controller.store.values.ui_scale * metric()))
		column.add_child(continue_button)
		var begin = button("menu.new", tr_copy("new_game"), "new", null, not info.get("has_save", false))
		begin.alignment = HORIZONTAL_ALIGNMENT_LEFT
		if not info.get("has_save", false): begin.add_theme_font_size_override("font_size", int(26 * controller.store.values.ui_scale * metric()))
		column.add_child(begin)
		var load_action = button("menu.load", tr_copy("load"), "show_load")
		load_action.alignment = HORIZONTAL_ALIGNMENT_LEFT
		column.add_child(load_action)
	else:
		var resume = button("pause.resume", tr_copy("resume"), "resume", null, true)
		resume.alignment = HORIZONTAL_ALIGNMENT_LEFT
		resume.add_theme_font_size_override("font_size", int(26 * controller.store.values.ui_scale * metric()))
		column.add_child(resume)
		var save = button("pause.save", tr_copy("save"), "save")
		save.alignment = HORIZONTAL_ALIGNMENT_LEFT
		save.disabled = not info.get("can_save", false)
		save.tooltip_text = str(info.get("save_reason", ""))
		column.add_child(save)
		var return_action = button("pause.menu", tr_copy("main_menu"), "main_menu")
		return_action.alignment = HORIZONTAL_ALIGNMENT_LEFT
		column.add_child(return_action)
	var summary_text = tr_copy("local_save") + " · " + str(info.get("save_summary", "")) if info.get("has_save", false) else tr_copy("no_save")
	if screen == "pause" and not info.get("has_save", false): summary_text = tr_copy("unsaved_journey")
	var summary = label(summary_text, 14, true)
	summary.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	column.add_child(summary)
	_space(column, 10)
	var utility = _flow(column)
	utility.add_child(_small_action(screen + ".settings", tr_copy("settings"), "show_settings"))
	if screen == "menu": utility.add_child(_small_action("menu.credits", tr_copy("credits"), "credits"))
	utility.add_child(_small_action(screen + ".quit", tr_copy("quit"), "quit"))
	status_label = label(controller.message, 15, true)
	status_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	status_label.visible = not controller.message.is_empty()
	column.add_child(status_label)

func _settings() -> void:
	var outer = _frame(0.065, 0.06, 0.935, 0.92)
	outer.add_child(label(controller.localized("title") + "  /  " + tr_copy("settings_intro"), 14, true))
	_title(outer, tr_copy("settings"), 42)
	var tabs = box(outer, false, 16)
	var titles = ["display", "audio", "controls", "interface"]
	for i in range(titles.size()):
		var b = button("tabs." + titles[i], tr_copy(titles[i]), "settings_tab", i, controller.settings_tab == i)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.role = "tab"
		b.add_theme_font_size_override("font_size", int(20 * controller.store.values.ui_scale * metric()))
		tabs.add_child(b)
	var explanation = label(tr_copy(titles[controller.settings_tab] + "_help"), 16, true)
	explanation.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	outer.add_child(explanation)
	var body = box(outer, false, 24)
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var scroller = _scroll(body, "settings." + str(controller.settings_tab))
	scroller.custom_minimum_size.y = 100 * metric()
	if _has_art_space():
		var art_space = Control.new()
		art_space.custom_minimum_size.x = get_viewport().get_visible_rect().size.x * 0.20
		art_space.mouse_filter = Control.MOUSE_FILTER_IGNORE
		body.add_child(art_space)
	var list = box(scroller, true, 10)
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var draft = controller.draft
	if controller.settings_tab == 0:
		_option(list, "window_mode", ["windowed", "borderless", "fullscreen"], [tr_copy("windowed"), tr_copy("borderless"), tr_copy("fullscreen")], draft.window_mode)
		_option(list, "resolution", ["1280x720", "1600x900", "1920x1080", "2560x1440"], ["1280 × 720", "1600 × 900", "1920 × 1080", "2560 × 1440"], draft.resolution)
		_toggle(list, "vsync", draft.vsync)
		_option(list, "fps", [30, 60, 120, 0], ["30", "60", "120", tr_copy("unlimited")], draft.fps)
	elif controller.settings_tab == 1:
		for key in ["master", "music", "effects", "voice"]: _slider(list, key, draft[key], 0.0, 1.0, 0.05)
	elif controller.settings_tab == 2:
		for action in controller.config.actions:
			var row = _row(list, tr_copy(action.trim_prefix("cfg_")))
			var b = button("binding." + action, controller.store.key_label(action, draft), "capture", action)
			b.custom_minimum_size.x = 190
			row.add_child(b)
	elif controller.settings_tab == 3:
		_option(list, "locale", ["zh-CN", "zh-TW", "en"], ["简体中文", "繁體中文", "English"], draft.locale)
		_slider(list, "ui_scale", draft.ui_scale, 0.9, 1.3, 0.05)
		_toggle(list, "reduced_motion", draft.reduced_motion)
	status_label = label(controller.message if not controller.message.is_empty() else tr_copy("pending") if controller.is_dirty() else "", 15, true)
	status_label.custom_minimum_size.y = 25 * metric()
	status_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	outer.add_child(status_label)
	var actions = _flow(outer)
	actions.add_child(_small_action("settings.defaults", tr_copy("defaults"), "defaults"))
	actions.add_child(_small_action("settings.cancel", tr_copy("cancel"), "cancel_settings"))
	actions.add_child(_small_action("settings.apply", tr_copy("apply"), "apply_settings", true))
	actions.add_child(_small_action("settings.back", tr_copy("back"), "back_settings"))

func _row(parent: Node, text: String) -> HBoxContainer:
	var row = box(parent, false, 24)
	row.custom_minimum_size.y = 52 * metric()
	var name_label = label(text)
	name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name_label.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(name_label)
	return row

func _option(parent: Node, key: String, values: Array, labels: Array, selected) -> void:
	var row = _row(parent, tr_copy(key))
	var choice = OptionButton.new()
	choice.custom_minimum_size = Vector2(280, 46) * metric()
	choice.accessibility_name = tr_copy(key)
	for text in labels: choice.add_item(str(text))
	choice.select(maxi(0, values.find(selected)))
	choice.item_selected.connect(func(index): controller.edit_setting(key, values[index]))
	put("settings." + key, choice)
	row.add_child(choice)

func _toggle(parent: Node, key: String, value: bool) -> void:
	var row = _row(parent, tr_copy(key))
	var toggle = ArtButton.new()
	toggle.toggle_mode = true
	toggle.reduce_motion = controller.store.values.reduced_motion
	toggle.text = tr_copy("on") if value else tr_copy("off")
	toggle.accessibility_name = tr_copy(key) + " · " + toggle.text
	toggle.button_pressed = value
	toggle.custom_minimum_size = Vector2(140, 46) * metric()
	UISkin.ink_button(toggle, value)
	toggle.emphasis = value
	toggle.toggled.connect(func(pressed):
		toggle.text = tr_copy("on") if pressed else tr_copy("off")
		toggle.accessibility_name = tr_copy(key) + " · " + toggle.text
		toggle.emphasis = pressed
		UISkin.ink_button(toggle, pressed)
		controller.edit_setting(key, pressed))
	put("settings." + key, toggle)
	row.add_child(toggle)

func _slider(parent: Node, key: String, value: float, minimum: float, maximum: float, step: float) -> void:
	var row = _row(parent, tr_copy(key))
	var slider = HSlider.new()
	slider.min_value = minimum
	slider.max_value = maximum
	slider.step = step
	slider.value = value
	slider.accessibility_name = tr_copy(key)
	slider.custom_minimum_size = Vector2(260, 46) * metric()
	put("settings." + key, slider)
	var number = label("%d%%" % roundi(value * 100), 16, true)
	number.custom_minimum_size.x = 70 * metric()
	slider.value_changed.connect(func(updated):
		number.text = "%d%%" % roundi(updated * 100)
		controller.edit_setting(key, float(updated)))
	row.add_child(slider)
	row.add_child(number)

func _loading() -> void:
	var column = _frame(0.065, 0.20, 0.51, 0.88)
	column.add_child(label(controller.localized("title"), 18, true))
	_title(column, tr_copy("loading"), 54)
	_rule(column)
	_space(column, 18)
	loading_label = label(tr_copy("loading_detail"), 18, true)
	loading_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	column.add_child(loading_label)
	var progress = box(column, false, 18)
	progress_bar = ProgressBar.new()
	progress_bar.custom_minimum_size = Vector2(0, 4) * metric()
	progress_bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	progress_bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	progress_bar.show_percentage = false
	progress.add_child(progress_bar)
	progress_number = label("0%", 28)
	progress_number.custom_minimum_size.x = 85 * metric()
	progress_number.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	progress.add_child(progress_number)
	var stages = box(column, false, 24)
	for phase in ["load_assets", "load_prepare"]:
		var stage = label(tr_copy(phase), 15, true)
		stages.add_child(stage)
		loading_steps.append(stage)
	_space(column, 12)
	status_label = label(controller.message, 17, true)
	status_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	column.add_child(status_label)
	if controller.loading_failed:
		column.add_child(button("loading.retry", tr_copy("retry"), "retry", null, true))
	column.add_child(_small_action("loading.back", tr_copy("main_menu"), "cancel_loading"))

func update_loading(value: float, detail: String) -> void:
	if is_instance_valid(progress_bar): progress_bar.value = clampf(value, 0.0, 100.0)
	if is_instance_valid(progress_number): progress_number.text = "%d%%" % floori(clampf(value, 0.0, 100.0))
	if is_instance_valid(loading_label): loading_label.text = detail
	for i in range(loading_steps.size()):
		var active = i == (1 if value >= 100.0 else 0)
		loading_steps[i].add_theme_color_override("font_color", UISkin.colors()[controller.config.id] if active else UISkin.colors().muted)

func _load() -> void:
	var column = _frame(0.065, 0.12, 0.64, 0.89)
	column.add_child(label(controller.localized("title") + "  /  " + tr_copy("local_save"), 15, true))
	_title(column, tr_copy("choose_save"), 42)
	_rule(column)
	var slots = controller.game_info().get("slots", [])
	var scroller = _scroll(column, "save_browser")
	var list = box(scroller)
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	if slots.is_empty():
		list.add_child(label(tr_copy("save_empty"), 20, true))
		var empty_hint = label(tr_copy("save_empty_hint"), 16, true)
		empty_hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		list.add_child(empty_hint)
		list.add_child(button("load.new", tr_copy("new_game"), "new", null, true))
	for i in range(slots.size()):
		var slot = slots[i]
		var text = str(slot.get("label", slot.get("summary", tr_copy("local_save"))))
		var action = button("load.slot%d" % i, text, "load_slot", str(slot.get("path", "")), true)
		action.alignment = HORIZONTAL_ALIGNMENT_LEFT
		action.clip_text = true
		action.tooltip_text = text
		list.add_child(action)
		var description = label(str(slot.get("summary", text)), 15, true)
		description.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		list.add_child(description)
		_rule(list, 44)
	if controller.game_info().get("can_import", false):
		list.add_child(button("load.import", tr_copy("import"), "import"))
		var description = label(str(controller.game_info().get("import_description", "")), 16, true)
		description.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		list.add_child(description)
	status_label = label(controller.message, 16, true)
	status_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	column.add_child(status_label)
	column.add_child(button("load.back", tr_copy("back"), "back"))

func _credits() -> void:
	var column = _frame(0.07, 0.13, 0.73, 0.88)
	_title(column, tr_copy("credits"), 42)
	var text = label(tr_copy("credits_text"), 21)
	text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	column.add_child(text)
	column.add_child(button("credits.back", tr_copy("back"), "back"))

func _confirmation(title: String, description: String, positive: String, action: String) -> void:
	var column = _frame(0.10, 0.22, 0.69, 0.82)
	_title(column, tr_copy(title), 40)
	var explanation = label(tr_copy(description), 20)
	explanation.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	column.add_child(explanation)
	column.add_child(button("confirm.yes", tr_copy(positive), action, null, true))
	column.add_child(button("confirm.no", tr_copy("back"), "back"))

func _display_confirmation() -> void:
	_confirmation("keep_display", "pending", "keep", "keep_display")
	display_countdown = label("", 22)
	content.get_child(0).get_child(0).add_child(display_countdown)
	var revert = button("display.revert", tr_copy("revert"), "revert_display")
	content.get_child(0).get_child(0).add_child(revert)

func set_status(text: String) -> void:
	if is_instance_valid(status_label):
		status_label.text = text
		status_label.visible = current_screen == "settings" or not text.is_empty()
