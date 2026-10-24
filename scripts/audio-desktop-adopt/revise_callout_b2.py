"""Prepare a one-line diction revision, preserving the immutable B2 handoff."""
from pathlib import Path
import hashlib,json,subprocess,sys,wave
import numpy as np
ROOT=Path(__file__).resolve().parents[2];BASE=ROOT/'source/audio/godot-b-v2';DEST=ROOT/'source/audio/godot-b-v2-r1'
sys.path.insert(0,str(ROOT/'.local/audio/ink-trial-v1/tools'))
import imageio_ffmpeg
FF=imageio_ffmpeg.get_ffmpeg_exe()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
assert sha(BASE/'delivery.json')=='db0df9c93af440a0a08d3ed52ccf3d2da03c64a95b155b7279fdf7badd215673'
assert not (DEST/'inputs.json').exists(),'Do not overwrite a previous revision'
for name in ['runtime','resources']:(DEST/name).mkdir(parents=True,exist_ok=True)
source=DEST/'callout/wukong-source.mp3';assert source.stat().st_size==25538
filters='highpass=f=95,lowpass=f=10500,equalizer=f=2800:t=q:w=1.2:g=1.5'
raw=subprocess.run([FF,'-v','error','-i',str(source),'-af',filters,'-f','f32le','-ar','48000','-ac','2','-'],capture_output=True,check=True).stdout
data=np.frombuffer(raw,dtype='<f4').reshape(-1,2).astype(float)
def active_rms(x):
    e=np.mean(x*x,axis=1);b=np.sqrt(e[:len(x)//480*480].reshape(-1,480).mean(1));b=b[b>10**(-45/20)]
    return float(np.sqrt(np.mean(b*b)))
gain=min(10**(6/20),max(10**(-9/20),10**(-19/20)/active_rms(data)),10**(-3/20)/np.abs(data).max())
data*=gain;data[:240]*=np.linspace(0,1,240)[:,None];data[-720:]*=np.linspace(1,0,720)[:,None]
pcm=np.round(np.clip(data,-1,1)*32767).astype('<i2').tobytes();wav=DEST/'runtime/wukong-skill-01-callout.wav'
with wave.open(str(wav),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(48000);w.writeframes(pcm)
inputs=read(BASE/'inputs.json');inputs['runtimeVersion']='B2.1';inputs['mixPolicy']['version']='B2.1'
inputs['baseDelivery']={'path':'source/audio/godot-b-v2/delivery.json','sha256':sha(BASE/'delivery.json')}
inputs['incrementalCredits']=1;inputs['b2FamilyCredits']=2;inputs['calloutRevision']='wukong-俺-not-我-20261024'
row=next(r for r in inputs['resources'] if r['id']=='wukong-skill-01')
row.update(source=str(wav),sourceSha256=sha(wav),pcmSha256=hashlib.sha256(pcm).hexdigest(),frames=len(data),loopBegin=0,loopEnd=len(data),
    output=str(DEST/'resources/wukong-skill-01.res'),originalSource=str(source),originalSha256=sha(source))
voice=next(r for r in inputs['actorAssets'] if r['id']==row['id']);voice['text']='吃俺老孙一棒！';voice['calloutSource']='source/audio/godot-b-v2-r1/callout/wukong-source.mp3'
write(DEST/'inputs.json',inputs);write(DEST/'callout/prepare-input.json',{'resources':[row],'incrementalCredits':1})
write(DEST/'callout/request.json',{'text':'吃俺老孙一棒！','voice':'Billy','model':'eleven_v3','languageCode':'zh','speed':0.95,
    'taskId':'7bc87e73-3f51-47d3-8988-fa8343b95bb6','incrementalCredits':1,'b2FamilyCredits':2,
    'sourceSha256':sha(source),'sourceBytes':source.stat().st_size,'seconds':len(data)/48000,
    'humanCorrection':'必须是吃俺老孙一棒，俺而非我。','humanListeningApproval':False,
    'changedDirection':'Remove the excited tag and request a slightly slower delivery for diction; spoken words remain exactly as requested.'})
write(DEST/'mastering.json',{'incrementalCredits':1,'b2FamilyCredits':2,'base':'source/audio/godot-b-v2/mastering.json',
    'processed':[{'id':row['id'],'sourceSha256':sha(source),'filters':filters,'gainDb':float(20*np.log10(gain)),
                  'afterActiveRms':active_rms(data),'afterPeak':float(np.abs(data).max()),'seconds':len(data)/48000,
                  'pitchOrTimeEdit':False}],
    'scope':'Only the requested Wukong diction revision. Other B2 assets and all music/mixer/director code remain identical. Synthesis speed is recorded, not a post-production time stretch.'})
write(DEST/'callout-review.json',{'exactWords':'吃俺老孙一棒！','requiredPronoun':'俺','avoidMishearing':'我',
    'actorSelfReference':'Wukong uses 俺 / 俺老孙; do not mechanically rewrite other characters’ pronouns.',
    'baseEligibilityReview':'source/audio/godot-b-v2/callout-review.json','skillIndices':[0,3,4,9],
    'humanListeningApproval':False,'scope':'One diction candidate replaces the earlier easily misheard delivery; no UI skill renaming or gameplay change.'})
print(json.dumps({'version':'B2.1','seconds':len(data)/48000,'peak':float(np.abs(data).max()),'familyCredits':2}))
