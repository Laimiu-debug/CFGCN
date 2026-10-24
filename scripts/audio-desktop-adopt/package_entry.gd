extends Node
## External driver through the existing default shell's --desktop-qa hook.
## Release templates reject --path overrides. Keep real packaged startup intact.
func run(shell) -> void:
	var delivery_path=OS.get_environment("CFGCN_AUDIO_DELIVERY")
	if not delivery_path.is_empty():
		var delivery=JSON.parse_string(FileAccess.get_file_as_string(delivery_path))
		var audio=get_node("/root/CFGCNAudio");var meta=audio.Library.META
		var expected=delivery.games.filter(func(g):return g.game==shell.config.id)
		var rows=[];var valid=delivery.passed and delivery.version==meta.version and expected.size()==1
		if expected.size()==1:
			var assets=expected[0].runtimeFiles.filter(func(r):return r.runtimePath.ends_with(".res"))
			valid=valid and assets.size()==meta.assets.size()
			for row in assets:
				var actual=FileAccess.get_sha256(row.runtimePath)
				rows.append({"path":row.runtimePath,"expectedSha256":row.sha256,"actualSha256":actual,"passed":actual==row.sha256})
				valid=valid and actual==row.sha256
		var identity={"passed":valid,"game":shell.config.id,"audioVersion":meta.version,"audioResourceManifest":meta.manifestSha256,
			"executable":OS.get_executable_path(),"defaultScene":ProjectSettings.get_setting("application/run/main_scene"),
			"deliveryPath":delivery_path,"deliverySha256":FileAccess.get_sha256(delivery_path),"activeAssets":rows,
			"scope":"Actual executable loads this PCK and its own default shell/audio resources; external driver is QA-only."}
		var proof=FileAccess.open(OS.get_environment("CFGCN_AUDIO_QA")+"/package-runtime.json",FileAccess.WRITE)
		proof.store_string(JSON.stringify(identity,"\t"));proof.close()
		if not valid:push_error("Package audio differs from the specified immutable handoff");get_tree().quit(3);return
	var path=OS.get_environment("CFGCN_AUDIO_DRIVER_SCRIPT")
	if path.is_empty():push_error("External package audio driver not specified");get_tree().quit(2);return
	var script=load(path)
	if script==null:push_error("External package driver could not load");get_tree().quit(2);return
	var driver=script.new();add_child(driver)
	await driver.run(shell)
