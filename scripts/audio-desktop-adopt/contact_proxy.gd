extends Node
## QA only: the shipped host and real main game call once; two mixers observe.
## The original mixer remains the audible master. Candidate audio has a silent
## return/stem and never issues rules input or substitutes a contact outcome.
var baseline
var candidate
var rules_snapshot:Callable
var calls=[]
var call_checks=0
var rules_preserved=true
func _get(property:StringName):return baseline.get(property) if is_instance_valid(baseline) else null
func effect(id:String,priority:int=50,gain:float=0.46,ui:bool=false,details:Dictionary={}) -> bool:
	var before=rules_snapshot.call() if rules_snapshot.is_valid() else ""
	var result=baseline.effect(id,priority,gain,ui,details)
	var changed=candidate.effect(id,priority,gain,ui,details)
	if before!="":
		call_checks+=1;rules_preserved=rules_preserved and before==rules_snapshot.call()
	calls.append({"frame":Engine.get_frames_drawn(),"clock":baseline.clock,"sound":id,"priority":priority,"gain":gain,"source":details.duplicate(true),"baselinePlayed":result,"candidatePlayed":changed})
	if calls.size()>4096:calls.pop_front()
	return result
func log_event(kind:String,details:Dictionary={}) -> void:
	baseline.log_event(kind,details);candidate.log_event(kind,details)
func sync_pause(value:bool) -> void:
	for name in ["Music","Effects","Voice"]:
		AudioServer.set_bus_volume_db(AudioServer.get_bus_index("ContactB22"+name),AudioServer.get_bus_volume_db(AudioServer.get_bus_index(name)))
	baseline.sync_pause(value);candidate.sync_pause(value)
func stop_oneshots() -> void:baseline.stop_oneshots();candidate.stop_oneshots()
func set_context(value:String,position:float=-1.0) -> void:baseline.set_context(value,position);candidate.set_context(value,position)
func speak(id:String) -> bool:
	var result=baseline.speak(id)
	candidate.speak(id)
	return result
func is_muted(bus:String) -> bool:return baseline.is_muted(bus)
func tick(delta:float) -> void:baseline.tick(delta);candidate.tick(delta)
func report() -> Dictionary:return baseline.report()
func shutdown() -> void:baseline.shutdown();candidate.shutdown()
