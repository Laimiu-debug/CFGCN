"""Conservative speech/skill clarity pass using existing paid sources only."""
from pathlib import Path
import hashlib,json,subprocess,sys,wave
import numpy as np
ROOT=Path(__file__).resolve().parents[2];DEST=ROOT/'source/audio/godot-b-v2';QA=ROOT/'.local/qa/godot-audio-b-v2'
TEMP=Path('H:/codex/tmp/cfgcn-audio-b2');TEMP.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(ROOT/'.local/audio/ink-trial-v1/tools'))
import imageio_ffmpeg
FF=imageio_ffmpeg.get_ffmpeg_exe()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def decode(path,filters=None):
    args=[FF,'-v','error','-i',str(path)]
    if filters:args+=['-af',filters]
    r=subprocess.run([*args,'-f','f32le','-ar','48000','-ac','2','-'],capture_output=True,check=True)
    return np.frombuffer(r.stdout,dtype='<f4').reshape(-1,2).astype(float)
def active_rms(data):
    mono=np.sqrt(np.mean(data**2,axis=1));blocks=mono[:len(mono)//480*480].reshape(-1,480)
    levels=np.sqrt(np.mean(blocks**2,axis=1));active=levels[levels>10**(-45/20)]
    return float(np.sqrt(np.mean(active**2)))
old=read(ROOT/'source/audio/godot-b-v1/inputs.json');prepared=read(ROOT/'source/audio/godot-b-v1/prepared.json')
native=read(ROOT/'source/xiyou/godot/fusion-native-v4/audio/inputs.json')
rows=[];measurements=[]
for row in old['resources']:
    prior=next(x for x in prepared['resources'] if x['id']==row['id'])
    output=DEST/'resources'/(row['id']+'.res')
    if row['kind']=='voice' or row['id'] in ['monk-chime','rake-drag','sand-spade']:
        origin=next(x for x in native['assets'] if x['id']==row['id'] and x['kind']==row['kind'])
        source=Path(origin['sourcePath']);assert sha(source)==origin['sourceSha256']
        raw=decode(source)
        filters='highpass=f=95,lowpass=f=10500,equalizer=f=2800:t=q:w=1.2:g=1.5' if row['kind']=='voice' else 'highpass=f=100,lowpass=f=12000'
        data=decode(source,filters)
        # Keep every word/attack and the native duration. Only very short edge
        # fades and fixed bounded gain are applied; no voice pitch/time change.
        target=10**((-19 if row['kind']=='voice' else -19.5)/20)
        level=active_rms(data);gain=min(10**(6/20),max(10**(-9/20),target/max(level,1e-6)))
        gain=min(gain,10**(-3/20)/max(np.abs(data).max(),1e-6));data*=gain
        fade_in=min(240,len(data));fade_out=min(720,len(data))
        data[:fade_in]*=np.linspace(0,1,fade_in)[:,None];data[-fade_out:]*=np.linspace(1,0,fade_out)[:,None]
        pcm=np.round(np.clip(data,-1,1)*32767).astype('<i2').tobytes();path=DEST/'runtime'/(row['id']+'.wav')
        with wave.open(str(path),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(48000);w.writeframes(pcm)
        rows.append({'id':row['id'],'kind':row['kind'],'source':str(path),'sourceSha256':sha(path),'pcmSha256':hashlib.sha256(pcm).hexdigest(),'frames':len(data),'loopBegin':0,'loopEnd':len(data),'output':str(output),'method':'wav-native-resource','originalSource':str(source),'originalSha256':sha(source)})
        measurements.append({'id':row['id'],'kind':row['kind'],'source':str(source),'sourceSha256':sha(source),'filters':filters,'gainDb':float(20*np.log10(gain)),'seconds':len(data)/48000,'beforeActiveRms':active_rms(raw),'afterActiveRms':active_rms(data),'afterPeak':float(np.abs(data).max()),'preservedDurationFrames':len(raw)==len(data),'voicePitchOrTimeChange':False})
    else:
        source=Path(prior['output']);assert sha(source)==prior['sha256']
        rows.append({'id':row['id'],'kind':row['kind'],'source':str(source),'sourceSha256':sha(source),'output':str(output),'method':'exact-native-resource','originalInput':row})
before=[]
for p in (QA/'before/apps').rglob('*'):
    if p.is_file():before.append({'path':str(p.relative_to(QA/'before')).replace('\\','/'),'sha256':sha(p),'bytes':p.stat().st_size})
(QA/'before.json').write_text(json.dumps(before,indent=2),encoding='utf-8')
policy={**old['speechPolicy'],'global_gap_seconds':6.0,'actor_gap_seconds':10.0,'repeat_clip_gap_seconds':20.0}
meta={'version':2,'runtimeVersion':'B2','accepted':'B music accepted; user requested combat clarity/mix optimization and conditional Windows/site publication on 2026-10-24','incrementalCredits':0,'priorBatchCredits':27,'resources':rows,'actorAssets':old['actorAssets'],'speechPolicy':policy,'before':before,'mixPolicy':{'version':'B2','voice_gain':0.90,'skill_voice_duck':0.56,'contact_voice_duck':0.72,'critical_voice_duck':0.48,'skill_global_gap':0.12,'contact_global_gap':0.075,'release_once_per_token':True}}
(DEST/'inputs.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
(DEST/'mastering.json').write_text(json.dumps({'incrementalCredits':0,'processed':measurements,'scope':'Existing speech and three actor skill cues; original MP3s/RES and all B music unchanged. Fixed EQ/gain/edge fades, no new dialogue or actors.'},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'resources':len(rows),'processed':len(measurements),'voices':sum(x['kind']=='voice' for x in measurements),'incrementalCredits':0}))
