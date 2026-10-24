extends Node
## One persistent B mixer; shared settings own all four bus volumes.
var streams={}
var music=[]
var effects=[]
var voice:AudioStreamPlayer
var played={}
var history=[]
var current=-1
var outgoing=-1
var music_id=""
var mood=""
var fade=1.6
var gains=[0.0,0.0]
var from_gain=0.0
var pending_music={}
var paused=false
var clock=0.0
var duck_until=0.0
var last_sound={}
var last_ui_sound={}
var limiter
var dropped=0
var steals=0
var muted_events=0
var max_effects=0
var category_mutes={}
var master_muted=false
var sequence=0
var transitions=0
var closed=false
var policy={}
var last_group_sound={}
var budget_drops={}
var voice_gain=0.9
var route_prefix="" # QA stems only; production uses the existing four buses.
var native_events={}
var native_event_ids=[]
var warning_until=-INF
var music_duck=1.0
var warning_plays=0
var warning_coalesces=0
var ordinary_peak=0

func player(bus:String) -> AudioStreamPlayer:
	var node=AudioStreamPlayer.new();node.bus=route_prefix+bus;add_child(node);return node
func configure(bank:Dictionary,theme:String,mix_policy:Dictionary={}) -> void:
	streams=bank;music_id=theme;policy=mix_policy.duplicate(true);policy.version="B2.2";process_mode=Node.PROCESS_MODE_ALWAYS
	for row in [["Music",0.45],["Effects",0.8],["Voice",0.9]]:
		if AudioServer.get_bus_index(row[0])<0:
			AudioServer.add_bus();var i=AudioServer.bus_count-1;AudioServer.set_bus_name(i,row[0]);AudioServer.set_bus_send(i,"Master");AudioServer.set_bus_volume_db(i,linear_to_db(row[1]))
	if not range(AudioServer.get_bus_effect_count(0)).any(func(i):return AudioServer.get_bus_effect(0,i) is AudioEffectHardLimiter):
		limiter=AudioEffectHardLimiter.new();limiter.ceiling_db=-1.2;AudioServer.add_bus_effect(0,limiter)
	for i in 2:music.append(player("Music"))
	for i in 8:effects.append({"node":player("Effects"),"priority":0,"started":0.0,"ui":false,"group":"generic","base_gain":0.0,"duck":1.0})
	voice=player("Voice")
func log_event(kind:String,details:Dictionary={}) -> void:
	if kind=="native-rule-event" and details.has("event_id"):
		var key=str(details.event_id)
		native_events[key]=details.duplicate(true);native_event_ids.append(key)
		if native_event_ids.size()>256:native_events.erase(native_event_ids.pop_front())
	sequence+=1;history.append({"id":sequence,"time":clock,"kind":kind,"details":details})
	if history.size()>512:history.pop_front()
func is_muted(bus:String) -> bool:
	var index=AudioServer.get_bus_index(bus)
	return index>=0 and (AudioServer.is_bus_mute(index) or AudioServer.get_bus_volume_db(index)<=-79.0)
func stop_oneshots() -> void:
	for row in effects:row.node.stop()
	if is_instance_valid(voice):voice.stop()
func sync_pause(value:bool) -> void:
	var was_master=master_muted;master_muted=is_muted("Master")
	paused=value or master_muted
	if master_muted and not was_master:stop_oneshots()
	for name in ["Music","Effects","Voice"]:category_mutes[name]=is_muted(name)
	if category_mutes.Effects:
		for row in effects:row.node.stop()
	if category_mutes.Voice:voice.stop()
	for node in music:node.stream_paused=paused or category_mutes.Music
	for row in effects:row.node.stream_paused=(paused and not row.ui) or master_muted
	voice.stream_paused=paused
func set_context(value:String,position:float=-1.0) -> void:
	if value==mood:pending_music={};return
	if outgoing>=0 and fade<1.6:pending_music={"mood":value,"position":position};return
	if current>=0 and position<0:
		mood=value;pending_music={};log_event("music-context-continued",{"mood":mood});return
	var next=0 if current<0 else 1-current
	music[next].stop();music[next].stream=streams[music_id]
	outgoing=current;from_gain=gains[current] if current>=0 else 0.0
	current=next;fade=0.0;gains[current]=0.0;mood=value;pending_music={};transitions+=1
	music[current].volume_db=-80.0;music[current].play(maxf(0.0,position));music[current].stream_paused=paused or is_muted("Music")
	played[music_id]=int(played.get(music_id,0))+1
	log_event("native-music-transition",{"mood":mood,"position":position,"seconds":1.6})
func effect(id:String,priority:int=50,gain:float=0.46,ui:bool=false,details:Dictionary={}) -> bool:
	if not streams.has(id):return false
	if master_muted or is_muted("Master") or is_muted("Effects") or (paused and not ui):muted_events+=1;return false
	var input_priority=priority
	var shaped=shape_cue(id,priority,gain,details)
	id=shaped.id;priority=shaped.priority;gain=shaped.gain
	if not streams.has(id):return false
	# UI remains usable during a real gameplay pause. Its cooldown uses monotonic
	# wall time; gameplay cues keep the frozen simulation/presentation clock.
	var stamp=Time.get_ticks_usec()/1000000.0 if ui else clock
	var recent=last_ui_sound if ui else last_sound
	var group=effect_group(id,priority,ui,details)
	var key=id+":"+group if group in ["warning","critical"] else id
	var interval=0.18 if group=="warning" else 0.16 if id=="pickup" else 0.09
	if stamp-float(recent.get(key,-INF))<interval:
		if group=="warning":warning_coalesces+=1
		return false
	var gap=0.16 if group=="ordinary" else float(policy.get("skill_global_gap",0.12)) if group=="skill" else float(policy.get("contact_global_gap",0.075)) if group=="contact" else 0.0
	if group not in ["warning","critical","ui"] and clock-float(last_group_sound.get(group,-INF))<gap:
		budget_drops[group]=int(budget_drops.get(group,0))+1;return false
	if group=="ordinary" and effects.filter(func(r):return r.node.playing and r.group=="ordinary").size()>=2:
		budget_drops[group]=int(budget_drops.get(group,0))+1;return false
	# One of the original eight slots belongs to real warning events. Normal
	# contacts, high-priority motion markers and ordinary crowds cannot take it.
	var pool=[effects[0]] if group=="warning" else effects.slice(1)
	var available=pool.filter(func(r):return not r.node.playing)
	var row
	if available.is_empty():
		var sorted=pool.duplicate();sorted.sort_custom(func(a,b):return a.priority<b.priority or (a.priority==b.priority and a.started<b.started))
		if group!="warning" and not (ui and paused) and int(sorted[0].priority)>=priority:dropped+=1;return false
		row=sorted[0];row.node.stop();steals+=1
	else:row=available[0]
	row.priority=priority;row.started=clock;row.ui=ui;row.group=group;row.base_gain=gain;row.duck=effect_duck(group)
	row.node.stream=streams[id];row.node.volume_db=linear_to_db(maxf(0.00001,gain*row.duck))
	row.node.pitch_scale=[0.96,1.0,1.035][int(played.get(id,0))%3] if priority<80 else 1.0
	row.node.stream_paused=false;row.node.play();recent[key]=stamp;last_group_sound[group]=clock
	played[id]=int(played.get(id,0))+1
	if group=="warning":warning_until=maxf(warning_until,clock+0.8);duck_until=maxf(duck_until,warning_until);warning_plays+=1
	elif group=="critical":duck_until=maxf(duck_until,clock+0.3)
	log_event("effect",{"sound":id,"priority":priority,"inputPriority":input_priority,"gain":gain,"group":group,"source":details})
	max_effects=maxi(max_effects,effects.filter(func(r):return r.node.playing).size())
	ordinary_peak=maxi(ordinary_peak,effects.filter(func(r):return r.node.playing and r.group=="ordinary").size())
	return true
func shape_cue(id:String,priority:int,gain:float,details:Dictionary) -> Dictionary:
	var kind=str(details.get("kind",""))
	var event=details.get("event",{})
	if kind=="actual-ordinary-release":
		# These are dry release accents, never an invented impact. Damage stays
		# with the native HP/contact event and the main project's result.
		if int(details.get("sourceKind",-1))==10:id="wood-impact"
		gain*=0.85;priority=32
	elif kind=="actual-qingmao-motion-event":priority=72
	elif kind in ["attack_contact","shield_contact"]:
		var raw=native_events.get(str(details.get("event_id","")),{})
		var amount=float(raw.get("hp_loss",details.get("hp",0)))+0.4*float(raw.get("armor_loss",details.get("armor",0)))
		if kind=="shield_contact":amount=float(raw.get("shield_loss",details.get("shield_loss",0)))
		var strength=clampf(amount/35.0,0.0,1.0)
		gain*=lerpf(0.62,1.03,strength)
		priority=80 if priority>=80 and amount>=20 else 74 if priority>=80 else 66
	elif kind in ["actual-hp-contact","actual-hero-hp-loss"]:
		var amount=float(event.get("damage",event.get("hp",0)))
		gain*=lerpf(0.62,1.0,clampf(amount/30.0,0.0,1.0))
	return {"id":id,"priority":priority,"gain":gain}
func speak(id:String) -> bool:
	if not streams.has(id) or paused or is_muted("Master") or is_muted("Voice") or voice.playing:return false
	voice_gain=float(policy.get("voice_gain",0.9));voice.stream=streams[id];voice.volume_db=linear_to_db(voice_gain);voice.stream_paused=false;voice.play()
	played[id]=int(played.get(id,0))+1;log_event("existing-skill-voice",{"sound":id});return true
func effect_group(id:String,priority:int,ui:bool,details:Dictionary) -> String:
	if ui:return "ui"
	var kind=str(details.get("kind",""))
	if kind=="actual-boss-warning" or (kind=="main-project-priority-cue" and details.get("original","")=="warning"):return "warning"
	if kind=="actual-ordinary-release":return "ordinary"
	if kind=="actual-skill-release" and details.get("event",{}).get("ultimate",false):return "critical"
	if kind in ["actual-skill-release","action_release","reaction_release","actual-qingmao-motion-event"]:return "skill"
	if kind in ["actual-hp-contact","actual-hero-hp-loss","actual-protection-loss","attack_contact","shield_contact","legacy-actual-damage"]:return "contact"
	if kind in ["actual-party-defeat","actual-battle-result","downed","actual-qingmao-defeat","actual-qingmao-counter"] or priority>=90:return "critical"
	if id.begins_with("footstep"):return "movement"
	return "generic"
func effect_duck(group:String) -> float:
	if group in ["warning","critical","ui"]:return 1.0
	if clock<warning_until:return 0.22 if group=="ordinary" else 0.30 if group=="skill" else 0.42 if group=="contact" else 0.22 if group=="movement" else 0.48
	if clock<duck_until:return 0.48 if group=="skill" else 0.62
	if voice.playing:
		return float(policy.get("skill_voice_duck",0.56)) if group=="skill" else float(policy.get("contact_voice_duck",0.72)) if group=="contact" else 0.38 if group=="movement" else 0.72
	return 1.0
func tick(delta:float) -> void:
	if paused:return
	clock+=delta
	for row in effects:
		if not row.node.playing:continue
		var target_duck=effect_duck(row.group)
		row.duck=move_toward(float(row.duck),target_duck,delta/(0.025 if target_duck<row.duck else 0.18))
		row.node.volume_db=linear_to_db(maxf(0.00001,row.base_gain*row.duck))
	if voice.playing:
		var desired=float(policy.get("voice_gain",0.9))*(0.42 if clock<warning_until else 0.70 if clock<duck_until else 1.0)
		voice_gain=move_toward(voice_gain,desired,delta/(0.025 if desired<voice_gain else 0.18));voice.volume_db=linear_to_db(maxf(0.00001,voice_gain))
	if is_muted("Music"):return
	fade=minf(1.6,fade+delta)
	if current>=0:gains[current]=sin(fade/1.6*PI/2.0)
	if outgoing>=0:
		gains[outgoing]=from_gain*cos(fade/1.6*PI/2.0)
		if fade>=1.6:music[outgoing].stop();gains[outgoing]=0;outgoing=-1
	var desired_duck=0.28 if clock<warning_until else 0.56 if clock<duck_until else 0.52 if voice.playing else 1.0
	music_duck=move_toward(music_duck,desired_duck,delta/(0.025 if desired_duck<music_duck else 0.22))
	var target=0.52*music_duck
	for i in 2:music[i].volume_db=linear_to_db(maxf(0.00001,gains[i]*target))
	if outgoing<0 and not pending_music.is_empty():
		var next=pending_music.duplicate();pending_music={};set_context(next.mood,next.position)
func report() -> Dictionary:
	return {"version":str(policy.get("version","B2.2")),"music":music_id,"mood":mood,"paused":paused,"clock":clock,"activeMusicPlayers":music.filter(func(p):return p.playing).size(),"activeEffects":effects.filter(func(r):return r.node.playing).size(),"voiceActive":voice.playing,"played":played.duplicate(),"droppedBusyEffects":dropped,"prioritySteals":steals,"mutedEvents":muted_events,"maxEffects":max_effects,"fixedPlayers":11,"resources":streams.size(),"transitions":transitions,"history":history.duplicate(true),"budgetDrops":budget_drops.duplicate(),"maximumSimultaneousVoices":1,"reservedWarningSlots":1,"warningPlays":warning_plays,"warningCoalesces":warning_coalesces,"ordinaryPeak":ordinary_peak,"nativeContextSize":native_events.size()}
func shutdown() -> void:
	if closed:return
	closed=true
	# Clear both node and playback stream references before the AudioServer exits.
	# Stopping only the one-shot pool leaves a looping WAV playback alive on fast quit.
	set_process(false);pending_music={}
	for node in music:
		if is_instance_valid(node):node.stop();node.stream=null
	for row in effects:
		if is_instance_valid(row.node):row.node.stop();row.node.stream=null
	if is_instance_valid(voice):voice.stop();voice.stream=null
	streams={};current=-1;outgoing=-1
	if limiter!=null:
		for i in range(AudioServer.get_bus_effect_count(0)-1,-1,-1):
			if AudioServer.get_bus_effect(0,i)==limiter:AudioServer.remove_bus_effect(0,i)
		limiter=null
	# The driver consumes stop/fade commands on its mix thread. Give this final
	# release one bounded drain interval, including during an immediate tree quit.
	# No rule/game frames advance here; regular scene switches do not call shutdown.
	OS.delay_msec(100)
func _exit_tree() -> void:shutdown()
