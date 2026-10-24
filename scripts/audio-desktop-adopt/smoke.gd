extends Node
var checks=[]
func verify(value:bool,name:String) -> void:checks.append({"passed":value,"name":name});print("B_AUDIO_CHECK "+name+" "+str(value))
func run(shell) -> void:
	var out=OS.get_environment("CFGCN_AUDIO_QA")
	var host=get_node("/root/CFGCNAudio")
	var capture=AudioEffectCapture.new();capture.buffer_length=1.0
	AudioServer.add_bus_effect(AudioServer.get_bus_index("Music"),capture)
	for i in 35:await get_tree().process_frame
	var peak=0.0
	for sample in capture.get_buffer(capture.get_frames_available()):peak=maxf(peak,maxf(absf(sample.x),absf(sample.y)))
	verify(host.ready_audio and host.mixer.mood=="menu" and peak>0.0001,"default-desktop-menu-plays-native-B")
	shell.begin_load("new")
	for i in 2400:
		await get_tree().process_frame
		if shell.screen=="play" or shell.loading_failed:break
	verify(shell.screen=="play" and shell.game_active,"default-desktop-loads-current-main-game")
	for i in 90:await get_tree().process_frame
	verify(host.report().version=="B1" and host.mixer.music_id=="music-"+shell.config.id,"game-keeps-one-B-host")
	verify(host.mixer.music.size()==2 and host.mixer.effects.size()==8,"bounded-two-music-eight-effect-pool")
	var data={"passed":checks.all(func(c):return c.passed),"checks":checks,"menuMusicPeak":peak,"audio":host.report(),"game":shell.config.id,"currentEntry":get_tree().current_scene.scene_file_path}
	var file=FileAccess.open(out+"/smoke.json",FileAccess.WRITE);file.store_string(JSON.stringify(data,"\t"));file.close()
	AudioServer.remove_bus_effect(AudioServer.get_bus_index("Music"),AudioServer.get_bus_effect_count(AudioServer.get_bus_index("Music"))-1)
	shell.save_then_leave("menu")
	for i in 5:await get_tree().process_frame
	host.queue_free()
	for i in 3:await get_tree().process_frame
	get_tree().quit(0 if data.passed else 1)
