extends Node
var shell
var audio
var game
var out=""
var checks=[]
var taps={}
var markers=[]
func check(value:bool,name:String,details:Dictionary={}) -> void:
	checks.append({"passed":value,"name":name,"details":details});print("B_AUDIO_CHECK "+name+" "+str(value))
func frames(n:int) -> void:
	for i in n:await get_tree().process_frame
func capture(name:String) -> void:
	await RenderingServer.frame_post_draw;get_viewport().get_texture().get_image().save_png(out+"/"+name+".png")
func mark(name:String) -> void:markers.append({"name":name,"frame":Engine.get_frames_drawn(),"time":Engine.get_frames_drawn()/30.0})
func peak(bus:String,count:int=10) -> float:
	taps[bus].clear_buffer();await frames(count)
	var value=0.0
	for sample in taps[bus].get_buffer(taps[bus].get_frames_available()):value=maxf(value,maxf(absf(sample.x),absf(sample.y)))
	return value
func positions() -> Array:return audio.mixer.music.map(func(p):return p.get_playback_position())
func equal_positions(a:Array,b:Array) -> bool:
	return range(a.size()).all(func(i):return absf(a[i]-b[i])<0.0001)
func settings_on_play(key:String,value) -> void:
	shell.open_pause();shell.open_settings();shell.edit_setting(key,value);shell.commit_settings();shell.act("back_settings");shell.resume_game();await frames(12)
func run(host) -> void:
	shell=host;audio=get_node("/root/CFGCNAudio");out=OS.get_environment("CFGCN_AUDIO_QA")
	for bus in ["Master","Music","Effects","Voice"]:
		var effect=AudioEffectCapture.new();effect.buffer_length=1.0;AudioServer.add_bus_effect(AudioServer.get_bus_index(bus),effect);taps[bus]=effect
	await frames(45);mark("menu")
	check(shell.screen=="menu" and await peak("Music")>0.0001,"native-default-menu-B-is-audible")
	await capture("menu")
	# Priority saturation is an explicit audio-only diagnostic, not a claimed battle.
	for id in ["staff-air","staff-body","blade-armor","shield-block","water-jian","bow-release","wound-cloth","weapon-whoosh"]:audio.mixer.effect(id,10,0.01,false,{"kind":"qa-pool-diagnostic"})
	var steals=audio.mixer.steals;audio.mixer.effect("danger-wood",95,0.01,false,{"kind":"qa-priority-diagnostic"})
	check(audio.mixer.steals==steals+1 and audio.mixer.effects.filter(func(r):return r.node.playing).size()==8,"critical-cue-preempts-eight-low-priority-slots")
	audio.mixer.stop_oneshots()
	shell.open_settings()
	for pair in [["master",0.73],["music",0.28],["effects",0.61],["voice",0.37]]:shell.edit_setting(pair[0],pair[1])
	shell.commit_settings();check(shell.store.saved.master==0.73 and shell.store.saved.music==0.28 and shell.store.saved.effects==0.61 and shell.store.saved.voice==0.37,"actual-shared-settings-persist-four-volumes")
	shell.edit_setting("music",0.1);shell.act("cancel_settings")
	check(is_equal_approx(db_to_linear(AudioServer.get_bus_volume_db(AudioServer.get_bus_index("Music"))),0.28),"cancel-rolls-back-live-bus-gain")
	shell.edit_setting("music",0.0);await frames(12)
	var frozen=positions();var quiet=await peak("Music",12)
	check(quiet<0.00001 and equal_positions(frozen,positions()),"music-zero-silences-and-freezes-native-cursors",{"peak":quiet})
	shell.act("cancel_settings");shell.act("back_settings");await frames(12)
	check(await peak("Music")>0.0001,"unmuting-music-resumes-without-restarting-theme")
	shell.begin_load("new")
	for i in 2400:
		await get_tree().process_frame
		if shell.screen=="play" or shell.loading_failed:break
	check(shell.screen=="play","default-shell-loads-actual-current-main-project")
	if shell.screen!="play":await finish();return
	game=shell.game;await frames(10);mark("game-start")
	var save_root=ProjectSettings.globalize_path(game.save_path) if shell.config.id=="xiyou" else game.campaign_store.slot_path()
	check(save_root.to_lower().begins_with("h:/") or save_root.to_lower().begins_with("h:\\"),"actual-game-save-path-is-isolated-on-H",{"path":save_root})
	if shell.config.id=="xiyou":await xiyou()
	else:await shuihu()
	await finish()
func xiyou() -> void:
	# Regional enemy pacing in later native builds differs from the old 80s
	# fixture. Wait for the real earned upgrade; never inject XP or enemies.
	var waited=0
	for i in 7200:
		await get_tree().process_frame
		waited=i+1
		if game.state.growth.pending!=null:break
	check(game.state.growth.pending!=null and game.state.growth.level>=2 and game.state.kills>=4,"normal-Tang-monk-kills-and-pickups-earn-upgrade",{"waitedFrames":waited,"elapsed":game.state.elapsed,"kills":game.state.kills,"level":game.state.growth.level,"xp":game.state.growth.xp,"migrationNotice":game.world.migration_notice})
	if game.state.growth.pending!=null:
		await frames(12);var exact=game.core.save_json();var cursor=positions();var quiet=await peak("Music",12)
		check(exact==game.core.save_json() and equal_positions(cursor,positions()) and quiet<0.00001,"earned-upgrade-freezes-rules-and-B-music")
		mark("upgrade");await capture("upgrade")
		game.choose_upgrade(0);await frames(12)
		check(game.state.growth.pending==null,"real-offered-card-resumes-original-growth")
	await frames(80);mark("initial-journey-end")
	shell.open_pause();await frames(12)
	var native=game.core.save_json();var saved=game.desktop_save();var cold=ClassDB.instantiate("XiyouCore");var loaded=JSON.parse_string(cold.restore_json(FileAccess.get_file_as_string(saved.path)))
	check(saved.ok and loaded.ok and cold.save_json()==native,"actual-growth-and-story-save-cold-restores-exactly")
	var source=ProjectSettings.globalize_path("res://../../../.local/qa/xiyou-godot-v3/spider_inspect/initial-checkpoint.json")
	var hash=FileAccess.get_sha256(source)
	shell.begin_load("load",source)
	for i in 900:
		await get_tree().process_frame
		if shell.screen=="play" or shell.loading_failed:break
	await frames(6)
	if not game.interaction.disabled:game.interaction.pressed.emit()
	await frames(300);mark("seven-spider")
	check(audio.xiyou_director.boss_alive(game.state) and audio.report().played.get("staff-air",0)>0 and audio.report().played.get("water-jian",0)>0,"real-old-checkpoint-produces-B-staff-and-water-sword")
	check(audio.report().history.any(func(e):return e.kind=="effect" and e.details.source.get("kind","")=="actual-boss-warning"),"actual-seven-spider-warning-has-priority-B-cue")
	await capture("seven-spider")
	await pause_and_mute()
	if not game.recovery_label().is_empty():game.recovery_button.pressed.emit()
	await frames(90);mark("recovery")
	check(audio.mixer.mood=="xy-aftermath" and audio.mixer.transitions>=3,"actual-recovery-crossfades-to-quiet-B-section")
	check(FileAccess.get_sha256(source)==hash,"earlier-Boss-checkpoint-remains-byte-identical")
	await capture("recovery")
func shuihu() -> void:
	await frames(90);mark("camp");await capture("camp")
	game.camp_view.selected_mission="M01";game.camp_view.selected_route="receive";game.camp_view.show_tab("missions")
	var depart=game.camp_view.buttons.get("depart:M01")
	check(depart!=null and not depart.disabled,"actual-camp-departure-is-available")
	if depart==null:return
	depart.pressed.emit();await frames(8);mark("depart")
	check(game.play_mode=="campaign_battle" and game.core.state.operation=="receive","public-departure-enters-real-M01-route")
	var policy=load("res://scripts/mission_play_policy.gd");var helper=load("res://scripts/mission_app_tests.gd").new()
	var clock=0.0;var last=-1.0;var paused_checked=false
	for i in 5400:
		await get_tree().process_frame;clock+=1.0/30.0
		if i%150==0:
			var trace=FileAccess.open(out+"/battle-progress.json",FileAccess.WRITE);trace.store_string(JSON.stringify({"frame":i,"phase":game.core.state.phase,"round":game.core.state.round,"side":game.core.state.side,"pending":game.core.state.pending,"pause_reasons":game.pause_reasons,"core_paused":game.core.state.get("paused",false),"screen":shell.screen}));trace.close()
		if game.core.state.phase!="playing":break
		if not paused_checked and int(audio.shuihu_director.counts.get("attack_contact",0))>0:
			paused_checked=true;mark("actual-contact");await capture("battle-contact");await pause_and_mute()
		if not game.core.state.pending.is_empty() or game.core.state.side!="player" or clock-last<0.42:continue
		last=clock;var step=policy.next(game.core)
		if step.kind=="order":helper.issue(game,step.actor,step.order)
		elif step.kind=="end_turn":game.end_button.pressed.emit()
	mark("battle-result");await frames(90)
	check(game.core.state.phase!="playing" and audio.mixer.mood=="sh-aftermath","actual-M01-result-crossfades-to-reflective-B-section")
	check(audio.shuihu_director.counts.get("attack_miss",0)>0 and audio.shuihu_director.counts.get("attack_contact",0)>0,"real-miss-and-contact-events-are-separated")
	await capture("battle-result")
	var battle=game.core.state.duplicate(true)
	game.end_button.pressed.emit();await frames(60);mark("camp-report")
	check(game.play_mode=="campaign" and not game.campaign.state.reports.is_empty(),"public-result-button-keeps-real-casualties-and-report")
	var file=FileAccess.open(out+"/final-battle.json",FileAccess.WRITE);file.store_string(JSON.stringify(battle,"\t"));file.close()
	file=FileAccess.open(out+"/final-campaign.json",FileAccess.WRITE);file.store_string(JSON.stringify(game.campaign.state,"\t"));file.close()
	await capture("camp-report")
func pause_and_mute() -> void:
	shell.open_pause();await frames(12)
	var core=game.core.save_json() if shell.config.id=="xiyou" else JSON.stringify(game.core.state)
	var cursor=positions();var quiet=await peak("Music",12);var voice_quiet=await peak("Voice",12)
	var after=game.core.save_json() if shell.config.id=="xiyou" else JSON.stringify(game.core.state)
	var game_effects_paused=audio.mixer.effects.all(func(row):return not row.node.playing or row.ui or row.node.stream_paused)
	check(core==after and equal_positions(cursor,positions()) and quiet<0.00001 and voice_quiet<0.00001 and game_effects_paused,"desktop-pause-freezes-actual-rules-and-game-audio",{"musicPeak":quiet,"voicePeak":voice_quiet,"uiFeedbackAllowed":true})
	shell.resume_game();await frames(15)
	await settings_on_play("master",0.0)
	var before=audio.report().played.duplicate();var frozen=positions();var muted=await peak("Master",90)
	check(muted<0.00001 and before==audio.report().played and equal_positions(frozen,positions()),"saved-Master-mute-allows-gameplay-without-old-sound-replay",{"peak":muted})
	await settings_on_play("master",0.73)
	await settings_on_play("effects",0.0)
	check(await peak("Effects",35)<0.00001,"shared-Effects-zero-silences-own-and-external-Boss-cues")
	await settings_on_play("effects",0.61)
	await settings_on_play("voice",0.0)
	check(await peak("Voice",20)<0.00001,"shared-Voice-zero-is-independent")
	await settings_on_play("voice",0.37)
func finish() -> void:
	mark("end")
	var saved=shell.save_game() if shell.game_active else {"ok":true}
	var report=audio.report()
	var data={"passed":checks.all(func(c):return c.passed),"checks":checks,"game":shell.config.id,"audio":report,"markers":markers,"save":saved,"profile":shell.store.config_path,"savedVolumes":shell.store.saved,"scope":"Actual default desktop entry and current main game; legal inputs and native events. Priority saturation is an explicitly separate audio-only diagnostic. Fixed-FPS capture is not a real-time performance benchmark."}
	var file=FileAccess.open(out+"/integration.json",FileAccess.WRITE);file.store_string(JSON.stringify(data,"\t"));file.close()
	shell.save_then_leave("menu");await frames(5)
	for bus in taps:AudioServer.remove_bus_effect(AudioServer.get_bus_index(bus),AudioServer.get_bus_effect_count(AudioServer.get_bus_index(bus))-1)
	audio.queue_free();await frames(3);get_tree().quit(0 if data.passed else 1)
