"""Sync only audio-owned runtime files and autoload keys into both main projects."""
from pathlib import Path
import argparse,hashlib,json,os,shutil,subprocess,sys
ROOT=Path(__file__).resolve().parents[2];PACKAGE=ROOT/'packages/godot-game-audio'
active=json.loads((PACKAGE/'current.json').read_text(encoding='utf-8')) if (PACKAGE/'current.json').exists() else {}
parser=argparse.ArgumentParser();parser.add_argument('--source',default=active.get('source','source/audio/godot-b-v1'));parser.add_argument('--qa',default=active.get('qa','.local/qa/godot-audio-b-v1'));args=parser.parse_args()
SOURCE=(ROOT/args.source).resolve();QA=(ROOT/args.qa).resolve()
assert SOURCE.is_relative_to((ROOT/'source/audio').resolve()) and QA.is_relative_to((ROOT/'.local/qa').resolve())
if SOURCE==ROOT/'source/audio/godot-b-v2-r2':
    subprocess.run([sys.executable,str(ROOT/'scripts/audio-desktop-contact/adopt.py'),'--source',args.source,'--qa',args.qa],check=True)
    raise SystemExit(0)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
inputs=read(SOURCE/'inputs.json');prepared=read(SOURCE/'prepared.json');before=read(QA/'before.json')
previous=read(QA/'main-integration.json') if (QA/'main-integration.json').exists() else {'games':[]}
records=[]
for game in ['xiyou','shuihu']:
    project=ROOT/'apps'/game/'godot';destination=project/'game_audio_b';destination.mkdir(exist_ok=True)
    staged=[]
    for row in prepared['resources']:
        identifier=row['id']
        if identifier.startswith('music-') and identifier!='music-'+game:continue
        spec=next(x for x in inputs['resources'] if x['id']==identifier)
        if game=='shuihu' and spec['kind'] in ['voice','skill-effect']:continue
        source=Path(row['output']);assert sha(source)==row['sha256']
        output=destination/'assets'/(identifier+'.res');output.parent.mkdir(exist_ok=True)
        if output.exists() and sha(output)!=sha(source):output=destination/'assets'/(identifier+'-'+sha(source)[:12]+'.res')
        if output.exists():assert sha(output)==sha(source),'Never replace a different immutable staged asset'
        else:os.link(source,output)
        staged.append({'id':identifier,'path':'res://game_audio_b/assets/'+output.name,'sha256':sha(output),'bytes':output.stat().st_size,'kind':spec['kind']})
    meta={'game':game,'version':inputs.get('runtimeVersion','B1'),'actorAssets':inputs['actorAssets'] if game=='xiyou' else [],'speechPolicy':inputs['speechPolicy'],'assets':staged,'mixPolicy':inputs.get('mixPolicy',{})}
    meta['manifestSha256']=hashlib.sha256(json.dumps(meta,sort_keys=True).encode()).hexdigest()
    code='extends RefCounted\n\nconst META = '+json.dumps(meta,ensure_ascii=False,indent='\t')+'\n\nconst STREAMS = {\n'
    code+=',\n'.join('\t'+json.dumps(r['id'])+': preload('+json.dumps(r['path'])+')' for r in staged)+'\n}\n'
    (destination/'library.gd').write_text(code,encoding='utf-8')
    for name in ['mixer.gd','host.gd','xiyou_director.gd','shuihu_director.gd']:
        shutil.copyfile(PACKAGE/name,destination/name)
    if game=='xiyou':
        target=project/'scripts/game_audio.gd';original=next(r for r in before if r['path']=='apps/xiyou/godot/scripts/game_audio.gd')
        accepted=[r.get('bridgeSha256') for r in previous['games'] if r['game']=='xiyou']
        assert sha(target) in [original['sha256'],sha(PACKAGE/'xiyou_bridge.gd'),*accepted],'Concurrent game_audio edit; preserve and inspect'
        shutil.copyfile(PACKAGE/'xiyou_bridge.gd',target)
    target=project/'project.godot';text=target.read_text(encoding='utf-8-sig')
    key='CFGCNAudio="*res://game_audio_b/host.gd"'
    if key not in text:
        assert 'CFGCNAudio=' not in text,'Different audio autoload already present'
        if '[autoload]' in text:text=text.replace('[autoload]','[autoload]\n\n'+key,1)
        else:text+='\n[autoload]\n\n'+key+'\n'
        target.write_text(text,encoding='utf-8')
    assert 'run/main_scene="res://shared_desktop_ui/desktop_boot.tscn"' in target.read_text(encoding='utf-8')
    records.append({'game':game,'assets':staged,'runtime':[{'path':str(p.relative_to(ROOT)),'sha256':sha(p)} for p in destination.glob('*.gd')],
        'autoload':key,'resources':len(staged),'runtimeBytes':sum(r['bytes'] for r in staged),
        'bridgeSha256':sha(project/'scripts/game_audio.gd') if game=='xiyou' else None})
(QA/'main-integration.json').write_text(json.dumps({'games':records,'sharedUiModified':False,'mainGameplayScriptsModified':False,'incrementalCredits':inputs.get('incrementalCredits',0)},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({r['game']:{'resources':r['resources'],'bytes':r['runtimeBytes']} for r in records}))
