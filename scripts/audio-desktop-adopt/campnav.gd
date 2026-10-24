extends Node
func run(shell) -> void:
	shell.begin_load("new")
	for i in 2400:
		await get_tree().process_frame
		if shell.screen=="play" or shell.loading_failed:break
	var game=shell.game
	for i in 100:await get_tree().process_frame
	var view=game.camp_view;view.selected_mission="M01";view.selected_route="receive";view.show_tab("missions")
	for i in 8:await get_tree().process_frame
	await RenderingServer.frame_post_draw
	var out=OS.get_environment("CFGCN_AUDIO_QA")
	get_viewport().get_texture().get_image().save_png(out+"/missions.png")
	var buttons=[]
	for button in view.body.find_children("*","Button",true,false):buttons.append({"text":button.text,"disabled":button.disabled})
	var data={"screen":shell.screen,"playMode":game.play_mode,"missionReady":game.mission_ready,"availableM01":game.mission_available("M01"),
		"missionMapAvailable":game.mission_scene.has_map("maps/shanshen-v1"),"bootstrapMessage":game.bootstrap_message,
		"registeredButtons":view.buttons.keys(),"visibleButtons":buttons,"campaign":game.campaign.state,
		"scope":"Read-only diagnostics after normal new-game and public mission-tab selection; no game state repair or reward injection."}
	var file=FileAccess.open(out+"/campnav.json",FileAccess.WRITE);file.store_string(JSON.stringify(data,"\t"));file.close()
	await get_node("/root/CFGCNAudio").prepare_shutdown();get_tree().quit()
