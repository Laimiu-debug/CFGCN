extends Node3D
## Only actual ordinary poses and native bolts40/41. No gameplay assignments.
signal cue(event: Dictionary)
const Ink=preload("res://addons/cfgcn_shadow/minions_v88/ink.gdshader")
const Forms=preload("res://addons/cfgcn_shadow/minions_v88/ink_forms.gd")
const BLOCK=2046
const PIGMENTS=[Color("263c34"),Color("f3e9c3"),Color("a64936"),Color("9b8255")]
const CONTACT={0:.3198,1:.648,10:.56,11:.48,12:.90,13:.70}
const CLIPS={0:"SaberSlash",1:"AxeCleave",10:"StoneThrow",11:"SpearThrust",12:"RootSlam",13:"TalismanCast"}
var mesh: ArrayMesh
var drawing: MeshInstance3D
var vertices=PackedVector3Array()
var used=[0,0,0,0]
var forms=Forms.new()
var camera: Camera3D
var locate: Callable
var anchors: Callable
var origin=Vector3.ZERO
var reduced=false
var clock=-1.
var histories={}
var births={}
var consumed={}
var events=[]
var counters={}
var flight_heights={}
func configure(source_tracks) -> Error:
	# Stable source release-plane height survives restore after the caster dies.
	for profile in source_tracks.rows:
		var id=str(source_tracks.rows[profile].source.id)
		if id not in ["shanxiao","foxtalisman"]:continue
		var kind=40 if id=="shanxiao" else 41;var source_kind=10 if kind==40 else 13
		var name="hand.front"
		var point=source_tracks.sample(profile,CLIPS[source_kind],CONTACT[source_kind],name)
		if not point is Vector3:return ERR_INVALID_DATA
		flight_heights[kind]=maxf(.15,point.y)
	if flight_heights.size()!=2:return ERR_INVALID_DATA
	mesh=ArrayMesh.new();vertices.resize(BLOCK*4)
	var colors=PackedColorArray();colors.resize(vertices.size())
	for i in vertices.size():colors[i]=PIGMENTS[i/BLOCK]
	var arrays=[];arrays.resize(Mesh.ARRAY_MAX);arrays[Mesh.ARRAY_VERTEX]=vertices;arrays[Mesh.ARRAY_COLOR]=colors
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,arrays,[],{},Mesh.ARRAY_FLAG_USE_DYNAMIC_UPDATE)
	mesh.custom_aabb=AABB(Vector3(-26,-14,-26),Vector3(52,42,52))
	drawing=MeshInstance3D.new();drawing.mesh=mesh;drawing.cast_shadow=GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var material=ShaderMaterial.new();material.shader=Ink;drawing.material_override=material;drawing.visible=false;add_child(drawing)
	forms.get_shape("stone");forms.get_shape("talisman");return OK
func reset() -> void:
	clock=-1.;histories.clear();births.clear();events.clear();consumed.clear();counters.clear()
	if is_instance_valid(drawing):drawing.visible=false
func native_at(point: Dictionary) -> Vector3:return global_transform*locate.call(point)
func stroke(points: Array,width: float,paint: int) -> bool:
	var needed=maxi(0,points.size()-1)*6
	if used[paint]+needed>BLOCK:counters.skippedDecorations+=1;return false
	for i in range(1,points.size()):
		var a: Vector3=points[i-1];var b: Vector3=points[i];var delta=b-a
		if delta.length_squared()<.000001:continue
		var side=camera.global_basis.z.cross(delta).normalized()*width*.5;var base=paint*BLOCK+used[paint]
		for pair in [[a-side,0],[a+side,1],[b-side,2],[a+side,3],[b+side,4],[b-side,5]]:vertices[base+pair[1]]=pair[0]-origin
		used[paint]+=6
	return true
func brush(points: Array,width: float,paint: int) -> void:
	var n=maxi(0,points.size()-1)*6
	if used[0]+n>BLOCK or used[paint]+n>BLOCK:counters.skippedDecorations+=1;return
	stroke(points,width*1.5,0);stroke(points.map(func(p):return p+camera.global_basis.z*.004),width,paint)
func symbol(name: String,position_: Vector3,scale_: float,angle: float) -> bool:
	var shape=forms.get_shape(name)
	for paint in 4:
		if used[paint]+shape[paint].size()>BLOCK:counters.projectileFallbacks+=1;return false
	var right=camera.global_basis.x*cos(angle)+camera.global_basis.y*sin(angle)
	var up=-camera.global_basis.x*sin(angle)+camera.global_basis.y*cos(angle)
	var basis=Basis(right*scale_,up*scale_,camera.global_basis.z)
	for paint in 4:
		var base=paint*BLOCK+used[paint]
		for i in shape[paint].size():vertices[base+i]=position_+basis*shape[paint][i]-origin
		used[paint]+=shape[paint].size()
	return true
func emit_event(event: Dictionary,fresh: bool,paused: bool) -> void:
	if not fresh or paused:return
	events.append(event.duplicate(true));if events.size()>48:events.pop_front()
	cue.emit(event.duplicate(true))
func projectile(b: Dictionary,ordinary: Dictionary,now: float,fresh: bool,paused: bool) -> void:
	var id=int(b.id);var source=int(b.source);var kind=int(b.kind);var source_kind=10 if kind==40 else 13
	if not births.has(id):
		if ordinary.has(source) and int(ordinary[source].kind)!=source_kind:return
		var name="hand.front"
		var point=anchors.call(source,name) if ordinary.has(source) else null
		var resolved=point is Vector3
		if not resolved and float(b.age)<.09:counters.missingLaunchSockets+=1;return
		var height=float(flight_heights[kind])
		if not resolved:point=native_at(b.origin)+camera.global_basis.y*height
		births[id]={"point":point,"height":height,"kind":kind,"source":source,"socket":name,"socketResolved":resolved}
		if float(b.age)<.08:
			emit_event({"kind":"ordinary-projectile-release","sourceFoe":source,"sourceKind":source_kind,"bolt":id,"nativeKind":kind,"socket":name,"at":now},fresh,paused)
	var start=births[id];var p=native_at(b.pos)+camera.global_basis.y*float(start.height)
	var join=clampf(float(b.age)/.09,0.,1.);p=start.point.lerp(p,join*join*(3.-2.*join))
	if not camera.is_position_in_frustum(p):return
	var direction=global_basis*Vector3(b.direction.x,0,b.direction.z)
	var angle=atan2(direction.dot(camera.global_basis.y),direction.dot(camera.global_basis.x))-PI*.5
	if kind==40:angle=-.3 if reduced else -.3+float(b.age)*5.2
	elif not reduced:angle+=sin(float(b.age)*7.+float(id))*.10
	if not symbol("stone" if kind==40 else "talisman",p,float(b.radius)/.24 if kind==40 else 1.,angle):return
	consumed[id]=true;counters.stones+=int(kind==40);counters.talismans+=int(kind==41)
	var tail=minf(.48,float(b.age)*float(b.speed))
	if tail>.07:
		var a=p-direction*tail;var b_=p-direction*.13
		brush([a,a.lerp(b_,.5)+camera.global_basis.y*.025,b_],.025 if kind==40 else .032,3 if kind==40 else 2)
	counters.drawnProjectiles.append({"id":id,"kind":kind,"source":source,"age":b.age,"socket":start.socket,"point":{"x":p.x,"y":p.y,"z":p.z},"socketResolved":start.socketResolved,"sourcePoint":{"x":start.point.x,"y":start.point.y,"z":start.point.z} if start.socketResolved else null})
func melee(e: Dictionary,now: float,fresh: bool,paused: bool) -> void:
	var id=int(e.id);var kind=int(e.kind);var clip=str(e.visual.clip);var time=float(e.visual.seconds)
	if not CONTACT.has(kind) or clip!=CLIPS[kind] or float(e.control)>0.:histories.erase(id);return
	var tip=anchors.call(id,"weapon.tip")
	if not tip is Vector3:counters.missingWeaponSockets+=1;return
	var old=histories.get(id,{"seconds":time,"at":now,"points":[],"clip":clip})
	if time<float(old.seconds) or clip!=str(old.clip) or now-float(old.at)>.25:old={"seconds":time,"at":now,"points":[],"clip":clip}
	var contact=float(CONTACT[kind])
	if time>=contact and float(old.seconds)<contact:
		emit_event({"kind":"ordinary-melee-release","sourceFoe":id,"sourceKind":kind,"clip":clip,"socket":"weapon.tip","at":now},fresh,paused)
	var points: Array=old.points
	if fresh:
		points.append({"at":now,"point":tip})
		while points.size()>6 or not points.is_empty() and now-float(points[0].at)>.12:points.pop_front()
	histories[id]={"seconds":time,"at":now,"points":points,"clip":clip}
	if time<contact-.09 or time>contact+.16 or not camera.is_position_in_frustum(tip):return
	counters.drawnMelee.append({"id":id,"kind":kind,"seconds":time,"clip":clip,"point":{"x":tip.x,"y":tip.y,"z":tip.z}})
	if not reduced and points.size()>1:
		brush(points.map(func(p):return p.point),.052 if kind==1 else .036,3 if kind in [1,12] else 2)
		counters.weaponTrails+=1
	if time>=contact and time<contact+.10:
		var right=camera.global_basis.x;var up=camera.global_basis.y
		if kind==11:
			var center=anchors.call(id,"weapon.center")
			if center is Vector3:
				var d=(tip-center).normalized();var side=camera.global_basis.z.cross(d).normalized()
				brush([tip-d*.17+side*.065,tip,tip-d*.17-side*.065],.024,1)
		elif kind==12:
			for sign_ in [-1.,1.]:brush([tip+right*.08*sign_,tip+right*.18*sign_+up*.13,tip+right*.22*sign_+up*.10],.026,3)
		else:brush([tip-right*.09-up*.04,tip+up*.08,tip+right*.09],.024,1)
func update_state(state: Dictionary,view: Camera3D,ground: Callable,sockets: Callable,reduced_motion=false) -> void:
	var started=Time.get_ticks_usec();camera=view;locate=ground;anchors=sockets;reduced=reduced_motion
	if state.is_empty():reset();return
	var now=float(state.elapsed)
	if now<clock:reset()
	var fresh=clock>=0. and now>clock and now-clock<.25;clock=now
	consumed.clear();used=[0,0,0,0];vertices.fill(Vector3.ZERO)
	counters={"vertices":0,"capacity":BLOCK*4,"meshInstances":1,"materials":1,"stones":0,"talismans":0,"weaponTrails":0,"missingLaunchSockets":0,"missingWeaponSockets":0,"projectileFallbacks":0,"skippedDecorations":0,"drawnProjectiles":[],"drawnMelee":[],"updateUsec":0,"groundRangeRings":0}
	origin=native_at(state.heroes[int(state.leader)].pos);drawing.global_transform=Transform3D(Basis.IDENTITY,origin)
	var ordinary={};var live={};var active_bolts={}
	for e in state.enemies:
		if int(e.role)==0 and CONTACT.has(int(e.kind)):
			ordinary[int(e.id)]=e
			if e.hp>0.:live[int(e.id)]=true
	# Actual projectiles get the fixed pool before decorative weapon strokes.
	for b in state.bolts:
		if int(b.owner)!=5 or int(b.kind) not in [40,41] or b.source==null:continue
		active_bolts[int(b.id)]=true;projectile(b,ordinary,now,fresh,bool(state.paused))
	for e in state.enemies:
		if e.hp>0. and int(e.role)==0 and int(e.kind) in [0,1,11,12]:melee(e,now,fresh,bool(state.paused))
	for id in births.keys():
		if not active_bolts.has(id):births.erase(id)
	for id in histories.keys():
		if not live.has(id):histories.erase(id)
	mesh.surface_update_vertex_region(0,0,vertices.to_byte_array());drawing.visible=used.any(func(n):return n>0)
	counters.vertices=used.reduce(func(a,b):return a+b,0);counters.byPigment=used.duplicate();counters.updateUsec=Time.get_ticks_usec()-started
func consumes_bolt(id: int) -> bool:return consumed.has(id)
func report() -> Dictionary:
	var result=counters.duplicate(true);result.events=events.duplicate(true);result.cachedFlights=births.size();result.cachedWeapons=histories.size();return result
