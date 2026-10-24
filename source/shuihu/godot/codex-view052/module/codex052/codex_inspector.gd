extends "../ceramic_model_inspector.gd"
## Leave host pause/back and text navigation keys available outside the model controls.
func _gui_input(event:InputEvent)->void:
    if event is InputEventKey and not event.keycode in [KEY_F,KEY_1,KEY_2,KEY_3]:return
    super._gui_input(event)
