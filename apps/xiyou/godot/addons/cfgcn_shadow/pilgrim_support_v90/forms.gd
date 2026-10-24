extends "res://addons/xiyou_integrated/skill_fx_v77/support_forms.gd"
## Actual healing cue/source/recipient and actual TangSeng protection only.
## No status inference, no HP, skill, target or control writes.
func healing(c: Dictionary,emission: Dictionary,chest: Vector3,view: Basis,reduced: bool) -> Array:
	var original=super.healing(c,emission,chest,view,reduced)
	if original.is_empty():return original
	var out: Array=[]
	var age=float(c.elapsed)
	var fade=1.0-_ease((age-.09)/(.74-.09))
	var recipient=int(c.target_actor) if c.get("target_actor")!=null else int(c.actor)
	var height=float(settings.profiles[clampi(recipient,0,4)].height)
	var target=chest+view*Vector3(0,-height*.12,.025)
	var travel=_ease(age/.28)
	var center: Vector3=emission.start.lerp(target,travel)+view.y*sin(PI*travel)*height*.055
	var opened=_ease(age/.26)
	var size=Vector2(.30+opened*.62,.29+opened*.57)
	var q=_turn(view,0.0 if reduced else sin(age*5.5)*.025)
	_flat(out,"pilgrim_v90",0,27,center-view.z*.004,q,size*1.04,fade*.43)
	_flat(out,"pilgrim_v90",0,20,center,q,size,fade*.98)
	_flat(out,"pilgrim_v90",1,22,center+view.z*.005,q,size,fade*.92)
	_flat(out,"pilgrim_v90",2,23,center+view.z*.008,q,size,fade*.70)
	if not reduced and age<.32:
		var a: Vector3=emission.start
		var d: Vector3=center-a
		var y: Vector3=view.z.cross(d)
		if d.length()>.18 and y.length_squared()>.000001:
			var x=d.normalized();y=y.normalized();var basis=Basis(x,y,x.cross(y).normalized())
			_flat(out,"pilgrim_v90",4,20,a,basis,Vector2(d.length(),.7),fade*.58*(1.0-_ease((age-.20)/.12)))
	return out
func guard(actor: int,h: Dictionary,chest: Vector3,view: Basis,reduced: bool) -> Array:
	var original=super.guard(actor,h,chest,view,reduced)
	if actor!=0 or float(h.hp)<=0.0 or int(h.beads)>0 or (float(h.shield)<=0.0 and float(h.guard)<=0.0 and float(h.reduction)<=0.0):return original
	# Preserve original link/veil/etc; remove only the old TangSeng torso plate.
	var out=original.filter(func(m):return not (str(m.family)=="inscribed" and int(m.kind)==5))
	var height=float(settings.profiles[0].height)
	var alpha=.50+clampf(float(h.shield)/45.,0.,1.)*.24 if float(h.shield)>0. else .60
	var center=chest+view*Vector3(0,-height*.10,.06)
	var size=Vector2(height*.88,height*.70)
	_flat(out,"pilgrim_v90",3,27,center-view.z*.004,view,size*1.025,alpha*.43)
	_flat(out,"pilgrim_v90",3,20,center,view,size,alpha*.96)
	if not reduced:_flat(out,"pilgrim_v90",5,22,center+view.z*.004,view,size,alpha*.80)
	return out
