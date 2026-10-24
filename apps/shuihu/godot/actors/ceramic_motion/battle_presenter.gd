extends Node3D

# Explicitly installed presentation adapter. The owning battle keeps its rules,
# input, collisions, state, saves and default scene. Candidates require opt-in.
const PoseClock = preload("res://actors/ceramic_motion/battle_pose_clock.gd")

var host
var bindings: Dictionary = {}
var last_error := ""
var calibration: Dictionary = {}
var _hidden_meshes: Dictionary = {}
var _health: Dictionary = {}
var _serial := 0
var _pending_key := ""
var _pending_elapsed := -1.0
var _pending_token := ""

func install(battle: Node, entries: Array, allow_candidates := false) -> Dictionary:
	if host != null or not bindings.is_empty(): return _failure("Presenter already installed")
	if not battle.get("ready_to_play") or battle.get("core") == null: return _failure("Battle is not ready")
	var seen: Dictionary = {}
	for entry: Dictionary in entries:
		var id := str(entry.get("id", ""))
		if id.is_empty() or seen.has(id) or not battle.get("figures").has(id): return _failure("Unknown or repeated character")
		if not entry.get("formal_admission", false) and not allow_candidates: return _failure("Candidate requires explicit QA opt-in")
		if str(battle.get("core").actor(id).get("weapon", "")) != str(entry.get("expected_weapon", "")):
			return _failure("Weapon does not match this actor scene")
		if not ResourceLoader.exists(str(entry.get("scene", ""))): return _failure("Actor scene missing")
		seen[id] = true
	host = battle
	process_priority = int(host.process_priority) + 100
	for entry: Dictionary in entries:
		var id := str(entry.id)
		var packed: PackedScene = load(str(entry.scene))
		var actor: Node3D = packed.instantiate()
		add_child(actor)
		if actor.get("last_error") != "" or str(actor.get("character_id")) != id:
			actor.queue_free(); uninstall(); return _failure("Actor descriptor failed to load")
		if not actor.get("descriptor").get("formal_admission", false) and not allow_candidates:
			actor.queue_free(); uninstall(); return _failure("Actor descriptor is still an unadmitted candidate")
		var bounds := _body_bounds(actor)
		var figure: Dictionary = host.figures[id]
		if bounds.size.y <= 0.0 or float(figure.height) <= 0.0:
			actor.queue_free(); uninstall(); return _failure("Body scale is unavailable")
		var target_height := float(entry.get("target_body_height", figure.height))
		var factor := target_height / bounds.size.y
		actor.scale = Vector3.ONE * factor
		var center := bounds.get_center(); center.y = bounds.position.y
		bindings[id] = {"actor": actor, "entry": entry.duplicate(true), "anchor": center * factor}
		calibration[id] = {"source_body_height": bounds.size.y, "target_body_height": target_height,
			"scale": factor, "source_foot": bounds.position.y, "host_height": figure.height,
			"basis_policy": "Host retains its original root; source actor faces the actual order target"}
		for mesh: Node in figure.root.find_children("*", "MeshInstance3D", true, false):
			_hidden_meshes[mesh] = mesh.visible
			mesh.visible = false
	reset_for_battle()
	return {"ok": true, "actors": bindings.size(), "calibration": calibration.duplicate(true), "formal_admission": false}

func _process(delta: float) -> void:
	sample(delta)

func reset_for_battle() -> void:
	_health.clear(); _pending_key = ""; _pending_elapsed = -1.0; _pending_token = ""
	for id: String in bindings:
		var actor: Node = bindings[id].actor
		actor.set_paused(false)
		actor.start_action(&"idle", _token(id, "reset"))
		_health[id] = _health_value(host.core.actor(id))
		var owner: Dictionary = host.core.actor(id)
		var nearest := INF
		for opponent: Dictionary in host.core.state.actors:
			if opponent.side == owner.side or int(opponent.hp) <= 0: continue
			var direction: Vector3 = host.grid.position(str(opponent.at)) - host.grid.position(str(owner.at))
			if direction.length_squared() > 0.000001 and direction.length_squared() < nearest:
				nearest = direction.length_squared()
				actor.rotation.y = atan2(-direction.x, -direction.z)
	sample(0.0)

func sample(delta: float) -> bool:
	if host == null or host.get("core") == null: return false
	if not is_finite(delta) or delta < 0.0: return _fail("Invalid display delta")
	var state: Dictionary = host.core.state
	var paused := bool(state.get("paused", false))
	var pending: Dictionary = state.get("pending", {})
	var key := "" if pending.is_empty() else JSON.stringify([pending.actor, pending.order, pending.start, pending.duration, bool(host.reduced_motion)])
	var elapsed := float(pending.get("elapsed", -1.0))
	if not paused and key != "" and (key != _pending_key or elapsed + 0.000001 < _pending_elapsed):
		_pending_token = _token(str(pending.actor), "order")
	if not paused:
		_pending_key = key; _pending_elapsed = elapsed
	for id: String in bindings:
		var binding: Dictionary = bindings[id]
		var actor: Node3D = binding.actor
		var logical: Dictionary = host.core.actor(id)
		if logical.is_empty() or not host.figures.has(id): actor.visible = false; continue
		if str(logical.weapon) != str(binding.entry.expected_weapon):
			actor.visible = false
			for mesh: Node in host.figures[id].root.find_children("*", "MeshInstance3D", true, false):
				if _hidden_meshes.has(mesh): mesh.visible = _hidden_meshes[mesh]
			return _fail("Battle changed equipment; matching actor variant is required")
		actor.visible = not logical.get("evacuated", false)
		actor.set_paused(paused)
		_place(id, logical, pending)
		if paused: continue
		var health := _health_value(logical)
		var damaged := _health.has(id) and health < float(_health[id])
		_health[id] = health
		if int(logical.hp) <= 0:
			if not _show(actor, &"defeat", delta): return false
		elif not pending.is_empty() and str(pending.actor) == id:
			if host.reduced_motion and PoseClock.semantic_for(str(pending.definition.kind)) == &"board_move":
				if not _show(actor, &"idle", 0.0): return false
			elif not PoseClock.sample(actor, pending, _pending_token): return _fail(actor.last_error)
		elif damaged:
			if not actor.start_action(&"hit", _token(id, "damage")): return _fail(actor.last_error)
			if not actor.set_action_time(0.0, false): return _fail(actor.last_error)
		elif actor.active_semantic == &"hit" and not actor.finished:
			if not actor.set_action_time(float(actor.elapsed_seconds) + delta, false): return _fail(actor.last_error)
		elif _guarding(logical):
			if actor.active_semantic != &"guard" and not actor.start_action(&"guard", _token(id, "guard")): return _fail(actor.last_error)
			# Logical guard lasts until the owning rules expire it, not until a clip ends.
			var raised := float(actor.descriptor.animations.guard.get("raise_seconds", 0.2))
			if not actor.set_action_time(maxf(float(actor.elapsed_seconds), raised), false): return _fail(actor.last_error)
		elif not _show(actor, &"idle", 0.0 if host.reduced_motion else delta): return false
	return true

func capture_state() -> Dictionary:
	var actors: Dictionary = {}
	for id: String in bindings:
		var actor: Node3D = bindings[id].actor
		actors[id] = {"motion": actor.capture_state(), "yaw": actor.rotation.y,
			"source_sha256": actor.descriptor.source.sha256}
	return {"schema_version": 1, "battle_digest": _battle_digest(), "serial": _serial,
		"pending_key": _pending_key, "pending_elapsed": _pending_elapsed, "pending_token": _pending_token,
		"health": _health.duplicate(true), "actors": actors}

func restore_state(saved: Dictionary) -> bool:
	if saved.get("schema_version") != 1 or saved.get("battle_digest") != _battle_digest():
		return _fail("Restore the matching authoritative battle and ledger before its presentation")
	var actors: Dictionary = saved.get("actors", {})
	if actors.size() != bindings.size(): return _fail("Saved actor set does not match")
	for id: String in bindings:
		if not actors.has(id) or actors[id].get("source_sha256") != bindings[id].actor.descriptor.source.sha256:
			return _fail("Saved actor source does not match")
	var previous := capture_state()
	for id: String in bindings:
		if not bindings[id].actor.restore_state(actors[id].get("motion", {})):
			for rollback: String in bindings: bindings[rollback].actor.restore_state(previous.actors[rollback].motion)
			return _fail("Invalid saved motion state; previous presentation retained")
	for id: String in bindings: bindings[id].actor.rotation.y = float(actors[id].yaw)
	_serial = int(saved.serial); _pending_key = str(saved.pending_key); _pending_elapsed = float(saved.pending_elapsed)
	_pending_token = str(saved.pending_token); _health = saved.health.duplicate(true)
	last_error = ""
	return sample(0.0)

func uninstall() -> void:
	for mesh: Node in _hidden_meshes:
		if is_instance_valid(mesh): mesh.visible = _hidden_meshes[mesh]
	_hidden_meshes.clear()
	for binding: Dictionary in bindings.values():
		if is_instance_valid(binding.actor): binding.actor.queue_free()
	bindings.clear(); calibration.clear(); _health.clear(); host = null

func _exit_tree() -> void:
	uninstall()

func _show(actor: Node, semantic: StringName, delta: float) -> bool:
	if actor.active_semantic != semantic and not actor.start_action(semantic, _token(str(actor.character_id), str(semantic))): return _fail(actor.last_error)
	return actor.set_action_time(float(actor.elapsed_seconds) + delta, false) or _fail(actor.last_error)

func _place(id: String, logical: Dictionary, pending: Dictionary) -> void:
	var actor: Node3D = bindings[id].actor
	var projectile_destination := ""
	if not pending.is_empty():
		var destination := ""
		var targets: Array = pending.order.get("targets", [])
		if str(pending.actor) == id:
			if not targets.is_empty():
				var target: Dictionary = host.core.actor(str(targets[0]))
				destination = str(target.get("at", ""))
				projectile_destination = str(target.get("id", ""))
			elif not pending.definition.get("path", []).is_empty(): destination = str(pending.definition.path[-1])
		elif targets.has(id): destination = str(host.core.actor(str(pending.actor)).get("at", ""))
		if destination != "":
			var direction: Vector3 = host.grid.position(destination) - host.grid.position(str(logical.at))
			if direction.length_squared() > 0.000001: actor.rotation.y = atan2(-direction.x, -direction.z)
	var figure: Dictionary = host.figures[id]
	var floor_position: Vector3 = figure.root.global_position - Vector3.UP * float(figure.foot)
	actor.global_position = floor_position - Basis(Vector3.UP, actor.rotation.y) * bindings[id].anchor
	if actor.has_method("set_projectile_target") and projectile_destination != "" and host.figures.has(projectile_destination):
		var target_figure: Dictionary = host.figures[projectile_destination]
		var target_floor: Vector3 = target_figure.root.global_position - Vector3.UP * float(target_figure.foot)
		actor.set_projectile_target(target_floor + Vector3.UP * float(target_figure.height) * 0.55)

func _body_bounds(actor: Node3D) -> AABB:
	var largest := -1
	var bounds := AABB()
	for mesh: MeshInstance3D in actor.find_children("*", "MeshInstance3D", true, false):
		if mesh.mesh == null: continue
		var vertices := 0
		for surface in mesh.mesh.get_surface_count():
			vertices += mesh.mesh.surface_get_array_len(surface)
		if vertices > largest:
			largest = vertices
			bounds = (actor.global_transform.affine_inverse() * mesh.global_transform) * mesh.mesh.get_aabb()
	return bounds

func _guarding(actor: Dictionary) -> bool:
	return bool(actor.get("guard", false)) or actor.get("effects", []).any(func(effect: Dictionary): return effect.get("kind", "") in ["melee_guard", "guard_stance", "brace", "shieldwall"])

func _health_value(actor: Dictionary) -> float:
	return float(actor.get("hp", 0)) + float(actor.get("armor", 0)) + float(actor.get("head_armor", 0)) + float(actor.get("shield_hp", 0))

func _token(id: String, kind: String) -> String:
	_serial += 1
	return "battle-presenter/" + str(_serial) + "/" + id + "/" + kind

func _battle_digest() -> String:
	return JSON.stringify(_canonical(host.core.state)).sha256_text()

func _canonical(value: Variant) -> Variant:
	if value is Dictionary:
		var result: Dictionary = {}
		for key: Variant in value: result[key] = _canonical(value[key])
		return result
	if value is Array: return value.map(func(item: Variant): return _canonical(item))
	if value is int or value is float: return "number:" + ("%.9f" % float(value))
	return value

func _failure(message: String) -> Dictionary:
	_fail(message)
	return {"ok": false, "message": message}

func _fail(message: String) -> bool:
	last_error = message
	return false
