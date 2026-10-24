extends SceneTree
func _initialize() -> void:
	var core=ClassDB.instantiate("XiyouCore")
	var file=FileAccess.open(OS.get_environment("CFGCN_AUDIO_QA")+"/skills-native.json",FileAccess.WRITE)
	file.store_string(core.skills_json());file.close();core=null
	quit()
