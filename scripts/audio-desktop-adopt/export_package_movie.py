"""Export the actual packaged M01 audio check, retaining byte-exact Master PCM."""
from pathlib import Path
import argparse,hashlib,json,subprocess,sys
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('game',choices=['xiyou','shuihu']);p.add_argument('identity');a=p.parse_args()
QA=ROOT/'.local/qa/godot-audio-b-v2/packages'/a.game/a.identity
TEMP=Path('H:/codex/tmp/cfgcn-audio-packages')/a.game/a.identity/'integration'
sys.path.insert(0,str(ROOT/'.local/audio/ink-trial-v1/tools'))
import imageio_ffmpeg
FF=imageio_ffmpeg.get_ffmpeg_exe()
def ff(args):
    r=subprocess.run([FF,'-v','error','-nostdin',*map(str,args)],capture_output=True)
    if r.returncode:raise RuntimeError(r.stderr.decode('utf-8','replace')[-1500:])
    return r.stdout
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
data=read(QA/'integration/integration.json');runner=read(QA/'integration/runner.json')
assert data['passed'] and runner['code']==0 and runner['packageFilesUnchanged']
native=TEMP/'native.avi';archive=QA/'integration/native-master.flac'
ff(['-y','-i',native,'-map','0:a:0','-c:a','flac',archive])
pcm=lambda p:ff(['-i',p,'-map','0:a:0','-f','s16le','-'])
assert pcm(native)==pcm(archive)
start=next(m['time'] for m in data['markers'] if m['name']=='game-start')
end=next(m['time'] for m in data['markers'] if m['name']=='end')
dest=ROOT/'.local/audio/godot-b-v2/windows';dest.mkdir(parents=True,exist_ok=True)
video=dest/(a.game+'-'+a.identity+'-audio-check.mp4')
ff(['-y','-i',native,'-ss',start,'-t',end-start,'-c:v','libx264','-threads','2','-preset','fast','-crf','20',
    '-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart',video])
samples=np.frombuffer(pcm(video),dtype='<i2').astype(float)/32768
assert np.max(np.abs(samples))<1 and np.sqrt(np.mean(samples*samples))>.0001
report={'passed':True,'game':a.game,'identity':a.identity,'video':str(video.relative_to(ROOT)),'sha256':sha(video),
    'bytes':video.stat().st_size,'seconds':end-start,'nativeStartSeconds':start,
    'nativeMasterArchive':str(archive.relative_to(ROOT)),'nativeMasterSha256':sha(archive),'nativePcmExact':True,
    'packageFilesSha256':runner['filesSha256'],'eventCounts':data['audio']['eventCounts'],
    'peak':float(np.max(np.abs(samples))),'rms':float(np.sqrt(np.mean(samples*samples))),
    'driver':'Normal game commands and buttons driven by an explicit QA policy; no HP/position/forced-result injection.',
    'scope':'Actual same EXE/PCK native picture and original mixed audio. Includes visible pause, settings and intentional mute checks; label as an audio check, not an uninterrupted promotional gameplay trailer. Fixed-FPS capture is not a performance benchmark.'}
(QA/'movie-export.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'passed':True,'video':str(video),'seconds':report['seconds'],'events':report['eventCounts']}))
