shader_type spatial;
render_mode unshaded, cull_disabled, shadows_disabled;
void fragment() {
	// Opaque ordinary depth, preserving scenery/character occlusion.
	ALBEDO = COLOR.rgb;
}
