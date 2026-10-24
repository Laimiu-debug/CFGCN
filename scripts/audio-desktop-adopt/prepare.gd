extends SceneTree
func _initialize() -> void:call_deferred("run")
func digest(data:PackedByteArray) -> String:
	var hashing=HashingContext.new();hashing.start(HashingContext.HASH_SHA256);hashing.update(data);return hashing.finish().hex_encode()
func run() -> void:
	var path=OS.get_environment("CFGCN_AUDIO_INPUTS")
	var inputs=JSON.parse_string(FileAccess.get_file_as_string(path));var results=[]
	for row in inputs.resources:
		if FileAccess.get_sha256(row.source)!=row.sourceSha256:push_error("Audio source changed: "+row.id);quit(1);return
		var stream
		if row.method=="wav-native-resource":
			stream=AudioStreamWAV.load_from_file(row.source)
			if stream==null or digest(stream.data)!=row.pcmSha256:push_error("PCM differs: "+row.id);quit(2);return
			if row.kind=="music":stream.loop_mode=AudioStreamWAV.LOOP_FORWARD;stream.loop_begin=int(row.loopBegin);stream.loop_end=int(row.loopEnd)
		elif row.method=="exact-mp3-data":
			stream=AudioStreamMP3.new();stream.data=FileAccess.get_file_as_bytes(row.source)
		else:
			var data=FileAccess.get_file_as_bytes(row.source)
			var file=FileAccess.open(row.output,FileAccess.WRITE);file.store_buffer(data);file.close()
			stream=load(row.output)
		if row.method!="exact-native-resource":
			var error=ResourceSaver.save(stream,row.output,ResourceSaver.FLAG_COMPRESS)
			if error!=OK:push_error("Resource save failed: "+row.id);quit(3);return
		var loaded=ResourceLoader.load(row.output,"",ResourceLoader.CACHE_MODE_IGNORE)
		if not loaded is AudioStream:push_error("Native audio load failed: "+row.id);quit(4);return
		if row.method=="wav-native-resource" and digest(loaded.data)!=row.pcmSha256:push_error("Native PCM differs: "+row.id);quit(5);return
		results.append({"id":row.id,"output":row.output,"sha256":FileAccess.get_sha256(row.output),"seconds":loaded.get_length(),"loop":row.kind=="music"})
	var out=FileAccess.open(path.get_base_dir()+"/prepared.json",FileAccess.WRITE);out.store_string(JSON.stringify({"resources":results,"exactPcm":true,"incrementalCredits":0},"\t"));out.close()
	print("AUDIO_B_PREPARED "+str(results.size()));quit()
