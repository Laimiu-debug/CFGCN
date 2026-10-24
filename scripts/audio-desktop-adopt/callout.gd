extends Node
var checks=[]
func check(value:bool,name:String) -> void:checks.append({"passed":value,"name":name})
func run(shell) -> void:
	var audio=get_node("/root/CFGCNAudio")
	var out=OS.get_environment("CFGCN_AUDIO_QA")
	var source="G:/CODE/CFGCN/source/xiyou/godot/character-motion-v70/legacy-native-save-v69.json"
	var digest=FileAccess.get_sha256(source)
	shell.begin_load("load",source)
	for i in 2400:
		await get_tree().process_frame
		if shell.screen=="play" or shell.loading_failed:break
	check(shell.screen=="play","real-old-five-person-journey-loads")
	if shell.screen!="play":get_tree().quit(1);return
	var game=shell.game
	game.send({"shadow_leader":1})
	check(int(game.state.leader)==1,"normal-character-selection-makes-Wukong-leader")
	var record=AudioEffectRecord.new();record.format=AudioStreamWAV.FORMAT_16_BITS
	AudioServer.add_bus_effect(AudioServer.get_bus_index("Voice"),record);record.set_recording_active(true)
	var voice_skills=[];var seen=0;var trace=[];var last_token=-1
	Input.action_press("cfg_move_up")
	for i in 600:
		if i in [30,180,330]:game.send({"shadow_cast":0})
		await get_tree().process_frame
		var actual_cast=game.state.heroes[1].cast
		if actual_cast!=null and int(actual_cast.token)!=last_token:
			last_token=int(actual_cast.token)
			trace.append({"frame":i,"time":audio.wall_clock,"skill":actual_cast.skill,"castTime":actual_cast.time,"nextEvent":actual_cast.next_event,"leader":game.state.leader,"voiceBusy":audio.mixer.voice.playing,"criticalUntil":audio.mixer.duck_until})
		if game.state.growth.pending!=null:
			if game.state.growth.pending.recipient==null:game.send({"growth_member":1})
			else:game.send({"growth_choice":0})
		var played=int(audio.report().played.get("wukong-skill-01",0))
		if played>seen:
			seen=played
			var cast=game.state.heroes[1].cast
			voice_skills.append(-1 if cast==null else int(cast.skill))
	Input.action_release("cfg_move_up")
	record.set_recording_active(false)
	var wav=record.get_recording();wav.save_to_wav(OS.get_environment("CFGCN_AUDIO_TEMP")+"/native-voice.wav")
	check(seen>0 and voice_skills.all(func(i):return i in [0,3,4,9]),"replacement-is-triggered-by-real-attacking-staff-casts-only")
	var nonzero=false
	for byte in wav.data:
		if byte!=0:nonzero=true;break
	check(nonzero,"replacement-produces-native-voice-bus-PCM")
	check(FileAccess.get_sha256(source)==digest,"original-source-save-remains-unchanged")
	var report={"passed":checks.all(func(c):return c.passed),"checks":checks,"voiceSkillIndices":voice_skills,"calls":seen,"castTrace":trace,
		"sourceSha256":digest,"audio":audio.report(),"scope":"Actual native main game, normal leader selection, movement/autocasts and normal manual slot-1 requests at frames 30/180/330; no HP/XP/cooldown injection. Spoken wording remains subject to human listening."}
	var file=FileAccess.open(out+"/callout.json",FileAccess.WRITE);file.store_string(JSON.stringify(report,"\t"));file.close()
	AudioServer.remove_bus_effect(AudioServer.get_bus_index("Voice"),AudioServer.get_bus_effect_count(AudioServer.get_bus_index("Voice"))-1)
	await audio.prepare_shutdown();get_tree().quit(0 if report.passed else 1)
