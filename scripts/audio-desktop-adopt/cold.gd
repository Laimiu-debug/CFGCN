extends Node
func run(shell) -> void:
	var audio=get_node("/root/CFGCNAudio");var phase=OS.get_environment("CFGCN_AUDIO_PHASE");var checks=[]
	var expected=0.0 if phase=="muted" else 0.73
	checks.append({"name":"cold-saved-four-volumes","passed":is_equal_approx(shell.store.values.master,expected) and is_equal_approx(shell.store.values.music,0.28) and is_equal_approx(shell.store.values.effects,0.61) and is_equal_approx(shell.store.values.voice,0.37)})
	var tap=AudioEffectCapture.new();tap.buffer_length=1.0;var bus=AudioServer.get_bus_index("Master");AudioServer.add_bus_effect(bus,tap)
	for i in 45:await get_tree().process_frame
	var peak=0.0
	for sample in tap.get_buffer(tap.get_frames_available()):peak=maxf(peak,maxf(absf(sample.x),absf(sample.y)))
	checks.append({"name":"cold-native-output-matches-saved-Master","passed":peak<0.00001 if phase=="muted" else peak>0.0001})
	if phase=="muted":
		shell.begin_load("continue")
		for i in 2400:
			await get_tree().process_frame
			if shell.screen=="play" or shell.loading_failed:break
		for i in 20:await get_tree().process_frame
		checks.append({"name":"second-process-continues-actual-isolated-game-save","passed":shell.screen=="play" and shell.game_active})
		tap.clear_buffer()
		for i in 20:await get_tree().process_frame
		var game_peak=0.0
		for sample in tap.get_buffer(tap.get_frames_available()):game_peak=maxf(game_peak,maxf(absf(sample.x),absf(sample.y)))
		checks.append({"name":"cold-continued-game-respects-saved-Master-zero","passed":game_peak<0.00001})
		shell.open_pause()
	shell.open_settings();shell.edit_setting("master",0.73 if phase=="muted" else 0.0);shell.commit_settings()
	checks.append({"name":"actual-settings-change-persisted","passed":shell.store.saved.master==(0.73 if phase=="muted" else 0.0)})
	var result={"passed":checks.all(func(c):return c.passed),"phase":phase,"game":shell.config.id,"checks":checks,"peak":peak,"profile":shell.store.config_path,"saved":shell.store.saved}
	var file=FileAccess.open(OS.get_environment("CFGCN_AUDIO_QA")+"/cold.json",FileAccess.WRITE);file.store_string(JSON.stringify(result,"\t"));file.close()
	shell.save_then_leave("menu")
	for i in 5:await get_tree().process_frame
	AudioServer.remove_bus_effect(bus,AudioServer.get_bus_effect_count(bus)-1);audio.queue_free()
	for i in 3:await get_tree().process_frame
	get_tree().quit(0 if result.passed else 1)
