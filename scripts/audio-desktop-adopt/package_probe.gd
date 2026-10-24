extends Node
func run(shell) -> void:
	var file=FileAccess.open(OS.get_environment("CFGCN_AUDIO_QA")+"/entry-probe.json",FileAccess.WRITE)
	file.store_string(JSON.stringify({"executable":OS.get_executable_path(),"defaultScene":ProjectSettings.get_setting("application/run/main_scene"),"actualShell":shell.scene_file_path,"scope":"Default packaged shell/external QA hook compatibility probe only; not B2 or final package acceptance."},"\t"));file.close()
	for i in 3:await get_tree().process_frame
	get_tree().quit()
