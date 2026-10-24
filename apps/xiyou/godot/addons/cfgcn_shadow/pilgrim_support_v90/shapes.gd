extends "res://addons/xiyou_integrated/skill_fx_v77/shapes.gd"
func configure(file: String) -> Error:
	var result=super.configure(file)
	if result!=OK:return result
	var extra=load("res://addons/xiyou_integrated/skill_fx_v77/shapes.gd").new()
	result=extra.configure("res://addons/cfgcn_shadow/pilgrim_support_v90/geometry.json")
	if result!=OK:return result
	for key in extra._meshes:_meshes[key]=extra._meshes[key]
	return OK
