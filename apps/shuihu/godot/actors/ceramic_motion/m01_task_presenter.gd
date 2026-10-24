extends "res://actors/ceramic_motion/campaign_presenter.gd"

# Additive presenter for the explicitly noncombat rescued-person variant.
# The three-friendly S2-M01-motion-v1 delivery and its hashes stay frozen.
func install(battle: Node, entries: Array, allow_candidates := false) -> Dictionary:
	for entry: Dictionary in entries:
		var logical: Dictionary = battle.core.actor(str(entry.get("id", "")))
		if not logical.get("task", false) or str(logical.get("side", "")) not in ["neutral", "player"]:
			return _failure("Task-only appearance requires the actual rescued-person state")
		if str(logical.get("weapon", "")) != "sabre": return _failure("Task sabre variant cannot replace another weapon")
	return super.install(battle, entries, allow_candidates)

func sample(delta: float) -> bool:
	if host != null and host.get("core") != null:
		for id: String in bindings:
			var logical: Dictionary = host.core.actor(id)
			if not logical.get("task", false) or str(logical.get("side", "")) not in ["neutral", "player"]:
				uninstall()
				return _fail("Task variant withdrawn after authoritative role change")
	return super.sample(delta)
