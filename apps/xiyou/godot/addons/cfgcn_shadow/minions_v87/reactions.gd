extends RefCounted
## Presentation only: real ordinary-enemy HP decreases start a short pulse.
## Never assigns state, damage, movement, cast clocks, pause or saved fields.
const DURATION=.18
var clock=-1.0
var previous={}
var pulses={}
var events=[]
func reset() -> void:clock=-1.0;previous.clear();pulses.clear();events.clear()
func observe(state: Dictionary,camera: Camera3D) -> void:
	var now=float(state.get("elapsed",0.0))
	if now<clock:reset()
	if now==clock:return
	clock=now;var next={}
	for enemy in state.get("enemies",[]):
		if int(enemy.role)!=0 or float(enemy.hp)<=0.0:continue
		var id=int(enemy.id);var at=Vector2(enemy.pos.x,enemy.pos.z)
		if previous.has(id):
			var old=previous[id]
			var same=int(old.kind)==int(enemy.kind) and int(old.profile)==int(enemy.profile) and at.distance_to(old.position)<12.0
			if not same:pulses.erase(id)
			if same and float(enemy.hp)<float(old.hp)-.001:
				var delta=at-old.position;var direction=delta.x*camera.global_basis.x.x+delta.y*camera.global_basis.x.z
				var sign_=1.0 if direction>=0.0 else -1.0
				pulses[id]={"at":now,"direction":sign_}
				events.append({"id":id,"kind":int(enemy.kind),"at":now,"hpBefore":old.hp,"hpAfter":enemy.hp})
				if events.size()>128:events.pop_front()
		next[id]={"hp":float(enemy.hp),"kind":int(enemy.kind),"profile":int(enemy.profile),"position":at}
	previous=next
	for id in pulses.keys():
		if not previous.has(id) or now-float(pulses[id].at)>DURATION:pulses.erase(id)
func pulse(enemy: Dictionary) -> float:
	var id=int(enemy.id)
	if not pulses.has(id):return 0.0
	var value=pulses[id];var phase=clampf((clock-float(value.at))/DURATION,0.0,1.0)
	var facing=-1.0 if float(enemy.facing.x)>0.0 else 1.0
	return float(value.direction)*facing*(1.0-phase)*(1.0-phase)
func report() -> Dictionary:return {"active":pulses.size(),"recordedEvents":events.duplicate(true),"clock":clock,"duration":DURATION,"scope":"readonly envelope for blending existing source HitRecoil; no new bone clip or gameplay control lock"}
