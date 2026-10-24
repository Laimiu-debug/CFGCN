extends "res://addons/xiyou_integrated/skill_fx_v77/shapes.gd"
## Build once; same original shape reader, normal depth and original pool budget.
func configure(file: String) -> Error:
	var result=super.configure(file)
	if result!=OK:return result
	var extra=load("res://addons/xiyou_integrated/skill_fx_v77/shapes.gd").new()
	result=extra.configure("res://addons/cfgcn_shadow/flights_v89/wave-geometry.json")
	if result!=OK:return result
	for key in extra._meshes:_meshes[key]=extra._meshes[key]
	return OK
