import { createRoot } from 'react-dom/client';
import { useEffect,useRef,useState } from 'react';
import { Button } from '@cfgcn/ui';
import '@fontsource-variable/noto-serif-sc';
import '@fontsource-variable/noto-sans-sc';
import '@cfgcn/ui/tokens.css';
import './style.css';

const scenes=[
  {id:'XY-A',game:'西游',name:'长安初行',sub:'初行 · 拾光 · 修行',desc:'从唐僧初行开始，听清拾光与升阶；修行选择时，音乐随实际游戏暂停。',art:'xiyou',instruments:'琵琶、阮、筝与笙，起步留白，逐渐添入节奏。'},
  {id:'XY-B',game:'西游',name:'盘丝交锋',sub:'预警 · 出招 · 退回整备',desc:'七蛛危险提示优先，棍、法器与水剑按真实释放和伤害接触发声，整备后收回紧张。',art:'xiyou',instruments:'同一主题的紧张段，给木质预警和兵器留出空间。'},
  {id:'SH-A',game:'水浒',name:'雪夜出征',sub:'寨中整备 · 守约接应',desc:'从寨中钱粮与编队出发，进入雪夜来信战场，再按实际结果归报。',art:'shuihu',instruments:'阮、琵琶、筝与克制的皮鼓、木击，保留宋代故事的江湖气。'},
  {id:'SH-B',game:'水浒',name:'兵刃与归报',sub:'交锋 · 伤势 · 战后收束',desc:'空挥与真实伤害分开；布皮接触依装备判断，战后保留伤亡和接应结果。',art:'shuihu',instruments:'减少持续高昂的铺陈，让出手、受创和战后余味分开。'},
];
const fmt=(n:number)=>`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;
function App(){
  const [data,setData]=useState<any>(null),[index,setIndex]=useState(0),[side,setSide]=useState<'A'|'B'>('B');
  const [playing,setPlaying]=useState(false),[time,setTime]=useState(0),[volume,setVolume]=useState(.7),[error,setError]=useState('');
  const refs=useRef<(HTMLVideoElement|null)[]>([]),selected=useRef(side),busy=useRef(false);
  const themes=useRef<(HTMLAudioElement|null)[]>([]);
  const polish=useRef<HTMLVideoElement|null>(null),callout=useRef<HTMLAudioElement|null>(null),packaged=useRef<HTMLVideoElement|null>(null);
  const [polishSide,setPolishSide]=useState<'B1'|'B2'>('B2');
  const scene=scenes[index],row=data?.cases.find((r:any)=>r.id===scene.id),duration=row?.duration||0;
  selected.current=side;
  useEffect(()=>{fetch('/media/review.json').then(r=>r.json()).then(setData).catch(()=>setError('听样清单暂未载入，请刷新。'));},[]);
  useEffect(()=>{for(let n=0;n<2;n++){const v=refs.current[n];if(v){v.volume=volume;v.muted=(n===0?'A':'B')!==side;}}},[side,volume,index]);
  useEffect(()=>{const timer=window.setInterval(()=>{const n=selected.current==='A'?0:1;const main=refs.current[n],other=refs.current[1-n];if(main&&other&&!main.paused&&Math.abs(main.currentTime-other.currentTime)>.10)other.currentTime=main.currentTime;},180);return()=>clearInterval(timer);},[]);
  function pause(){refs.current.forEach(v=>v?.pause());setPlaying(false);}
  function seek(t:number){refs.current.forEach(v=>{if(v&&v.readyState>=1)v.currentTime=Math.max(0,Math.min(t,duration-.01));});setTime(t);}
  async function play(){
    if(busy.current)return;busy.current=true;setError('');
    themes.current.forEach(a=>a?.pause());polish.current?.pause();callout.current?.pause();packaged.current?.pause();
    try{const active=refs.current[side==='A'?0:1];if(active&&active.currentTime>=duration-.2)seek(0);await Promise.all(refs.current.map(v=>v?.play()));setPlaying(true);}
    catch{pause();setError('播放器还在载入，稍后再点一次播放。');}finally{busy.current=false;}
  }
  function changeSide(next:'A'|'B'){
    const current=refs.current[side==='A'?0:1],other=refs.current[next==='A'?0:1];
    if(current&&other&&other.readyState>=1)other.currentTime=current.currentTime;
    refs.current.forEach(v=>{if(v)v.muted=true;});setSide(next);
  }
  function changeScene(n:number){pause();themes.current.forEach(a=>a?.pause());setIndex(n);setTime(0);setError('');}
  function playTheme(index:number){pause();polish.current?.pause();callout.current?.pause();packaged.current?.pause();themes.current.forEach((a,n)=>{if(n!==index)a?.pause();});}
  function playPolish(){pause();themes.current.forEach(a=>a?.pause());callout.current?.pause();packaged.current?.pause();}
  function playCallout(){pause();themes.current.forEach(a=>a?.pause());polish.current?.pause();packaged.current?.pause();}
  function playPackage(){pause();themes.current.forEach(a=>a?.pause());polish.current?.pause();callout.current?.pause();}
  function changePolish(next:'B1'|'B2'){
    const v=polish.current;if(!v||next===polishSide)return;
    const at=v.currentTime,wasPlaying=!v.paused;v.pause();setPolishSide(next);
    v.src=`/b2/xiyou-clarity-${next}.mp4`;
    v.onloadedmetadata=()=>{v.currentTime=Math.min(at,v.duration-.02);if(wasPlaying)v.play().catch(()=>{});v.onloadedmetadata=null;};
  }
  const events=row?.events||[];
  const find=(kind:string,test=(e:any)=>true)=>events.find((e:any)=>e.kind===kind&&test(e))?.time;
  const rawMarkers=scene.id==='XY-A'?[['初行',0],['拾光',find('actual-xp-pickup')],['升阶',find('earned-upgrade')],['选技后',find('upgrade-choice-applied')]]:
    scene.id==='XY-B'?[['交锋',0],['危险预警',find('actual-boss-warning')],['真实接触',find('actual-hp-contact')],['退回整备',find('actual-encounter-recovery-or-completion')]]:
    [['开始',0],['进入战场',find('actual-world-mode',(e:any)=>e.details.phase==='battle')],['出手',find('paid-attack-start')],['实际战果',find('actual-battle-result')]];
  return <main className={`review review--${scene.art}`}>
<header><div className="eyebrow"><span className="seal">听</span> 山河入声 <span>B 版已采用</span></div><h1>同一段实机，两套声音</h1><p>切换 A / B 保留进度。先听音乐的起承，再留意每一次出手与停顿。</p><div className="summary"><span>四段对照</span><span>两首完整主题</span><span>B1 接入 0 · 喊招两稿 2 积分</span></div></header>
    <div className="main-previews"><span>已接入主工程</span><a href="/media/xiyou-main-B.mp4">西游 · 本地实机 ↗</a><a href="/media/shuihu-main-B.mp4">水浒 · 本地实机 ↗</a><small>含转场、暂停与音量检查</small></div>
    <nav aria-label="选择对比场景">{scenes.map((s,n)=><Button key={s.id} variant="choice" aria-pressed={index===n} className={index===n?'scene active':'scene'} onClick={()=>changeScene(n)}><img src={`/art/${s.art}-card.webp`} alt=""/><span><small>{s.game} · {String(n+1).padStart(2,'0')}</small><strong>{s.name}</strong><em>{s.sub}</em></span></Button>)}</nav>
    <section className="listening" aria-label={scene.name}>
      <div className="scene-heading"><div><p className="eyebrow">{scene.game} · {scene.sub}</p><h2>{scene.name}</h2></div><div className="versions" role="group" aria-label="声音版本"><Button variant={side==='A'?'primary':'secondary'} aria-pressed={side==='A'} onClick={()=>changeSide('A')}>A · {scene.art==='shuihu'?'旧素材对照':'此前声音'}</Button><Button variant={side==='B'?'primary':'secondary'} aria-pressed={side==='B'} onClick={()=>changeSide('B')}>B · 新声音</Button></div></div>
      <div className="screen">{(['A','B'] as const).map((s,n)=><video key={scene.id+s} ref={v=>{refs.current[n]=v;}} src={`/media/${scene.id}-${s}.mp4`} poster={`/media/${scene.id}-poster.jpg`} preload="auto" playsInline muted={side!==s} className={side===s?'visible':'hidden'} aria-label={`${scene.name} ${s}版`} onTimeUpdate={e=>{if(selected.current===s)setTime(e.currentTarget.currentTime);}} onEnded={()=>pause()} onError={()=>setError('这段视频尚未载入，请刷新后重试。')}/>)}<span className="version-badge">正在听 {side} · {side==='B'?'新声音':scene.art==='shuihu'?'旧素材接入对照':'此前声音'}</span></div>
      <div className="transport"><Button variant="primary" onClick={()=>playing?pause():play()} aria-label={playing?'暂停试听':'播放试听'}>{playing?'暂停':'播放试听'}</Button><Button variant="secondary" onClick={()=>seek(0)} aria-label="从头播放">重听</Button><span className="time">{fmt(time)} / {fmt(duration)}</span><label className="volume">音量<input aria-label="试听音量" type="range" min="0" max="1" step=".01" value={volume} onChange={e=>setVolume(+e.target.value)}/></label><Button variant="quiet" onClick={()=>refs.current[side==='A'?0:1]?.requestFullscreen()}>全屏</Button></div>
      <input className="timeline" aria-label="试听进度" type="range" min="0" max={duration||1} step=".05" value={time} onChange={e=>seek(+e.target.value)}/>
      <div className="markers" aria-label="关键时点">{rawMarkers.filter((m:any)=>typeof m[1]==='number'&&m[1]<duration).map((m:any)=><Button key={m[0]} variant="quiet" onClick={()=>seek(m[1])}>{m[0]} <span>{fmt(m[1])}</span></Button>)}</div>
      {error&&<p className="error" role="alert">{error}</p>}
      <div className="listening-notes"><div><h3>这一段，留意什么</h3><p>{scene.desc}</p><p className="muted">{scene.instruments}</p></div><div><h3>对比说明</h3><p>同一次游戏运行，画面与战果相同；两版已校准整体响度。</p><p className="muted">{scene.art==='shuihu'?'水浒 A 是旧素材按真实事件接入的基线；原战役此前尚无完整声音。':'西游 A 保留采用 B 之前的音乐与事件声音，B 是本次已选的新主题与混音。'}</p><div className="downloads"><a href={`/media/${scene.id}-A.mp4`} download>下载 A</a><a href={`/media/${scene.id}-B.mp4`} download>下载 B</a></div></div></div>
    </section>
    <section className="themes polish"><h2>战斗声音，再听清一些</h2><p>B2 源工程候选 · 同一段五人实战、同一画面与总音量，保留混音本身的差异。</p><div className="versions" role="group" aria-label="战斗混音对照"><Button variant={polishSide==='B1'?'primary':'secondary'} aria-pressed={polishSide==='B1'} onClick={()=>changePolish('B1')}>B1 · 已采用基线</Button><Button variant={polishSide==='B2'?'primary':'secondary'} aria-pressed={polishSide==='B2'} onClick={()=>changePolish('B2')}>B2 · 战斗辨识</Button></div><video ref={polish} controls playsInline preload="metadata" src="/b2/xiyou-clarity-B2.mp4" onPlay={playPolish} aria-label="B1与B2战斗混音对照" style={{width:'100%',aspectRatio:'16/9',marginTop:'1rem'}}/><p className="muted">多段技能只在真正开招时响一次；主控、同伴和危险提示分出层次。录制来自实际规则，未后补音效；固定帧率录制不作为性能证明。</p><h3>悟空 · 新出棍短句</h3><p>“吃俺老孙一棒！”取代容易误听的“看棍！”，仅在攻击棍招时触发。</p><audio ref={callout} controls preload="metadata" src="/b21-source/wukong-skill-01-callout.wav" onPlay={playCallout} aria-label="悟空新喊招吃俺老孙一棒"/><p className="muted">B2.1 已经你听审采用，台词用“俺”，只在攻击棍招触发。沿用原声线，两稿共 2 积分；Windows 包整体与官网发布另验。</p></section>
    <section className="themes"><h2>Windows 包内声音检查</h2><p><a href="/b2/windows/xiyou-v12-b21-ui21-r2-audio-check.mp4">西游 0.1.11.0 · 原声检查 2:02 ↗</a> · <a href="/b2/windows/xiyou-v12-b21-ui21-r2-theme.mp3">完整主题试听</a></p><p className="muted">西游音频专项28项通过，含升级、七蛛预警、转场和音量检查；完整乌鸡国章与最终下载仍待主工程验收。</p><p>水浒 0.0.12-preview.3 · B2.1 游戏原声，含出手、战果、暂停与音量检查。</p><video ref={packaged} controls playsInline preload="metadata" src="/b2/windows/shuihu-preview012-b21-r3-audio-check.mp4" onPlay={playPackage} aria-label="水浒Windows包内B2.1原声检查" style={{width:'100%',aspectRatio:'16/9'}}/><p className="muted">音频专项已通过。此片包含刻意静音和暂停；本包另有战后暂停崩溃待修，目前不开放下载。</p></section>
    <section className="themes"><h2>也可以完整听一遍主题</h2><div><article><h3>西游 · 云途初行</h3><p>唐风器乐意象 · 留白与向前</p><audio ref={a=>{themes.current[0]=a;}} onPlay={()=>playTheme(0)} controls preload="metadata" src="/source/runtime/music-xiyou.wav"/></article><article><h3>水浒 · 义行山水</h3><p>宋代江湖意象 · 守约与余味</p><audio ref={a=>{themes.current[1]=a;}} onPlay={()=>playTheme(1)} controls preload="metadata" src="/source/runtime/music-shuihu.wav"/></article></div></section>
    <footer>B 版已按你的选择接入两作 Godot 主工程。这里保留原 A/B 听样与真实事件结果，并新增 B2 混音候选；前轮素材制作 27 积分，B1 接入 0 积分，喊招两稿共 2 积分。正式 Windows 包另按主工程验收更新。</footer>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
