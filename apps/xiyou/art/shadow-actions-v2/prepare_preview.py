"""Compose the expanded local skill book around the original GLB viewer."""
from pathlib import Path
HERE=Path(__file__).resolve().parent
source=(HERE.parent/'shadow-actions-v1/preview.html').read_text(encoding='utf-8')
script=source.split('<script type="module">',1)[1].split('</script>',1)[0]
script=script.replace("const records = (await (await fetch('/catalog.json')).json()).characters;", "const records = (await (await fetch('/catalog.json')).json()).characters;\n    const book = await (await fetch('/assets/skills.json')).json();\n    let tabKind = 'active';")
script=script.replace('records, renderer, scene, camera','records, book, renderer, scene, camera')
script=script.replace('    const qa =','    let armDetail=false;\n    const qa =')
script=script.replace('      camera.left = (-half * w) / h;','      if(armDetail){camera.top=current.record.height*1.12;camera.bottom=current.record.height*.33;half=(camera.top-camera.bottom)/2;}\n      camera.left = (-half * w) / h;')
script=script.replace("Math.max(Math.abs(b[0]), Math.abs(b[2])) + height * 0.15", "Math.max(Math.abs(b[0]), Math.abs(b[2])) + Math.abs(spec?.root_motion?.distance ?? 0) + height * 0.15")
script=script.replace("$('#moving').disabled = !spec.upper_clip;", "$('#moving').disabled = !spec.upper_clip;\n      $('#moving').setAttribute('aria-pressed',String(moving && !!spec.upper_clip));\n      showEntry(book.entries.find(e=>e.id===current.record.id+'.'+spec.clip));")
script=script.replace("const u = THREE.MathUtils.clamp((p - 0.14) / 0.74, 0, 1);\n        x = spec.root_motion.distance * u * u * (3 - 2 * u);", "const keys=spec.root_motion.keys;\n        let a=keys[0],b=keys.at(-1);\n        for(let i=0;i<keys.length-1;i++)if(p>=keys[i][0]&&p<=keys[i+1][0]){a=keys[i];b=keys[i+1];break;}\n        const u=THREE.MathUtils.clamp((p-a[0])/Math.max(.0001,b[0]-a[0]),0,1);\n        x=spec.root_motion.distance*THREE.MathUtils.lerp(a[1],b[1],u*u*(3-2*u));")
start=script.index("        $('#actions').replaceChildren();")
end=script.index('        gaitTime = 0;',start)
script=script[:start]+"        renderLibrary();\n"+script[end:]
script=script.replace("record.name + ' · 3 招 / 受击 / 后撤 · ' + record.clips.length + ' 个实际导出片段'", "record.name + ' · ' + (record.modules.length-2) + ' 招 + 受击 / 后撤 · ' + record.clips.length + ' 个导出片段'")
script=script.replace('        resize();\n        qa.ready = true;', "        if(tabKind!=='active'){const e=book.entries.find(e=>tabKind==='combo'?e.kind==='combo':e.kind==='passive'&&e.actor===id);showEntry(e);paused=true;pausedUI();sample();if(e)showEntry(e);}\n        resize();\n        qa.ready = true;")
script=script.replace("      pausedUI();\n    };\n    $('#phase')", "      pausedUI();\n      sample();\n    };\n    $('#phase')")
script=script.replace("    await selectCharacter('wukong');", '''
    function showEntry(entry) {
      const detail=$('#detail');detail.replaceChildren();
      if(!entry){const p=document.createElement('p');p.textContent='通用受击 / 闪避动作，不计入技能总数。位移接入必须经过地图碰撞。';detail.append(p);return;}
      const title=document.createElement('h2');title.textContent=entry.name+' · '+entry.role;detail.append(title);
      for(const [label,value] of [['触发',entry.trigger],['目标',entry.target],['作用',entry.effect],['限制与应对',entry.limit],['成长分支一',entry.branches[0]],['成长分支二',entry.branches[1]],['组合',entry.synergy],['状态',entry.status]]){
        const p=document.createElement('p'),strong=document.createElement('strong');strong.textContent=label+'：';p.append(strong,document.createTextNode(value));detail.append(p);
      }
      if(entry.sequence){
        const p=document.createElement('p');p.textContent='检查参与者的演员动作（组合特效与机制尚待实现）：';detail.append(p);
        const nav=document.createElement('div');nav.className='controls';
        for(const id of entry.sequence){const [actor,clip]=id.split('.'),button=document.createElement('button');button.className='series-button series-button--secondary';button.textContent=book.entries.find(e=>e.id===id)?.name??clip;button.onclick=async()=>{$('#character').value=actor;await selectCharacter(actor);selectModule(current.record.modules.find(s=>s.clip===clip));};nav.append(button);}detail.append(nav);
      }
      qa.selectedEntry=entry.id;
    }
    function renderLibrary(){
      if(!current)return;
      const nav=$('#actions');nav.replaceChildren();
      const query=$('#search').value.trim();
      let entries=book.entries.filter(e=>(tabKind==='combo'?e.kind==='combo':e.actor===current.record.id&&(tabKind==='passive'?e.kind==='passive':['active','enemy'].includes(e.kind))));
      entries=entries.filter(e=>!query||(e.name+' '+e.role+' '+e.effect).includes(query));
      for(const entry of entries){
        const button=document.createElement('button');button.type='button';button.className='series-button series-button--secondary skill-card';button.dataset.skill=entry.id;
        if(entry.clip)button.dataset.clip=entry.clip;
        const picture=document.createElement('span');picture.className='card-picture';
        const actors=entry.actors??[entry.actor];
        if(entry.motion){const img=document.createElement('img');img.src='/assets/'+entry.motion.thumbnail;img.alt='';img.loading='lazy';picture.append(img);}
        else for(const actor of actors){const img=document.createElement('img');img.src='/assets/'+actor+'/parts/head.png';img.alt='';img.loading='lazy';picture.append(img);}
        const name=document.createElement('strong');name.textContent=entry.name;
        const role=document.createElement('span');role.textContent=entry.role;
        button.append(picture,name,role);
        button.onclick=()=>{if(entry.clip)selectModule(current.record.modules.find(s=>s.clip===entry.clip));else{paused=true;pausedUI();sample();showEntry(entry);for(const b of nav.children)b.setAttribute('aria-pressed',String(b===button));}};
        nav.append(button);
      }
      if(tabKind==='active'&&!query)for(const s of current.record.modules.filter(s=>!s.skill_id)){
        const button=document.createElement('button');button.className='series-button series-button--secondary';button.dataset.clip=s.clip;button.textContent=s.label;button.onclick=()=>selectModule(s);nav.append(button);
      }
      if(!entries.length){const p=document.createElement('p');p.textContent='本角色没有这一类技能；试试其他角色或清除检索。';nav.append(p);}
      nav.scrollTop=0;
      $('#library-count').textContent=entries.length+' 项'+(tabKind==='combo'?'全队连携':tabKind==='passive'?'成长被动':'角色招式');
      for(const b of document.querySelectorAll('[data-kind]'))b.setAttribute('aria-pressed',String(b.dataset.kind===tabKind));
    }
    for(const button of document.querySelectorAll('[data-kind]'))button.onclick=()=>{
      tabKind=button.dataset.kind;renderLibrary();
      const id=$('#actions [data-skill]')?.dataset.skill,entry=book.entries.find(e=>e.id===id);
      if(entry?.clip)selectModule(current.record.modules.find(s=>s.clip===entry.clip),false);
      paused=true;pausedUI();sample();if(entry)showEntry(entry);
      for(const b of $('#actions').children)b.setAttribute('aria-pressed',String(b.dataset.skill===id));
    };
    $('#search').oninput=renderLibrary;
    $('#arm-detail').onclick=()=>{armDetail=!armDetail;$('#arm-detail').setAttribute('aria-pressed',String(armDetail));$('#arm-detail').textContent=armDetail?'看完整人物':'放大肩臂';resize();};
    await selectCharacter('wukong');''')
html='''<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>西游皮影 · 百招候选册</title><link rel="icon" href="data:,"><link rel="stylesheet" href="/theme.css">
<style>
body{margin:0;padding:20px;font-family:var(--font-body);background:var(--paper);color:var(--ink)}header,main{max-width:1480px;margin:auto}h1,h2{font-family:var(--serif);font-weight:normal}h1{font-size:28px;margin:0 0 8px}h2{font-size:23px}p{line-height:1.65;margin:8px 0;color:var(--muted)}strong{color:var(--ink)}.controls,.scrub,.tabs{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.series-button{padding:8px 12px}.series-button[aria-pressed="true"]{outline:2px solid var(--jade);outline-offset:2px}select,input{font:inherit;background:var(--paper);color:var(--ink);border:1px solid var(--line);padding:8px;max-width:100%;box-sizing:border-box}select:focus-visible,input:focus-visible{outline:2px solid var(--jade);outline-offset:3px}.workbench{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(340px,1fr);gap:24px;margin-top:12px}.stage{min-width:0}.stage canvas{display:block;width:100%;height:440px}.scrub{margin-top:12px}.scrub input{width:min(300px,65%);accent-color:var(--jade)}#timeline{height:4px;background:var(--line);margin:10px 0}#timeline span{display:block;height:100%;background:var(--jade);width:0}#stage-label{font:20px var(--serif);color:var(--ink)}.library{min-width:0}.library input{margin-top:12px;width:100%}.skill-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:5px;max-height:570px;overflow:auto}.skill-card{display:flex;flex-direction:column;align-items:stretch;text-align:left;gap:5px;padding:8px}.skill-card strong{font-size:17px}.skill-card>span:last-child{font-size:13px;color:var(--muted)}.card-picture{display:flex;align-items:center;justify-content:center;height:108px;overflow:hidden}.card-picture img{max-width:100%;height:100%;object-fit:contain}.card-picture img+img{margin-left:-8px;max-width:25%}.card-picture img:first-child:nth-last-child(n+3){max-width:25%}#detail{border-top:1px solid var(--line);padding-top:10px;margin-top:20px;max-width:1000px}footer{margin-top:16px;border-top:1px solid var(--line);padding-top:12px}output{font-variant-numeric:tabular-nums}.hint{font-size:14px}@media(max-width:760px){body{padding:12px}.workbench{grid-template-columns:minmax(0,1fr);gap:12px}.stage canvas{height:340px}.skill-grid{max-height:390px}.card-picture{height:95px}h1{font-size:24px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
</style>
<header><h1>西游皮影 · 扩展技能册</h1><p>90 项候选：40 主角招式 · 20 被动 · 18 妖怪招式 · 12 连携。58 项演员技能动作已制作，机制与特效待接入战斗。</p><label>检查角色 <select id="character" aria-label="检查角色"></select></label><p id="status" role="status">正在载入动作库…</p></header>
<main><div class="workbench"><section class="stage" aria-label="实际演员动作"><canvas aria-label="皮影技能实际模型预览"></canvas><p id="stage-label"></p><p class="hint" id="events"></p><div class="controls"><button class="series-button series-button--primary" id="play">重新出招</button><button class="series-button series-button--secondary" id="pause" aria-pressed="false">暂停</button><button class="series-button series-button--secondary" id="moving" aria-pressed="false">走动施法</button><button class="series-button series-button--secondary" id="slow" aria-pressed="false">半速</button><button class="series-button series-button--secondary" id="loop" aria-pressed="true">循环演练</button><button class="series-button series-button--secondary" id="flip" aria-pressed="false">左右翻面</button></div><div class="scrub"><label for="phase">动作进度</label><input id="phase" aria-label="动作进度" type="range" min="0" max="100" step="1" value="0"><output id="clock">0.00s</output><output id="gait-clock" hidden></output></div><div id="timeline" aria-hidden="true"><span></span></div><p class="hint">建议每人装备 1 自动兵器技 + 2 主动技；被动随成长选择。技能池与装备槽方案待实战确定。</p></section><aside class="library" aria-label="招式与机制"><nav class="tabs" aria-label="技能分类"><button class="series-button series-button--secondary" data-kind="active" aria-pressed="true">角色招式</button><button class="series-button series-button--secondary" data-kind="passive" aria-pressed="false">成长被动</button><button class="series-button series-button--secondary" data-kind="combo" aria-pressed="false">队伍连携</button></nav><label><input id="search" aria-label="检索技能" placeholder="检索招式、用途或效果"></label><p id="library-count"></p><nav class="skill-grid" id="actions" aria-label="技能动作"></nav></aside></div><section id="detail" aria-label="当前技能设计"></section><footer><p class="hint">本地资源候选，使用实际 GLB 骨骼，可检查起手、接触、收势与走动施法。位移曲线独立记录，地图碰撞、命中、技能特效与精细指形仍待接入审阅。被动与连携为设计数据，不计作额外演员动作。</p></footer></main>
<script type="importmap">{"imports":{"three":"/lib/build/three.module.js","three/addons/":"/lib/examples/jsm/"}}</script><script type="module">'''+script+'''</script></html>'''
html=html.replace('百招候选册','扩展技能册').replace('height:440px','height:clamp(260px,calc(100dvh - 420px),440px)').replace('max-height:570px','max-height:clamp(300px,calc(100dvh - 340px),570px)')
html=html.replace('<div class="scrub">','<div class="controls"><button class="series-button series-button--secondary" id="arm-detail" aria-pressed="false">放大肩臂</button></div><div class="scrub">',1)
(HERE/'preview.html').write_text(html,encoding='utf-8')
server=(HERE.parent/'shadow-actions-v1/serve.mjs').read_text(encoding='utf-8').replace('8878','8879')
(HERE/'serve.mjs').write_text(server,encoding='utf-8')
print('Prepared original GLB skill-book preview on port 8879.')
