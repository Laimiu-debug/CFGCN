"""Freeze accepted B assets and existing native cues; no paid generation."""
from pathlib import Path
import hashlib,json,shutil,wave
ROOT=Path(__file__).resolve().parents[2];SOURCE=ROOT/'source/audio/godot-b-v1'
QA=ROOT/'.local/qa/godot-audio-b-v1'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
for d in [SOURCE/'resources',QA/'before']:d.mkdir(parents=True,exist_ok=True)
files=['apps/xiyou/godot/scripts/game_audio.gd','apps/xiyou/godot/project.godot','apps/shuihu/godot/project.godot']
before=[]
for file in files:
    path=ROOT/file;out=QA/'before'/file
    if not out.exists():out.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(path,out)
    before.append({'path':file,'sha256':sha(out),'bytes':out.stat().st_size})
(QA/'before.json').write_text(json.dumps(before,indent=2),encoding='utf-8')
manifest=read(ROOT/'source/audio/desktop-ab-v1/manifest.json')
native=read(ROOT/'apps/xiyou/godot/audio/native-v4/manifest.json')
old=read(ROOT/'apps/website/art/audio/ink-v1/manifest.json')
rows={}
for a in manifest['assets']:
    source=ROOT/a['runtime'];assert sha(source)==a['sha256']
    with wave.open(str(source)) as w:pcm=w.readframes(w.getnframes())
    rows[a['id']]={'id':a['id'],'kind':a['kind'],'source':str(source),'sourceSha256':sha(source),
        'pcmSha256':hashlib.sha256(pcm).hexdigest(),'frames':a['frames'],'loopBegin':a['loopStartFrame'],
        'loopEnd':a['frames'],'output':str(SOURCE/'resources'/(a['id']+'.res')),'method':'wav-native-resource'}
for a in native['assets']:
    if a['kind'] not in ['voice','skill-effect','effect'] or a['id'] in rows:continue
    source=ROOT/'apps/xiyou/godot'/a['path'].removeprefix('res://')
    rows[a['id']]={'id':a['id'],'kind':a['kind'],'source':str(source),'sourceSha256':sha(source),
        'output':str(SOURCE/'resources'/(a['id']+'.res')),'method':'exact-native-resource'}
for identifier in ['ui-confirm','ui-cancel']:
    a=old['effects'][identifier];source=ROOT/'apps/website/public'/a['url'].lstrip('/')
    assert sha(source)==a['sha256']
    rows[identifier]={'id':identifier,'kind':'effect','source':str(source),'sourceSha256':sha(source),
        'output':str(SOURCE/'resources'/(identifier+'.res')),'method':'exact-mp3-data'}
metadata={'version':1,'accepted':'User approved B and requested both main projects on 2026-10-24',
    'incrementalCredits':0,'priorBatchCredits':27,'resources':list(rows.values()),
    'actorAssets':[{k:a[k] for k in ['id','kind','actor','skills','ultimate'] if k in a} for a in native['assets'] if a['kind'] in ['voice','skill-effect']],
    'speechPolicy':native['speech_policy'],'before':before}
(SOURCE/'inputs.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'resources':len(rows),'credits':0,'source':str(SOURCE)}))
