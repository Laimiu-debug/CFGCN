extends Node
## Audio-owned autoload observes the existing desktop shell without editing it.
const Library=preload("res://game_audio_b/library.gd")
const Mixer=preload("res://game_audio_b/mixer.gd")
const Xiyou=preload("res://game_audio_b/xiyou_director.gd")
const Shuihu=preload("res://game_audio_b/shuihu_director.gd")
var mixer
var xiyou_director=Xiyou.new()
var shuihu_director=Shuihu.new()
var game_ref:WeakRef
var shell_ref:WeakRef
var snapshot={}
var manual_pause=false
var wall_clock=0.0
var ready_audio=false
var was_active=false
var scene="menu"
var frames=0
var resets=0
var external_players=[]
var shutting_down=false
func _ready() -> void:
	process_mode=Node.PROCESS_MODE_ALWAYS;process_priority=1000
	mixer=Mixer.new();add_child(mixer);mixer.configure(Library.STREAMS,"music-"+Library.META.game,Library.META.get("mixPolicy",{}))
	xiyou_director.configure({"assets":Library.META.actorAssets,"speech_policy":Library.META.speechPolicy})
	get_tree().node_added.connect(_on_node_added)
	for node in get_tree().root.get_children():_on_node_added(node)
	ready_audio=true
func _on_node_added(node:Node) -> void:
	if node is AudioStreamPlayer and not is_ancestor_of(node) and node.bus in ["Effects","Voice"]:external_players.append(weakref(node))
	var script=node.get_script()
	if script==null:return
	var path=script.resource_path
	if path=="res://shared_desktop_ui/boot.gd":shell_ref=weakref(node)
	elif path==("res://scripts/main.gd" if Library.META.game=="xiyou" else "res://scripts/battle_app.gd"):attach_game(node)
func attach_game(game:Node) -> void:
	if game_ref!=null and game_ref.get_ref()==game:return
	game_ref=weakref(game);snapshot={};manual_pause=false;reset_source()
	if Library.META.game=="shuihu" and game.has_signal("game_audio_event") and not game.game_audio_event.is_connected(_on_shuihu_event):game.game_audio_event.connect(_on_shuihu_event)
func push_xiyou(state:Dictionary,menu_paused:bool) -> void:snapshot=state;manual_pause=menu_paused
func reset_source() -> void:
	xiyou_director.reset();shuihu_director.reset();snapshot={};resets+=1
	if is_instance_valid(mixer):mixer.stop_oneshots()
func set_menu_paused(value:bool) -> void:manual_pause=value
func game_node():return game_ref.get_ref() if game_ref!=null else null
func shell_node():return shell_ref.get_ref() if shell_ref!=null else null
func shell_paused() -> bool:
	var shell=shell_node()
	return is_instance_valid(shell) and bool(shell.game_active) and shell.screen!="play"
func dispatch(cues:Array) -> void:
	for row in cues:mixer.effect(row.id,int(row.get("priority",50)),float(row.get("gain",0.46)),bool(row.get("ui",false)),row.get("details",{}))
func _on_shuihu_event(event:Dictionary) -> void:
	var game=game_node()
	if not is_instance_valid(game) or not game.desktop_started or not is_instance_valid(game.core):return
	# Always consume delivery IDs, including suppressed actions; unmuting or
	# returning from a menu must not replay buffered historical contacts.
	var cues=shuihu_director.on_event(event,game)
	if shell_paused() or game.core.state.get("paused",false) or mixer.is_muted("Master") or mixer.is_muted("Effects"):return
	mixer.log_event("native-rule-event",event)
	dispatch(cues)
func sync_external() -> void:
	external_players=external_players.filter(func(r):return is_instance_valid(r.get_ref()))
	for ref in external_players:
		var node=ref.get_ref()
		if mixer.is_muted("Master") or mixer.is_muted(node.bus):node.stop()
		node.stream_paused=mixer.paused
func _process(delta:float) -> void:
	if not ready_audio:return
	wall_clock+=delta;frames+=1
	var game=game_node();var shell=shell_node()
	var active=is_instance_valid(game) and bool(game.get("desktop_started"))
	if is_instance_valid(shell):active=active and bool(shell.game_active)
	if not active:
		if was_active:reset_source()
		was_active=false;scene="menu";mixer.sync_pause(false);mixer.set_context("menu",0.0);mixer.tick(delta);return
	was_active=true
	if Library.META.game=="xiyou":
		var state=snapshot if not snapshot.is_empty() else game.state
		if state.is_empty():return
		var blocked=manual_pause or shell_paused() or mixer.is_muted("Master")
		var frame=xiyou_director.observe(state,wall_clock,mixer.voice.playing or mixer.clock<mixer.duck_until,blocked)
		scene=frame.scene;mixer.sync_pause(frame.paused)
		if frame.reset:mixer.stop_oneshots()
		mixer.set_context(frame.mood,frame.position)
		if not blocked:dispatch(frame.cues)
		if frame.voice!=null and not blocked:mixer.speak(frame.voice)
	else:
		if not game.ready_to_play or game.core==null:return
		var frame=shuihu_director.observe(game)
		scene=game.play_mode
		mixer.sync_pause(shell_paused() or not game.pause_reasons.is_empty() or game.core.state.get("paused",false))
		mixer.set_context(frame.mood,frame.position)
		if not mixer.paused:dispatch(frame.cues)
	sync_external();mixer.tick(delta)
func report() -> Dictionary:
	var value=mixer.report() if is_instance_valid(mixer) else {}
	value.merge({"configured":ready_audio,"game":Library.META.game,"scene":scene,"frames":frames,"resets":resets,"externalAudioPlayers":external_players.size(),"eventCounts":shuihu_director.counts.duplicate(),"resourceManifestSha256":Library.META.manifestSha256},true)
	return value
func ui_event(action:String) -> bool:
	if not ready_audio:return false
	var key=action.replace("-","_").trim_prefix("ui_")
	var cues={"confirm":["ui-confirm",45,0.24],"cancel":["ui-cancel",40,0.20],"hint":["ui-confirm",35,0.12],"error":["danger-wood",85,0.22]}
	if not cues.has(key):return false
	var cue=cues[key]
	return mixer.effect(cue[0],cue[1],cue[2],true,{"kind":"shared-ui","action":key})
func _release_audio() -> void:
	if shutting_down:return
	shutting_down=true
	ready_audio=false;set_process(false)
	if get_tree().node_added.is_connected(_on_node_added):get_tree().node_added.disconnect(_on_node_added)
	var game=game_node()
	if is_instance_valid(game) and game.has_signal("game_audio_event") and game.game_audio_event.is_connected(_on_shuihu_event):game.game_audio_event.disconnect(_on_shuihu_event)
	for ref in external_players:
		var node=ref.get_ref()
		if is_instance_valid(node):node.stop();node.stream=null
	external_players=[];snapshot={};game_ref=null;shell_ref=null
	if is_instance_valid(mixer):mixer.shutdown()
func prepare_shutdown() -> void:
	_release_audio()
	# Offline Movie Maker has no independent driver thread; explicit quit callers
	# can drain the same stop commands through its last native processing frames.
	for i in 3:await get_tree().process_frame
func _exit_tree() -> void:_release_audio()
