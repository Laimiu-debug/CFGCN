"""Build one catalogue for the native actions, equipment and rehearsal UI."""
from pathlib import Path
import json,copy

HERE=Path(__file__).resolve().parent

NEW=[
 ('wukong','StaffGuard','架棍听风','条件格挡','正面短格挡窗','横棍承接一次可格挡攻击，成功后才送出棍风。','空架不反击；侧后与不可格挡攻击绕过。','宽窗低破势','窄窗高破势','筋斗闪身后转回正面'),
 ('wukong','ReturningStaff','飞棍回环','离手双程','前方短距飞棍','掷棍、飞出、回旋、接棍对应独立事件，去程与回程各可命中一次。','离手期间不能使用其他实体棍招；弹道受地形阻挡。','远抛慢回','近抛快回','定身后把两段留给同一目标'),
 ('wukong','MonkeyCommand','猴王号令','队伍集火','一名可见威胁','举棍点将，队友首次有效跟进各获得一次收益。','不强拉队友、不保证首领换目标；每人一次。','集火破势','援护退敌','火眼照妖后组织队友跟进'),
 ('wukong','StoneShell','石身卸势','站定卸力','自身与近处碎石','沉身抗位移并减伤，收势释放部分实际承受的冲击。','必须停步；储存与回击封顶，无长时间无敌。','稳身强护、少回击','蓄震回击、少减伤','架棍失败后的保底承接'),
 ('tangseng','ScriptureRibbon','经卷缚灵','弹道束缚','首名可控敌人','展卷送带，先触到的普通敌人短缚并打断本次蓄势。','可躲且受遮挡；首领只破势，硬控递减。','长卷远距短缚','短卷近距强缚','为窄线送剑争取一次时机'),
 ('tangseng','PilgrimLantern','心灯护行','有限护持','附近可见地面','托灯安放，队友首次接近时获得护持。','灯有耐久与总次数；不是常驻安全区或导航路线。','广照多人薄护','守灯少人厚护','撤线前设置一个护持支点'),
 ('tangseng','KarmicReflection','因果回响','承伤后回响','一名敌人','结印标记；该敌下一次造成有效伤害后承受一次封顶回响。','无真实伤害则不触发；反射与代偿不递归。','慈护降低下一击','惩戒增强回响','配站定护持，但不能靠互相反伤刷伤害'),
 ('tangseng','PurifyingVerse','净坛梵唱','通道净化','面前窄条地面','定步分掌持续诵经，按三个时点清除可驱散地面邪秽。','起手可打断；不能删除全部首领预警或地形。','长唱清得更宽','短唱清得更快','给治疗与撤步留出短暂出口'),
 ('bajie','RakeVault','腾耙越阵','支耙短跃','短距可达落点','支耙压腿，收膝短跃，落地时横推近敌。','先检查可达落点；不越墙或深水，落地要收势。','轻跃远移少推拒','重落近移强推拒','从包围边缘换位后回耙'),
 ('bajie','GroundFurrow','犁地断锋','低位土浪','前方贴地窄带','双手压耙犁出两段土浪，削弱地面冲锋与低位地浪。','高位弹道绕过；不制造实体墙。','长犁窄线','短犁宽线','沙僧护高位、八戒截低位'),
 ('bajie','BellyRebound','鼓腹反震','近击蓄震','正前方短扇形','张臂鼓腹承接有效近击，再释放一次正面反震。','空放只弱推拒；蓄力封顶，不储存反射伤害。','厚腹多减伤少反震','震腹少减伤强推拒','用护持稳住承击，别把侧后当无敌'),
 ('bajie','RakePin','耙压千钧','压制架势','面前首名敌人','举耙压势并保持重心，分段削减其架势。','施放者停步；侧后易受击，首领不长期定身。','压首单体破势','压阵兼顾轻敌','给悟空落棍留短窗口'),
 ('shaseng','WaterSplit','分水双铲','前后分段','前扫、后挑两条弧','先扫前方，再回身挑出后方水弧，两段各有释放时点。','不是持续周身伤害；转向受限。','前锋正面更强','回护后方更宽','前线清开后回护唐僧'),
 ('shaseng','SandAnchor','沉沙锚印','有限拦截','一片可通行地面','竖铲点地放锚印，首次冲过的敌人失衡。','每敌一次、总次数有限；重敌只破势，地面始终通行。','宽锚低破势','窄锚高破势','撤退前截住一轮追击'),
 ('shaseng','BeadOrbit','念珠护阵','限次护弹','一名受威胁队友','取珠展臂，用有限念珠分次削弱普通弹道。','总次数封顶；不吞首领全部射线。','分珠多人少次数','凝珠单人多次数','保护站定诵经或纳气'),
 ('shaseng','Undertow','潜流换线','换位援护','一条短斜向水带','斜铲引流，队友沿带移动获得抗冲击，敌人横穿略减速。','不强制位移或传送队友；仅一条，短时消散。','援流更长护持低','守流更短护持高','同心愿契下自主换线'),
 ('xiaobailong','TwinCrescent','双月回锋','两段剑波','两道交叉曲月','斜劈后折锋上挑，送出两道有空隙的曲月。','两段方向和时刻可辨；不会全程追踪。','交月更宽单段弱','凝月更窄破势强','定身或绊足后交锋'),
 ('xiaobailong','MistVeil','雾隐游身','折步解锁','自身短退步','折步隐锋，在短雾中打断普通敌人的重新锁定。','既有弹道仍危险；不无限隐身或骗首领。','轻雾更远更短','凝雾更近更稳','退到队友水线后重新送剑'),
 ('xiaobailong','TidePrison','水牢截影','单体截击','一名轻敌','合掌束流，短困并打断该敌本次连招。','控制递减；首领只破势，不无限水牢。','深牢强缚短距','散流弱缚兼顾邻敌','沙僧锚印后错峰控制'),
 ('xiaobailong','PearlPulse','骊珠引潮','消痕爆发','有限友方水痕','拢潮托珠，再送锋释放；消费封顶的友方水痕增强。','无水痕仍有小剑波；不清除全场地带，不能自我循环。','聚珠少痕强单体','散潮多痕宽波','沙僧潜流或自身剑潮后消费')
]

DEFAULTS={
 'tangseng':['RobeWard','HealingVow','PureSeal','BellChime'],
 'wukong':['StaffSweep','HairClone','FreezeSeal','CrashingCloud'],
 'bajie':['RakeSweep','RakeHook','RakeSlam','BellyBrace'],
 'shaseng':['SpadeThrust','PrayerBeads','RiverWard','RiverDrag'],
 'xiaobailong':['WaveStep','DragonDash','FrostBreath','RainBlessing']}


def build():
    data=json.loads((HERE.parent/'shadow-actions-v2/skills.json').read_text(encoding='utf-8'))
    manifest=json.loads((HERE/'manifest.json').read_text(encoding='utf-8'))
    for actor,clip,name,role,target,effect,limit,a,b,synergy in NEW:
        data['entries'].append(dict(id=actor+'.'+clip,actor=actor,clip=clip,name=name,kind='active',role=role,target=target,trigger='装备后释放，满足作用条件才触发收益',effect=effect,limit=limit,branches=[a,b],synergy=synergy,new_in=3))
    records={c['id']:c for c in manifest['characters']}
    for e in data['entries']:
        if not e['clip']:continue
        s=next(s for s in records[e['actor']]['modules'] if s['clip']==e['clip'])
        e['motion']={k:copy.deepcopy(s[k]) for k in ['clip','upper_clip','duration','windup_end','release_end','events']}
        for k in ['root_motion','airborne','weapon_flight','stationary']:
            if k in s:e['motion'][k]=copy.deepcopy(s[k])
        e['motion']['mode']='完整身体 / 碰撞位移' if not s['upper_clip'] else '站立全身 + 移动上身遮罩'
        e['motion']['thumbnail']=e['actor']+'/thumbnails/'+e['clip']+'.png'
        e['status']='Blender / GLB 动作已制作，已接入五人地图演武初版；正式培养、战斗平衡与最终美术待验收' if e['kind']=='active' else 'Blender / GLB 动作已制作；妖怪演武目前使用基础攻击，完整招式 AI 待接入'
        if e['kind']=='active':
            # Rehearsal timings are deliberately labelled, not production balance.
            e['rehearsal_cooldown']=round(max(s['duration']+.4,3 if '兵器' in e['trigger'] else 5),2)
    data.update(version=3,date='2026-10-20',status='用户确认 12 选 4；动作模块与本地构筑演练，正式战斗待接入',counts={'hero_active':60,'hero_passive':20,'enemy':18,'combo':12,'total':110,'actor_skill_actions':78},loadout='五位主角各 12 招，每人自由选择 4 个不同技能；兵器招式占槽，被动与连携另计。',defaults={actor:[actor+'.'+clip for clip in clips] for actor,clips in DEFAULTS.items()},storage_key='cfgcn:xiyou:shadow-loadouts:v1')
    assert len(data['entries'])==110 and len({e['id'] for e in data['entries']})==110
    for actor in DEFAULTS:assert sum(e['kind']=='active' and e['actor']==actor for e in data['entries'])==12
    (HERE/'skills.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return data


if __name__=='__main__':
    print(json.dumps(build()['counts'],ensure_ascii=False))
