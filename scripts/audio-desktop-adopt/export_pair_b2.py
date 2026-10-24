"""Same native picture, separate B1/B2 bus captures, one common Master gain."""
from pathlib import Path
import hashlib,json,subprocess,sys
import numpy as np
ROOT=Path(__file__).resolve().parents[2];QA=ROOT/'.local/qa/godot-audio-b-v2'
TEMP=Path('H:/codex/tmp/cfgcn-audio-adopt-v2/xiyou/clarity')
DEST=ROOT/'.local/audio/godot-b-v2';DEST.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(ROOT/'.local/audio/ink-trial-v1/tools'))
import imageio_ffmpeg
FF=imageio_ffmpeg.get_ffmpeg_exe()
def ff(args):
    p=subprocess.run([FF,'-nostdin','-hide_banner',*map(str,args)],capture_output=True)
    if p.returncode:raise RuntimeError(p.stderr.decode('utf-8','replace')[-1500:])
    return p
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def pcm(p,rate=48000):
    return ff(['-v','error','-i',p,'-map','0:a:0','-ar',rate,'-ac','2','-f','s16le','-']).stdout
data=json.loads((QA/'xiyou/clarity/clarity.json').read_text(encoding='utf-8'))
assert data['passed'] and data['duplicateB2ReleaseTokens']==0
rate=12000
video=np.frombuffer(pcm(TEMP/'native.avi',rate),dtype='<i2').reshape(-1,2).mean(1)
record=np.frombuffer(pcm(TEMP/'native-B2.wav',rate),dtype='<i2').reshape(-1,2).mean(1)
# Correlate an interior native Master window with the recorded B2 return.
template=record[round(.2*rate):round(.8*rate)]
window=video[:round(1.2*rate)]
n=1<<(len(template)+len(window)-1).bit_length()
c=np.fft.irfft(np.fft.rfft(window,n)*np.fft.rfft(template[::-1],n),n)
offset=int(c[len(template)-1:len(window)].argmax())
coefficient=float(np.corrcoef(template,window[offset:offset+len(template)])[0,1])
delay=offset-round(.2*rate)
assert coefficient>.99,(delay,coefficient)
begin=data['startFrame']/30
record_begin=begin-delay/rate
assert record_begin>=0
results=[]
for side in ['B1','B2']:
    raw=TEMP/('native-'+side+'.wav');archive=QA/'xiyou/clarity'/('native-'+side+'.flac')
    ff(['-y','-i',raw,'-c:a','flac',archive]);assert pcm(raw)==pcm(archive)
    final=DEST/('xiyou-clarity-'+side+'.mp4')
    ff(['-y','-ss',begin,'-i',TEMP/'native.avi','-ss',record_begin,'-i',archive,
        '-map','0:v:0','-map','1:a:0','-t',data['seconds'],'-af','volume='+str(data['masterGain']),
        '-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p',
        '-c:a','aac','-b:a','192k','-movflags','+faststart',final])
    decoded=np.frombuffer(pcm(final),dtype='<i2').astype(float)/32768
    assert np.max(np.abs(decoded))<1 and np.sqrt(np.mean(decoded*decoded))>.0001
    results.append({'side':side,'video':str(final.relative_to(ROOT)),'sha256':sha(final),'bytes':final.stat().st_size,
        'nativeBusArchive':str(archive.relative_to(ROOT)),'nativeBusPcmExact':True,'archiveSha256':sha(archive),
        'peak':float(np.max(np.abs(decoded))),'commonMasterGain':data['masterGain']})
reference=sum(e['kind']=='effect' and e['details'].get('source',{}).get('kind')=='actual-skill-release' for e in data['reference']['history'])
report={'passed':True,'seconds':data['seconds'],'results':results,'b1ActualReleases':reference,
    'b2ActualReleases':data['newReleases'],'duplicateB2Tokens':0,'readonlyRulesChecks':data['readonlyCoreChecks'],
    'videoBegin':begin,'recordBegin':record_begin,'recordToMovieOffsetSamples12k':delay,'syncCorrelation':coefficient,
    'scope':'Same actual native rules timeline and picture. B1 and B2 native bus recordings use the same Master gain; no separate loudness normalization or added foley.'}
(QA/'paired-export.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:report[k] for k in ['passed','seconds','b1ActualReleases','b2ActualReleases','syncCorrelation']}))
