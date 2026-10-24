extends Node
func run(shell) -> void:
	var audio=get_node("/root/CFGCNAudio");var out=OS.get_environment("CFGCN_AUDIO_QA");var temporary=OS.get_environment("CFGCN_AUDIO_TEMP")
	var record=AudioEffectRecord.new();record.format=AudioStreamWAV.FORMAT_16_BITS
	var bus=AudioServer.get_bus_index("Music");AudioServer.add_bus_effect(bus,record);record.set_recording_active(true)
	var master=AudioEffectRecord.new();master.format=AudioStreamWAV.FORMAT_16_BITS
	AudioServer.add_bus_effect(0,master);master.set_recording_active(true)
	var offline=OS.get_environment("CFGCN_AUDIO_OFFLINE_CAPTURE")=="1"
	var wraps=[];var last=0.0;var started=Engine.get_frames_drawn();var started_wall=Time.get_ticks_msec();var stopped=false
	var stream=audio.mixer.streams[audio.mixer.music_id];var expected=stream.get_length()*2-float(stream.loop_begin)/stream.mix_rate
	while (float(Engine.get_frames_drawn()-started)/30.0 if offline else float(Time.get_ticks_msec()-started_wall)/1000.0)<expected+30:
		await get_tree().process_frame
		var player=audio.mixer.music[audio.mixer.current]
		var position=player.get_playback_position()
		var elapsed=float(Engine.get_frames_drawn()-started)/30.0 if offline else float(Time.get_ticks_msec()-started_wall)/1000.0
		if last>stream.get_length()-2 and position<5:wraps.append({"frame":Engine.get_frames_drawn(),"time":elapsed,"position":position})
		last=position
		if Engine.get_frames_drawn()%300==0:
			var progress=FileAccess.open(out+"/loop-progress.json",FileAccess.WRITE)
			progress.store_string(JSON.stringify({"frame":Engine.get_frames_drawn()-started,"audioPosition":position,"elapsed":elapsed,"wallSeconds":float(Time.get_ticks_msec()-started_wall)/1000.0,"wraps":wraps.size(),"mixerClock":audio.mixer.clock,"paused":audio.mixer.paused,"version":audio.report().version,"offline":offline}));progress.close()
		if wraps.size()>=2 and position>float(stream.loop_begin)/stream.mix_rate+1.0:stopped=true;break
	record.set_recording_active(false);var recording=record.get_recording();recording.save_to_wav(temporary+"/native-music.wav")
	master.set_recording_active(false);master.get_recording().save_to_wav(temporary+"/native-master.wav")
	var data={"passed":stopped and wraps.size()==2 and audio.mixer.transitions==1,"game":shell.config.id,"wraps":wraps,"firstPass":stream.get_length(),"repeatSeconds":stream.get_length()-float(stream.loop_begin)/stream.mix_rate,"recordFrames":recording.data.size()/4,"sampleRate":recording.mix_rate,"transitions":audio.mixer.transitions,"source":"Default desktop main-menu B music, two natural whole-length crossings; no seeks or speed change to audio pitch.","offline":offline,"scope":"Offline fixed-FPS native engine movie; not wall-clock playback or a performance benchmark." if offline else "Real executable, real-time native audio recording. Render frame rate is not a performance acceptance result."}
	var file=FileAccess.open(out+"/loop.json",FileAccess.WRITE);file.store_string(JSON.stringify(data,"\t"));file.close();print("B_AUDIO_FULL_LOOP "+str(data.passed))
	AudioServer.remove_bus_effect(bus,AudioServer.get_bus_effect_count(bus)-1)
	AudioServer.remove_bus_effect(0,AudioServer.get_bus_effect_count(0)-1)
	audio.queue_free()
	for i in 3:await get_tree().process_frame
	get_tree().quit(0 if data.passed else 1)
