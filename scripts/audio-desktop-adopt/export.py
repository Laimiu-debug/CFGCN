"""Archive and verify real current-main output. No added music, foley or gain."""
from pathlib import Path
import argparse,hashlib,json,re,subprocess,sys,wave
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'.local/audio/ink-trial-v1/tools'))
import imageio_ffmpeg
FF=imageio_ffmpeg.get_ffmpeg_exe()
parser=argparse.ArgumentParser();parser.add_argument('--batch',choices=['godot-audio-b-v1','godot-audio-b-v2'],default='godot-audio-b-v1');args=parser.parse_args()
version='v2' if args.batch.endswith('v2') else 'v1'
QA=ROOT/'.local/qa'/args.batch;TEMP=Path('H:/codex/tmp')/('cfgcn-audio-adopt-'+version)
DEST=ROOT/'.local/audio'/('godot-b-v2' if version=='v2' else 'desktop-ab-v1');DEST.mkdir(parents=True,exist_ok=True)
def ff(args):
    p=subprocess.run([FF,'-nostdin','-hide_banner',*map(str,args)],capture_output=True)
    if p.returncode:raise RuntimeError(p.stderr.decode('utf-8','replace')[-1500:])
    return p
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def pcm_hash(p):return hashlib.sha256(ff(['-i',p,'-map','0:a:0','-f','s16le','-']).stdout).hexdigest()
def pcm(p):return np.frombuffer(ff(['-i',p,'-map','0:a:0','-f','s16le','-']).stdout,dtype='<i2').reshape(-1,2).astype(float)/32768
def read(p):return json.loads(p.read_text(encoding='utf-8'))
inputs=read(ROOT/('source/audio/godot-b-'+version)/'inputs.json')
results=[]
for game in ['xiyou','shuihu']:
    take=QA/game/'integration';data=read(take/'integration.json');loop=read(QA/game/'loop/loop.json')
    assert data['passed'] and loop['passed']
    for label in ['integration','loop','cold-normal','cold-muted']:
        folder=QA/game/label
        assert read(folder/'runner.json')['code']==0
        log=(folder/'console.log').read_text(encoding='utf-8')
        assert not any(x in log for x in ['ERROR:','WARNING:','SCRIPT ERROR'])
    original=TEMP/game/'loop/native-music.wav';archived=QA/game/'loop/native-music.flac'
    ff(['-y','-i',original,'-c:a','flac',archived])
    assert pcm_hash(original)==pcm_hash(archived)
    spec=next(x for x in inputs['resources'] if x['id']=='music-'+game)
    if spec['method']=='exact-native-resource':spec=spec['originalInput']
    source=pcm(spec['source']);recorded=pcm(archived);template=source[-9600:].mean(1)
    measurements=[]
    for cross in loop['wraps']:
        begin=max(0,round((cross['time']-1)*48000));end=round((cross['time']+.7)*48000)
        window=recorded[begin:end].mean(1)
        n=1<<(len(window)+len(template)-1).bit_length()
        c=np.fft.irfft(np.fft.rfft(window,n)*np.fft.rfft(template[::-1],n),n)
        boundary=int(c[len(template)-1:len(window)].argmax())+len(template)
        actual=window[boundary:boundary+24000]
        expected=source[spec['loopBegin']:spec['loopBegin']+len(actual)].mean(1)
        correlation=float(np.corrcoef(actual,expected)[0,1])
        assert len(actual)==24000 and correlation>.995
        gain=float(actual@expected/(expected@expected))
        silence=float(np.sqrt(np.mean(window[boundary-4800:boundary+4800]**2)))
        assert silence>.0001
        measurements.append({'nativeBoundarySample':begin+boundary,'postBoundaryCorrelation':correlation,
            'boundary200msRms':silence,'measuredGain':gain})
    video=TEMP/game/'integration/native.avi'
    # The film includes explicit settings/mute checks after the first real contact.
    # Keep those visible; crop only the audio-only pool diagnostic before play.
    begin=next(m['time'] for m in data['markers'] if m['name']=='game-start')
    end=next(m['time'] for m in data['markers'] if m['name']=='end')
    final=DEST/(game+'-main-B.mp4')
    ff(['-y','-i',video,'-ss',begin,'-t',end-begin,'-c:v','libx264','-preset','fast','-crf','20',
        '-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart',final])
    native=take/'native-master.flac'
    ff(['-y','-i',video,'-map','0:a:0','-c:a','flac',native])
    assert pcm_hash(video)==pcm_hash(native)
    samples=pcm(final);peak=float(np.abs(samples).max());rms=float(np.sqrt(np.mean(samples**2)))
    assert rms>.0001 and peak<1
    film=read(take/'runner.json')
    results.append({'game':game,'passed':True,'video':str(final.relative_to(ROOT)),'videoSha256':sha(final),
        'videoBytes':final.stat().st_size,'seconds':end-begin,'nativeFrameStart':round(begin*30),
        'nativeMasterArchive':str(native.relative_to(ROOT)),'nativeMasterPcmExact':True,
        'loopArchive':str(archived.relative_to(ROOT)),'loopPcmExact':True,'loopArchiveSha256':sha(archived),
        'wholeLengthNaturalCrossings':measurements,'loopPeriod':loop['repeatSeconds'],
        'nativeCapturedSeconds':loop['recordFrames']/loop['sampleRate'],'peak':peak,'rms':rms,
        'checks':len(data['checks']),'scope':'Actual current main project, real rules and native movie audio. Includes visible pause/mute/settings checks. Offline fixed-FPS recording, not real-time FPS or full-game acceptance.'})
    print(json.dumps({'game':game,'wholeLengthCrossings':2,'loopMinCorrelation':min(x['postBoundaryCorrelation'] for x in measurements),'video':str(final),'seconds':end-begin}),flush=True)
(QA/'export.json').write_text(json.dumps({'passed':True,'incrementalCredits':inputs.get('incrementalCredits',0),'results':results},ensure_ascii=False,indent=2),encoding='utf-8')
