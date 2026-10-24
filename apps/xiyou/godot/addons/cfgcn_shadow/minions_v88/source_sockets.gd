extends RefCounted
## Read only: matches the current VAT draw including original HitRecoil blend.
const ROOT="res://addons/cfgcn_shadow/minions_v88/sockets/"
var rows={}
var enemies={}
var cache={}
var camera: Camera3D
var crowd: Node3D
var location: Callable
var reactions
var reduced=false
var queries=0
var misses=0
func configure(owner_node: Node3D,base_catalog: Dictionary) -> Error:
	crowd=owner_node
	if not FileAccess.file_exists(ROOT+"catalog.json"):return ERR_CANT_OPEN
	var catalog: Dictionary=JSON.parse_string(FileAccess.get_file_as_string(ROOT+"catalog.json"))
	for record in catalog.models:
		var originals=base_catalog.models.filter(func(x):return int(x.profile)==int(record.profile))
		if originals.size()!=1 or str(originals[0].modelSha256)!=str(record.sourceSHA256):return ERR_INVALID_DATA
		var image=load(record.poses)
		if not image is Image or image.get_width()!=record.sockets.size() or image.get_height()!=int(record.rows):return ERR_FILE_CORRUPT
		var columns={}
		for column in record.sockets.size():columns[str(record.sockets[column])]=column
		rows[int(record.profile)]={"image":image,"clips":record.clips,"columns":columns,"source":record}
	return OK if rows.size()==6 else ERR_INVALID_DATA
func reset() -> void:enemies.clear();cache.clear();queries=0;misses=0
func update_state(state: Dictionary,view: Camera3D,locate: Callable,hit_tracker,reduce_hit_motion: bool) -> void:
	camera=view;location=locate;reactions=hit_tracker;reduced=reduce_hit_motion
	enemies.clear();cache.clear();queries=0;misses=0
	for e in state.get("enemies",[]):
		if int(e.role)==0 and e.hp>0. and rows.has(int(e.profile)):enemies[int(e.id)]=e
func sample(profile: int,clip: String,time: float,socket: String):
	if not rows.has(profile):return null
	var row=rows[profile]
	if not row.clips.has(clip) or not row.columns.has(socket):return null
	var entry=row.clips[clip];var length=float(entry.length)
	var clock=fposmod(time,length) if clip in ["Idle","Walk"] else clampf(time,0.,length-.0001)
	var frame=clock/length*(int(entry.frames)-1);var index=int(entry.row)+floori(frame);var column=int(row.columns[socket])
	var a=row.image.get_pixel(column,index);var b=row.image.get_pixel(column,index+1)
	return Vector3(a.r,a.g,a.b).lerp(Vector3(b.r,b.g,b.b),frame-floorf(frame))
func local_point(enemy: Dictionary,socket: String):
	var profile=int(enemy.profile);var result=sample(profile,str(enemy.visual.clip),float(enemy.visual.seconds),socket)
	if not result is Vector3:return null
	var pulse=absf(reactions.pulse(enemy)) if reactions!=null else 0.
	if not reduced and pulse>.0001:
		var phase=1.-sqrt(pulse);var hit_length=float(rows[profile].clips.HitRecoil.length)
		var hit=sample(profile,"HitRecoil",phase*hit_length,socket)
		if not hit is Vector3:return null
		result=result.lerp(hit,sin(phase*PI)*.45)
	return result
func actual_socket(id: int,socket: String):
	queries+=1
	if not enemies.has(id):return null
	var key=str(id)+"/"+socket
	if cache.has(key):return cache[key]
	var e=enemies[id];var point=local_point(e,socket)
	if not point is Vector3:misses+=1;return null
	var size=float(e.size);var mirror=-1. if e.facing.x>0. else 1.
	var position: Vector3=location.call(e.pos)
	var value=crowd.global_transform*(position+(camera.basis.x*point.x*mirror+camera.basis.y*point.y+camera.basis.z*point.z)*size)
	cache[key]=value;return value
func report() -> Dictionary:return {"profiles":rows.size(),"enemies":enemies.size(),"queries":queries,"missingKnownSockets":misses,"cached":cache.size(),"includesSourceHitRecoilBlend":true,"scope":"same-draw original sockets; no per-enemy skeleton nodes or native state mutation"}
