"""Twelve equipable actions per hero; v2 is a read-only dependency.

Pose coordinates use each actor's own height. Root motion stays outside the
skeletal clip so a game adapter must resolve every step against terrain.
"""
from pathlib import Path
import copy, importlib.util
from ultimates import apply_signature

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('previous_catalog',HERE.parent/'shadow-actions-v2/catalog.py')
previous=importlib.util.module_from_spec(spec);spec.loader.exec_module(previous)
BASE,UPPER,LOWER=previous.BASE,previous.UPPER,previous.LOWER
# Read-only v4 source: proportions change by body region, never by squashing
# the rendered sprite. Faces keep their aspect and each actor keeps a shape.
COMPACT={
 'tangseng':(.76,.88,1.26,.84), 'wukong':(.78,.94,1.23,.79),
 'bajie':(.82,.92,1.14,.79), 'shaseng':(.74,.91,1.24,.82),
 'xiaobailong':(.76,.90,1.21,.92), 'wolf':(.79,.93,1.20,.94),
 'tiger':(.80,.94,1.18,.90), 'baigufuren':(.77,.90,1.24,.94)}
ROSTER=copy.deepcopy(previous.ROSTER)
for actor in ROSTER:
    leg,torso,width,weapon=COMPACT[actor['id']]
    actor['source_height']=actor['height']
    actor['height']=round(actor['height']*(.42*leg+.36*torso+.22*.98),6)
    actor['proportions']['shape']+='；v5 缩短腿段、加厚躯干，头脸等比保留'
    actor['proportions']['stride']*=1.45 if actor['id']=='bajie' else 1.05
pose,move=previous.pose,previous.move


def events(item,*values):
    item['events']=[dict(time=round(item['duration']*t,4),type=kind,socket=socket) for t,kind,socket in values]
    return item


def planted(item):
    item['upper_clip']=None
    item['stationary']=True
    return item


def travel(item,distance,air=False):
    item['upper_clip']=None
    item['footwork']='leap' if air else 'two_step'
    item['travel_height_ratio']=distance
    item['root_motion']={'axis':'facing-x','distance':distance,'keys':[[0,0],[.14,0],[.88,1],[1,1]],'application':'external collision-aware displacement; do not teleport'}
    if air:
        item['airborne']={'start':.18,'end':.72,'height_ratio':.15}
        item['root_motion']['keys']=[[0,0],[.18,0],[.72,1],[1,1]]
    return item


EXTRA={
 'wukong':[
  events(move('StaffGuard','架棍听风 · 横棍候击',1.35,.32,[pose(.22,.06,.09,.69,1.25,.05,.65,.04),pose(.32,.12,.14,.69,1.48,.04,.68,.045),pose(.66,.12,.14,.69,1.48,.04,.68,.045),pose(.82,-.035,.10,.68,1.12,.04,.64,.02)],True,event='guard_open'),(.32,'guard_open','weapon'),(.68,'guard_close','weapon')),
  events(move('ReturningStaff','飞棍回环 · 掷棍接棍',1.75,.34,[pose(.20,-.16,.02,.76,-.72,-.04,.68,.025),pose(.34,.17,.26,.71,1.40,-.08,.64,.035),pose(.54,.12,.23,.68,1.40,-.06,.66,.025),pose(.76,-.06,.18,.72,.35,.04,.66,.02),pose(.87,.04,.12,.64,.12,.08,.63,.025)],event='staff_out',weapon_flight={'start':.34,'turn':.56,'catch':.78,'distance_height_ratio':.85,'lift_height_ratio':.42}),(.34,'staff_out','weapon'),(.56,'staff_return','weapon'),(.78,'staff_catch','weapon')),
  events(move('MonkeyCommand','猴王号令 · 举棍点将',1.25,.50,[pose(.24,-.08,.08,.78,-.28,-.03,.69,.015),pose(.50,.08,.20,.79,.18,.27,.76,.02),pose(.72,.06,.20,.77,.18,.27,.76,.02)],event='command'),(.50,'command','hand.back')),
  events(planted(move('StoneShell','石身卸势 · 沉身蓄震',1.70,.31,[pose(.20,.15,.07,.55,.32,.02,.60,.065),pose(.31,.24,.07,.54,.46,.07,.59,.08),pose(.67,.24,.07,.54,.46,.07,.59,.08),pose(.79,-.10,.20,.71,.16,.21,.74,.025)],event='stone_open')), (.31,'stone_open','actor'),(.78,'stone_release','actor'))],
 'tangseng':[
  events(move('ScriptureRibbon','经卷缚灵 · 展卷送带',1.35,.48,[pose(.24,-.05,.11,.66,-.10,-.08,.66,.02),pose(.38,-.035,.13,.70,-.13,.06,.73,.015),pose(.48,.09,.16,.70,.08,.27,.71,.025),pose(.69,.07,.15,.68,.05,.25,.70,.02)],event='ribbon'),(.48,'ribbon','hand.back')),
  events(move('PilgrimLantern','心灯护行 · 托灯安放',1.55,.62,[pose(.23,.08,.12,.59,.04,.08,.57,.03),pose(.44,-.05,.12,.72,-.06,.10,.79,.01),pose(.62,.16,.19,.61,.14,.23,.55,.04),pose(.77,.14,.18,.62,.12,.20,.56,.035)],event='lantern'),(.44,'lantern_lift','hand.back'),(.62,'lantern_place','hand.back')),
  events(move('KarmicReflection','因果回响 · 振杖结印',1.30,.49,[pose(.23,-.06,.08,.73,-.18,.04,.64,.015),pose(.38,.04,.16,.64,.20,.07,.72,.025),pose(.49,.08,.18,.65,.24,.24,.76,.02),pose(.70,.04,.15,.67,.14,.22,.75,.02)],event='karma_mark'),(.49,'karma_mark','hand.back')),
  events(planted(move('PurifyingVerse','净坛梵唱 · 定步分掌',1.85,.34,[pose(.22,-.035,.14,.68,-.04,.06,.69,.025),pose(.34,.04,.17,.68,.08,.24,.69,.03),pose(.55,.06,.17,.68,.08,.25,.69,.03),pose(.73,.055,.17,.68,.08,.25,.69,.03)],event='purify')), (.34,'purify_start','hand.back'),(.55,'purify_pulse','hand.back'),(.73,'purify_end','hand.back'))],
 'bajie':[
  events(travel(move('RakeVault','腾耙越阵 · 支耙短跃',1.50,.72,[pose(.14,.22,.14,.56,.38,.06,.60,.065),pose(.24,.17,.12,.67,.40,.06,.63,.04),pose(.46,-.06,.11,.72,.65,.02,.66,.02),pose(.64,.17,.19,.58,1.25,.10,.59,.055),pose(.72,.26,.23,.52,1.48,.10,.54,.075),pose(.85,.12,.16,.58,.60,.07,.62,.04)],True,event='vault_land'),.42,True),(.18,'vault_takeoff','actor'),(.72,'vault_land','actor')),
  events(planted(move('GroundFurrow','犁地断锋 · 压耙犁地',1.65,.43,[pose(.25,.14,.12,.54,1.52,.03,.56,.055),pose(.43,.28,.25,.43,1.74,.11,.47,.075),pose(.66,.22,.28,.44,1.68,.14,.48,.07),pose(.79,.09,.20,.55,1.18,.10,.56,.035)],True,event='furrow')), (.43,'furrow','weapon.tip'),(.63,'furrow_follow','weapon.tip')),
  events(planted(move('BellyRebound','鼓腹反震 · 张臂承击',1.65,.30,[pose(.20,-.10,.08,.67,-.20,-.10,.69,.025),pose(.30,-.15,.08,.69,-.25,-.13,.73,.02),pose(.62,-.15,.08,.69,-.25,-.13,.73,.02),pose(.76,.23,.18,.59,.45,.23,.62,.065)],event='belly_open')), (.30,'belly_open','actor'),(.75,'belly_release','actor')),
  events(planted(move('RakePin','耙压千钧 · 举耙压势',1.85,.43,[pose(.25,-.16,.04,.80,-.22,.02,.72,.02),pose(.43,.23,.23,.57,1.35,.10,.59,.055),pose(.62,.27,.24,.55,1.42,.11,.57,.065),pose(.76,.25,.23,.56,1.40,.10,.58,.06)],True,event='pin_start')), (.43,'pin_start','weapon.tip'),(.62,'pin_pulse','weapon.tip'),(.76,'pin_end','weapon.tip'))],
 'shaseng':[
  events(move('WaterSplit','分水双铲 · 前扫回挑',1.65,.36,[pose(.20,-.12,-.01,.69,-.70,.01,.64,.025),pose(.36,.20,.24,.57,1.42,.10,.57,.04),pose(.49,.05,.14,.68,.12,.04,.64,.025),pose(.65,-.15,-.035,.72,-1.10,-.08,.69,.035),pose(.77,-.09,.00,.72,-.73,-.03,.67,.025)],True,event='front_wave'),(.36,'front_wave','weapon.tip'),(.65,'rear_wave','weapon.tip')),
  events(move('SandAnchor','沉沙锚印 · 竖铲定锚',1.45,.56,[pose(.25,-.07,.10,.78,-.04,.05,.70,.015),pose(.42,.02,.12,.72,.04,.07,.66,.025),pose(.56,.20,.16,.54,.04,.09,.59,.06),pose(.74,.16,.16,.56,.05,.09,.59,.05)],True,event='sand_anchor'),(.56,'sand_anchor','actor')),
  events(move('BeadOrbit','念珠护阵 · 取珠展臂',1.50,.51,[pose(.23,.06,.12,.64,.04,.05,.67,.025),pose(.38,-.055,.13,.69,-.02,.06,.80,.015),pose(.51,.02,.14,.69,.04,.24,.78,.02),pose(.72,.04,.15,.67,.07,.24,.74,.025)],event='bead_guard'),(.38,'bead_lift','hand.back'),(.51,'bead_guard','hand.back')),
  events(move('Undertow','潜流换线 · 斜铲引流',1.45,.47,[pose(.24,-.07,.05,.74,-.36,.01,.67,.025),pose(.47,.17,.25,.55,1.28,.11,.59,.045),pose(.66,.09,.23,.60,1.02,.12,.62,.03)],True,event='undertow'),(.47,'undertow','weapon.tip'))],
 'xiaobailong':[
  events(move('TwinCrescent','双月回锋 · 交锋双月',1.35,.35,[pose(.20,-.08,.04,.80,-3.10,-.03,.67,.02),pose(.35,.17,.27,.61,-1.10,-.09,.64,.03),pose(.47,.02,.16,.60,-.38,.00,.69,.025),pose(.65,-.10,.10,.79,-3.25,.12,.74,.015),pose(.78,-.035,.17,.72,-2.70,.08,.69,.02)],event='moon_first'),(.35,'moon_first','weapon.tip'),(.65,'moon_second','weapon.tip')),
  events(travel(move('MistVeil','雾隐游身 · 折步隐锋',1.20,.43,[pose(.21,.08,.11,.61,-.85,.03,.68,.045),pose(.43,-.10,.06,.70,-2.20,.19,.75,.025),pose(.65,-.06,.10,.68,-1.86,.15,.73,.025)],event='mist'),-.32),(.43,'mist','hand.back')),
  events(move('TidePrison','水牢截影 · 合掌束流',1.50,.52,[pose(.25,.04,.10,.65,-1.02,.04,.65,.03),pose(.41,-.035,.12,.74,-1.40,.08,.80,.015),pose(.52,.08,.21,.69,-1.52,.24,.72,.025),pose(.74,.07,.21,.68,-1.52,.23,.72,.025)],event='tide_prison'),(.52,'tide_prison','hand.back')),
  events(move('PearlPulse','骊珠引潮 · 拢潮送锋',1.60,.61,[pose(.22,.09,.10,.62,-.85,.05,.59,.04),pose(.40,-.10,.09,.76,-2.80,.09,.82,.015),pose(.51,-.08,.10,.78,-2.95,.10,.84,.01),pose(.61,.17,.28,.64,-1.40,.26,.74,.03),pose(.77,.10,.24,.63,-1.30,.22,.72,.03)],event='pearl'),(.40,'pearl_gather','hand.back'),(.61,'pearl_release','weapon.tip'))]
}


def modules(character):
    items=copy.deepcopy(previous.modules(character))
    new=copy.deepcopy(EXTRA.get(character['id'],[]))
    for item in new:
        item['skill_id']=character['id']+'.'+item['clip']
        release={'StaffGuard':.70,'ReturningStaff':.80,'StoneShell':.82,
                 'PurifyingVerse':.75,'GroundFurrow':.68,'BellyRebound':.79,
                 'RakePin':.78,'WaterSplit':.72,'TwinCrescent':.72}
        if item['clip'] in release:item['release_end']=round(item['duration']*release[item['clip']],4)
        if 'root_motion' in item:
            item['root_motion']['distance']=round(character['height']*item['travel_height_ratio'],4)
    result=[*items[:-2],*new,*items[-2:]]
    hero=character['id'] not in ['wolf','tiger','baigufuren']
    for item in result:
        if hero and item['clip'] not in ['HitRecoil','DodgeBack']:
            # An attack owns the upper pose, never the player's locomotion.
            item['upper_clip']=item['clip']+'_Upper'
            for key in ['root_motion','airborne','stationary','footwork','travel_height_ratio']:
                item.pop(key,None)
            if item['clip']=='RakeVault':
                item['name']='腾耙破阵 · 支耙下压'
        elif item['clip']=='DodgeBack':
            item['duration']=.45
            item['windup_end']=.08
            item['release_end']=.32
            item['events']=[dict(time=.08,type='dodge',socket='actor')]
            item['root_motion']['distance']=round(-character['height']*.22,4)
            if hero:item['airborne']={'start':.16,'end':.80,'height_ratio':.07}
    return [apply_signature(item) for item in result]
