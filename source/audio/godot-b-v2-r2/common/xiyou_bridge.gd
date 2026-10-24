extends Node
## Preserve the main project's audio interface; the persistent B host owns sound.
var service
var configured=false
var streams={}
var manifest={}
var director
var music=[]
var effects=[]
var voice
var played={}
var clock:float:
	get:return service.mixer.clock if is_instance_valid(service) else 0.0
var paused:bool:
	get:return service.mixer.paused if is_instance_valid(service) else true
var dropped:int:
	get:return service.mixer.dropped if is_instance_valid(service) else 0
func configure() -> Error:
	service=get_node_or_null("/root/CFGCNAudio")
	# Existing --script acceptance tools use a custom SceneTree and may not create
	# project autoloads. Standalone debug scenes still use this same real host.
	if service==null:
		service=load("res://game_audio_b/host.gd").new();service.name="CFGCNAudio";get_tree().root.add_child(service)
	service.attach_game(get_parent())
	configured=service.ready_audio
	if not configured:return ERR_CANT_OPEN
	streams=service.mixer.streams.duplicate();streams.warning=streams["danger-wood"]
	director=service.xiyou_director;manifest=director.manifest
	music=service.mixer.music;voice=service.mixer.voice;played=service.mixer.played
	effects=service.mixer.effects.map(func(r):return r.node)
	return OK
func update_state(state:Dictionary,menu_paused:bool) -> void:
	if configured:service.push_xiyou(state,menu_paused)
func set_paused(value:bool) -> void:
	if configured:service.set_menu_paused(value);service.mixer.sync_pause(value)
func reset() -> void:
	if configured:service.reset_source()
func effect(id:String,gain:float=0.42) -> void:
	if configured:service.mixer.effect("danger-wood" if id=="warning" else "staff-air" if id=="staff-sweep" else id,95 if id=="warning" else 50,gain,false,{"kind":"main-project-priority-cue","original":id})
func report() -> Dictionary:return service.report() if configured else {"configured":false}
