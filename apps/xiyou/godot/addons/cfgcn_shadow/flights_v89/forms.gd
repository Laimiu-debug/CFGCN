extends "res://addons/xiyou_integrated/skill_fx_v77/flight_forms.gd"
## One actual WhiteWaveStep recipe. Every other original recipe is inherited.
func compose(b: Dictionary,head: Vector3,view: Basis,home: Dictionary,emission: Dictionary,reduced: bool) -> Array:
	if int(b.owner)!=4 or int(b.kind)!=4:
		return super.compose(b,head,view,home,emission,reduced)
	_marks.clear()
	var direction=Vector3(float(b.direction.x),0,float(b.direction.z))
	var local=view.inverse()*direction
	var q=_q(view,atan2(local.y,local.x))
	var age=float(b.age)
	var grow=_ease(age/.15)
	var fade=_ease(float(b.ttl)/.15)
	var size=Vector2(.86+grow*.18,.95+grow*.15)
	# Folded crest at the real head; thin broken tail trails behind it.
	_ink("wave_v89",0,27,head-view.z*.006,q,size*1.035,fade*.52)
	_ink("wave_v89",0,21,head,q,size,fade*.88)
	_ink("wave_v89",1,22,head+view.z*.005,q,size,fade*.94)
	if not reduced:
		_ink("wave_v89",2,21,head-view.z*.004,q,size,fade*.64)
		_ink("wave_v89",3,22,head+view.z*.008,q,size,fade*.91)
	return _marks.duplicate()
