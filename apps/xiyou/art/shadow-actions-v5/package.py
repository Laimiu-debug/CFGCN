"""Pack editable/ runtime resources and verify every archived member."""
from pathlib import Path
import hashlib,json,zipfile,struct,subprocess
from PIL import Image
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
data=json.loads((HERE/'skills.json').read_text(encoding='utf-8'))
manifest=json.loads((HERE/'manifest.json').read_text(encoding='utf-8'))
entries=data['entries'];ids={e['id'] for e in entries};assert len(ids)==110
expected={'active':60,'passive':20,'enemy':18,'combo':12}
assert {k:sum(e['kind']==k for e in entries) for k in expected}==expected
skills={s['skill_id']:s for c in manifest['characters'] for s in c['modules'] if s.get('skill_id')}
assert len(skills)==78 and {e['id'] for e in entries if e['clip']}==set(skills)
for actor,loadout in data['defaults'].items():
    pool={e['id'] for e in entries if e['actor']==actor and e['kind']=='active'}
    assert len(pool)==12 and len(set(loadout))==4 and set(loadout)<=pool
    for entry in [e for e in entries if e['actor']==actor and e['kind']=='active']:
        with Image.open(HERE/actor/'icons'/(entry['clip']+'.png')) as icon:
            assert icon.mode=='RGBA' and icon.getchannel('A').getextrema()[0]==0 and icon.getchannel('A').getextrema()[1]>0
for e in entries:
    assert all(e.get(key) for key in ['trigger','target','effect','limit','synergy','status'])
    assert len(set(e['branches']))==2
    if e['clip']:
        s=skills[e['id']];assert e['motion']['events']==s['events']
        for key in ['clip','upper_clip','duration','windup_end','release_end']:assert e['motion'][key]==s[key]
        with Image.open(HERE/e['motion']['thumbnail']) as image:assert image.size==(360,270)
    assert all(item in ids for item in e.get('sequence',[]))
for c in manifest['characters']:
    for s in c['modules']:assert all(e['socket'] in c['surface_sockets'] for e in s['events'])
    raw=(HERE/c['id']/c['runtime']).read_bytes()
    assert hashlib.sha256(raw).hexdigest()==c['runtime_sha256']
    assert hashlib.sha256((ROOT/c['source']).read_bytes()).hexdigest()==c['source_sha256']
    length=struct.unpack_from('<I',raw,12)[0];gltf=json.loads(raw[20:20+length])
    assert len(gltf['meshes'])==1 and len(gltf['materials'])==1
full=sum(len(c['modules']) for c in manifest['characters'])
upper=sum(bool(s['upper_clip']) for c in manifest['characters'] for s in c['modules'])
clips=sum(len(c['clips']) for c in manifest['characters'])
assert (full,upper,clips)==(94,74,200)
files=[p for p in HERE.rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.name!='files.sha256.json']
hashes={str(p.relative_to(HERE)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
(HERE/'files.sha256.json').write_text(json.dumps(hashes,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
subprocess.run(['node',str(ROOT/'node_modules/prettier/bin/prettier.cjs'),'--write',str(HERE/'files.sha256.json')],check=True,stdout=subprocess.DEVNULL)
out=ROOT/'.local/exports/xiyou-shadow-actions-v5.zip';out.parent.mkdir(exist_ok=True)
docs=['docs/xiyou-skill-loadouts.md','docs/xiyou-shadow-actions.md','docs/xiyou-shadow-trial.md']
with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=3) as z:
    for p in [*files,HERE/'files.sha256.json']:z.write(p,'shadow-actions-v5/'+str(p.relative_to(HERE)).replace('\\','/'))
    for path in docs:z.write(ROOT/path,path)
with zipfile.ZipFile(out) as z:
    assert z.testzip() is None
    for path,digest in hashes.items():assert hashlib.sha256(z.read('shadow-actions-v5/'+path)).hexdigest()==digest
report=dict(designs=len(entries),kinds=expected,hero_actions=60,skill_actions=len(skills),full_body_actions=full,upper_variants=upper,clips=clips,thumbnails=78,films=0,filmed_actions=0,runtime_bytes=sum(c['runtime_bytes'] for c in manifest['characters']),package_bytes=out.stat().st_size,package_files=len(files)+len(docs)+1,zip_checked=True,hashes_checked=len(hashes),source_unchanged=True)
(ROOT/'.local/qa/shadow-actions-v5/package.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
