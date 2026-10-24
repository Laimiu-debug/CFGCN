extends Node
func real_wait() -> void:
	var until=Time.get_ticks_usec()+140000
	while Time.get_ticks_usec()<until:await get_tree().process_frame
func run(shell) -> void:
	var audio=get_node("/root/CFGCNAudio");var checks=[]
	var tap=AudioEffectCapture.new();tap.buffer_length=1.0
	var bus=AudioServer.get_bus_index("Effects");AudioServer.add_bus_effect(bus,tap)
	for i in 20:await get_tree().process_frame
	for action in ["ui_confirm","ui_cancel","ui_hint","ui_error"]:
		tap.clear_buffer();var played=audio.ui_event(action)
		for i in 20:await get_tree().process_frame
		var peak=0.0
		for point in tap.get_buffer(tap.get_frames_available()):peak=maxf(peak,maxf(absf(point.x),absf(point.y)))
		checks.append({"name":action+"-native-effects-bus","passed":played and peak>0.0001,"peak":peak})
	checks.append({"name":"unknown-ui-action-is-silent","passed":not audio.ui_event("unknown")})
	shell.open_settings();shell.edit_setting("master",0.0)
	for i in 12:await get_tree().process_frame
	checks.append({"name":"ui-cues-respect-existing-Master-zero","passed":not audio.ui_event("ui_confirm")})
	shell.act("cancel_settings");shell.edit_setting("effects",0.0)
	for i in 12:await get_tree().process_frame
	checks.append({"name":"ui-cues-respect-existing-Effects-zero","passed":not audio.ui_event("ui_cancel")})
	shell.act("cancel_settings");shell.act("back_settings")
	shell.begin_load("new")
	for i in 2400:
		await get_tree().process_frame
		if shell.screen=="play" or shell.loading_failed:break
	checks.append({"name":"actual-main-game-loaded-for-pause-menu","passed":shell.screen=="play"})
	if shell.screen=="play":
		shell.open_pause()
		for i in 12:await get_tree().process_frame
		var clock=audio.mixer.clock;var count=int(audio.mixer.played.get("ui-confirm",0))
		var before=shell.game.core.save_json() if shell.config.id=="xiyou" else JSON.stringify(shell.game.core.state)
		await real_wait();shell.act("show_settings");await real_wait();shell.act("back_settings");await real_wait();shell.act("show_settings");await real_wait()
		checks.append({"name":"actual-paused-menu-repeated-confirm-uses-monotonic-time","passed":int(audio.mixer.played.get("ui-confirm",0))>=count+2})
		var after=shell.game.core.save_json() if shell.config.id=="xiyou" else JSON.stringify(shell.game.core.state)
		checks.append({"name":"repeated-ui-does-not-advance-paused-rules-or-music-clock","passed":before==after and is_equal_approx(clock,audio.mixer.clock) and audio.mixer.paused})
	var result={"passed":checks.all(func(c):return c.passed),"checks":checks,"game":shell.config.id,"scope":"Audio API and native bus diagnostic only; shared UI action wiring stays with its owner."}
	var file=FileAccess.open(OS.get_environment("CFGCN_AUDIO_QA")+"/ui.json",FileAccess.WRITE);file.store_string(JSON.stringify(result,"\t"));file.close()
	AudioServer.remove_bus_effect(bus,AudioServer.get_bus_effect_count(bus)-1)
	# Use the public shutdown path, including Movie Maker's synchronous driver.
	await audio.prepare_shutdown()
	get_tree().quit(0 if result.passed else 1)
