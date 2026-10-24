extends Node
var shell
var audio
var candidate
var proxy
var baseline
var out=""
var temporary=""
var checks=[]
var records={}
var start_frame=0
var end_frame=0
var active=false
var readonly_checks=0
var unchanged=true
var sample_frames=0
var native_events=[]
var candidate_inputs={}
var delta_results={}
var take_master_gain=1.0
var volume_tap
func check(value:bool,name:String,details:Dictionary={}) -> void:
	checks.append({"passed":value,"name":name,"details":details});print("B22_CONTACT_CHECK "+name+" "+str(value))
func frames(n:int) -> void:
	for i in n:await get_tree().process_frame
func run(host) -> void:
	shell=host;audio=get_node("/root/CFGCNAudio");baseline=audio.mixer
	for path in ["G:/CODE/CFGCN/source/audio/godot-b-v2-r2/common/mixer.gd","G:/CODE/CFGCN/scripts/audio-desktop-adopt/contact_proxy.gd"]:candidate_inputs[path]=FileAccess.get_sha256(path)
	out=OS.get_environment("CFGCN_AUDIO_QA");temporary=OS.get_environment("CFGCN_AUDIO_TEMP")
	process_mode=Node.PROCESS_MODE_ALWAYS;process_priority=2000
	AudioServer.add_bus(1);AudioServer.set_bus_name(1,"ContactB22Silent");AudioServer.set_bus_send(1,"Master");AudioServer.set_bus_volume_db(1,-80.0)
	AudioServer.add_bus(2);AudioServer.set_bus_name(2,"ContactB22Return");AudioServer.set_bus_send(2,"ContactB22Silent")
	for name in ["Music","Effects","Voice"]:
		AudioServer.add_bus(3);AudioServer.set_bus_name(3,"ContactB22"+name);AudioServer.set_bus_send(3,"ContactB22Return")
		AudioServer.set_bus_volume_db(3,AudioServer.get_bus_volume_db(AudioServer.get_bus_index(name)))
	var limiter=AudioEffectHardLimiter.new();limiter.ceiling_db=-1.2;AudioServer.add_bus_effect(AudioServer.get_bus_index("ContactB22Return"),limiter)
	candidate=load("G:/CODE/CFGCN/source/audio/godot-b-v2-r2/common/mixer.gd").new();candidate.route_prefix="ContactB22";add_child(candidate)
	candidate.configure(baseline.streams,baseline.music_id,baseline.policy)
	check(baseline.policy.get("version","")!="B2.2-contact-candidate","candidate-does-not-mutate-shipped-policy")
	if OS.get_environment("CFGCN_AUDIO_PHASE")=="check":
		await diagnostic();await finish(false);return
	proxy=load("G:/CODE/CFGCN/scripts/audio-desktop-adopt/contact_proxy.gd").new();proxy.baseline=baseline;proxy.candidate=candidate;proxy.rules_snapshot=snapshot_rules;add_child(proxy);audio.mixer=proxy
	# Changing a bus effect list can recreate its effect instances. Install the
	# diagnostic tap before recording and leave it in place until all stems seal.
	volume_tap=AudioEffectCapture.new();volume_tap.buffer_length=1.0;AudioServer.add_bus_effect(0,volume_tap)
	for pair in [["B21","Master"],["B22","ContactB22Return"]]:
		if OS.get_environment("CFGCN_AUDIO_PHASE") in ["cold","muted"]:continue
		var record=AudioEffectRecord.new();record.format=AudioStreamWAV.FORMAT_16_BITS
		AudioServer.add_bus_effect(AudioServer.get_bus_index(pair[1]),record);record.set_recording_active(true);records[pair[0]]=record
	take_master_gain=db_to_linear(AudioServer.get_bus_volume_db(0))
	if OS.get_environment("CFGCN_AUDIO_PHASE") in ["cold","muted"]:
		await cold_restore();await finish(true);return
	if shell.config.id=="shuihu":await shuihu()
	else:await xiyou()
	await finish(true)
func diagnostic() -> void:
	# This explicitly separate audio scheduling fixture is never a claimed battle.
	for id in ["staff-air","staff-body","blade-armor","shield-block","ink-spell","wood-impact","bow-release"]:
		candidate.effect(id,70,0.00001,false,{"kind":"qa-slot-saturation"})
	check(candidate.effects.slice(1).all(func(r):return r.node.playing) and not candidate.effects[0].node.playing,"seven-normal-slots-never-consume-warning-slot")
	var started=candidate.effect("danger-wood",95,0.00001,false,{"kind":"actual-boss-warning","qaFixture":true})
	check(started and candidate.effects[0].node.playing and candidate.effects[0].group=="warning","boss-warning-starts-with-normal-pool-saturated")
	candidate.sync_pause(true)
	check(candidate.effect("ui-confirm",45,0.00001,true,{"kind":"shared-ui"}) and candidate.effects[0].group=="warning","paused-UI-feedback-keeps-protected-warning")
	candidate.sync_pause(false);candidate.stop_oneshots()
	var contact=candidate.effect_group("wound-cloth",84,false,{"kind":"attack_contact"})
	var marker=candidate.effect_group("wood-impact",85,false,{"kind":"actual-qingmao-motion-event"})
	check(contact=="contact" and marker=="skill","ordinary-hit-and-animation-marker-are-not-Boss-warning")
	var weak=candidate.shape_cue("wound-cloth",84,0.54,{"kind":"attack_contact","hp":2,"armor":0})
	var strong=candidate.shape_cue("wound-cloth",84,0.54,{"kind":"attack_contact","hp":35,"armor":0})
	check(weak.gain<strong.gain and strong.gain<=0.56,"resolved-damage-strength-has-bounded-audible-gain")
	var old_gain=AudioServer.get_bus_volume_db(0);AudioServer.set_bus_volume_db(0,-80.0);candidate.sync_pause(false)
	check(not candidate.effect("danger-wood",95,0.4,false,{"kind":"actual-boss-warning"}) and candidate.paused,"Master-zero-suppresses-new-warning-and-pauses-native-players")
	AudioServer.set_bus_volume_db(0,old_gain);candidate.sync_pause(false)
	check(candidate.effects.size()==8 and candidate.music.size()==2,"candidate-keeps-original-eleven-players")
func shuihu() -> void:
	shell.begin_load("new")
	for i in 2400:
		await get_tree().process_frame
		if shell.screen=="play" or shell.loading_failed:break
	check(shell.screen=="play","shipped-default-shell-loads-real-campaign")
	if shell.screen!="play":return
	var game=shell.game;game.game_audio_event.connect(collect)
	await frames(45);game.camp_view.selected_mission="M01";game.camp_view.selected_route="receive";game.camp_view.show_tab("missions")
	var depart=game.camp_view.buttons.get("depart:M01");check(depart!=null and not depart.disabled,"normal-M01-departure")
	if depart==null:return
	depart.pressed.emit();await frames(12);start_frame=Engine.get_frames_drawn();active=true
	var policy=load("res://scripts/mission_play_policy.gd");var helper=load("res://scripts/mission_app_tests.gd").new();var last=-1.0
	for i in 3300:
		await get_tree().process_frame
		if i%300==0:
			var progress=FileAccess.open(out+"/progress.json",FileAccess.WRITE);progress.store_string(JSON.stringify({"frame":i,"round":game.core.state.round,"phase":game.core.state.phase,"events":native_events.size()}));progress.close()
		if game.core.state.phase!="playing":break
		if OS.get_environment("CFGCN_AUDIO_PHASE")=="bow" and i>=360 and native_events.any(func(e):return e.kind in ["attack_contact","attack_miss"] and game.core.weapons.get(str(e.get("weapon","")),{}).get("ranged",false)):break
		if not game.core.state.pending.is_empty() or game.core.state.side!="player" or float(i)/30.0-last<0.42:continue
		last=float(i)/30.0;var step=policy.next(game.core)
		if OS.get_environment("CFGCN_AUDIO_PHASE")=="bow":
			var ranged=ranged_order(game.core)
			if not ranged.is_empty():step=ranged
		if step.kind=="order":helper.issue(game,step.actor,step.order)
		elif step.kind=="end_turn":game.end_button.pressed.emit()
	await frames(15);active=false;end_frame=Engine.get_frames_drawn()
	check(native_events.any(func(e):return e.kind=="attack_contact") and native_events.any(func(e):return e.kind=="attack_miss"),"paired-same-actual-M01-has-real-hit-and-miss")
	if OS.get_environment("CFGCN_AUDIO_PHASE")=="bow":check(native_events.any(func(e):return e.kind in ["attack_contact","attack_miss"] and game.core.weapons.get(str(e.get("weapon","")),{}).get("ranged",false)),"ordinary-public-bow-order-has-a-real-resolved-result")
	check(unchanged and readonly_checks>0,"both-mixers-leave-real-rules-state-unchanged")
	game.game_audio_event.disconnect(collect)
	if game.core.state.phase!="playing":
		game.end_button.pressed.emit();await frames(8)
		check(game.play_mode=="campaign","actual-result-returns-to-camp-before-pause-settings")
func ranged_order(core) -> Dictionary:
	for actor in core.state.actors:
		if actor.side!="player" or actor.hp<=0 or not core.weapons.get(str(actor.weapon),{}).get("ranged",false):continue
		var skill=core.weapons[actor.weapon].skills[0].id
		for target in core.state.actors:
			if target.side!="enemy" or target.hp<=0:continue
			var order={"id":skill,"targets":[target.id]}
			if core.preview(order,actor.id).get("reason","")=="":return {"kind":"order","actor":actor.id,"order":order}
	return {}
func xiyou() -> void:
	# The main owner's existing real pre-qingmao checkpoint is supplied as a
	# separate reviewed input; never inject HP/positions or synthesize a victory.
	var source=OS.get_environment("CFGCN_AUDIO_CONTACT_SAVE")
	check(not source.is_empty() and FileAccess.file_exists(source),"main-owned-real-checkpoint-is-supplied")
	if source.is_empty() or not FileAccess.file_exists(source):return
	var digest=FileAccess.get_sha256(source);shell.begin_load("load",source)
	for i in 2400:
		await get_tree().process_frame
		if shell.screen=="play" or shell.loading_failed:break
	check(shell.screen=="play","shipped-default-shell-loads-main-owned-checkpoint")
	if shell.screen!="play":return
	await frames(6)
	var game=shell.game
	if OS.get_environment("CFGCN_AUDIO_PHASE")!="ordinary" and not game.interaction.disabled:game.interaction.pressed.emit()
	await frames(6);start_frame=Engine.get_frames_drawn();active=true
	for i in 1200:
		await get_tree().process_frame
		if i%90==0:
			Input.action_release("cfg_move_left");Input.action_release("cfg_move_right");Input.action_press("cfg_move_left" if (i/90)%2==0 else "cfg_move_right")
		if game.state.growth.pending!=null:
			if game.state.growth.pending.recipient==null:game.send({"growth_member":1})
			else:game.send({"growth_choice":0})
	Input.action_release("cfg_move_left");Input.action_release("cfg_move_right");active=false;end_frame=Engine.get_frames_drawn()
	check(unchanged and readonly_checks>0,"both-mixers-leave-real-rules-state-unchanged")
	check(FileAccess.get_sha256(source)==digest,"real-checkpoint-file-stays-byte-identical")
	if OS.get_environment("CFGCN_AUDIO_PHASE")=="ordinary":
		for kind in [10,13]:check(proxy.calls.any(func(c):return c.source.get("kind","")=="actual-ordinary-release" and int(c.source.get("sourceKind",-1))==kind and c.candidatePlayed),"actual-nearby-ordinary-kind-"+str(kind)+"-is-audible-in-candidate")
	else:check(proxy.calls.any(func(c):return c.source.get("kind","")=="actual-boss-warning" and c.source.get("boss","")=="qingmao"),"actual-qingmao-windup-reaches-both-mixers")
	check(proxy.calls.any(func(c):return c.source.get("kind","")=="actual-hp-contact"),"actual-native-HP-contact-reaches-both-mixers")
func cold_restore() -> void:
	var muted=OS.get_environment("CFGCN_AUDIO_PHASE")=="muted"
	var saved=shell.store.saved
	check(is_equal_approx(float(saved.master),0.0 if muted else 0.73) and is_equal_approx(float(saved.music),0.28) and is_equal_approx(float(saved.effects),0.61) and is_equal_approx(float(saved.voice),0.37),"independent-process-restores-four-saved-volumes")
	shell.begin_load("continue")
	for i in 2400:
		await get_tree().process_frame
		if shell.screen=="play" or shell.loading_failed:break
	check(shell.screen=="play","actual-default-shell-cold-continues-isolated-save")
	if shell.screen!="play":return
	start_frame=Engine.get_frames_drawn();active=true;await frames(60);active=false;end_frame=Engine.get_frames_drawn()
	# A never-started/stopped spare player has no live playback to pause.
	# Check only live playback, plus actual Master PCM and the muted one-shots.
	var players=candidate.music.map(func(p):return {"playing":p.playing,"streamPaused":p.stream_paused,"hasStream":p.stream!=null,"position":p.get_playback_position()})
	var state_ok=candidate.paused==muted and candidate.music.all(func(p):return not p.playing or p.stream_paused==muted)
	var peak=0.0
	if muted:
		volume_tap.clear_buffer();await frames(18)
		for value in volume_tap.get_buffer(volume_tap.get_frames_available()):peak=maxf(peak,maxf(absf(value.x),absf(value.y)))
		state_ok=state_ok and baseline.paused and peak<0.00001 and candidate.effects.all(func(r):return not r.node.playing) and not candidate.voice.playing
	check(state_ok,"candidate-cold-Master-mute-state-is-correct",{"players":players,"masterPeak":peak})
	shell.open_pause();shell.open_settings();shell.edit_setting("master",0.73 if muted else 0.0);shell.commit_settings()
	delta_results={"phase":"muted" if muted else "cold","saved":shell.store.saved.duplicate(true)}
func actual_pause_delta() -> void:
	var game=shell.game
	await frames(6)
	if shell.config.id=="xiyou" and game.state.growth.pending!=null:
		if game.state.growth.pending.recipient==null:game.send({"growth_member":1});await frames(3)
		game.send({"growth_choice":0});await frames(3)
	shell.open_pause();await frames(6)
	var state=full_live_rules();var positions=candidate.music.map(func(p):return p.get_playback_position());var clock=candidate.clock
	await frames(18)
	check(shell.screen!="play" and state==full_live_rules() and candidate.clock==clock and range(2).all(func(i):return absf(candidate.music[i].get_playback_position()-positions[i])<0.0001),"actual-package-menu-freezes-rules-and-candidate-music")
	shell.open_settings()
	for pair in [["master",0.73],["music",0.28],["effects",0.61],["voice",0.37]]:shell.edit_setting(pair[0],pair[1])
	shell.commit_settings();shell.act("back_settings");shell.resume_game();await frames(8)
	check(["Music","Effects","Voice"].all(func(name):return is_equal_approx(AudioServer.get_bus_volume_db(AudioServer.get_bus_index(name)),AudioServer.get_bus_volume_db(AudioServer.get_bus_index("ContactB22"+name)))),"candidate-follows-actual-shared-bus-settings")
	shell.open_pause();shell.open_settings();shell.edit_setting("master",0.0);shell.commit_settings();shell.act("back_settings");shell.resume_game();await frames(8)
	volume_tap.clear_buffer();await frames(18)
	var peak=0.0
	for value in volume_tap.get_buffer(volume_tap.get_frames_available()):peak=maxf(peak,maxf(absf(value.x),absf(value.y)))
	check(peak<0.00001 and candidate.paused and candidate.effects.all(func(r):return not r.node.playing),"actual-package-Master-zero-silences-both-mixes",{"peak":peak})
	shell.open_pause();shell.open_settings();shell.edit_setting("master",0.73);shell.edit_setting("effects",0.0);shell.commit_settings();shell.act("back_settings");shell.resume_game();await frames(8)
	check(candidate.effects.all(func(r):return not r.node.playing),"actual-Effects-zero-stops-candidate-one-shots")
	shell.open_pause();shell.open_settings();shell.edit_setting("effects",0.61);shell.edit_setting("voice",0.0);shell.commit_settings();shell.act("back_settings");shell.resume_game();await frames(8)
	check(not candidate.voice.playing,"actual-Voice-zero-is-independent")
	shell.open_pause();shell.open_settings();shell.edit_setting("voice",0.37);shell.commit_settings()
	var save=shell.save_game();check(save.get("ok",false),"actual-package-save-is-ready-for-independent-cold-process")
	delta_results={"saved":shell.store.saved.duplicate(true),"save":save,"masterZeroPeak":peak}
func full_live_rules() -> String:
	return shell.game.core.state_json() if shell.config.id=="xiyou" else JSON.stringify(shell.game.core.state)
func collect(event:Dictionary) -> void:
	if active:native_events.append(event.duplicate(true))
func snapshot_rules() -> String:
	if not active or not is_instance_valid(shell.game):return ""
	var game=shell.game
	return game.core.save_json() if shell.config.id=="xiyou" else JSON.stringify(game.core.state)
func _process(_delta:float) -> void:
	if not active:return
	sample_frames+=1
	if sample_frames%30!=0:return
	var game=shell.game
	var before=game.core.save_json() if shell.config.id=="xiyou" else JSON.stringify(game.core.state)
	candidate.report();baseline.report()
	var after=game.core.save_json() if shell.config.id=="xiyou" else JSON.stringify(game.core.state)
	readonly_checks+=1;unchanged=unchanged and before==after
func finish(paired:bool) -> void:
	if paired and OS.get_environment("CFGCN_AUDIO_PHASE") not in ["cold","muted"]:await actual_pause_delta()
	check(candidate_inputs.keys().all(func(path):return FileAccess.get_sha256(path)==candidate_inputs[path]),"candidate-and-proxy-start-end-SHA-unchanged")
	if paired:check(proxy.rules_preserved and (proxy.call_checks>0 or OS.get_environment("CFGCN_AUDIO_PHASE") in ["cold","muted"]),"actual-audio-calls-preserve-full-current-rules",{"checks":proxy.call_checks})
	if paired:
		for side in records:
			records[side].set_recording_active(false);records[side].get_recording().save_to_wav(temporary+"/native-"+side+".wav")
	var data={"passed":checks.all(func(c):return c.passed),"checks":checks,"baseline":baseline.report(),"candidate":candidate.report(),"startFrame":start_frame,"endFrame":end_frame,"seconds":float(end_frame-start_frame)/30.0,"nativeEvents":native_events,"nativeCueCalls":proxy.calls if paired else [],"readonlyChecks":readonly_checks,"game":shell.config.id,"masterGain":db_to_linear(AudioServer.get_bus_volume_db(0)),"scope":"One actual shipping EXE/PCK plus an explicitly external audio-only candidate. One real rules instance, same native cues and picture; not a new shipped package, full campaign, shield-block or performance acceptance. Audio diagnostic fixtures are separately labeled."}
	data.candidateInputSha256=candidate_inputs
	data.masterGain=take_master_gain;data.affectedPauseAndVolumes=delta_results
	var file=FileAccess.open(out+"/contact.json",FileAccess.WRITE);file.store_string(JSON.stringify(data,"\t"));file.close()
	if paired:audio.mixer=baseline
	if shell.game_active:shell.save_then_leave("menu");await frames(5)
	candidate.shutdown();candidate.queue_free()
	if is_instance_valid(proxy):proxy.baseline=null;proxy.candidate=null;proxy.queue_free()
	await frames(3)
	if paired:
		for side in records:remove_effect("Master" if side=="B21" else "ContactB22Return",records[side])
		remove_effect("Master",volume_tap)
	for name in ["ContactB22Music","ContactB22Effects","ContactB22Voice","ContactB22Return","ContactB22Silent"]:AudioServer.remove_bus(AudioServer.get_bus_index(name))
	await audio.prepare_shutdown();get_tree().quit(0 if data.passed else 1)
func remove_effect(bus_name:String,effect) -> void:
	var bus=AudioServer.get_bus_index(bus_name)
	for i in range(AudioServer.get_bus_effect_count(bus)-1,-1,-1):
		if AudioServer.get_bus_effect(bus,i)==effect:AudioServer.remove_bus_effect(bus,i);return
