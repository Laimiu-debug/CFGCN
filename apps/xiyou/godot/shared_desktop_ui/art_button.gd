extends Button
## A text action with a small ink cue; the full native hit area remains intact.

const UISkin = preload("res://shared_desktop_ui/theme.gd")
const Data = preload("res://shared_desktop_ui/game_data.gd")
var emphasis = false
var role = "action"
var reduce_motion = false
var interest = 0.0
var cue_tween: Tween

func _ready() -> void:
	focus_mode = Control.FOCUS_ALL
	mouse_entered.connect(_cue_changed)
	mouse_exited.connect(_cue_changed)
	focus_entered.connect(_cue_changed)
	focus_exited.connect(_cue_changed)
	resized.connect(queue_redraw)
	_cue_changed()

func _exit_tree() -> void:
	if cue_tween: cue_tween.kill()

func settle_motion() -> void:
	if cue_tween: cue_tween.kill()
	interest = 1.0 if has_focus() or is_hovered() else 0.0
	queue_redraw()

func _cue_changed() -> void:
	if cue_tween: cue_tween.kill()
	var target = 1.0 if has_focus() or is_hovered() else 0.0
	if reduce_motion:
		interest = target
		queue_redraw()
		return
	cue_tween = create_tween().set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	cue_tween.tween_method(func(value): interest = value; queue_redraw(), interest, target, 0.16)

func _draw() -> void:
	if disabled: return
	var c = UISkin.colors()
	var accent = c[Data.CONFIG.id]
	var strength = maxf(0.28 if emphasis else 0.0, interest)
	if has_focus():
		# One open stroke marks keyboard focus; it never becomes a panel border.
		draw_line(Vector2(4, size.y * 0.36), Vector2(4, size.y * 0.64), c.gold, 2.0, true)
	if role == "tab" or strength <= 0.001: return
	var text_width = get_theme_font("font").get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, get_theme_font_size("font_size")).x
	var width = minf(maxf(26.0, text_width * (0.35 + 0.65 * interest)), maxf(0.0, size.x - 38.0))
	var x = 22.0 if alignment == HORIZONTAL_ALIGNMENT_LEFT else (size.x - width) * 0.5
	draw_texture_rect(Data.ART.brush, Rect2(x, size.y - 6.0, width, 3.0), false, Color(accent, strength * 0.82))
