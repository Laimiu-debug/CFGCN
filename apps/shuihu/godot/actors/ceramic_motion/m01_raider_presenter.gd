extends "res://actors/ceramic_motion/campaign_presenter.gd"

# One anonymous source, two independent players/skeletons. Authoritative combat,
# AI, damage, fees, random state and event sounds remain in MissionCore/main.
func install(battle: Node, entries: Array, allow_candidates := false) -> Dictionary:
	for entry: Dictionary in entries:
		var id := str(entry.get("id", ""))
		var logical: Dictionary=battle.core.actor(id)
		if id not in ["enemy-0","enemy-1"] or not _ordinary_role_allowed(battle,logical):
			return _failure("M01 raider presentation requires the actual ordinary enemy instance")
		if str(logical.get("hero_id",""))!="" or logical.get("task",false):
			return _failure("Anonymous raiders cannot impersonate a named or task character")
		if str(logical.get("weapon",""))!="sabre":
			return _failure("Raider sabre presentation cannot replace another weapon")
	return super.install(battle,entries,allow_candidates)

func sample(delta: float) -> bool:
	if host!=null and host.get("core")!=null:
		for id: String in bindings:
			var logical: Dictionary=host.core.actor(id)
			if not _ordinary_role_allowed(host,logical):
				uninstall()
				return _fail("Withdraw ordinary source after authoritative identity/side change")
	return super.sample(delta)

func _ordinary_role_allowed(battle: Node, logical: Dictionary) -> bool:
	if str(battle.core.state.get("mission",""))!="M01":return false
	if logical.is_empty() or str(logical.get("hero_id",""))!="" or logical.get("task",false):return false
	var side:=str(logical.get("side",""))
	# A paid M01 parley authoritatively makes these same instances neutral.
	# Retain their appearance; only the owning rules decide combat eligibility.
	return side=="enemy" or (side=="neutral" and bool(battle.core.state.get("ceasefire",false)))
