extends Node3D

# The battle owns time, movement, HP, resources, and the persisted event ledger.
# This node presents a pose and requests events; it never applies game rules.
signal action_event(character_id: StringName, action_token: String, event_id: StringName, event_kind: StringName)
signal action_finished(character_id: StringName, action_token: String, semantic: StringName)

@export var character_id: StringName
@export var model_scene: PackedScene
@export_file("*.json") var descriptor_path: String

var model: Node3D
var animation_player: AnimationPlayer
var skeleton: Skeleton3D
var descriptor: Dictionary = {}
var last_error := ""
var paused := false
var active_semantic: StringName = &""
var active_token := ""
var elapsed_seconds := 0.0
var finished := false
var fired_events: Dictionary = {}
var ended_tokens: Dictionary = {}
var _initial_nodes: Dictionary = {}

func _ready() -> void:
	var data = JSON.parse_string(FileAccess.get_file_as_string(descriptor_path))
	if not data is Dictionary or model_scene == null:
		_fail("Missing model or descriptor")
		return
	descriptor = data
	if str(descriptor.id) != str(character_id):
		_fail("Character ID does not match the retained source")
		return
	model = model_scene.instantiate()
	$Visual.add_child(model)
	var players := model.find_children("*", "AnimationPlayer", true, false)
	var skeletons := model.find_children("*", "Skeleton3D", true, false)
	if players.size() != 1 or skeletons.size() != 1:
		_fail("Expected one character AnimationPlayer and Skeleton3D")
		return
	animation_player = players[0]
	skeleton = skeletons[0]
	animation_player.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	animation_player.root_motion_track = NodePath("")
	animation_player.playback_auto_capture = false
	for node in model.find_children("*", "Node3D", true, false):
		if not node is BoneAttachment3D:
			_initial_nodes[node] = node.transform
	for definition in descriptor.animations.values():
		if not animation_player.has_animation(definition.clip):
			_fail("Missing declared animation: " + str(definition.clip))
			return
	start_action(&"idle", "initial-idle")

func start_action(semantic: StringName, token: String) -> bool:
	if animation_player == null or not descriptor.get("animations", {}).has(str(semantic)) or token.is_empty():
		return _fail("Unknown action or missing unique action token")
	if token == active_token:
		return semantic == active_semantic
	if ended_tokens.has(token):
		return _fail("An ended action token cannot be restarted")
	if not active_token.is_empty():
		ended_tokens[active_token] = true
	active_semantic = semantic
	active_token = token
	elapsed_seconds = 0.0
	finished = false
	fired_events.clear()
	_reset_pose()
	animation_player.play(descriptor.animations[str(semantic)].clip, 0.0)
	_sample_pose(0.0)
	last_error = ""
	return true

func set_action_time(seconds: float, emit_events := true) -> bool:
	if animation_player == null or active_token.is_empty() or not is_finite(seconds) or seconds < 0.0:
		return _fail("Invalid authoritative action time")
	if paused:
		return true
	if seconds + 0.0000001 < elapsed_seconds:
		return _fail("Use restore_state for a rewind; action time must be monotonic")
	var definition: Dictionary = descriptor.animations[str(active_semantic)]
	var expected_token := active_token
	var next_time := seconds if definition.get("loop", false) else minf(seconds, float(definition.duration))
	elapsed_seconds = next_time
	_sample_pose(next_time)
	for event in definition.get("events", []):
		if float(event.seconds) <= next_time and not fired_events.has(str(event.id)):
			# A silent replay consumes past events, so it cannot emit them later.
			fired_events[str(event.id)] = true
			if emit_events:
				action_event.emit(character_id, active_token, StringName(event.id), StringName(event.kind))
				if active_token != expected_token:
					return true
	if not definition.get("loop", false) and next_time >= float(definition.duration) and not finished:
		finished = true
		if emit_events:
			action_finished.emit(character_id, active_token, active_semantic)
	return true

func set_paused(value: bool) -> void:
	paused = value

func capture_state() -> Dictionary:
	return {"schema_version": 1, "character_id": str(character_id), "semantic": str(active_semantic),
		"action_token": active_token, "elapsed_seconds": elapsed_seconds, "paused": paused,
		"finished": finished, "fired_events": fired_events.duplicate(true), "ended_tokens": ended_tokens.duplicate(true)}

func restore_state(state: Dictionary) -> bool:
	if state.get("schema_version") != 1 or state.get("character_id") != str(character_id):
		return _fail("Motion state belongs to a different character or version")
	var semantic := str(state.get("semantic", ""))
	var token := str(state.get("action_token", ""))
	var time := float(state.get("elapsed_seconds", -1.0))
	if not descriptor.animations.has(semantic) or token.is_empty() or not is_finite(time) or time < 0.0:
		return _fail("Invalid saved motion state")
	if not state.get("fired_events", {}) is Dictionary or not state.get("ended_tokens", {}) is Dictionary:
		return _fail("Invalid saved motion event ledger")
	# Validate before touching the current presentation. Restore never emits rules.
	var definition: Dictionary = descriptor.animations[semantic]
	if not definition.get("loop", false) and time > float(definition.duration) + 0.000001:
		return _fail("Saved motion time exceeds this clip")
	active_semantic = StringName(semantic)
	active_token = token
	elapsed_seconds = time
	paused = bool(state.get("paused", false))
	finished = bool(state.get("finished", false)) or (not definition.get("loop", false) and time >= float(definition.duration))
	fired_events = state.get("fired_events", {}).duplicate(true)
	ended_tokens = state.get("ended_tokens", {}).duplicate(true)
	# Recover missing ledger entries conservatively; the battle is the authority.
	for event in definition.get("events", []):
		if float(event.seconds) <= time:
			fired_events[str(event.id)] = true
	_reset_pose()
	animation_player.play(definition.clip, 0.0)
	_sample_pose(time)
	last_error = ""
	return true

func hand_global_transform(side: StringName) -> Transform3D:
	var bone_name := str(descriptor.skeleton.hands.get(str(side), ""))
	var index := skeleton.find_bone(bone_name)
	if index == -1:
		_fail("Missing declared hand attachment")
		return global_transform
	return skeleton.global_transform * skeleton.get_bone_global_pose(index)

func _sample_pose(time: float) -> void:
	var definition: Dictionary = descriptor.animations[str(active_semantic)]
	var length := animation_player.get_animation(definition.clip).length
	var clip_time := fmod(time, length) if definition.get("loop", false) else minf(time, length)
	if definition.get("time_map", "") == "guard_raise_hold_recover":
		var raise_end := float(definition.raise_seconds)
		var recover_start := float(definition.recover_start_seconds)
		var duration := float(definition.duration)
		if time < raise_end:
			clip_time = time / raise_end * 0.5 * length
		elif time < recover_start:
			clip_time = 0.5 * length
		else:
			clip_time = lerpf(0.5 * length, length, clampf((time - recover_start) / (duration - recover_start), 0.0, 1.0))
	animation_player.seek(clip_time, true, true)

func _reset_pose() -> void:
	skeleton.reset_bone_poses()
	for node in _initial_nodes:
		node.transform = _initial_nodes[node]

func _fail(message: String) -> bool:
	last_error = message
	return false
