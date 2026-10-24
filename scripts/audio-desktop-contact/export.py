"""Export paired native audio with one picture and a verified recording offset."""
from pathlib import Path
import argparse,hashlib,json,subprocess,sys
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('game');p.add_argument('identity');p.add_argument('--name',required=True);a=p.parse_args()
QA=ROOT/'.local/qa/godot-audio-b-v2/packages'/a.game/a.identity/'contact'
TEMP=Path('H:/codex/tmp/cfgcn-audio-packages')/a.game/a.identity/'contact'
DEST=ROOT/'.local/audio/godot-b-v2/contact';DEST.mkdir(parents=True,exist_ok=True)
sys.dont_write_bytecode=True;sys.path.insert(0,str(ROOT/'.local/audio/ink-trial-v1/tools'))
import imageio_ffmpeg
FF=imageio_ffmpeg.get_ffmpeg_exe()
def ff(args):
    r=subprocess.run([FF,'-v','error','-nostdin',*map(str,args)],capture_output=True)
    if r.returncode:raise RuntimeError(r.stderr.decode('utf-8','replace')[-1200:])
    return r.stdout
def sha(p):
    h=hashlib.sha256()
    with p.open('rb') as f:
        for b in iter(lambda:f.read(1048576),b''):h.update(b)
    return h.hexdigest()
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def pcm(p):return ff(['-i',p,'-map','0:a:0','-ac','2','-ar','48000','-f','s16le','-'])
def samples(p):return np.frombuffer(pcm(p),dtype='<i2').reshape(-1,2).mean(1).astype(float)/32768
data=read(QA/'contact.json');runner=read(QA/'runner.json');runtime=read(QA/'package-runtime.json')
assert data['passed'] and runner['code']==0 and runner['packageFilesUnchanged'] and runtime['passed']
assert data['seconds']>1 and data['nativeCueCalls']
native=TEMP/'native.avi';archives=[]
for side in ['B21','B22']:
    raw=TEMP/('native-'+side+'.wav');kept=QA/('native-'+side+'.flac')
    ff(['-y','-i',raw,'-c:a','flac',kept]);assert pcm(raw)==pcm(kept)
    archives.append({'side':side,'path':kept.relative_to(ROOT).as_posix(),'sha256':sha(kept),'pcmSha256':hashlib.sha256(pcm(kept)).hexdigest(),'pcmExact':True})
actual=samples(native);reference=samples(TEMP/'native-B21.wav');candidate=samples(TEMP/'native-B22.wav')
assert abs(len(reference)-len(candidate))<=512
def locate(anchor,offset=None):
    at=round(anchor*48000);template=reference[at:at+24000];template=template-template.mean();m=len(template)
    start=max(0,round((anchor+(offset or 0)-(.5 if offset is not None else 1))*48000))
    end=min(len(actual),round((anchor+(offset or 0)+(1 if offset is not None else 3))*48000))
    window=actual[start:end];n=1<<(len(window)+m-1).bit_length()
    c=np.fft.irfft(np.fft.rfft(window,n)*np.fft.rfft(template[::-1],n),n)[m-1:len(window)]
    sums=np.r_[0,np.cumsum(window)];squares=np.r_[0,np.cumsum(window*window)]
    power=squares[m:]-squares[:-m]-(sums[m:]-sums[:-m])**2/m
    correlation=c/np.sqrt(np.maximum(power,1e-20)*np.sum(template*template))
    best=int(np.argmax(correlation));return (start+best-at)/48000,float(correlation[best])
anchors=[];offset,corr=locate(1.0);anchors.append({'anchorSeconds':1.0,'offsetSeconds':offset,'correlation':corr})
for anchor in [data['startFrame']/30-offset+data['seconds']*.4,data['endFrame']/30-offset-1.0]:
    lag,c=locate(anchor,offset);anchors.append({'anchorSeconds':anchor,'offsetSeconds':lag,'correlation':c})
assert all(x['correlation']>.995 and abs(x['offsetSeconds']-offset)<16/48000 for x in anchors),anchors
start=data['startFrame']/30;duration=data['seconds'];picture=TEMP/'paired-picture.mp4'
ff(['-y','-ss',start,'-i',native,'-t',duration,'-an','-c:v','libx264','-threads','2','-preset','fast','-crf','20','-pix_fmt','yuv420p',picture])
videos=[]
for side in ['B21','B22']:
    video=DEST/(a.name+'-'+side+'.mp4')
    if side=='B21':
        args=['-y','-i',picture,'-ss',start,'-i',native,'-t',duration,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-movflags','+faststart',video]
    else:
        audio_start=start-offset;assert audio_start>=0
        args=['-y','-i',picture,'-ss',audio_start,'-i',TEMP/'native-B22.wav','-t',duration,'-map','0:v:0','-map','1:a:0',
              '-af','volume='+str(data['masterGain']),'-c:v','copy','-c:a','aac','-b:a','192k','-movflags','+faststart',video]
    ff(args)
    stream=ff(['-i',video,'-map','0:v:0','-c','copy','-f','h264','-'])
    videos.append({'side':side,'path':video.relative_to(ROOT).as_posix(),'sha256':sha(video),'bytes':video.stat().st_size,
                   'videoStreamSha256':hashlib.sha256(stream).hexdigest()})
assert videos[0]['videoStreamSha256']==videos[1]['videoStreamSha256']
report={'passed':True,'game':a.game,'identity':a.identity,'name':a.name,'seconds':duration,'nativeStartSeconds':start,
        'audioOffsetProof':anchors,'archives':archives,'videos':videos,'samePictureBytes':True,
        'packageFilesSha256':runner['filesSha256'],'candidateHashEmbeddedAtStart':'candidateInputSha256' in data,
        'masterGain':data['masterGain'],'perSideLoudnessNormalization':False,'extraFoleyOrMusic':False,
        'scope':'B2.1 actual package vs explicitly external B2.2 audio candidate, one real rules instance and identical video stream. Candidate is not yet part of the shipped PCK; not full game or performance acceptance.'}
(QA/'export.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'passed':True,'name':a.name,'seconds':duration,'offsetSeconds':offset,'minimumCorrelation':min(x['correlation'] for x in anchors),'videos':videos},ensure_ascii=False))
