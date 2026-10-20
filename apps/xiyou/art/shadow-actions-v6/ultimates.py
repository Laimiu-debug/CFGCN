"""Five manually equipped signature actions; stable skill IDs preserve saves."""
def p(t,lean,x,z,angle,bx,bz,compression=.03):
    return dict(t=t,lean=lean,hand=[x,z],weapon=angle,back_hand=[bx,bz],compression=compression)

ULTIMATES={
 'PurifyingVerse':dict(name='大乘梵音',actor='tangseng',cooldown=24.,duration=2.4,
    role='救场 · 三段梵音',target='近处队友与敌人',
    effect='展掌诵经，三次莲音推开近敌、治疗附近存活队友并清除邪秽，末段补一层护持。',
    limit='不复活倒地者；施法仍可移动，闪避会取消后续莲音，已消耗冷却保留。',
    poses=[p(.19,-.055,.12,.71,-.09,.03,.74,.02),p(.32,.045,.16,.70,.08,.25,.72),p(.43,-.025,.14,.72,.02,.09,.80,.02),p(.52,.065,.18,.68,.12,.27,.70),p(.64,-.035,.14,.74,-.04,.10,.82,.02),p(.74,.075,.19,.69,.14,.27,.74),p(.86,.025,.15,.69,.07,.19,.71,.02)],
    events=[(.32,'purify_start','hand.back'),(.52,'purify_pulse','hand.back'),(.74,'purify_end','hand.back')]),
 'CrashingCloud':dict(name='金箍镇岳',actor='wukong',cooldown=20.,duration=1.8,
    role='破阵 · 重击与余震',target='面前宽扇区与身边',
    effect='沉肩擎棍后砸下巨棍虚影，正面重击破势，第二次短余震震开身边追敌。',
    limit='巨棍是法术虚影，不改变身体碰撞；两段各只命中一次，闪避取消未释放段落。',
    poses=[p(.16,.16,.14,.66,-.24,.02,.69,.06),p(.34,-.12,.05,.78,-.28,.03,.72,.015),p(.46,-.07,.07,.77,.05,.05,.73,.01),p(.58,.24,.24,.53,1.38,.10,.57,.06),p(.72,.17,.22,.53,1.50,.10,.54,.05),p(.85,.06,.14,.64,.42,.06,.65,.025)],
    events=[(.58,'mountain_hit','weapon.tip'),(.72,'mountain_echo','weapon.tip')]),
 'RakePin':dict(name='天蓬九重耙',actor='bajie',cooldown=22.,duration=2.1,
    role='压制 · 三叠九齿',target='面前逐渐扩展的扇区',
    effect='举耙蓄势，连续三段九齿耙浪向前压进；末段土浪更重，削减架势并推开近敌。',
    limit='三段有空隙，不形成常驻伤害墙；首领只短暂破势，闪避取消后续段落。',
    poses=[p(.20,-.16,.04,.80,-.22,.02,.72,.02),p(.34,.23,.23,.57,1.35,.10,.59,.055),p(.43,-.06,.08,.76,-.08,.03,.70,.025),p(.54,.25,.24,.55,1.42,.11,.57,.065),p(.64,-.08,.07,.78,-.16,.02,.72,.02),p(.75,.27,.23,.56,1.40,.10,.58,.06),p(.86,.08,.15,.63,.40,.06,.64,.03)],
    events=[(.34,'pin_start','weapon.tip'),(.54,'pin_pulse','weapon.tip'),(.75,'pin_end','weapon.tip')]),
 'WaterSplit':dict(name='流沙覆海',actor='shaseng',cooldown=22.,duration=2.1,
    role='控场 · 前浪与回潮',target='前方宽水扇与后侧追敌',
    effect='铲开三叠前浪，再回身挑起回潮；命中敌人留下湿痕，短水带降低追击速度。',
    limit='水带不推动队友，不封住道路；前后两段分别结算，闪避会取消未发回潮。',
    poses=[p(.19,-.12,-.01,.69,-.70,.01,.64,.025),p(.36,.20,.24,.57,1.42,.10,.57,.04),p(.49,.05,.14,.68,.12,.04,.64,.025),p(.65,-.15,-.035,.72,-1.10,-.08,.69,.035),p(.78,-.09,0.,.72,-.73,-.03,.67,.025)],
    events=[(.36,'front_wave','weapon.tip'),(.65,'rear_wave','weapon.tip')]),
 'PearlPulse':dict(name='白龙破浪',actor='xiaobailong',cooldown=20.,duration=1.9,
    role='贯穿 · 龙形剑潮',target='面前一条长线',
    effect='拢潮托珠后送剑，白龙虚影沿剑潮贯穿近敌；最多消耗三道附近友方水痕增强威力。',
    limit='受地形阻挡，贯穿目标数封顶；不自动冲刺，无水痕仍能释放基础龙潮。',
    poses=[p(.18,.09,.10,.62,-.85,.05,.59,.04),p(.36,-.10,.09,.76,-2.80,.09,.82,.015),p(.49,-.08,.10,.78,-2.95,.10,.84,.01),p(.62,.17,.28,.64,-1.40,.26,.74,.03),p(.77,.10,.24,.63,-1.30,.22,.72,.03)],
    events=[(.36,'pearl_gather','hand.back'),(.62,'pearl_release','weapon.tip')])}

def apply_signature(item):
    if item['clip'] not in ULTIMATES:return item
    u=ULTIMATES[item['clip']]
    item.update(label=u['name'],duration=u['duration'],poses=u['poses'],ultimate=True)
    item['events']=[dict(time=round(t*u['duration'],4),type=kind,socket=socket) for t,kind,socket in u['events']]
    item['windup_end']=round(u['events'][0][0]*u['duration'],4)
    item['release_end']=round((u['events'][-1][0]+.09)*u['duration'],4)
    return item
