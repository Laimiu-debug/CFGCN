"""Verify and retain the two real-time natural loop crossings from a fixed EXE."""
from pathlib import Path
import argparse,hashlib,json,subprocess,sys
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('game',choices=['xiyou','shuihu']);p.add_argument('identity');a=p.parse_args()
QA=ROOT/'.local/qa/godot-audio-b-v2/packages'/a.game/a.identity
TEMP=Path('H:/codex/tmp/cfgcn-audio-packages')/a.game/a.identity/'loop'
sys.path.insert(0,str(ROOT/'.local/audio/ink-trial-v1/tools'))
import imageio_ffmpeg
FF=imageio_ffmpeg.get_ffmpeg_exe()
def ff(args):
    r=subprocess.run([FF,'-v','error','-nostdin',*map(str,args)],capture_output=True)
    if r.returncode:raise RuntimeError(r.stderr.decode('utf-8','replace')[-1500:])
    return r.stdout
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def pcm(p):return ff(['-i',p,'-map','0:a:0','-ac','2','-ar','48000','-f','s16le','-'])
def array(p):return np.frombuffer(pcm(p),dtype='<i2').reshape(-1,2).astype(float)/32768
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
data=read(QA/'loop/loop.json');runner=read(QA/'loop/runner.json')
assert data['passed'] and not data['offline'] and runner['code']==0 and runner['packageFilesUnchanged']
runtime=read(QA/'loop/package-runtime.json');assert runtime['passed'] and runtime['audioVersion']=='B2.1'
archives=[]
for name in ['native-music','native-master']:
    raw=TEMP/(name+'.wav');kept=QA/'loop'/(name+'.flac')
    ff(['-y','-i',raw,'-c:a','flac',kept]);assert pcm(raw)==pcm(kept)
    samples=array(kept);assert np.sqrt(np.mean(samples*samples))>.0001 and np.abs(samples).max()<.99
    archives.append({'path':str(kept.relative_to(ROOT)),'sha256':sha(kept),'pcmSha256':hashlib.sha256(pcm(kept)).hexdigest(),
        'pcmExact':True,'frames':len(samples),'seconds':len(samples)/48000,'peak':float(np.abs(samples).max())})
inputs=read(ROOT/'source/audio/godot-b-v2-r1/inputs.json')
spec=next(r for r in inputs['resources'] if r['id']=='music-'+a.game)['originalInput']
source=array(spec['source']);recorded=array(QA/'loop/native-music.flac');template=source[-9600:].mean(1)
crossings=[]
for wrap in data['wraps']:
    start=max(0,round((wrap['time']-1)*48000));end=round((wrap['time']+.7)*48000)
    window=recorded[start:end].mean(1);n=1<<(len(window)+len(template)-1).bit_length()
    c=np.fft.irfft(np.fft.rfft(window,n)*np.fft.rfft(template[::-1],n),n)
    boundary=int(c[len(template)-1:len(window)].argmax())+len(template)
    actual=window[boundary:boundary+24000];expected=source[spec['loopBegin']:spec['loopBegin']+len(actual)].mean(1)
    correlation=float(np.corrcoef(actual,expected)[0,1]);assert len(actual)==24000 and correlation>.995
    crossings.append({'nativeBoundarySample':start+boundary,'postBoundaryCorrelation':correlation,
        'boundary200msRms':float(np.sqrt(np.mean(window[boundary-4800:boundary+4800]**2)))})
dest=ROOT/'.local/audio/godot-b-v2/windows';dest.mkdir(parents=True,exist_ok=True)
audition=dest/(a.game+'-'+a.identity+'-theme.mp3')
ff(['-y','-i',spec['source'],'-c:a','libmp3lame','-b:a','192k',audition])
report={'passed':True,'game':a.game,'identity':a.identity,'audioVersion':'B2.1','realTime':True,'wholeLengthNaturalCrossings':crossings,
    'firstPass':data['firstPass'],'repeatSeconds':data['repeatSeconds'],'archives':archives,
    'packageFilesSha256':runner['filesSha256'],'packageFilesUnchanged':True,
    'audition':{'path':str(audition.relative_to(ROOT)),'sha256':sha(audition),'bytes':audition.stat().st_size,
        'nativeWavSource':spec['source'],'nativeSourceSha256':spec['sourceSha256'],'processing':'192 kbps MP3 from the exact in-game PCM master; no new generation, added foley or loudness change.'},
    'scope':'Actual shipping EXE/PCK, native real-time Music/Master recording, two natural whole-length crossings without seek/pitch changes. Not a whole-game, subjective listening or frame-rate acceptance.'}
(QA/'loop-archive.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'passed':True,'game':a.game,'identity':a.identity,'naturalCrossings':2,'minimumCorrelation':min(c['postBoundaryCorrelation'] for c in crossings),'audition':str(audition)}))
