"""Compose the actual GLB viewer with persistent twelve-to-four equipment."""
from pathlib import Path
HERE=Path(__file__).resolve().parent
html=(HERE.parent/'shadow-actions-v2/preview.html').read_text(encoding='utf-8')

def replace(old,new):
    global html
    assert old in html,old[:100]
    html=html.replace(old,new)

replace('西游皮影 · 扩展技能册','西游皮影 · 肘臂修整与六十招')
replace('90 项候选：40 主角招式 · 20 被动 · 18 妖怪招式 · 12 连携。58\n      项演员技能动作已制作，机制与特效待接入战斗。','五位主角各 12 招，每人选 4 招，整队 20 槽。60 项主角动作 + 18 项妖怪动作；直接检查实际模型。')
replace('建议每人装备 1 自动兵器技 + 2 主动技；被动随成长选择。技能池与装备槽方案待实战确定。','1–4 键或图标出招；四槽演练按动作收势与试用冷却顺序执行。冷却跟随技能，换槽和换人不刷新。')
replace('<p id="status" role="status">', '<nav id="party" aria-label="五人技能方案"></nav><p id="equipment-status" role="status"></p><p id="status" role="status">')
replace('<p id="stage-label"></p>', '''<section id="loadout" aria-label="四个已装备技能">
<div id="slots" aria-label="点击技能出招"></div>
<div class="controls"><button class="series-button series-button--primary" id="practice" aria-pressed="false">演练四槽</button><button class="series-button series-button--secondary" id="new-loadout">试用新增四招</button>
<label>整备位置 <select id="slot-choice" aria-label="整备位置"><option value="0">第 1 槽</option><option value="1">第 2 槽</option><option value="2">第 3 槽</option><option value="3">第 4 槽</option></select></label>
<button class="series-button series-button--secondary" id="equip">装入此槽</button></div><div class="controls" id="templates" aria-label="悟空构筑示例"></div></section>
<p id="stage-label"></p>''')
replace('height: clamp(260px, calc(100dvh - 420px), 440px);','height: clamp(300px, calc(100dvh - 430px), 480px);')
replace('  </style>', '''
    #party{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:12px 0}
    .party-portrait{display:flex;align-items:center;gap:8px;background:transparent!important}
    .party-portrait img{width:38px;height:44px;object-fit:contain}
    .party-portrait[aria-pressed="true"]{outline:2px solid var(--jade)}
    #loadout{margin:12px 0}#slots{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:12px}
    .slot{position:relative;display:flex;flex-direction:column;align-items:center;min-width:0;padding:0 0 5px!important;background:transparent!important}
    .slot img{width:100%;height:65px;object-fit:contain}
    .slot strong{font-size:14px;line-height:1.5}.slot-cooldown{position:absolute;inset:0 0 25px;display:grid;place-items:center;font:20px var(--serif);pointer-events:none;color:var(--ink)}
    .slot-cooldown:not(:empty){background:var(--paper-overlay)}#templates{margin-top:12px}
    #equipment-status{font-size:14px}.stage canvas{touch-action:none}#film{display:block;width:100%;margin-top:12px}
    @media(max-width:760px){.party-portrait{padding:4px!important}.party-portrait img{width:29px;height:35px}#party{gap:6px}.party-portrait span{font-size:13px}.slot strong{font-size:12px}#slots{gap:4px}.stage canvas{height:350px}}
  </style>''')
replace("    import * as THREE from 'three';", "    import * as THREE from 'three';\n    import { SkillDirector } from '/director.mjs';")
replace('function selectModule(next, replay = true, preserveGait = true) {','function selectModule(next, replay = true, preserveGait = true, fromDirector = false) {\n      if(!fromDirector)endPractice();')
replace('      resize();\n    }\n    function sample()', '      resize();\n      updateEquipButton();\n    }\n    function sample()')
replace('      qa.paused = paused;','      qa.paused = paused;')
replace("    $('#phase').oninput = (e) => {", "    $('#phase').oninput = (e) => {\n      endPractice();")
replace('      selectModule(spec);\n    };\n    $(\'#slow\')', '      selectModule(spec,true,true,practice);\n    };\n    $(\'#slow\')')
replace("    async function selectCharacter(id) {", "    async function selectCharacter(id) {\n      endPractice();qa.ready=false;")
replace('        qa.ready = true;','        qa.ready = true;\n        renderSlots();')
replace("    await selectCharacter('wukong');", (HERE/'loadout-ui.js').read_text(encoding='utf-8')+"\n    await selectCharacter('wukong');")
replace('      if (!paused && spec) {','      if (practice) { practiceTick(dt); } else if (!paused && spec) {')
replace('地图碰撞、命中、技能特效与精细指形仍待接入审阅。','本页演练不结算敌人伤害；地图碰撞、战斗 AI、正式特效与数值仍待接入验收。')
(HERE/'preview.html').write_text(html,encoding='utf-8')
print('Prepared native 60-action equipment rehearsal on port 8883.')
