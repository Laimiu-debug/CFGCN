"""Original choreography data. Times are seconds; pose keys use normalized time.

These clips author motion, not damage, cooldowns or character unlock rules.
Hand coordinates are fractions of each character's own height, from hip center.
"""
from pathlib import Path
import json

HERE = Path(__file__).resolve().parent
BASE = HERE.parent / "shadow-roster-v4"
ROSTER = json.loads((BASE / "roster.json").read_text(encoding="utf-8"))
UPPER = ["abdomen", "body", "head", "upper_arm.back", "forearm.back",
         "upper_arm.front", "forearm.front", "weapon", "accessory"]
LOWER = ["pelvis", "thigh.back", "shin.back", "foot.back", "thigh.front", "shin.front", "foot.front"]


def pose(t, lean, x, z, weapon, bx, bz, compression=.015):
    return dict(t=t, lean=lean, hand=[x,z], weapon=weapon,
                back_hand=[bx,bz], compression=compression)


def move(clip, label, duration, contact, poses, two_hand=False, event="hit", **extra):
    duration=round(duration*60)/60
    return dict(clip=clip, label=label, duration=duration,
                windup_end=round(contact*duration,4),
                release_end=round((contact+.13)*duration,4),
                events=[dict(time=round(contact*duration,4),type=event,socket="weapon.tip" if event in ["hit","projectile","wave"] else "actor" if event in ["hurt","dodge"] else "hand.back")],
                poses=poses, two_hand=two_hand, upper_clip=clip+"_Upper", **extra)


SETS = {
 "wukong": [
  move("StaffSweep","如意棍法 · 横扫",.90,.43,[pose(.30,-.14,-.025,.70,-.85,.06,.65,.035),pose(.43,.18,.24,.60,1.35,.10,.60,.025),pose(.59,.24,.24,.53,1.95,.08,.57,.04)],True),
  move("FreezeSeal","定身咒 · 举臂发诀",1.05,.48,[pose(.30,-.06,.12,.58,.04,-.04,.67),pose(.48,.08,.16,.58,.12,.25,.72),pose(.68,.04,.16,.60,.10,.24,.72)],event="freeze"),
  move("HairClone","毫毛分身 · 拈毫吹化",1.20,.53,[pose(.25,-.08,.12,.58,.08,.02,.84),pose(.43,-.10,.12,.58,.08,.08,.83),pose(.53,.08,.15,.59,.15,.27,.77),pose(.70,.05,.15,.59,.12,.23,.73)],event="spawn_clone")],
 "tangseng": [
  move("Chant","梵音退敌 · 抬臂诵经",1.05,.47,[pose(.27,-.035,.13,.58,.015,.03,.68),pose(.47,.06,.15,.59,.02,.20,.70),pose(.66,.04,.15,.59,.02,.16,.72)],event="chant"),
  move("RobeWard","锦襕护持 · 展臂护身",1.30,.42,[pose(.24,-.05,.10,.65,-.12,-.05,.67,.01),pose(.42,-.035,.21,.72,-.20,.19,.72,.018),pose(.75,-.025,.21,.72,-.20,.19,.72,.018)],event="ward"),
  move("HealingVow","回春愿 · 托举祝愿",1.40,.56,[pose(.26,.06,.12,.62,-.06,.04,.63,.025),pose(.56,-.055,.13,.73,-.06,.10,.80,.01),pose(.78,-.04,.13,.72,-.04,.10,.79,.01)],event="heal")],
 "bajie": [
  move("RakeSweep","钉耙横扫",1.12,.47,[pose(.32,-.18,.00,.67,-.65,.02,.65,.035),pose(.47,.19,.23,.57,1.32,.10,.57,.025),pose(.64,.24,.23,.51,1.72,.09,.53,.035)],True,proposal=True),
  move("RakeSlam","举耙重落",1.40,.56,[pose(.34,-.16,.04,.79,-.24,.02,.70,.018),pose(.47,-.13,.04,.80,.02,.04,.73,.01),pose(.56,.24,.23,.53,1.38,.09,.57,.045),pose(.68,.22,.23,.50,1.55,.10,.53,.05)],True,proposal=True),
  move("BellyBrace","收腹架耙 · 防守",1.20,.44,[pose(.24,.08,.07,.57,.20,-.02,.61,.035),pose(.44,.18,.12,.63,.50,.10,.63,.05),pose(.76,.13,.12,.63,.50,.10,.63,.045)],event="guard",proposal=True)],
 "shaseng": [
  move("SpadeSweep","月牙铲 · 沉身横扫",1.12,.46,[pose(.30,-.12,-.01,.68,-.70,.01,.66,.025),pose(.46,.16,.22,.59,1.28,.08,.60,.035),pose(.65,.20,.24,.53,1.63,.09,.57,.04)],True,proposal=True),
  move("SpadeThrust","月牙铲 · 平铲前送",1.04,.48,[pose(.29,-.07,-.025,.62,1.45,.02,.63,.025),pose(.48,.20,.27,.61,1.54,.13,.61,.035),pose(.62,.15,.26,.60,1.54,.12,.60,.03)],True,proposal=True),
  move("RiverWard","竖铲护河",1.35,.47,[pose(.28,-.04,.13,.62,-.08,.01,.65),pose(.47,.02,.15,.68,.04,.20,.76),pose(.76,.02,.15,.68,.04,.20,.76)],event="ward",proposal=True)],
 "xiaobailong": [
  move("JianCut","人形剑势 · 斜劈",.86,.43,[pose(.28,-.09,.03,.78,-3.25,.00,.66,.018),pose(.43,.13,.28,.67,-1.65,-.04,.62,.025),pose(.60,.17,.26,.56,-.95,-.08,.62,.03)],proposal=True),
  move("WaveStep","人形腾浪 · 进身送剑",1.0,.52,[pose(.28,-.06,.08,.65,-1.25,.02,.67,.035),pose(.52,.15,.29,.65,-1.57,-.05,.66,.025),pose(.68,.10,.27,.63,-1.57,-.05,.64,.02)],event="wave",proposal=True),
  move("ScaleWard","龙鳞护佑 · 举臂护持",1.20,.45,[pose(.27,-.05,.15,.62,-.66,.00,.66),pose(.45,-.03,.14,.70,-.35,.14,.79),pose(.76,-.02,.14,.70,-.35,.14,.79)],event="ward",proposal=True)],
 "wolf": [
  move("SaberSlash","狼妖 · 抽刀斩",.78,.41,[pose(.27,-.02,.02,.76,-.65,-.02,.63,.04),pose(.41,.32,.29,.58,1.38,-.05,.63,.045),pose(.58,.36,.26,.47,1.90,-.09,.57,.055)],proposal=True),
  move("LowLunge","狼妖 · 低身突刺",.88,.49,[pose(.28,.14,.06,.57,1.05,.00,.60,.055),pose(.49,.38,.31,.56,1.55,-.06,.60,.07),pose(.64,.31,.27,.55,1.50,-.04,.60,.065)],proposal=True),
  move("WolfHowl","狼妖 · 仰首呼啸",1.25,.49,[pose(.28,.13,.12,.56,.25,.00,.66,.05),pose(.49,-.12,.10,.63,-.12,.06,.77,.02),pose(.73,-.10,.10,.63,-.12,.06,.77,.02)],event="howl",proposal=True)],
 "tiger": [
  move("AxeCleave","虎妖 · 举斧重劈",1.20,.54,[pose(.34,-.14,.04,.80,-.32,.00,.72,.02),pose(.45,-.11,.03,.81,-.18,.01,.74,.015),pose(.54,.23,.24,.54,1.33,.11,.59,.055),pose(.70,.25,.24,.49,1.62,.10,.54,.06)],True,proposal=True),
  move("AxeSweep","虎妖 · 横斧破阵",1.08,.46,[pose(.30,-.13,-.01,.69,-.73,.02,.65,.03),pose(.46,.18,.25,.59,1.32,.10,.60,.045),pose(.66,.23,.26,.52,1.72,.10,.56,.05)],True,proposal=True),
  move("TigerRoar","虎妖 · 震身怒吼",1.32,.48,[pose(.28,.12,.13,.57,.18,-.02,.64,.055),pose(.48,-.12,.13,.70,-.20,.19,.72,.02),pose(.70,-.08,.13,.70,-.20,.19,.72,.02)],event="roar",proposal=True)],
 "baigufuren": [
  move("BoneBolt","白骨夫人 · 送杖飞矢",1.04,.46,[pose(.28,-.07,.05,.69,-.26,-.02,.67,.01),pose(.46,.06,.25,.71,1.04,.14,.70,.012),pose(.65,.05,.25,.70,1.12,.12,.69,.012)],event="projectile",proposal=True),
  move("SleeveSweep","白骨夫人 · 拂袖",1.16,.46,[pose(.27,-.06,.11,.63,.08,-.03,.78,.01),pose(.46,.07,.14,.64,.20,.25,.72,.014),pose(.66,.10,.15,.61,.25,.27,.61,.02)],event="sleeve",proposal=True),
  move("SpiritCall","白骨夫人 · 招魂",1.50,.58,[pose(.24,.07,.11,.61,.02,.03,.62,.02),pose(.44,-.06,.13,.76,-.16,.09,.78,.01),pose(.58,-.10,.14,.81,-.25,.09,.85,.005),pose(.78,-.06,.14,.79,-.18,.09,.82,.008)],event="summon",proposal=True)]}


def modules(character):
    items = SETS[character["id"]]
    # A hit recoils away from the strike; a dodge is a two-foot retreat. The
    # separate root curve must be consumed by collision-aware game movement.
    hit=move("HitRecoil","受击 · 后仰缓冲",.55,.12,[pose(.12,-.18,.09,.62,-.10,-.04,.66,.035),pose(.35,.08,.13,.61,.10,.02,.65,.045),pose(.65,.04,.13,.61,.08,.02,.64,.02)],event="hurt")
    hit["upper_clip"]=None
    dodge=move("DodgeBack","闪避 · 后撤换步",.84,.40,[pose(.24,-.10,.10,.61,-.12,-.02,.66,.045),pose(.45,-.13,.11,.64,-.16,.04,.68,.06),pose(.72,-.03,.12,.62,.0,.02,.65,.025)],event="dodge")
    dodge["upper_clip"]=None
    dodge["root_motion"]={"axis":"facing-x","distance":round(-character["height"]*.28,4),"keys":[[0,0],[.14,0],[.88,1],[1,1]],"application":"external collision-aware displacement; not baked into bone translation"}
    return [*items,hit,dodge]


if __name__=="__main__":
    print(json.dumps({c["id"]:modules(c) for c in ROSTER},ensure_ascii=False,indent=2))
