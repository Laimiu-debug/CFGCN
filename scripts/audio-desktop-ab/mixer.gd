extends Node
## Two isolated native recording buses, driven by one actual game timeline.
var game
var game_id=""
var repo=""
var out=""
var records={}
var streams={}
var old_streams={}
var music_a: AudioStreamPlayer
var music_b: AudioStreamPlayer
var music_b_tail: AudioStreamPlayer
var transition_progress=2.0
var voice_b: AudioStreamPlayer
var pool_a=[]
var pool_b=[]
var trace=[]
var last={}
var actor_before={}
var last_event={}
var played={"A":{},"B":{}}
var clock=0.0
var next_event=0
var duck_until=0.0
var old_pending=""
var phase=""
var b_director
var music_started=false
var steals=0
var dropped=0
var recording=false
var media=""
var contact_seen={}
var boss_before=false

func add_bus(name: String,send: String,gain=1.0,at=-1) -> int:
	AudioServer.add_bus(at);var index=AudioServer.bus_count-1 if at<0 else at
	AudioServer.set_bus_name(index,name);AudioServer.set_bus_send(index,send)
	AudioServer.set_bus_volume_db(index,linear_to_db(gain));return index
func player(bus: String) -> AudioStreamPlayer:
	var node=AudioStreamPlayer.new();node.bus=bus;add_child(node);return node
func begin(project_game: String,directory: String) -> void:
	game_id=project_game;out=directory;repo=ProjectSettings.globalize_path("res://../../../")
	media=OS.get_environment("CFGCN_AB_MEDIA_DIR");if media.is_empty():media=out
	process_priority=1000
	# Keep both recording taps at unity. The review exports use documented
	# fixed loudness gains; no post-recording music or event sounds are added.
	# Godot sends buses from right to left. Insert recording returns before the
	# existing category buses, otherwise the old Music/Effects tap is silent.
	add_bus("AB-Sink","Master",0.00001,1)
	for name in ["AB-A","AB-B"]:
		var index=add_bus(name,"Master" if name=="AB-A" else "AB-Sink",1.0,2 if name=="AB-A" else 3)
		var limiter=AudioEffectHardLimiter.new();limiter.ceiling_db=-1.2
		AudioServer.add_bus_effect(index,limiter)
		var record=AudioEffectRecord.new();record.format=AudioStreamWAV.FORMAT_16_BITS
		AudioServer.add_bus_effect(index,record);records[name]=record;record.set_recording_active(true)
	for name in ["Music","Effects","Voice"]:
		AudioServer.set_bus_send(AudioServer.get_bus_index(name),"AB-A")
		var gain=db_to_linear(AudioServer.get_bus_volume_db(AudioServer.get_bus_index(name)))
		add_bus("AB-B-"+name,"AB-B",gain)
	for i in 8:
		pool_a.append({"node":player("Effects"),"priority":0,"started":0.0,"ui":false})
		pool_b.append({"node":player("AB-B-Effects"),"priority":0,"started":0.0,"ui":false})
	music_a=player("Music");music_b=player("AB-B-Music");music_b_tail=player("AB-B-Music");voice_b=player("AB-B-Voice")
	var manifest=JSON.parse_string(FileAccess.get_file_as_string(repo+"source/audio/desktop-ab-v1/manifest.json"))
	for row in manifest.assets:
		if row.kind=="music" and row.id!="music-"+game_id:continue
		var clip=AudioStreamWAV.load_from_file(repo+row.runtime)
		if row.kind=="music":
			clip.loop_mode=AudioStreamWAV.LOOP_FORWARD;clip.loop_begin=int(row.get("loopStartFrame",0));clip.loop_end=int(row.frames)
		streams[row.id]=clip
	var legacy=JSON.parse_string(FileAccess.get_file_as_string(repo+"apps/website/art/audio/ink-v1/manifest.json"))
	for id in legacy.effects:
		var row=legacy.effects[id]
		if not row.url.ends_with(".mp3"):continue
		var clip=AudioStreamMP3.new();clip.data=FileAccess.get_file_as_bytes(repo+"apps/website/public"+row.url)
		old_streams[id]=clip
	recording=true
func attach(root_game) -> void:
	game=root_game
	if game_id=="xiyou":
		for key in game.sound.streams:old_streams[key]=game.sound.streams[key]
		b_director=load("res://scripts/audio_director.gd").new();b_director.configure(game.sound.manifest)
		boss_before=b_director.boss_alive(game.state)
	else:
		var source=JSON.parse_string(FileAccess.get_file_as_string(repo+"source/audio/desktop-ab-v1/legacy-shuihu.json"))
		for row in source.assets:
			var clip=AudioStreamWAV.load_from_file(repo+row.path)
			clip.loop_mode=AudioStreamWAV.LOOP_FORWARD;clip.loop_begin=int(row.loopStartFrame);clip.loop_end=int(row.frames)
			old_streams[row.id]=clip
	music_b.stream=streams["music-"+game_id]
	var start=52.0 if OS.get_environment("CFGCN_AB_FLOW")=="XY-B" else 0.0
	music_b.volume_db=-80.0;music_b.play(start);music_started=true
func log_event(kind: String,details: Dictionary={}) -> void:
	next_event+=1;trace.append({"event":next_event,"time":clock,"frame":Engine.get_frames_drawn(),"kind":kind,"details":details})
func count(side: String,id: String) -> void:played[side][id]=int(played[side].get(id,0))+1
func transition_music(position: float) -> void:
	var old=music_b;music_b=music_b_tail;music_b_tail=old
	music_b.stop();music_b.stream=old.stream;music_b.volume_db=-80.0;music_b.play(position)
	transition_progress=0.0
	log_event("native-music-crossfade",{"seconds":1.6,"targetPosition":position})
func effect(side: String,id: String,priority: int,gain=0.55,ui=false) -> void:
	var bank=streams if side=="B" and streams.has(id) else old_streams
	if not bank.has(id):return
	var cooldown=0.16 if id=="pickup" else 0.09
	if clock-float(last_event.get(side+id,-INF))<cooldown:return
	var pool=pool_b if side=="B" else pool_a
	var available=pool.filter(func(r):return not r.node.playing)
	var row
	if available.is_empty():
		if side=="A":dropped+=1;return
		var sorted=pool.duplicate();sorted.sort_custom(func(a,b):return a.priority<b.priority or (a.priority==b.priority and a.started<b.started))
		if int(sorted[0].priority)>=priority:dropped+=1;return
		row=sorted[0];row.node.stop();steals+=1
	else:row=available[0]
	row.priority=priority;row.started=clock;row.ui=ui
	var node=row.node;node.stream=bank[id];node.volume_db=linear_to_db(gain)
	node.pitch_scale=[0.96,1.0,1.035][int(played[side].get(id,0))%3] if side=="B" and priority<80 else 1.0
	node.stream_paused=false;node.play();last_event[side+id]=clock;count(side,id)
	if priority>=80:duck_until=maxf(duck_until,clock+0.8)
func tick(delta: float) -> void:
	if game==null:return
	clock+=delta
	if game_id=="xiyou":xiyou()
	else:shuihu()
	for name in ["Music","Effects","Voice"]:
		var source_index=AudioServer.get_bus_index(name);var target_index=AudioServer.get_bus_index("AB-B-"+name)
		AudioServer.set_bus_volume_db(target_index,AudioServer.get_bus_volume_db(source_index))
		AudioServer.set_bus_mute(target_index,AudioServer.is_bus_mute(source_index))
	music_b_tail.stream_paused=music_b.stream_paused
	if music_b.stream_paused:return
	var target=0.52*(0.58 if voice_b.playing or clock<duck_until else 1.0)
	if transition_progress<1.6:
		transition_progress=minf(1.6,transition_progress+delta)
		var angle=transition_progress/1.6*PI/2.0
		music_b.volume_db=linear_to_db(maxf(0.00001,target*sin(angle)))
		music_b_tail.volume_db=linear_to_db(maxf(0.00001,target*cos(angle)))
		if transition_progress>=1.6:music_b_tail.stop()
	else:
		var gain=db_to_linear(music_b.volume_db)
		music_b.volume_db=linear_to_db(maxf(0.00001,lerpf(gain,target,minf(1,delta*4))))
func _process(delta: float) -> void:
	# Native main-root/sound processing uses priority 0. Observe its completed
	# render snapshot in the same frame, never advance a second rules timeline.
	tick(delta)
func xiyou() -> void:
	var state=game.state
	if state.is_empty():return
	var paused=game.menu_paused or bool(state.paused) or AudioServer.is_bus_mute(0)
	var frame=b_director.observe(state,clock,voice_b.playing,game.menu_paused)
	music_b.stream_paused=paused;voice_b.stream_paused=paused
	for row in pool_b:row.node.stream_paused=paused and not row.ui
	var level=int(state.growth.level);var xp=float(state.growth.xp)
	if not last.is_empty():
		if level>int(last.level):
			log_event("earned-upgrade",{"level":level,"xp":xp});effect("B","ui-confirm",100,0.45,true)
		elif xp>float(last.xp):
			log_event("actual-xp-pickup",{"xpDelta":xp-float(last.xp)});effect("B","pickup",35,0.17)
		if last.pending!=null and state.growth.pending==null:log_event("upgrade-choice-applied")
	last={"level":level,"xp":xp,"pending":state.growth.pending}
	if paused:return
	for row in frame.skill_effects:
		var id=row.asset.id;var selected="staff-air" if id=="staff-sweep" else "water-jian" if id=="water-jian" else id
		effect("B",selected,65,0.54);log_event("actual-skill-release",{"actor":row.actor,"skill":row.skill,"sound":selected})
	for id in frame.cues:
		if id in ["warning","metal-impact"]:continue # Handle certified contacts by actual owner below.
		var selected="wound-cloth" if id=="wood-impact" else id
		effect("B",selected,60 if id=="metal-impact" else 55 if id=="wood-impact" else 20,0.18 if id.begins_with("footstep") else 0.46)
	var live_contacts={}
	for hit in state.get("strokes",[]):
		if int(hit.kind)!=9:continue
		live_contacts[int(hit.id)]=true
		if contact_seen.has(int(hit.id)) or hit.get("hit")==null or float(hit.hit.hp_after)>=float(hit.hit.hp_before):continue
		var actor=int(hit.owner)
		var selected="staff-body" if actor==1 else "water-jian" if actor==4 else "monk-chime" if actor==0 else "wound-cloth"
		effect("B",selected,60,0.23 if actor in [0,4] else 0.46)
		log_event("actual-hp-contact",{"owner":actor,"skill":hit.get("skill"),"contact":hit.get("contact"),"sound":selected,"damage":float(hit.hit.hp_before)-float(hit.hit.hp_after)})
	contact_seen=live_contacts
	var boss_now=b_director.boss_alive(state)
	if boss_before and not boss_now:
		transition_music(125.0);log_event("actual-encounter-recovery-or-completion")
	boss_before=boss_now
	var visuals=state.get("spider_visuals",{})
	var warnings=visuals.get("webs",[]).filter(func(w):return w.warning)
	var warning_now=not warnings.is_empty()
	if warning_now and not bool(actor_before.get("warning",false)):
		effect("B","danger-wood",95,0.68);log_event("actual-boss-warning",{"warnings":warnings.size()})
	actor_before["warning"]=warning_now
	if frame.voice!=null and not voice_b.playing:
		voice_b.stream=old_streams[frame.voice.asset.id];voice_b.volume_db=linear_to_db(0.78);voice_b.play();count("B",frame.voice.asset.id)
func shuihu() -> void:
	var in_battle=game.play_mode=="campaign_battle" or game.play_mode=="drill"
	var next_phase="battle" if in_battle and game.core.state.phase=="playing" else "aftermath" if in_battle else "camp"
	if phase!=next_phase:
		phase=next_phase;music_a.stream=old_streams["legacy-menu" if phase=="camp" else "legacy-battle"]
		music_a.volume_db=linear_to_db(0.58);music_a.play()
		if phase=="battle":transition_music(42.0)
		elif phase=="aftermath":transition_music(120.0)
		log_event("actual-world-mode",{"mode":game.play_mode,"phase":phase})
	if not in_battle:return
	var state=game.core.state
	var paused=not game.pause_reasons.is_empty() or AudioServer.is_bus_mute(0)
	music_a.stream_paused=paused;music_b.stream_paused=paused
	for row in pool_a+pool_b:row.node.stream_paused=paused and not row.ui
	if paused:return
	var pending=state.pending
	if not pending.is_empty():
		var key=str(pending.actor)+":"+str(state.round)+":"+str(pending.order)+":"+str(state.seq-int(pending.elapsed*60))
		# Actor/order plus elapsed reset identifies a new real paid order.
		var fresh=old_pending.is_empty() or pending.actor!=actor_before.get("pending_actor","") or float(pending.elapsed)<float(actor_before.get("pending_elapsed",-1))
		if fresh:
			var kind=pending.definition.kind
			if kind=="attack":
				var actor=game.core.actor(pending.actor);var weapon=game.core.weapons[actor.weapon]
				effect("A","weapon-whoosh",40,0.42)
				var id="bow-release" if bool(weapon.ranged) else "staff-air"
				effect("B",id,55,0.52);log_event("paid-attack-start",{"actor":actor.id,"weapon":actor.weapon,"kind":kind})
			elif kind=="move":
				effect("A","piece-place",20,0.35);effect("B","footstep-stone",20,0.18);log_event("paid-move-start",{"actor":pending.actor})
		old_pending=key;actor_before["pending_actor"]=pending.actor;actor_before["pending_elapsed"]=pending.elapsed
	else:old_pending=""
	for actor in state.actors:
		var key="actor:"+actor.id
		if actor_before.has(key):
			var old=actor_before[key];var hp=maxf(0,float(old.hp)-float(actor.hp));var armor=maxf(0,float(old.armor)-float(actor.armor))
			if hp>0 or armor>0:
				effect("A","metal-impact" if armor>0 else "wood-impact",50,0.42)
				var body_id=str(game.core.heroes.get(actor.id,{}).get("body","cloth"))
				if actor.get("prototype","")!="":
					for spec in game.core.source_data.enemies:
						if spec.id==actor.prototype:body_id=spec.body;break
				var id="blade-armor" if armor>0 and body_id in ["lamellar","heavy","plate"] else "wound-cloth"
				effect("B",id,70,0.56)
				log_event("actual-damage-result",{"target":actor.id,"hp":hp,"armor":armor,"sound":id,"bodyId":body_id,"materialRule":"Authored hero body or actual enemy prototype; metal only for lamellar/heavy/plate, otherwise cloth/leather contact"})
			if float(old.hp)>0 and float(actor.hp)<=0:log_event("actual-unit-downed",{"actor":actor.id})
		actor_before[key]={"hp":actor.hp,"armor":actor.armor}
	if not last.is_empty() and state.phase!=last.get("phase") and state.phase!="playing":
		effect("A","victory" if state.phase=="won" else "defeat",90,0.42)
		effect("B","ui-confirm" if state.phase=="won" else "danger-wood",90,0.38)
		log_event("actual-battle-result",{"phase":state.phase})
	last={"phase":state.phase}
func finish() -> Dictionary:
	for name in records:
		records[name].set_recording_active(false)
		var clip=records[name].get_recording();clip.save_to_wav(media+"/"+name+".wav")
	var report={"game":game_id,"engineNativeBusRecording":true,"sameRuleTimeline":true,"played":played,"events":trace,"prioritySteals":steals,"dropped":dropped,"scope":"Native AudioStreamPlayers mixed in the actual game, isolated review buses. Shuihu A is explicitly an old-material wiring reference, not a claim that the previous campaign had audio. No post-recording music/foley insertion."}
	var f=FileAccess.open(out+"/events.json",FileAccess.WRITE);f.store_string(JSON.stringify(report,"\t"));f.close()
	return report
