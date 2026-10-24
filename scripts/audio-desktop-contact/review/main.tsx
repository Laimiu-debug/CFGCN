import {createRoot} from 'react-dom/client';
import {useEffect,useRef,useState} from 'react';
import {Button} from '@cfgcn/ui';
import '@fontsource-variable/noto-serif-sc';
import '@fontsource-variable/noto-sans-sc';
import '@cfgcn/ui/tokens.css';
import './style.css';
type Side='B21'|'B22';
const fmt=(t:number)=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
function App(){
  const [data,setData]=useState<any>(null),[index,setIndex]=useState(0),[side,setSide]=useState<Side>('B22'),[error,setError]=useState('');
  const player=useRef<HTMLVideoElement|null>(null),loading=useRef(false);
  const selected=data?.cases[index];
  useEffect(()=>{fetch('/b2/contact/review.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(setData).catch(()=>setError('听样清单还未就绪，请稍后刷新。'));},[]);
  function changeScene(n:number){player.current?.pause();setIndex(n);setError('');}
  function changeSide(next:Side){
    const v=player.current;if(!v||next===side||loading.current)return;
    const time=v.currentTime,playing=!v.paused,volume=v.volume;v.pause();loading.current=true;setSide(next);
    v.src=selected.videos[next];v.onloadedmetadata=()=>{v.currentTime=Math.min(time,Math.max(0,v.duration-.02));v.volume=volume;loading.current=false;v.onloadedmetadata=null;if(playing)v.play().catch(()=>setError('点播放即可继续。'));};
  }
  return <main>
    <header><p className="eyebrow"><span>听</span> 山河入声 · B2.2 听审采用</p><h1>出手有轻重，预警留得住</h1><p className="intro">先听兵刃的轻重，再听危险来临时的留白。切换两版，保持同一画面与进度。</p><div className="facts"><span>沿用原曲与声线</span><span>同一次实际游戏</span><span>本批生成消耗 0 积分</span></div></header>
    {data&&<><nav aria-label="选择交锋听样">{data.cases.map((c:any,n:number)=><Button key={c.id} variant="quiet" aria-pressed={n===index} className={n===index?'active':''} onClick={()=>changeScene(n)}><img src={`/art/${c.game}-card.webp`} alt=""/><span><small>{c.gameName} · {fmt(c.seconds)}</small><strong>{c.title}</strong></span></Button>)}</nav>
    <section aria-label="声音前后对照"><div className="scene-top"><div><p className="eyebrow">{selected.gameName} · {selected.version}</p><h2>{selected.title}</h2></div><div className="sides" role="group" aria-label="切换声音版本"><Button variant="quiet" aria-pressed={side==='B21'} onClick={()=>changeSide('B21')}>B2.1 · 当前基线</Button><Button variant="quiet" aria-pressed={side==='B22'} onClick={()=>changeSide('B22')}>B2.2 · 接触优化</Button></div></div>
      <video key={selected.id} ref={player} src={selected.videos[side]} controls playsInline preload="metadata" aria-label={`${selected.title} ${side}声音`} onError={()=>{loading.current=false;setError('片段尚未载入，请刷新后再试。');}}/>
      <p className="listen-for">{selected.listenFor}</p><div className="notes"><p><b>这一段已录到</b><br/>{selected.coverage}</p><p><b>本段范围</b><br/>{selected.limit}</p></div>
      <details><summary>版本与录制说明</summary><p>画面来自上述 Windows 候选。B2.1 是包内声音，B2.2 是同一进程中录制的外部音频候选，使用相同实际事件和声音资源，尚未写进该发行包。两版共用同一条视频流和相同用户总音量，没有逐版响度归一或后补音效。</p><p>输入由明确的QA指令驱动，保留真实命中、伤亡与规则结果；不是人工鼠标录像、整款完成或性能基准。{selected.extraNote}</p></details>
    </section></>}
    {error&&<p role="alert" className="error">{error}</p>}
    {!data&&!error&&<p>听样正在载入。</p>}
    <footer>悟空“吃俺老孙一棒！”保留已认可的声线。B2.2 方向已听审采用；本页对照中的发行包仍为 B2.1，优化增量正交主工程纳入下一唯一版本。<a href="/">返回此前听样</a></footer>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
