extends RefCounted

const GameData = preload("res://shared_desktop_ui/game_data.gd")

static func palette() -> Dictionary:
	return GameData.PALETTE

static func colors() -> Dictionary:
	var data = palette()
	var result = {}
	for key in data: result[key] = Color(data[key])
	return result

static func body_font() -> Font:
	var font = SystemFont.new()
	font.font_names = PackedStringArray(["Microsoft YaHei UI", "Microsoft YaHei", "Noto Serif SC", "SimSun"])
	return font

static func title_font() -> Font:
	var fonts: Array[Font] = []
	for font in GameData.TITLE_FONTS:
		font.allow_system_fallback = false
		fonts.append(font)
	if fonts.is_empty(): return body_font()
	var primary = fonts.pop_front()
	var calligraphy_fallback = SystemFont.new()
	calligraphy_fallback.font_names = PackedStringArray(["KaiTi", "STKaiti", "FangSong", "SimSun"])
	fonts.append(calligraphy_fallback)
	fonts.append(body_font())
	primary.fallbacks = fonts
	return primary

static func make_theme(scale_factor: float = 1.0) -> Theme:
	var c = colors()
	var theme = Theme.new()
	theme.default_font = body_font()
	theme.default_font_size = int(22 * scale_factor)
	for type in ["Label", "Button", "CheckButton", "CheckBox", "OptionButton", "LineEdit", "TabBar"]:
		theme.set_color("font_color", type, c.ink)
		theme.set_color("font_hover_color", type, c.ink)
		theme.set_color("font_focus_color", type, c.ink)
		theme.set_color("font_disabled_color", type, c.muted)
	var plain = StyleBoxFlat.new()
	plain.bg_color = Color.TRANSPARENT
	plain.border_color = Color(c.line, 0.6)
	plain.border_width_bottom = 1
	plain.set_content_margin_all(12)
	var hover = plain.duplicate()
	hover.bg_color = Color.TRANSPARENT
	hover.border_color = c.jade
	hover.border_width_bottom = 2
	var focus = StyleBoxFlat.new()
	focus.bg_color = Color.TRANSPARENT
	focus.border_color = c.gold
	focus.border_width_bottom = 2
	focus.set_expand_margin_all(1)
	for type in ["Button", "OptionButton"]:
		theme.set_stylebox("normal", type, plain)
		theme.set_stylebox("hover", type, hover)
		theme.set_stylebox("pressed", type, hover)
		theme.set_stylebox("focus", type, focus)
		var disabled = plain.duplicate()
		disabled.border_color.a = 0.25
		theme.set_stylebox("disabled", type, disabled)
		theme.set_constant("h_separation", type, 12)
	var popup = StyleBoxFlat.new()
	popup.bg_color = c.paper
	popup.set_content_margin_all(10)
	theme.set_stylebox("panel", "PopupMenu", popup)
	theme.set_color("font_color", "PopupMenu", c.ink)
	theme.set_color("font_hover_color", "PopupMenu", c.paper)
	var popup_hover = hover.duplicate()
	popup_hover.bg_color = c.jade
	theme.set_stylebox("hover", "PopupMenu", popup_hover)
	var slider = StyleBoxFlat.new()
	slider.bg_color = Color(c.line, 0.8)
	slider.content_margin_top = 2
	slider.content_margin_bottom = 2
	var grabber = slider.duplicate()
	grabber.bg_color = c.jade
	theme.set_stylebox("slider", "HSlider", slider)
	theme.set_stylebox("grabber_area", "HSlider", grabber)
	theme.set_stylebox("grabber_area_highlight", "HSlider", grabber)
	var track = StyleBoxFlat.new()
	track.bg_color = Color(c.jade, 0.12)
	track.set_content_margin_all(0)
	var fill = track.duplicate()
	fill.bg_color = c[GameData.CONFIG.id]
	theme.set_stylebox("background", "ProgressBar", track)
	theme.set_stylebox("fill", "ProgressBar", fill)
	var paper = StyleBoxFlat.new()
	paper.bg_color = c.paper
	paper.set_content_margin_all(12)
	theme.set_stylebox("panel", "Panel", paper)
	theme.set_stylebox("panel", "PanelContainer", paper)
	var tooltip = paper.duplicate()
	tooltip.shadow_color = Color(c.ink, 0.12)
	tooltip.shadow_size = 5
	theme.set_stylebox("panel", "TooltipPanel", tooltip)
	theme.set_color("font_color", "TooltipLabel", c.ink)
	theme.set_font_size("font_size", "TooltipLabel", int(16 * scale_factor))
	var rail = StyleBoxEmpty.new()
	rail.set_content_margin_all(2)
	var thumb = StyleBoxFlat.new()
	thumb.bg_color = Color(c.jade, 0.32)
	thumb.content_margin_left = 2
	thumb.content_margin_right = 2
	for state in ["scroll", "scroll_focus"]: theme.set_stylebox(state, "VScrollBar", rail)
	for state in ["grabber", "grabber_highlight", "grabber_pressed"]: theme.set_stylebox(state, "VScrollBar", thumb)
	return theme

static func ink_button(button: Button, primary: bool) -> void:
	var c = colors()
	var accent = c[GameData.CONFIG.id]
	for state in ["normal", "hover", "pressed", "disabled", "focus"]:
		var style = StyleBoxEmpty.new()
		style.content_margin_left = 22
		style.content_margin_right = 16
		style.content_margin_top = 8
		style.content_margin_bottom = 8
		button.add_theme_stylebox_override(state, style)
	button.add_theme_color_override("font_color", accent if primary else c.ink)
	button.add_theme_color_override("font_hover_color", accent)
	button.add_theme_color_override("font_pressed_color", c.gold)
	button.add_theme_color_override("font_focus_color", accent)
	button.add_theme_color_override("font_disabled_color", Color(c.muted, 0.55))
