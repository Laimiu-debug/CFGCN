"""Replace one approved callout without rewriting linked B1/B2 resources."""
from pathlib import Path
import hashlib, json, shutil, subprocess, sys, wave
import numpy as np

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'source/audio/godot-b-v2'
QA=ROOT/'.local/qa/godot-audio-b-v2'
sys.path.insert(0,str(ROOT/'.local/audio/ink-trial-v1/tools'))
import imageio_ffmpeg
FF=imageio_ffmpeg.get_ffmpeg_exe()

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def read(path):return json.loads(path.read_text(encoding='utf-8-sig'))
def write(path,data):path.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')

original=SOURCE/'callout/wukong-source.mp3'
assert original.is_file() and original.stat().st_size==35569
before=QA/'attempts/before-callout'
assert not before.exists(), 'Preserve the original checkpoint; do not overwrite it'
before.mkdir(parents=True)
for name in ['inputs.json','mastering.json','prepared.json']:
    shutil.copy2(SOURCE/name,before/name)
shutil.copy2(QA/'main-integration.json',before/'main-integration.json')
request={'id':'wukong-skill-01','oldText':'看棍！','text':'吃俺老孙一棒！',
         'deliveryText':'[excited] 吃俺老孙一棒！','voice':'Billy','model':'eleven_v3',
         'languageCode':'zh','speed':1.08,'taskId':'0f85ef96-3951-498b-8fcd-510836de07c0',
         'credits':1,'source':'source/audio/godot-b-v2/callout/wukong-source.mp3',
         'sourceSha256':sha(original),'sourceBytes':original.stat().st_size,
         'sourceDurationSeconds':2.16,
         'reason':'User reported 看棍 as 砍棍; replace the easily misheard short line. Only one generation.',
         'subjectiveAcceptance':'Generated candidate; final pronunciation and delivery remain subject to listening.'}
write(SOURCE/'callout/request.json',request)
filters='highpass=f=95,lowpass=f=10500,equalizer=f=2800:t=q:w=1.2:g=1.5'
r=subprocess.run([FF,'-v','error','-i',str(original),'-af',filters,'-f','f32le','-ar','48000','-ac','2','-'],capture_output=True,check=True)
data=np.frombuffer(r.stdout,dtype='<f4').reshape(-1,2).astype(float)
def rms_active(a):
    energy=np.mean(a*a,axis=1)
    blocks=np.sqrt(energy[:len(a)//480*480].reshape(-1,480).mean(1))
    active=blocks[blocks>10**(-45/20)]
    return float(np.sqrt(np.mean(active*active)))
level=rms_active(data)
gain=min(10**(6/20),max(10**(-9/20),10**(-19/20)/level),10**(-3/20)/np.abs(data).max())
data*=gain
data[:240]*=np.linspace(0,1,240)[:,None]
data[-720:]*=np.linspace(1,0,720)[:,None]
pcm=np.round(np.clip(data,-1,1)*32767).astype('<i2').tobytes()
wav=SOURCE/'runtime/wukong-skill-01-callout.wav'
with wave.open(str(wav),'wb') as w:
    w.setnchannels(2);w.setsampwidth(2);w.setframerate(48000);w.writeframes(pcm)
inputs=read(SOURCE/'inputs.json')
entry=next(x for x in inputs['resources'] if x['id']=='wukong-skill-01')
entry.update(source=str(wav),sourceSha256=sha(wav),pcmSha256=hashlib.sha256(pcm).hexdigest(),frames=len(data),
             loopBegin=0,loopEnd=len(data),output=str(SOURCE/'resources/wukong-skill-01-callout.res'),
             originalSource=str(original),originalSha256=sha(original))
voice=next(x for x in inputs['actorAssets'] if x['id']=='wukong-skill-01')
voice.update(skills=[0,3,4,9],text=request['text'],calloutSource=request['source'])
inputs['incrementalCredits']=1
inputs['calloutRevision']='wukong-one-line-20261024'
write(SOURCE/'inputs.json',inputs)
write(SOURCE/'callout/prepare-input.json',{'resources':[entry],'incrementalCredits':1})
master=read(SOURCE/'mastering.json')
master['incrementalCredits']=1
row=next(x for x in master['processed'] if x['id']==entry['id'])
row.update(source=str(original),sourceSha256=sha(original),filters=filters,gainDb=float(20*np.log10(gain)),
           seconds=len(data)/48000,afterActiveRms=rms_active(data),afterPeak=float(np.abs(data).max()),
           preservedDurationFrames=True,voicePitchOrTimeChange=False,newWords=True,text=request['text'])
row.pop('beforeActiveRms',None)
master['scope']='Existing paid source cleanup plus one user-requested Wukong line replacement (1 credit). Original sources and music remain intact.'
write(SOURCE/'mastering.json',master)
write(SOURCE/'callout-review.json',{
    'userFeedback':'技能名字太尬了，砍棍是什么东西',
    'finding':'Actual old transcript is 看棍, not 砍棍. The visible ordinary skill is 如意棍法. No skill IDs or gameplay values changed.',
    'replacement':request,
    'voiceEligibility':{'actor':1,'skills':[0,3,4,9],
        'removedSkills':[6,8,11],
        'reason':'An attacking staff callout should not accompany CloudFeint, StaffGuard or StoneShell.'},
    'namingPolicy':['Names must match the character, weapon and implemented action.',
        'Keep ordinary action names readable; avoid arbitrary grandiose compounds.',
        'Spoken combat lines may differ from UI names; ensure unambiguous pronunciation and sparse repetition.'],
    'otherVoiceTextsUnchanged':True,'incrementalCredits':1,
    'reviewScope':'The existing 60 active UI labels are reviewed as reference; this batch changes one spoken line and its audio-owned eligibility only.'})
print(json.dumps({'id':entry['id'],'frames':len(data),'seconds':len(data)/48000,'peak':row['afterPeak'],'credits':1}))
