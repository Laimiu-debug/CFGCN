extends SceneTree
## Two accelerated boundary crossings per native music stream. This checks
## engine looping only; it is not two complete musical listening passes.
var rows=[]
var elapsed=0.0
var reseeked=false
var out=""
func _initialize() -> void:call_deferred("run")
func run() -> void:
	out=OS.get_environment("CFGCN_AB_OUTPUT")
	var repo=ProjectSettings.globalize_path("res://../../../")
	var manifest=JSON.parse_string(FileAccess.get_file_as_string(repo+"source/audio/desktop-ab-v1/manifest.json"))
	for row in manifest.assets:
		if row.kind!="music":continue
		AudioServer.add_bus();var bus=AudioServer.bus_count-1;AudioServer.set_bus_name(bus,row.id);AudioServer.set_bus_send(bus,"Master")
		var record=AudioEffectRecord.new();record.format=AudioStreamWAV.FORMAT_16_BITS;AudioServer.add_bus_effect(bus,record);record.set_recording_active(true)
		var stream=AudioStreamWAV.load_from_file(repo+row.runtime);stream.loop_mode=AudioStreamWAV.LOOP_FORWARD;stream.loop_begin=int(row.loopStartFrame);stream.loop_end=int(row.frames)
		var player=AudioStreamPlayer.new();root.add_child(player);player.stream=stream;player.bus=row.id;player.play(stream.get_length()-1.0)
		rows.append({"id":row.id,"player":player,"record":record,"last":stream.get_length()-1.0,"wraps":[],"length":stream.get_length(),"loopBegin":stream.loop_begin,"loopEnd":stream.loop_end})
	while elapsed<6.2:
		await process_frame;elapsed+=1.0/30.0
		for row in rows:
			var position=row.player.get_playback_position()
			if row.last>30 and position<5:row.wraps.append({"time":elapsed,"position":position})
			row.last=position
		if elapsed>3 and not reseeked:
			for row in rows:row.player.seek(row.length-1.0)
			reseeked=true
	var result=[]
	for row in rows:
		row.record.set_recording_active(false);row.record.get_recording().save_to_wav(out+"/"+row.id+"-native-loops.wav")
		result.append({"id":row.id,"wraps":row.wraps,"length":row.length,"loopBegin":row.loopBegin,"loopEnd":row.loopEnd,"passed":row.wraps.size()==2})
	var file=FileAccess.open(out+"/native-loop-check.json",FileAccess.WRITE);file.store_string(JSON.stringify({"passed":result.all(func(r):return r.passed),"streams":result,"scope":"Two real engine boundary crossings using explicit end seeks; not complete listening passes."},"\t"));file.close()
	var passed=result.all(func(r):return r.passed)
	print("NATIVE_LOOP_CHECK "+JSON.stringify(result))
	for row in rows:
		row.player.queue_free();AudioServer.remove_bus(AudioServer.get_bus_index(row.id))
	rows.clear();await process_frame;await process_frame;quit(0 if passed else 1)
