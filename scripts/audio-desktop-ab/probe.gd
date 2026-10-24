extends SceneTree
func _initialize() -> void:call_deferred("run")
func run() -> void:
	var out=OS.get_environment("CFGCN_AB_OUTPUT")
	var result={"engine":Engine.get_version_info(),"coreAvailable":ClassDB.class_exists("XiyouCore")}
	if result.coreAvailable:
		var core=ClassDB.instantiate("XiyouCore")
		var source=OS.get_environment("CFGCN_AB_SAVE")
		if source!="":result["restore"]=JSON.parse_string(core.restore_json(FileAccess.get_file_as_string(source)))
		var s=JSON.parse_string(core.state_json())
		result["keys"]=s.keys();result["hero"]=s.heroes[0];result["growth"]=s.growth
		for key in ["boss","boss_guests","strokes","hazards","journey","story","choices","intent"]:
			if s.has(key):result[key]=s[key]
	var f=FileAccess.open(out+"/probe.json",FileAccess.WRITE);f.store_string(JSON.stringify(result,"\t"));f.close()
	print("AB_PROBE "+str(result.coreAvailable));quit()
