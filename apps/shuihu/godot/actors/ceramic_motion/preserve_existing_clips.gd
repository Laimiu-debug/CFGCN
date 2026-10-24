@tool
extends EditorScenePostImport

# Preserve the already authored six-clip sources while Godot replaces the old
# runtime. These are existing local rigs, not newly downloaded Tripo presets.
func _post_import(scene: Node) -> Object:
	var source := get_source_file()
	var recipe = JSON.parse_string(FileAccess.get_file_as_string(source.get_basename() + ".curves.json"))
	if not recipe is Dictionary or recipe.get("source_sha256") != FileAccess.get_sha256(source):
		push_error("Existing-motion source SHA or recipe differs: " + source)
		return scene
	var skeletons := scene.find_children("*", "Skeleton3D", true, false)
	if skeletons.size() != 1:
		push_error("Expected one retained character skeleton")
		return scene
	var skeleton: Skeleton3D = skeletons[0]
	var restored := 0
	for entry in recipe.animations:
		var players := scene.find_children("*", "AnimationPlayer", true, false).filter(func(node): return node.has_animation(entry.clip))
		if players.size() != 1:
			push_error("Expected one source clip player: " + str(entry.clip))
			return scene
		var player: AnimationPlayer = players[0]
		var animation := player.get_animation(entry.clip)
		var animation_root := player.get_node(player.root_node)
		var skeleton_path := str(animation_root.get_path_to(skeleton))
		for curve in entry.curves:
			if skeleton.find_bone(curve.bone) == -1:
				push_error("Unknown source bone: " + str(curve.bone))
				return scene
			var type: Animation.TrackType = Animation.TYPE_POSITION_3D
			if curve.property == "rotation":
				type = Animation.TYPE_ROTATION_3D
			elif curve.property == "scale":
				type = Animation.TYPE_SCALE_3D
			var path := NodePath(skeleton_path + ":" + str(curve.bone))
			var track := animation.find_track(path, type)
			if track == -1:
				track = animation.add_track(type)
				animation.track_set_path(track, path)
			else:
				for index in range(animation.track_get_key_count(track) - 1, -1, -1):
					animation.track_remove_key(track, index)
			animation.track_set_interpolation_type(track, Animation.INTERPOLATION_NEAREST if curve.interpolation == "STEP" else Animation.INTERPOLATION_LINEAR)
			animation.track_set_interpolation_loop_wrap(track, false)
			for index in curve.times.size():
				var value: Array = curve.values[index]
				var seconds := float(curve.times[index])
				if type == Animation.TYPE_ROTATION_3D:
					animation.rotation_track_insert_key(track, seconds, Quaternion(value[0], value[1], value[2], value[3]).normalized())
				elif type == Animation.TYPE_POSITION_3D:
					animation.position_track_insert_key(track, seconds, Vector3(value[0], value[1], value[2]))
				else:
					animation.scale_track_insert_key(track, seconds, Vector3(value[0], value[1], value[2]))
			restored += 1
	scene.set_meta("retained_source_clip_count", recipe.animations.size())
	scene.set_meta("retained_source_curve_count", restored)
	scene.set_meta("retained_source_sha256", recipe.source_sha256)
	print("RETAINED_MOTION_IMPORT ", source.get_file(), " clips=", recipe.animations.size(), " curves=", restored)
	return scene
