extends RefCounted
## Consume the main project's ephemeral presentation signal; never resolve rules.
var core_id=0
var phase=""
var seen={}
var ids=[]
var previous_actors={}
var counts={}
func reset() -> void:
	core_id=0;phase="";seen={};ids=[];previous_actors={}
func observe(game) -> Dictionary:
	var battle=game.play_mode in ["campaign_battle","drill"]
	var state=game.core.state
	var mood="sh-battle" if battle and state.phase=="playing" else "sh-aftermath" if battle else "sh-camp"
	var changed_core=game.core.get_instance_id()!=core_id
	if changed_core:reset();core_id=game.core.get_instance_id()
	var cues=[]
	if battle and phase=="playing" and state.phase!="playing":
		cues.append({"id":"ui-confirm" if state.phase=="won" else "danger-wood","priority":90,"gain":0.38,"details":{"kind":"actual-battle-result","phase":state.phase}})
	# Very old drill saves do not emit contact results; use actual HP/armor deltas
	# there only. Current combat_rules=2 always uses the explicit event below.
	if battle and int(state.get("combat_rules",1))!=2 and not changed_core:
		for actor in state.actors:
			if previous_actors.has(actor.id):
				var old=previous_actors[actor.id]
				if actor.hp<old.hp or actor.armor<old.armor:cues.append({"id":"wound-cloth","priority":65,"gain":0.46,"details":{"kind":"legacy-actual-damage","target":actor.id}})
	previous_actors={}
	for actor in state.actors:previous_actors[actor.id]={"hp":actor.hp,"armor":actor.armor}
	phase=state.phase
	return {"mood":mood,"position":42.0 if mood=="sh-battle" else 120.0 if mood=="sh-aftermath" else -1.0,"cues":cues}
func on_event(event:Dictionary,game) -> Array:
	if game.core.get_instance_id()!=core_id:reset();core_id=game.core.get_instance_id()
	var id=str(event.get("event_id",""))
	if id.is_empty() or seen.has(id):return []
	seen[id]=true;ids.append(id)
	if ids.size()>256:seen.erase(ids.pop_front())
	var kind=str(event.kind);counts[kind]=int(counts.get(kind,0))+1
	var details={"kind":kind,"event_id":id,"side":event.get("side",""),"actor":event.get("actor"),"target":event.get("target"),"action":event.get("action")}
	if kind in ["action_release","reaction_release"]:
		if kind=="action_release" and event.get("action_kind","") not in ["attack","shield_attack"]:return []
		var weapon=game.core.weapons.get(str(event.get("weapon","")),{})
		var weapon_id=str(event.get("weapon",""))
		var sound="bow-release" if weapon.get("ranged",false) else "staff-air" if ["spear","staff","pole","halberd"].any(func(part):return weapon_id.contains(part)) else "weapon-whoosh"
		return [{"id":sound,"priority":60 if event.get("side","")=="player" else 45,"gain":0.50 if event.get("side","")=="player" else 0.30,"details":details}]
	if kind=="step":return [{"id":"footstep-stone" if event.get("terrain","") in ["road","paved","courtyard","bridge"] else "footstep-earth","priority":20,"gain":0.13 if event.get("side","")=="player" else 0.07,"details":details}]
	if kind=="shield_contact" and float(event.get("shield_loss",0))>0:
		details.shield_loss=event.shield_loss
		return [{"id":"shield-block","priority":75,"gain":0.56,"details":details}]
	if kind=="attack_contact":
		if float(event.get("hp_loss",0))<=0 and float(event.get("armor_loss",0))<=0:return []
		var target=game.core.actor(str(event.get("target","")))
		var material=str(target.get("helmet_id","none") if event.get("head",false) else target.get("body_id","cloth"))
		var metal=material in ["lamellar","heavy","plate","war","full"]
		# Unknown armour stays in the restrained contact group; it is never inferred
		# as metal merely because a numeric armour value is high.
		details.material=material;details.hp=event.get("hp_loss",0);details.armor=event.get("armor_loss",0);details.head=event.get("head",false)
		return [{"id":"blade-armor" if metal and float(event.get("armor_loss",0))>0 else "wound-cloth","priority":84 if target.get("side","")=="player" else 68,"gain":0.54 if target.get("side","")=="player" else 0.40,"details":details}]
	if kind=="downed" and event.get("side","")=="player":return [{"id":"danger-wood","priority":90,"gain":0.38,"details":details}]
	return [] # A certified miss has the release sound only, never an invented hit.
