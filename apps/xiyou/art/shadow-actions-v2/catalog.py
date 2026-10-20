"""Expanded original choreography; mechanics live in skill_book.py.

Reuse v1 as a read-only authoring dependency. Each character keeps its own
anatomy, hand anchors and weapon dimensions. Root motion is external data.
"""
from pathlib import Path
import copy, importlib.util

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('base_choreography',HERE.parent/'shadow-actions-v1/catalog.py')
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
BASE,ROSTER,UPPER,LOWER=base.BASE,base.ROSTER,base.UPPER,base.LOWER
pose,move=base.pose,base.move


def travel(item,distance,airborne=False):
    item['upper_clip']=None
    item['footwork']='two_step'
    item['travel_height_ratio']=distance
    if airborne:
        item['footwork']='leap'
        item['airborne']={'start':.18,'end':.72,'height_ratio':.14,'landing_phase':.72}
    return item


EXTRA={
 'wukong':[
  move('StaffThrust','点将直捣',.90,.48,[pose(.28,-.10,-.03,.62,1.47,.01,.62,.03),pose(.48,.22,.28,.63,1.54,.13,.63,.035),pose(.62,.16,.26,.62,1.54,.12,.62,.03)],True),
  move('BackSweep','回身挑棍',1.05,.52,[pose(.26,.13,.21,.55,1.74,.08,.56,.04),pose(.42,-.14,-.02,.65,-.72,.01,.65,.025),pose(.52,-.10,.04,.77,-.26,.02,.70,.02),pose(.70,.09,.18,.65,.78,.09,.63,.03)],True),
  travel(move('CrashingCloud','坠云压阵',1.40,.72,[pose(.18,.16,.14,.66,-.24,.02,.69,.06),pose(.37,-.12,.05,.78,-.28,.03,.72,.015),pose(.58,-.07,.07,.77,.05,.05,.73,.01),pose(.72,.24,.24,.53,1.38,.10,.57,.06),pose(.82,.17,.22,.53,1.5,.10,.54,.05)],True),.24,True),
  travel(move('CloudFeint','筋斗闪身',.88,.46,[pose(.22,.08,.11,.61,-.15,.00,.68,.04),pose(.46,-.16,.09,.68,-.30,.20,.73,.05),pose(.71,-.05,.13,.63,-.05,.12,.68,.025)],event='decoy'),-.24),
  move('FlameGaze','火眼照妖',1.08,.49,[pose(.25,-.03,.12,.60,.04,.03,.85),pose(.49,.10,.15,.62,.12,.23,.83),pose(.72,.08,.14,.62,.10,.25,.78)],event='reveal')],
 'tangseng':[
  move('LotusPulse','莲华推障',1.12,.49,[pose(.28,-.07,.12,.62,-.05,-.03,.65,.025),pose(.49,.10,.15,.63,.12,.26,.69,.03),pose(.67,.06,.15,.62,.08,.24,.68,.02)],event='push'),
  move('BellChime','振杖清音',.95,.43,[pose(.24,-.08,.05,.70,-.32,.01,.66),pose(.43,.12,.23,.68,.54,.15,.67,.025),pose(.60,.07,.20,.66,.36,.12,.67)],event='interrupt'),
  move('VowLink','同心愿契',1.30,.51,[pose(.24,-.02,.11,.65,-.02,.04,.62),pose(.51,-.04,.14,.71,-.10,.22,.75),pose(.77,-.02,.14,.70,-.08,.22,.75)],event='tether'),
  move('PureSeal','清心破妄',1.03,.47,[pose(.24,.05,.12,.60,.08,.02,.64,.025),pose(.47,-.07,.13,.74,-.08,.10,.82,.01),pose(.65,.07,.15,.66,.10,.25,.73)],event='cleanse'),
  move('Mandala','经幡结界',1.60,.58,[pose(.23,-.05,.08,.64,-.13,-.04,.65),pose(.42,-.09,.08,.75,-.23,.03,.79,.01),pose(.58,-.02,.20,.74,-.12,.22,.78,.015),pose(.80,-.02,.20,.74,-.12,.22,.78,.015)],event='zone')],
 'bajie':[
  move('RakeHook','倒耙牵敌',1.25,.54,[pose(.28,.19,.27,.63,1.48,.12,.63,.03),pose(.43,.15,.27,.59,1.61,.13,.59,.035),pose(.54,-.15,.02,.63,1.08,.02,.63,.04),pose(.72,-.12,.02,.66,.73,.02,.64,.025)],True,event='pull'),
  move('RakeTrip','横耙绊足',1.15,.49,[pose(.27,-.12,.02,.63,1.18,.02,.61,.035),pose(.49,.23,.24,.51,1.76,.11,.54,.065),pose(.66,.19,.22,.50,1.88,.10,.52,.06)],True,event='trip'),
  move('MudWall','泥涧筑垒',1.45,.57,[pose(.30,-.13,.04,.78,-.20,.02,.70,.02),pose(.43,-.09,.06,.77,.03,.04,.72,.015),pose(.57,.23,.23,.52,1.48,.10,.56,.06),pose(.75,.15,.22,.53,1.50,.10,.54,.05)],True,event='terrain_slow'),
  travel(move('RollingCharge','挺腹冲阵',1.10,.56,[pose(.23,-.10,.07,.59,.30,.01,.64,.06),pose(.44,.22,.15,.61,.58,.10,.65,.06),pose(.56,.30,.17,.60,.65,.11,.64,.065),pose(.78,.14,.14,.60,.43,.08,.64,.04)],event='charge'),.26),
  move('FeastBreath','纳气回元',1.80,.60,[pose(.22,.15,.12,.56,.20,.02,.52,.055),pose(.43,.02,.12,.65,-.03,.05,.67,.03),pose(.60,-.06,.13,.70,-.10,.09,.75,.015),pose(.80,-.02,.13,.68,-.04,.09,.72,.02)],event='self_heal')],
 'shaseng':[
  move('SpadeLift','挑铲断势',1.15,.50,[pose(.28,.17,.22,.53,1.76,.10,.55,.04),pose(.50,-.09,.07,.78,-.26,.04,.72,.015),pose(.67,-.04,.12,.75,.04,.07,.69,.02)],True,event='lift'),
  move('SandVortex','流沙回旋',1.50,.53,[pose(.24,-.14,.00,.66,-.70,.01,.64,.03),pose(.42,.19,.23,.57,1.35,.09,.59,.04),pose(.53,.23,.22,.51,1.72,.09,.54,.05),pose(.70,-.09,.03,.66,-.48,.02,.64,.03),pose(.81,.12,.21,.61,1.23,.08,.61,.03)],True,event='vortex'),
  travel(move('RiverDrag','退步引流',1.22,.54,[pose(.25,.14,.25,.62,1.50,.11,.62,.03),pose(.54,-.12,.03,.64,1.12,.03,.63,.035),pose(.72,-.07,.05,.66,.70,.04,.65,.02)],True,event='drag'),-.22),
  move('PrayerBeads','念珠镇魂',1.12,.48,[pose(.24,-.04,.13,.63,.06,.02,.71),pose(.35,-.07,.13,.66,-.02,.04,.76),pose(.48,.10,.15,.64,.16,.27,.73),pose(.68,.08,.15,.63,.12,.24,.70)],event='beads'),
  travel(move('RiverTread','踏浪截阵',1.10,.54,[pose(.25,-.08,.05,.66,.80,.02,.65,.04),pose(.54,.19,.24,.63,1.38,.11,.63,.035),pose(.73,.12,.22,.62,1.34,.10,.62,.03)],True,event='intercept'),.24)],
 'xiaobailong':[
  move('RisingSlash','游龙挑锋',.95,.48,[pose(.26,.12,.21,.55,-.85,-.03,.62,.035),pose(.48,-.08,.14,.80,-2.70,-.06,.67,.015),pose(.65,-.02,.19,.77,-2.30,-.04,.67,.02)],event='lift'),
  travel(move('TideReturn','回澜折剑',1.10,.51,[pose(.25,.05,.21,.65,-1.20,.01,.68,.035),pose(.51,-.12,.13,.74,-2.25,.13,.74,.04),pose(.70,.12,.27,.65,-1.55,-.03,.64,.025)],event='parry'),-.22),
  move('FrostBreath','寒息引流',1.48,.50,[pose(.24,-.06,.13,.64,-.63,.02,.73),pose(.50,.12,.18,.65,-.95,.26,.75,.025),pose(.78,.10,.17,.65,-.95,.26,.74,.02)],event='frost'),
  travel(move('DragonDash','穿云疾剑',.90,.49,[pose(.23,-.08,.09,.66,-1.25,.02,.69,.04),pose(.49,.24,.30,.65,-1.57,-.07,.65,.03),pose(.70,.15,.27,.64,-1.57,-.05,.65,.025)],event='dash'),.29),
  move('RainBlessing','甘霖普降',1.55,.56,[pose(.25,.04,.12,.64,-.52,.02,.64,.025),pose(.56,-.07,.12,.77,-.30,.11,.83,.01),pose(.78,-.04,.14,.75,-.37,.16,.80,.015)],event='rain')],
 'wolf':[
  move('TwinCut','双势连斩',1.20,.36,[pose(.22,-.04,.03,.76,-.64,-.02,.65,.035),pose(.36,.30,.28,.58,1.33,-.05,.61,.05),pose(.51,-.02,.09,.73,-.46,.01,.65,.03),pose(.64,.32,.28,.54,1.70,-.07,.60,.05),pose(.77,.21,.24,.56,1.45,-.04,.62,.04)]),
  travel(move('LateralPounce','侧跃扑袭',1.15,.72,[pose(.18,.29,.16,.59,.64,-.02,.65,.075),pose(.40,-.05,.08,.75,-.36,.02,.70,.02),pose(.60,.17,.20,.68,.72,.02,.66,.02),pose(.72,.35,.28,.55,1.57,-.06,.59,.07),pose(.83,.28,.25,.55,1.50,-.04,.61,.05)]),.27,True),
  move('PackMark','群猎点名',1.20,.49,[pose(.25,.10,.12,.62,.20,.01,.71,.04),pose(.49,-.08,.11,.67,-.14,.23,.78,.02),pose(.73,.06,.16,.62,.33,.25,.72,.035)],event='mark')],
 'tiger':[
  travel(move('ShoulderRush','虎肩冲阵',1.25,.54,[pose(.25,-.12,.08,.65,.48,.03,.66,.06),pose(.54,.31,.18,.59,.92,.12,.62,.07),pose(.73,.20,.17,.61,.72,.10,.64,.05)],event='charge'),.25),
  move('GroundStomp','虎踞踏地',1.35,.55,[pose(.28,-.07,.11,.72,-.12,.02,.70,.02),pose(.42,-.09,.12,.73,-.18,.05,.71,.01),pose(.55,.22,.16,.61,.39,.11,.65,.075),pose(.73,.15,.15,.62,.28,.10,.65,.055)],event='stomp',stomp=True),
  move('AxeGuard','架斧反震',1.40,.49,[pose(.23,.06,.10,.61,.65,.04,.63,.035),pose(.49,.09,.13,.66,.83,.08,.66,.04),pose(.70,.09,.13,.66,.83,.08,.66,.04),pose(.82,.16,.20,.62,1.25,.09,.62,.04)],True,event='parry')],
 'baigufuren':[
  move('BoneCage','白骨囚笼',1.65,.57,[pose(.24,-.03,.10,.64,-.03,.02,.63,.015),pose(.41,-.09,.12,.78,-.22,.06,.80,.008),pose(.57,.06,.23,.73,.82,.24,.76,.014),pose(.79,.05,.23,.72,.82,.23,.75,.014)],event='cage'),
  travel(move('FalseSkin','画皮移形',1.20,.49,[pose(.25,.06,.12,.61,.20,-.02,.73,.025),pose(.49,-.12,.10,.73,-.20,.18,.81,.025),pose(.74,-.04,.14,.66,.04,.21,.73,.02)],event='illusion'),-.24),
  move('SoulSiphon','摄魂牵引',1.80,.48,[pose(.23,-.07,.12,.68,-.18,-.02,.67,.01),pose(.48,.09,.23,.73,.85,.26,.75,.015),pose(.76,-.04,.15,.73,.14,.12,.77,.02),pose(.85,-.05,.13,.72,.03,.08,.76,.02)],event='siphon')]
}
EXTRA['wolf'][0]['events']=[dict(time=round(EXTRA['wolf'][0]['duration']*t,4),type='hit',socket='weapon.tip') for t in [.36,.64]]


def modules(character):
    items=copy.deepcopy([*base.SETS[character['id']],*EXTRA[character['id']],*base.modules(character)[-2:]])
    for item in items:
        if item.get('stomp'):item['upper_clip']=None
        if item['clip'] in [s['clip'] for s in EXTRA[character['id']]]:
            for event in item['events']:
                kind=event['type']
                if kind in ['hit','pull','trip','terrain_slow','lift','vortex','drag','intercept','dash','parry']:event['socket']='weapon.tip'
                if kind in ['charge','decoy','illusion']:event['socket']='actor'
                if kind=='stomp':event['socket']='foot.front'
                if kind in ['decoy','illusion']:event['space']='cast-origin'
        if 'travel_height_ratio' in item:
            item['root_motion']={'axis':'facing-x','distance':round(character['height']*item['travel_height_ratio'],4),'keys':[[0,0],[.14,0],[.88,1],[1,1]],'application':'external collision-aware displacement; never teleport through terrain'}
            if item.get('airborne'):item['root_motion']['keys']=[[0,0],[.18,0],[.72,1],[1,1]]
        item['skill_id']=character['id']+'.'+item['clip'] if item['clip'] not in ['HitRecoil','DodgeBack'] else None
    return items
