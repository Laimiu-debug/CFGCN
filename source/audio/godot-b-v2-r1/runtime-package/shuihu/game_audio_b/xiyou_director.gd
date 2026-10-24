extends RefCounted
## Read-only native releases, contacts, growth and actual seven-spider warnings.
var manifest={}
var previous={}
var contacts={}
var actor_effect={}
var actor_voice={}
var clip_voice={}
var last_voice=-INF
var distance=0.0
var last_step=-INF
var aftermath_until=-INF
var warning_before=false
var effect_token={}
var last_warning=-INF
func configure(data:Dictionary) -> void:manifest=data
func reset() -> void:
	previous={};contacts={};actor_effect.clear();effect_token.clear();actor_voice.clear();clip_voice.clear();last_voice=-INF;distance=0;last_step=-INF;aftermath_until=-INF;warning_before=false;last_warning=-INF
func boss_alive(state:Dictionary) -> bool:
	return (state.get("boss")!=null and not state.boss.defeated) or state.get("boss_guests",[]).any(func(b):return not b.defeated)
func find_asset(kind:String,actor:int,skill:int):
	for row in manifest.assets:
		if row.kind==kind and int(row.get("actor",-1))==actor and row.get("skills",[]).any(func(i):return int(i)==skill):return row
	return null
func cue(frame:Dictionary,id:String,priority:int,gain:float,kind:String,details:Dictionary={},ui=false) -> void:
	frame.cues.append({"id":id,"priority":priority,"gain":gain,"ui":ui,"details":{"kind":kind,"event":details}})
func observe(state:Dictionary,now:float,voice_busy:bool,menu_paused:bool) -> Dictionary:
	var before=previous;var boss=boss_alive(state);var dead=state.heroes.all(func(h):return h.hp<=0.0)
	var rewind=not before.is_empty() and float(state.elapsed)<float(before.elapsed)
	var phase_finished=not before.is_empty() and before.boss and not boss
	if rewind:reset()
	if phase_finished:aftermath_until=now+14.0
	previous={"elapsed":state.elapsed,"leader":state.leader,"heroes":state.heroes,"growth":state.growth,"boss":boss,"dead":dead}
	var frame={"paused":menu_paused or (bool(state.paused) and not dead),"scene":"battle" if boss or not state.enemies.is_empty() else "exploration","mood":"xy-boss" if boss else "xy-aftermath" if dead or now<aftermath_until else "xy-journey","position":52.0 if boss else 125.0 if dead or now<aftermath_until else 0.0,"cues":[],"voice":null,"reset":rewind}
	var live={}
	for hit in state.get("strokes",[]):
		if int(hit.kind)==9:live[int(hit.id)]=true
	var warnings=state.get("spider_visuals",{}).get("webs",[]).filter(func(w):return w.warning)
	var warning_now=not warnings.is_empty()
	if before.is_empty() or rewind:
		contacts=live;warning_before=warning_now
		for actor in range(5):
			var cast=state.heroes[actor].cast
			if cast!=null and int(cast.next_event)>0:effect_token[actor]=int(cast.token)
		return frame
	if not menu_paused:
		if int(state.growth.level)>int(before.growth.level):cue(frame,"ui-confirm",100,0.45,"earned-upgrade",{"level":state.growth.level},true)
		elif float(state.growth.xp)>float(before.growth.xp):cue(frame,"pickup",35,0.17,"actual-xp-pickup",{"delta":float(state.growth.xp)-float(before.growth.xp)})
	var dt=float(state.elapsed)-float(before.elapsed)
	if frame.paused or dt<=0 or dt>0.5:contacts=live;warning_before=warning_now;return frame
	if dead and not before.dead:cue(frame,"danger-wood",90,0.4,"actual-party-defeat")
	if warning_now and not warning_before:
		cue(frame,"danger-wood",95,0.68,"actual-boss-warning",{"warnings":warnings.size()});last_warning=now
	warning_before=warning_now
	var voices=[];var skills=[];var lead=state.heroes[int(state.leader)].pos
	for actor in range(5):
		var hero=state.heroes[actor];var old=before.heroes[actor]
		if hero.hp<old.hp:cue(frame,"wound-cloth",88 if actor==int(state.leader) else 55,0.48 if actor==int(state.leader) else 0.26,"actual-hero-hp-loss",{"actor":actor,"hp":float(old.hp)-float(hero.hp)})
		elif hero.shield<old.shield:cue(frame,"ink-spell",50,0.16,"actual-protection-loss",{"actor":actor})
		if hero.dodge!=null and (old.dodge==null or hero.dodge.time<old.dodge.time):cue(frame,"weapon-whoosh",40,0.35,"actual-dodge",{"actor":actor})
		var cast=hero.cast
		if cast==null or hero.hp<=0 or Vector2(hero.pos.x-lead.x,hero.pos.z-lead.z).length()>8.5:continue
		var fresh=old.cast==null or int(cast.token)!=int(old.cast.token)
		if int(cast.next_event)>0 and int(effect_token.get(actor,-1))!=int(cast.token):
			# A multi-hit/lingering spell has one opening sound per genuine cast.
			# Its later damage contacts remain separately audible, without replaying
			# the entire chime/whoosh on every rules pulse.
			effect_token[actor]=int(cast.token)
			var asset=find_asset("skill-effect",actor,int(cast.skill))
			var speech=find_asset("voice",actor,int(cast.skill))
			if asset!=null and now-float(actor_effect.get(actor,-INF))>=0.14:skills.append({"actor":actor,"skill":cast.skill,"token":cast.token,"asset":asset,"ultimate":speech!=null and speech.ultimate,"distance":Vector2(hero.pos.x-lead.x,hero.pos.z-lead.z).length()})
		if not fresh or cast.time>float(manifest.speech_policy.max_new_cast_age_seconds) or int(cast.next_event)>0:continue
		var spoken=find_asset("voice",actor,int(cast.skill))
		if spoken==null or (actor!=int(state.leader) and not spoken.ultimate):continue
		if now-float(actor_voice.get(actor,-INF))<float(manifest.speech_policy.actor_gap_seconds) or now-float(clip_voice.get(spoken.id,-INF))<float(manifest.speech_policy.repeat_clip_gap_seconds):continue
		voices.append({"actor":actor,"skill":cast.skill,"asset":spoken})
	skills.sort_custom(func(a,b):return (10 if a.actor==int(state.leader) else 0)>(10 if b.actor==int(state.leader) else 0))
	for row in skills.slice(0,2):
		actor_effect[row.actor]=now
		var primary=row.actor==int(state.leader)
		var attenuation=1.0 if primary else 0.58*clampf(1.0-row.distance/14.0,0.35,1.0)
		cue(frame,"staff-air" if row.asset.id=="staff-sweep" else row.asset.id,82 if row.ultimate else 72 if primary else 54,0.52*attenuation,"actual-skill-release",{"actor":row.actor,"skill":row.skill,"token":row.token,"primary":primary,"ultimate":row.ultimate,"distance":row.distance})
	var hit_candidates=state.get("strokes",[]).filter(func(hit):return int(hit.kind)==9 and not contacts.has(int(hit.id)) and hit.get("hit")!=null and float(hit.hit.hp_after)<float(hit.hit.hp_before))
	hit_candidates.sort_custom(func(a,b):return int(a.owner)==int(state.leader) and int(b.owner)!=int(state.leader))
	for hit in hit_candidates:
		if int(hit.kind)!=9 or contacts.has(int(hit.id)) or hit.get("hit")==null or float(hit.hit.hp_after)>=float(hit.hit.hp_before):continue
		var owner=int(hit.owner)
		var id="staff-body" if owner==1 else "water-jian" if owner==4 else "monk-chime" if owner==0 else "wound-cloth"
		var primary=owner==int(state.leader)
		cue(frame,id,68 if primary else 50,(0.22 if owner in [0,4] else 0.40)*(1.0 if primary else 0.50),"actual-hp-contact",{"actor":owner,"primary":primary,"skill":hit.get("skill"),"stroke":hit.id,"damage":float(hit.hit.hp_before)-float(hit.hit.hp_after)})
	contacts=live
	if not voice_busy and now-last_warning>=0.9 and now-last_voice>=float(manifest.speech_policy.global_gap_seconds) and not voices.is_empty():
		voices.sort_custom(func(a,b):return (10 if a.actor==int(state.leader) else 0)+(4 if a.asset.ultimate else 0)>(10 if b.actor==int(state.leader) else 0)+(4 if b.asset.ultimate else 0))
		var row=voices[0];frame.voice=row.asset.id;last_voice=now;actor_voice[row.actor]=now;clip_voice[row.asset.id]=now
	if int(state.leader)==int(before.leader):
		var old=before.heroes[int(state.leader)].pos;var moved=Vector2(lead.x-old.x,lead.z-old.z).length()
		distance=0.0 if moved>4.0 else distance+moved
		if distance>=1.1 and now-last_step>=0.28:distance=fmod(distance,1.1);last_step=now;cue(frame,"footstep-earth",20,0.12,"actual-footstep")
	else:distance=0
	return frame
