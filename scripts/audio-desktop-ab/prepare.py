"""Archive the small authorized batch and derive fixed-gain native WAVs.
Signed URLs are accepted only through an ephemeral environment value.
"""
from pathlib import Path
import argparse, base64, hashlib, json, os, re, subprocess, sys, urllib.request
import numpy as np
import wave
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'source/audio/desktop-ab-v1'
QA=ROOT/'.local/qa/desktop-audio-ab-v1'
sys.path.insert(0,str(ROOT/'.local/audio/ink-trial-v1/tools'))
import imageio_ffmpeg
FF=imageio_ffmpeg.get_ffmpeg_exe()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def ff(args):
 r=subprocess.run([FF,'-hide_banner','-nostdin',*args],capture_output=True)
 if r.returncode:raise RuntimeError('Local audio conversion failed')
 return r.stdout
def measure(p):
 r=subprocess.run([FF,'-hide_banner','-nostdin','-i',str(p),'-af','loudnorm=I=-20:TP=-2:LRA=9:print_format=json','-f','null','-'],capture_output=True,text=True,encoding='utf-8',errors='replace')
 m=re.findall(r'\{\s*"input_i".*?\}',r.stderr,re.S)
 if not m:raise RuntimeError('Loudness measurement unavailable')
 return json.loads(m[-1])
for p in [SOURCE/'originals',SOURCE/'runtime',QA]:p.mkdir(parents=True,exist_ok=True)
jobs=json.loads(base64.b64decode(os.environ.pop('CFGCN_AB_DOWNLOADS','W10=')))
for j in jobs:
 p=SOURCE/'originals'/(j['id']+'.mp3')
 if p.exists():continue
 try:
  with urllib.request.urlopen(urllib.request.Request(j['url'],headers={'User-Agent':'CFGCN-Audio-Review/1'}),timeout=90) as response:b=response.read()
  if len(b)<5000:raise ValueError('Incomplete asset')
  p.with_suffix('.part').write_bytes(b);p.with_suffix('.part').replace(p)
 except Exception as e:
  print(json.dumps({'id':j['id'],'download':'failed','errorType':type(e).__name__}),flush=True);raise SystemExit(1) from None
brief=json.loads((SOURCE/'brief.json').read_text(encoding='utf-8'))
entries=[]
for a in brief['assets']:
 p=SOURCE/'originals'/(a['id']+'.mp3')
 if not p.exists():continue
 data=np.frombuffer(ff(['-v','error','-i',str(p),'-f','f32le','-ar','48000','-ac','2','-']),dtype='<f4').reshape(-1,2)
 if not np.isfinite(data).all() or np.max(np.abs(data))<0.001:raise RuntimeError('Invalid source signal')
 m=measure(p);target=-20.5 if a['kind']=='music' else -19
 gain=min(target-float(m['input_i']),-3.5-float(m['input_tp']))
 out=SOURCE/'runtime'/(a['id']+'.wav')
 ff(['-v','error','-y','-i',str(p),'-af',f'volume={gain:.6f}dB','-ar','48000','-ac','2','-c:a','pcm_s16le',str(out)])
 loop_start=0
 if a['kind']=='music':
  y=np.frombuffer(ff(['-v','error','-i',str(out),'-f','f32le','-ar','48000','-ac','2','-']),dtype='<f4').reshape(-1,2).copy()
  step=480;rms=np.array([np.sqrt(np.mean(y[i:i+step]**2)) for i in range(0,len(y),step)])
  active=np.flatnonzero(rms>max(.001,float(rms.max())*.055))
  end=min(len(y)-2400,(int(active[-1])+1)*step) if len(active) else len(y)-2400
  overlap=round(2.0*48000);head=round(.4*48000)
  blend=(.5-.5*np.cos(np.linspace(0,np.pi,overlap)))[:,None]
  y=y[:end];y[-overlap:]=y[-overlap:]*(1-blend)+y[head:head+overlap]*blend
  loop_start=head+overlap
  pcm=np.round(np.clip(y,-.999,.999)*32767).astype('<i2')
  with wave.open(str(out),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(48000);w.writeframes(pcm.tobytes())
 before=ff(['-v','error','-i',str(out),'-f','f32le','-ar','48000','-ac','2','-'])
 back=np.frombuffer(before,dtype='<f4')
 if not np.isfinite(back).all() or np.max(np.abs(back))>=1:raise RuntimeError('Invalid runtime')
 entries.append({'id':a['id'],'title':a['title'],'kind':a['kind'],'source':p.relative_to(ROOT).as_posix(),'sourceSha256':sha(p),'runtime':out.relative_to(ROOT).as_posix(),'sha256':sha(out),'frames':len(back)//2,'sampleRate':48000,'sourceDuration':len(data)/48000,'duration':len(back)/2/48000,'loopStartFrame':loop_start,'fixedGainDb':gain,'sourceLufs':float(m['input_i']),'runtimeLufs':float(measure(out)['input_i']),'listening':'candidate_for_user_review'})
 print(json.dumps({k:entries[-1][k] for k in ['id','duration','runtimeLufs']},ensure_ascii=False),flush=True)
manifest={'date':'2026-10-24','generationCount':len(entries),'credits':sum(a['credits'] for a in brief['assets'] if any(e['id']==a['id'] for e in entries)),'assets':entries,'automaticRegenerations':0,'reviewBoundary':'Decoded and gain-staged candidates; musical and material listening acceptance is pending.'}
(SOURCE/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'archived':len(entries),'credits':manifest['credits']},ensure_ascii=False))
legacy=json.loads((ROOT/'apps/website/art/audio/ink-v2/manifest.json').read_text(encoding='utf-8'))
old=[]
for identifier,target in [('shuihu-01-menu','legacy-menu'),('shuihu-07-skirmish','legacy-battle')]:
 a=next(a for a in legacy['assets'] if a['id']==identifier)
 p=ROOT/'apps/website/public'/a['url'].lstrip('/');out=SOURCE/'runtime'/(target+'.wav')
 if sha(p)!=a['sha256']:raise RuntimeError('Legacy source changed')
 ff(['-v','error','-y','-i',str(p),'-c:a','pcm_s16le',str(out)])
 old.append({'id':target,'source':p.relative_to(ROOT).as_posix(),'sourceSha256':sha(p),'path':out.relative_to(ROOT).as_posix(),'sha256':sha(out),'frames':a['frames'],'loopStartFrame':a['loopStartFrame']})
(SOURCE/'legacy-shuihu.json').write_text(json.dumps({'assets':old,'generationCount':0},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
