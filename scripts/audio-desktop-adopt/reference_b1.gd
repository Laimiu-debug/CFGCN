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

func player(bus:String) -> AudioStreamPlayer:
	var node=AudioStreamPlayer.new();node.bus="ReferenceB1"+bus;add_child(node);return node
func configure(bank:Dictionary,theme:String) -> void:
	streams=bank;music_id=theme;process_mode=Node.PROCESS_MODE_ALWAYS
	for row in [["Music",0.45],["Effects",0.8],["Voice",0.9]]:
		if AudioServer.get_bus_index(row[0])<0:
			AudioServer.add_bus();var i=AudioServer.bus_count-1;AudioServer.set_bus_name(i,row[0]);AudioServer.set_bus_send(i,"Master");AudioServer.set_bus_volume_db(i,linear_to_db(row[1]))
	if not range(AudioServer.get_bus_effect_count(0)).any(func(i):return AudioServer.get_bus_effect(0,i) is AudioEffectHardLimiter):
		limiter=AudioEffectHardLimiter.new();limiter.ceiling_db=-1.2;AudioServer.add_bus_effect(0,limiter)
	for i in 2:music.append(player("Music"))
	for i in 8:effects.append({"node":player("Effects"),"priority":0,"started":0.0,"ui":false})
	voice=player("Voice")
func log_event(kind:String,details:Dictionary={}) -> void:
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
	# UI remains usable during a real gameplay pause. Its cooldown uses monotonic
	# wall time; gameplay cues keep the frozen simulation/presentation clock.
	var stamp=Time.get_ticks_usec()/1000000.0 if ui else clock
	var recent=last_ui_sound if ui else last_sound
	if stamp-float(recent.get(id,-INF))<(0.16 if id=="pickup" else 0.09):return false
	var available=effects.filter(func(r):return not r.node.playing)
	var row
	if available.is_empty():
		var sorted=effects.duplicate();sorted.sort_custom(func(a,b):return a.priority<b.priority or (a.priority==b.priority and a.started<b.started))
		if int(sorted[0].priority)>=priority:dropped+=1;return false
		row=sorted[0];row.node.stop();steals+=1
	else:row=available[0]
	row.priority=priority;row.started=clock;row.ui=ui
	row.node.stream=streams[id];row.node.volume_db=linear_to_db(gain)
	row.node.pitch_scale=[0.96,1.0,1.035][int(played.get(id,0))%3] if priority<80 else 1.0
	row.node.stream_paused=false;row.node.play();recent[id]=stamp
	played[id]=int(played.get(id,0))+1
	if priority>=80:duck_until=maxf(duck_until,clock+0.8)
	log_event("effect",{"sound":id,"priority":priority,"source":details})
	max_effects=maxi(max_effects,effects.filter(func(r):return r.node.playing).size())
	return true
func speak(id:String) -> bool:
	if not streams.has(id) or paused or is_muted("Master") or is_muted("Voice") or voice.playing:return false
	voice.stream=streams[id];voice.volume_db=linear_to_db(0.78);voice.stream_paused=false;voice.play()
	played[id]=int(played.get(id,0))+1;log_event("existing-skill-voice",{"sound":id});return true
func tick(delta:float) -> void:
	if paused:return
	clock+=delta
	if is_muted("Music"):return
	fade=minf(1.6,fade+delta)
	if current>=0:gains[current]=sin(fade/1.6*PI/2.0)
	if outgoing>=0:
		gains[outgoing]=from_gain*cos(fade/1.6*PI/2.0)
		if fade>=1.6:music[outgoing].stop();gains[outgoing]=0;outgoing=-1
	var target=0.52*(0.58 if voice.playing or clock<duck_until else 1.0)
	for i in 2:music[i].volume_db=linear_to_db(maxf(0.00001,gains[i]*target))
	if outgoing<0 and not pending_music.is_empty():
		var next=pending_music.duplicate();pending_music={};set_context(next.mood,next.position)
func report() -> Dictionary:
	return {"version":"B1","music":music_id,"mood":mood,"paused":paused,"clock":clock,"activeMusicPlayers":music.filter(func(p):return p.playing).size(),"activeEffects":effects.filter(func(r):return r.node.playing).size(),"voiceActive":voice.playing,"played":played.duplicate(),"droppedBusyEffects":dropped,"prioritySteals":steals,"mutedEvents":muted_events,"maxEffects":max_effects,"fixedPlayers":11,"resources":streams.size(),"transitions":transitions,"history":history.duplicate(true)}
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
