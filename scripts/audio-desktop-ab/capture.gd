extends SceneTree
var game
var mixer
var flow=""
var case_dir=""
var elapsed=0.0
var phase_clock=0.0
var commands=[]
var last_input=""
var upgrades=[]
var frame_rows=[]
var start_frame=0
var duration=0.0
var selected_member=false
var selected_card=false
var transition_time=-1.0
var screenshot_times=[1.0,20.0,42.0]
var source_path=""
var source_sha=""
var battle_finished_at=-1.0
var encounter_recovered=false
var camera_clock=0.0
var departed=false
var completed_battle={}
func _initialize() -> void:call_deferred("run")
func write_json(name: String,data) -> void:
	var f=FileAccess.open(case_dir+"/"+name,FileAccess.WRITE);f.store_string(JSON.stringify(data,"\t"));f.close()
func release_keys() -> void:
	for name in ["cfg_move_up","cfg_move_down","cfg_move_left","cfg_move_right"]:Input.action_release(name)
func run() -> void:
	flow=OS.get_environment("CFGCN_AB_FLOW");case_dir=OS.get_environment("CFGCN_AB_OUTPUT")
	var settings=load("res://shared_desktop_ui/settings_store.gd").new();settings.apply(settings.DEFAULTS,false)
	var game_id="xiyou" if flow.begins_with("XY") else "shuihu"
	mixer=load("res://comparison/mixer.gd").new();root.add_child(mixer);mixer.begin(game_id,case_dir)
	if game_id=="xiyou":game=load("res://scenes/main.tscn").instantiate()
	else:game=load("res://scripts/battle_app.gd").new()
	game.set_meta("desktop_shell_managed",true);root.add_child(game)
	for i in 900:
		await process_frame
		if (game_id=="xiyou" and game.world!=null) or (game_id=="shuihu" and game.ready_to_play and game.mission_ready):break
	var receipt={}
	if flow=="XY-A":
		receipt=game.desktop_start("new");duration=90.0
	elif flow=="XY-B":
		source_path=ProjectSettings.globalize_path("res://../../../.local/qa/xiyou-godot-v3/spider_inspect/initial-checkpoint.json")
		source_sha=FileAccess.get_sha256(source_path);receipt=game.desktop_start("load",source_path);duration=50.0
	else:
		receipt=game.desktop_start("new_game");duration=150.0
	if not OS.get_environment("CFGCN_AB_SECONDS").is_empty():duration=float(OS.get_environment("CFGCN_AB_SECONDS"))
	if not receipt.get("ok",false):
		write_json("failure.json",{"receipt":receipt,"flow":flow});push_error("Audition normal start failed");quit(1);return
	await process_frame;await process_frame
	if flow=="XY-B" and not game.interaction.disabled:game.interaction.pressed.emit()
	mixer.attach(game);start_frame=Engine.get_frames_drawn()
	var first_state=game.core.save_json() if game_id=="xiyou" else JSON.stringify(game.campaign.state)
	write_json("start.json",{"flow":flow,"startFrame":start_frame,"fps":30,"source":source_path,"sourceSha256":source_sha,"mixerSha256":FileAccess.get_sha256("res://comparison/mixer.gd"),"driverSha256":FileAccess.get_sha256("res://comparison/capture.gd"),"initialStateSha256":first_state.sha256_text(),"receipt":receipt,"actualGameRoot":game.get_script().resource_path,"capture":"Fixed-FPS actual native engine run, not a real-time frame-rate benchmark"})
	while elapsed<duration:
		await process_frame
		var dt=1.0/30.0;elapsed+=dt
		if game_id=="xiyou":drive_xiyou()
		else:drive_shuihu()
		if game_id=="shuihu" and game.play_mode=="campaign_battle" and game.core.state.phase!="playing":
			if battle_finished_at<0:battle_finished_at=elapsed;completed_battle=game.core.state.duplicate(true)
		if battle_finished_at>=0 and elapsed-battle_finished_at>7.0:break
		if not screenshot_times.is_empty() and elapsed>=screenshot_times[0]:
			screenshot_times.pop_front();await RenderingServer.frame_post_draw
			root.get_texture().get_image().save_png(case_dir+"/frame-"+str(roundi(elapsed))+".png")
		if Engine.get_frames_drawn()%30==0:
			frame_rows.append({"frame":Engine.get_frames_drawn(),"time":elapsed,"mode":game.state.get("current","") if game_id=="xiyou" else game.play_mode,"musicA":game.sound.music_id if game_id=="xiyou" else mixer.phase,"effectsB":mixer.pool_b.filter(func(r):return r.node.playing).size()})
	release_keys()
	await process_frame;await process_frame
	var report=mixer.finish()
	var result={"flow":flow,"seconds":elapsed,"startFrame":start_frame,"endFrame":Engine.get_frames_drawn(),"fps":30,"commands":commands,"upgrades":upgrades,"frames":frame_rows,"sameActualRuleTimelineForBothAudioBuses":true,"engine":Engine.get_version_info(),"sourceShaUnchanged":source_path=="" or FileAccess.get_sha256(source_path)==source_sha,"events":report.events.size(),"final":{}}
	if game_id=="xiyou":
		result.final={"level":game.state.growth.level,"xp":game.state.growth.xp,"kills":game.state.kills,"leader":game.state.leader,"bossAlive":game.sound.director.boss_alive(game.state),"audioA":game.sound.report()}
		var save_file=FileAccess.open(case_dir+"/final-journey.json",FileAccess.WRITE);save_file.store_string(game.core.save_json());save_file.close()
	else:
		var battle=game.core.state if completed_battle.is_empty() else completed_battle
		result.final={"mode":game.play_mode,"battlePhase":battle.phase,"round":battle.round,"campaignReports":game.campaign.state.reports,"actors":battle.actors}
		write_json("final-campaign.json",game.campaign.state);write_json("final-battle.json",battle)
	write_json("capture.json",result);print("AB_CAPTURE_DONE "+flow+" "+str(report.events.size()))
	game.queue_free();mixer.queue_free();await process_frame;await process_frame;quit()
func drive_xiyou() -> void:
	var offer=game.state.growth.pending
	if offer!=null:
		release_keys();last_input=""
		if transition_time<0:transition_time=elapsed;upgrades.append({"time":elapsed,"level":game.state.growth.level,"earnedOffer":offer.duplicate(true)})
		if offer.recipient==null and elapsed-transition_time>2.0:game.send({"growth_member":0});commands.append({"time":elapsed,"kind":"growth_member","value":0})
		elif offer.recipient!=null and elapsed-transition_time>4.0 and not selected_card:game.choose_upgrade(0);commands.append({"time":elapsed,"kind":"growth_choice","value":0});selected_card=true
		return
	transition_time=-1;selected_card=false
	# The actual new-game HUD acceptance earns its first upgrade while the
	# Tang monk holds position. Let foes enter his existing auto-skill range.
	if flow=="XY-A" and upgrades.is_empty():release_keys();last_input="";return
	if flow=="XY-B":
		release_keys();last_input=""
		if elapsed>30.0 and not encounter_recovered and not game.recovery_label().is_empty():
			game.recovery_button.pressed.emit();encounter_recovered=true;commands.append({"time":elapsed,"kind":"actual_recovery_button"})
		return
	var wanted="cfg_move_up" if int(elapsed/9.0)%4==0 else "cfg_move_right" if int(elapsed/9.0)%4==1 else "cfg_move_down" if int(elapsed/9.0)%4==2 else "cfg_move_left"
	if wanted!=last_input:
		release_keys();Input.action_press(wanted);last_input=wanted;commands.append({"time":elapsed,"kind":"movement","action":wanted})
	if flow=="XY-B" and elapsed<2.0 and not game.interaction.disabled and not game.sound.director.boss_alive(game.state):
		game.interaction.pressed.emit()
func drive_shuihu() -> void:
	var depart_at=11.0 if flow=="SH-A" else 2.0
	if game.play_mode=="campaign":
		if departed:return
		if elapsed>=depart_at:
			game.camp_view.selected_mission="M01";game.camp_view.selected_route="receive-agreement" if flow=="SH-A" else "receive"
			game.camp_view.show_tab("missions")
			var button=game.camp_view.buttons.get("depart:M01")
			if button!=null and not button.disabled:button.pressed.emit();departed=game.play_mode=="campaign_battle";commands.append({"time":elapsed,"kind":"depart","route":game.camp_view.selected_route})
		return
	if game.play_mode!="campaign_battle":return
	# Follow actions through the game's existing keyboard camera controls.
	# Only camera input is sent; rule positions and combat state are untouched.
	if elapsed-camera_clock>=0.12:
		camera_clock=elapsed
		var actor_id=game.core.state.pending.get("actor",game.core.state.selected)
		var actor=game.core.actor(actor_id)
		if not actor.is_empty():
			var delta=game.grid.position(actor.at)-game.focus
			var action="cfg_move_right" if delta.x>1.0 else "cfg_move_left" if delta.x< -1.0 else "cfg_move_down" if delta.z>1.0 else "cfg_move_up" if delta.z< -1.0 else ""
			if action!="":
				var event=InputEventAction.new();event.action=action;event.pressed=true;game._unhandled_input(event)
	if game.core.state.phase!="playing":
		if battle_finished_at>=0 and elapsed-battle_finished_at>4.0:game.end_button.pressed.emit();commands.append({"time":elapsed,"kind":"actual_result_report_button"})
		return
	if not game.core.state.pending.is_empty() or game.core.state.side!="player":return
	if elapsed-phase_clock<0.42:return
	phase_clock=elapsed
	var step=load("res://scripts/mission_play_policy.gd").next(game.core)
	if step.kind=="order":
		var helper=load("res://scripts/mission_app_tests.gd").new()
		if helper.issue(game,step.actor,step.order):commands.append({"time":elapsed,"round":game.core.state.round,"actor":step.actor,"order":step.order.duplicate(true)})
	elif step.kind=="end_turn":game.end_button.pressed.emit();commands.append({"time":elapsed,"kind":"end_turn","round":game.core.state.round})
