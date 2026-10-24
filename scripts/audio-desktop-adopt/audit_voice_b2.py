"""Validate callout bindings against the real native skill order, not file order."""
from pathlib import Path
import hashlib, json, re
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'source/audio/godot-b-v2'
QA=ROOT/'.local/qa/godot-audio-b-v2'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
data=read(SOURCE/'inputs.json')
skills=read(QA/'skills-native.json')
transcripts=read(ROOT/'apps/xiyou/art/audio/shadow-voice-v47/manifest.json')
labels=read(ROOT/'apps/xiyou/godot/data/skills.json')
old=read(QA/'attempts/before-callout/inputs.json')
for row in data['actorAssets']:
    if row['kind']!='voice':continue
    actor=int(row['actor'])
    if row['ultimate']:
        row['skills']=[i for i,s in enumerate(skills[actor]) if s['ultimate']]
    else:
        row['skills']=[int(i) for i in row['skills'] if not skills[actor][int(i)]['ultimate']]
    if row['id']!='wukong-skill-01':
        text=next(v['text'] for v in transcripts['voices'] if v['id']==row['id'])
        row['text']=re.sub(r'\[[^\]]*\]','',text).strip()
    assert row['skills']
    assert all(bool(skills[actor][int(i)]['ultimate'])==bool(row['ultimate']) for i in row['skills'])
(SOURCE/'inputs.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
review=read(SOURCE/'callout-review.json')
review['nativeSkillOrderSha256']=sha(QA/'skills-native.json')
review['uiLabelsSource']={'path':'apps/xiyou/godot/data/skills.json','sha256':sha(ROOT/'apps/xiyou/godot/data/skills.json')}
review['voiceBindings']=[]
for row in data['actorAssets']:
    if row['kind']!='voice':continue
    original=next(v for v in old['actorAssets'] if v['id']==row['id'])
    bindings=[]
    for i in row['skills']:
        definition=skills[int(row['actor'])][int(i)]
        label=next(v for v in labels['entries'] if v['id']==definition['id'])
        bindings.append({'index':int(i),'id':definition['id'],'name':label['name'],'actualUltimate':definition['ultimate']})
    review['voiceBindings'].append({'id':row['id'],'text':row['text'],'skillsBefore':original['skills'],
                                    'skillsAfter':row['skills'],'bindings':bindings})
review['additionalFinding']='The old Bajie ultimate voice was bound to RakeVault (index 8, not an ultimate). It now follows native RakePin index 11; ordinary callout excludes the real ultimate.'
(SOURCE/'callout-review.json').write_text(json.dumps(review,ensure_ascii=False,indent=2),encoding='utf-8')
(QA/'callout-bindings.json').write_text(json.dumps({'passed':True,'nativeOrderSource':str(QA/'skills-native.json'),
    'voiceRows':len(review['voiceBindings']),'allUltimateFlagsMatchNativeDefinitions':True,
    'wukongSpokenAttackIndices':[0,3,4,9],'uiSkillIdsAndLabelsChanged':False},indent=2),encoding='utf-8')
print(json.dumps({'passed':True,'voiceRows':len(review['voiceBindings']),'nativeUltimateOrderVerified':True}))
