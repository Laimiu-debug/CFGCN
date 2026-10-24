extends Node
func run(shell) -> void:
	var catalogue=load("res://scripts/catalogue.gd");var rows=[]
	for id in ["maps/shanshen-v1","maps/yezhu-v1","maps/huangnigang-v1","maps/qingzhou-v1","maps/liangshan-v1","maps/ludang-v1","maps/jiangzhou-v1"]:
		var data=catalogue.read_data(id);var path=str(data.get("scene",""))
		rows.append({"record":id,"scene":path,"fileExists":FileAccess.file_exists(path),"resourceExists":ResourceLoader.exists(path),
			"expectedSha256":data.get("scene_sha256",""),"actualSha256":FileAccess.get_sha256(path)})
	var actors=catalogue.read_data("native-actors-v1")
	for id in actors.actors:
		var spec=actors.actors[id];var path=str(spec.scene)
		rows.append({"actor":id,"scene":path,"fileExists":FileAccess.file_exists(path),"resourceExists":ResourceLoader.exists(path),
			"expectedSha256":spec.sha256,"actualSha256":FileAccess.get_sha256(path)})
	var file=FileAccess.open(OS.get_environment("CFGCN_AUDIO_QA")+"/assetprobe.json",FileAccess.WRITE)
	file.store_string(JSON.stringify({"rows":rows,"scope":"Read-only raw resource/SHA diagnostics inside the actual shipping PCK; no gate bypass or game mutation."},"\t"));file.close()
	await get_node("/root/CFGCNAudio").prepare_shutdown();get_tree().quit()
