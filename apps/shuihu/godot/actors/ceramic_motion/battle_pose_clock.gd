extends RefCounted

# Presentation only. The battle reserves costs, resolves hits and persists its
# own event ledger. Sampling this clock must never run those rules a second time.
static func semantic_for(kind: String) -> StringName:
	if kind in ["attack", "push", "pull", "shield_attack", "attack_withdraw"]:
		return &"attack"
	if kind in ["defend", "personal_guard", "counter", "brace", "shieldwall", "ally_guard"]:
		return &"guard"
	return &"board_move" if kind == "move" else &"idle"

static func semantic_for_actor(actor: Node, kind: String) -> StringName:
	# Support props can present a rally/recovery gesture without making every
	# sword-bearing actor swing its blade whenever a recovery order is issued.
	var definitions: Dictionary = actor.get("descriptor").get("animations", {})
	for semantic: String in definitions:
		if definitions[semantic].get("gameplay_kinds", []).has(kind):
			return StringName(semantic)
	return semantic_for(kind)

static func pose_time(definition: Dictionary, pending: Dictionary, semantic: StringName) -> float:
	var duration := float(pending.get("duration", 0.0))
	var elapsed := float(pending.get("elapsed", 0.0))
	var clip_duration := float(definition.get("duration", 0.0))
	if not is_finite(duration) or not is_finite(elapsed) or duration <= 0.0 or clip_duration <= 0.0:
		return -1.0
	var impact := float(pending.get("impact", duration * 0.5))
	if not is_finite(impact) or impact < 0.0 or impact > duration:
		return -1.0
	elapsed = clampf(elapsed, 0.0, duration)
	if semantic == &"guard":
		var raised := float(definition.get("raise_seconds", clip_duration * 0.5))
		return raised * minf(1.0, elapsed / impact) if impact > 0.0 else raised
	if semantic == &"attack":
		for event: Dictionary in definition.get("events", []):
			if event.get("kind", "") not in ["melee_contact", "projectile_release", "ranged_contact", "support_commit"]:
				continue
			var contact := float(event.seconds)
			if elapsed < impact and impact > 0.0:
				return contact * elapsed / impact
			return contact + (clip_duration - contact) * (elapsed - impact) / (duration - impact) if duration > impact else contact
	return clip_duration * elapsed / duration

static func sample(actor: Node, pending: Dictionary, action_token: String) -> bool:
	if str(actor.get("character_id")) != str(pending.get("actor", "")):
		return false
	var semantic := semantic_for_actor(actor, str(pending.get("definition", {}).get("kind", "")))
	var animations: Dictionary = actor.get("descriptor").get("animations", {})
	if not animations.has(str(semantic)):
		return false
	var seconds := pose_time(animations[str(semantic)], pending, semantic)
	if seconds < 0.0 or not actor.start_action(semantic, action_token):
		return false
	# Rules already run in core.advance(). Silent sampling also consumes crossed
	# visual events so a later sample cannot emit a duplicate damage request.
	return actor.set_action_time(seconds, false)
