extends Node
var shell
var audio
var reference
var director
var game
var active=false
var records={}
var releases={"B1":[],"B2":[]}
var readonly_checks=0
var preserved=true
var start_frame=0
var sample_frames=0
func bank() -> Dictionary:
	var source=JSON.parse_string(FileAccess.get_file_as_string("G:/CODE/CFGCN/source/audio/godot-b-v1/prepared.json"));var result={}
	for row in source.resources:
		if row.id=="music-shuihu":continue
		result[row.id]=load(row.output)
	return result
func run(host) -> void:
	shell=host;audio=get_node("/root/CFGCNAudio");process_mode=Node.PROCESS_MODE_ALWAYS;process_priority=2000
	# Reference returns are inserted left of their sends. Only the B2 main mix
	# reaches the audible Master; B1 is captured before a separate silent return.
	AudioServer.add_bus(1);AudioServer.set_bus_name(1,"ReferenceB1Silent");AudioServer.set_bus_volume_db(1,-80);AudioServer.set_bus_send(1,"Master")
	AudioServer.add_bus(2);AudioServer.set_bus_name(2,"ReferenceB1Return");AudioServer.set_bus_send(2,"ReferenceB1Silent")
	for name in ["Music","Effects","Voice"]:
		AudioServer.add_bus(3);AudioServer.set_bus_name(3,"ReferenceB1"+name);AudioServer.set_bus_send(3,"ReferenceB1Return")
		AudioServer.set_bus_volume_db(3,AudioServer.get_bus_volume_db(AudioServer.get_bus_index(name)))
	var limit=AudioEffectHardLimiter.new();limit.ceiling_db=-1.2;AudioServer.add_bus_effect(AudioServer.get_bus_index("ReferenceB1Return"),limit)
	for pair in [["B1","ReferenceB1Return"],["B2","Master"]]:
		var record=AudioEffectRecord.new();record.format=AudioStreamWAV.FORMAT_16_BITS;AudioServer.add_bus_effect(AudioServer.get_bus_index(pair[1]),record);record.set_recording_active(true);records[pair[0]]=record
	reference=load("G:/CODE/CFGCN/scripts/audio-desktop-adopt/reference_b1.gd").new();add_child(reference);reference.configure(bank(),"music-xiyou")
	director=load("G:/CODE/CFGCN/source/audio/godot-b-v2/baseline-package/xiyou_director.gd").new()
	var meta=JSON.parse_string(FileAccess.get_file_as_string("G:/CODE/CFGCN/source/audio/godot-b-v1/inputs.json"));director.configure({"assets":meta.actorAssets,"speech_policy":meta.speechPolicy})
	var source="G:/CODE/CFGCN/source/xiyou/godot/character-motion-v70/legacy-native-save-v69.json";var digest=FileAccess.get_sha256(source)
	shell.begin_load("load",source)
	for i in 2400:
		await get_tree().process_frame
		if shell.screen=="play" or shell.loading_failed:break
	if shell.screen!="play":push_error("Real clarity main load failed");get_tree().quit(2);return
	game=shell.game;active=true;start_frame=Engine.get_frames_drawn();Input.action_press("cfg_move_up")
	for i in 450:
		await get_tree().process_frame
		if game.state.growth.pending!=null:
			if game.state.growth.pending.recipient==null:game.send({"growth_member":4})
			else:game.send({"growth_choice":0})
	Input.action_release("cfg_move_up");active=false
	for i in 12:await get_tree().process_frame
	var temp=OS.get_environment("CFGCN_AUDIO_TEMP");var out=OS.get_environment("CFGCN_AUDIO_QA")
	for side in records:
		records[side].set_recording_active(false);records[side].get_recording().save_to_wav(temp+"/native-"+side+".wav")
	var b2=audio.report();var keys={};var duplicate_releases=0
	for row in b2.history:
		if row.kind!="effect":continue
		var data=row.details.source
		if data.get("kind","")=="actual-skill-release":
			var event=data.event;var key=str(event.actor)+":"+str(event.token)
			if keys.has(key):duplicate_releases+=1
			keys[key]=true;releases.B2.append(row)
	var data={"passed":preserved and readonly_checks>0 and duplicate_releases==0 and FileAccess.get_sha256(source)==digest,"referenceReleases":releases.B1.size(),"newReleases":releases.B2.size(),"duplicateB2ReleaseTokens":duplicate_releases,"readonlyCoreChecks":readonly_checks,"sourceSha256":digest,"startFrame":start_frame,"seconds":15.0,"masterGain":db_to_linear(AudioServer.get_bus_volume_db(0)),"reference":reference.report(),"current":b2,"scope":"One actual native Lv38 game and real movement/automatic casts. B1 reference director/mixer observes the same state without mutating rules. Native paired pre-Master-fader captures; one common Master gain applies to both on export. Fixed-FPS comparison is not a performance benchmark."}
	var file=FileAccess.open(out+"/clarity.json",FileAccess.WRITE);file.store_string(JSON.stringify(data,"\t"));file.close()
	reference.shutdown();reference.queue_free();await audio.prepare_shutdown()
	for pair in [["B1","ReferenceB1Return"],["B2","Master"]]:
		var bus=AudioServer.get_bus_index(pair[1]);AudioServer.remove_bus_effect(bus,AudioServer.get_bus_effect_count(bus)-1)
	for name in ["ReferenceB1Music","ReferenceB1Effects","ReferenceB1Voice","ReferenceB1Return","ReferenceB1Silent"]:AudioServer.remove_bus(AudioServer.get_bus_index(name))
	get_tree().quit(0 if data.passed else 1)
func _process(delta:float) -> void:
	if not active:return
	sample_frames+=1
	var state=game.state;var original=game.core.save_json() if sample_frames%30==0 else ""
	var frame=director.observe(state,audio.wall_clock,reference.voice.playing,shell.screen!="play")
	reference.sync_pause(frame.paused);reference.set_context(frame.mood,frame.position)
	for row in frame.cues:
		reference.effect(row.id,row.priority,row.gain,row.get("ui",false),row.get("details",{}))
		if row.details.kind=="actual-skill-release":releases.B1.append(row)
	if frame.voice!=null:reference.speak(frame.voice)
	reference.tick(delta)
	if not original.is_empty():readonly_checks+=1;preserved=preserved and original==game.core.save_json()
