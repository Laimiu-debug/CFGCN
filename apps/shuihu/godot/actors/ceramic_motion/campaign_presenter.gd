extends "res://actors/ceramic_motion/battle_presenter.gd"

# The campaign remains the sole owner of movement, facing, rules and saves.
# Install only after _enter_mission / public load, and uninstall before leaving.
var _cold_sample := false
var _bound_core := 0

func install(battle: Node, entries: Array, allow_candidates := false) -> Dictionary:
	if battle.get("play_mode") != "campaign_battle": return _failure("Campaign battle is not active")
	if battle.get("actor_facing") == null: return _failure("Campaign facing provider missing")
	_bound_core = battle.core.get_instance_id()
	last_error = ""
	var result: Dictionary = super.install(battle, entries, allow_candidates)
	if result.ok and last_error != "":
		uninstall()
		return _failure(last_error)
	return result

func reset_for_battle() -> void:
	_cold_sample = true
	super.reset_for_battle()
	_cold_sample = false

func sample(delta: float) -> bool:
	if host == null or host.get("core") == null: return false
	if host.play_mode != "campaign_battle" or host.core.get_instance_id() != _bound_core:
		uninstall()
		return _fail("Reinstall against the new authoritative campaign battle")
	if not is_finite(delta) or delta < 0.0: return _fail("Invalid display delta")
	var state: Dictionary = host.core.state
	var paused := bool(state.get("paused", false))
	var pending: Dictionary = state.get("pending", {})
	var key := "" if pending.is_empty() else JSON.stringify([pending.actor, pending.order, pending.start, pending.duration, bool(host.reduced_motion)])
	var elapsed := float(pending.get("elapsed", -1.0))
	if (not paused or _cold_sample) and key != "" and (key != _pending_key or elapsed + 0.000001 < _pending_elapsed):
		_pending_token = _token(str(pending.actor), "order")
	if not paused or _cold_sample:
		_pending_key = key; _pending_elapsed = elapsed
	for id: String in bindings:
		var binding: Dictionary = bindings[id]
		var actor: Node3D = binding.actor
		var logical: Dictionary = host.core.actor(id)
		if logical.is_empty() or not host.figures.has(id): actor.visible = false; continue
		if str(logical.weapon) != str(binding.entry.expected_weapon):
			uninstall()
			return _fail("Equipment changed; install the matching frozen variant")
		actor.visible = not logical.get("evacuated", false)
		actor.set_paused(false if _cold_sample else paused)
		_place(id, logical, pending)
		if paused and not _cold_sample: continue
		var health := _health_value(logical)
		var damaged := _health.has(id) and health < float(_health[id])
		_health[id] = health
		if int(logical.hp) <= 0 or str(logical.get("carried_by", "")) != "":
			if not _show(actor, &"defeat", delta): return false
			# A body already down in an authoritative cold save never falls again.
			if _cold_sample or str(logical.get("carried_by", "")) != "":
				if not actor.set_action_time(float(actor.descriptor.animations.defeat.duration), false): return _fail(actor.last_error)
		elif not pending.is_empty() and str(pending.actor) == id:
			if host.reduced_motion and PoseClock.semantic_for(str(pending.definition.kind)) == &"board_move":
				if not _show(actor, &"idle", 0.0): return false
			else:
				var display: Dictionary = pending
				var token := _pending_token
				if str(pending.definition.kind) == "move":
					# MissionCore advances exactly one route segment per 0.48 s.
					# Reuse the existing board clip once per segment, not once per order.
					display = pending.duplicate(true)
					var segment := mini(pending.definition.path.size() - 1, floori(elapsed / 0.48))
					display.elapsed = clampf(elapsed - segment * 0.48, 0.0, 0.48)
					display.duration = 0.48; display.impact = 0.24
					token += "/segment/" + str(segment)
				if not PoseClock.sample(actor, display, token): return _fail(actor.last_error)
		elif damaged:
			if not actor.start_action(&"hit", _token(id, "damage")): return _fail(actor.last_error)
			if not actor.set_action_time(0.0, false): return _fail(actor.last_error)
		elif actor.active_semantic == &"hit" and not actor.finished:
			if not actor.set_action_time(float(actor.elapsed_seconds) + delta, false): return _fail(actor.last_error)
		elif _guarding(logical):
			if actor.active_semantic != &"guard" and not actor.start_action(&"guard", _token(id, "guard")): return _fail(actor.last_error)
			var raised := float(actor.descriptor.animations.guard.get("raise_seconds", 0.2))
			if not actor.set_action_time(maxf(float(actor.elapsed_seconds), raised), false): return _fail(actor.last_error)
		elif not _show(actor, &"idle", 0.0 if host.reduced_motion else delta): return false
		actor.set_paused(paused)
	return true

func _place(id: String, logical: Dictionary, pending: Dictionary) -> void:
	var actor: Node3D = bindings[id].actor
	var figure: Dictionary = host.figures[id]
	var facing: Basis = host.actor_facing.basis_for(host.core, figure, id)
	var forward := facing * Vector3.RIGHT
	forward.y = 0.0
	if forward.length_squared() > 0.000001: actor.rotation.y = atan2(-forward.x, -forward.z)
	var floor_position: Vector3 = figure.root.global_position - Vector3.UP * float(figure.foot)
	actor.global_position = floor_position - Basis(Vector3.UP, actor.rotation.y) * bindings[id].anchor
	if actor.has_method("clear_projectile_target"): actor.clear_projectile_target()
	if actor.has_method("set_projectile_target") and not pending.is_empty() and str(pending.actor) == id:
		var targets: Array = pending.order.get("targets", [])
		if not targets.is_empty() and host.figures.has(str(targets[0])):
			var target: Dictionary = host.figures[str(targets[0])]
			var floor_target: Vector3 = target.root.global_position - Vector3.UP * float(target.foot)
			actor.set_projectile_target(floor_target + Vector3.UP * float(target.height) * 0.55)
