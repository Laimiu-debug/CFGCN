extends "res://actors/ceramic_motion/ceramic_actor.gd"

# Retarget only the independently skinned arrow. The retained body, original
# bow/string timing, host movement and authoritative rules remain unchanged.
var projectile_target := Vector3.ZERO
var has_projectile_target := false

func set_projectile_target(world_point: Vector3) -> void:
	if not world_point.is_finite(): return
	projectile_target = world_point
	has_projectile_target = true

func clear_projectile_target() -> void:
	has_projectile_target = false

func capture_state() -> Dictionary:
	var state := super.capture_state()
	state.projectile_target = [projectile_target.x, projectile_target.y, projectile_target.z]
	state.has_projectile_target = has_projectile_target
	return state

func restore_state(state: Dictionary) -> bool:
	var point: Variant = state.get("projectile_target", [0.0, 0.0, 0.0])
	if not point is Array or point.size() != 3: return _fail("Invalid saved arrow target")
	for value: Variant in point:
		if not (value is int or value is float) or not is_finite(float(value)): return _fail("Invalid saved arrow target")
	var before := projectile_target
	var was_set := has_projectile_target
	projectile_target = Vector3(float(point[0]), float(point[1]), float(point[2]))
	has_projectile_target = bool(state.get("has_projectile_target", false))
	if super.restore_state(state): return true
	projectile_target = before; has_projectile_target = was_set
	return false

func _sample_pose(time: float) -> void:
	super._sample_pose(time)
	if not has_projectile_target or active_semantic != &"attack": return
	var definition: Dictionary = descriptor.get("projectile_presentation", {})
	var release := float(definition.get("release_seconds", 0.32))
	var contact := float(definition.get("contact_seconds", 0.48))
	var clip_time := float(animation_player.current_animation_position)
	if clip_time < release or clip_time >= 0.8 or contact <= release: return
	var index := skeleton.find_bone("Projectile")
	if index < 0: return
	# Sample the retained release pose, then restore the body before overriding
	# this one arrow bone. Seeking cannot emit events or spend rules resources.
	animation_player.seek(release, true, true)
	var release_pose := skeleton.global_transform * skeleton.get_bone_global_pose(index)
	animation_player.seek(clip_time, true, true)
	var bind: Transform3D = skeleton.global_transform * skeleton.get_bone_global_rest(index)
	var tip: Array = definition.get("tip_bind_gltf", [])
	var tail: Array = definition.get("nock_bind_gltf", [])
	if tip.size() != 3 or tail.size() != 3: return
	var source_tip := Vector3(float(tip[0]), float(tip[1]), float(tip[2]))
	var source_tail := Vector3(float(tail[0]), float(tail[1]), float(tail[2]))
	# Bind coordinates belong to the retained model, before its wrapper/scale.
	var to_world := skeleton.global_transform * skeleton.get_bone_global_pose(index)
	var release_delta := release_pose * bind.affine_inverse() * skeleton.global_transform
	var release_tip := release_delta * source_tip
	var release_tail := release_delta * source_tail
	var direction := projectile_target - release_tip
	if direction.length_squared() < 0.00000001: return
	var rotation := Quaternion((release_tip - release_tail).normalized(), direction.normalized())
	var desired_basis := Basis(rotation) * release_pose.basis
	var tip_from_bone := release_pose.basis.inverse() * (release_tip - release_pose.origin)
	var fraction := (clip_time - release) / (contact - release)
	var desired_tip := release_tip.lerp(projectile_target, fraction)
	to_world = Transform3D(desired_basis, desired_tip - desired_basis * tip_from_bone)
	skeleton.set_bone_global_pose(index, skeleton.global_transform.affine_inverse() * to_world)
