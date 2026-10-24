shader_type spatial;
render_mode unshaded, cull_disabled;
uniform sampler2D atlas : source_color, filter_linear_mipmap, repeat_disable;
uniform sampler2D poses : filter_nearest, repeat_disable;
uniform sampler2D hit_poses : filter_nearest, repeat_disable;
uniform float hit_frame_span = 1.0;
uniform vec4 tint : source_color = vec4(1.0);
uniform float alpha_cutoff = 0.42;
uniform bool reduce_hit_motion = false;
varying float actual_hit_pulse;
void vertex() {
	// Preserve the original half-float-safe source pose lookup exactly.
	int row = int(round(INSTANCE_CUSTOM.x)) + 256 * int(round(INSTANCE_CUSTOM.y));
	vec3 a = texelFetch(poses, ivec2(VERTEX_ID,row),0).xyz;
	vec3 b = texelFetch(poses, ivec2(VERTEX_ID,row+1),0).xyz;
	VERTEX = mix(a,b,INSTANCE_CUSTOM.z);
	actual_hit_pulse = clamp(abs(INSTANCE_CUSTOM.w),0.0,1.0);
	if (!reduce_hit_motion && actual_hit_pulse > 0.0001) {
		float phase = 1.0 - sqrt(actual_hit_pulse);
		float frame = phase * hit_frame_span;
		int hit_row = min(int(floor(frame)),int(hit_frame_span)-1);
		vec3 hit_a = texelFetch(hit_poses,ivec2(VERTEX_ID,hit_row),0).xyz;
		vec3 hit_b = texelFetch(hit_poses,ivec2(VERTEX_ID,hit_row+1),0).xyz;
		vec3 hit = mix(hit_a,hit_b,frame-float(hit_row));
		// Keep the real walk/attack running; blend a short existing bone recoil.
		VERTEX = mix(VERTEX,hit,sin(phase*3.14159265)*0.45);
	}
}
void fragment() {
	vec4 pixel = texture(atlas,UV) * tint;
	vec3 warm_hit = min(vec3(1.0),pixel.rgb*1.22+vec3(0.08,0.035,0.0));
	ALBEDO = mix(pixel.rgb,warm_hit,actual_hit_pulse*0.75);
	ALPHA = pixel.a;
	ALPHA_SCISSOR_THRESHOLD = alpha_cutoff;
}
