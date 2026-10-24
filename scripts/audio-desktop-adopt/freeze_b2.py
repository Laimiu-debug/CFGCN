"""Create an immutable, audio-only B2 handoff after the recorded source checks."""
from pathlib import Path
import argparse, ast, datetime, hashlib, json, os, shutil
ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser();parser.add_argument('--source',default='source/audio/godot-b-v2');parser.add_argument('--callout-label',default='callout-manual');args=parser.parse_args()
SOURCE=(ROOT/args.source).resolve();assert SOURCE.is_relative_to((ROOT/'source/audio').resolve())
QA=ROOT/'.local/qa/godot-audio-b-v2';PACKAGE=ROOT/'packages/godot-game-audio'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def rel(p):return p.relative_to(ROOT).as_posix()
def write(p,data):p.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
assert not (SOURCE/'delivery.json').exists(), 'Published audio handoff is immutable; make a new batch to revise it'
inputs=read(SOURCE/'inputs.json');prepared=read(SOURCE/'prepared.json');staged=read(QA/'main-integration.json')
assert len(prepared['resources'])==38 and prepared['exactPcm'] and inputs['incrementalCredits']==1
for row in inputs['resources']:assert sha(Path(row['source']))==row['sourceSha256']
for row in prepared['resources']:assert sha(Path(row['output']))==row['sha256']
for p in (ROOT/'scripts/audio-desktop-adopt').glob('*.py'):ast.parse(p.read_text(encoding='utf-8'),filename=str(p))
common=[]
for name in ['mixer.gd','host.gd','xiyou_director.gd','shuihu_director.gd','xiyou_bridge.gd']:
    origin=PACKAGE/name;dest=SOURCE/'runtime-package/common'/name;dest.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(origin,dest);assert sha(origin)==sha(dest)
    common.append({'path':rel(origin),'frozen':rel(dest),'sha256':sha(dest),'bytes':dest.stat().st_size})
games=[]
for g in staged['games']:
    game=g['game'];project=ROOT/'apps'/game/'godot';frozen=SOURCE/'runtime-package'/game
    config=(project/'project.godot').read_text(encoding='utf-8-sig')
    assert config.count('CFGCNAudio="*res://game_audio_b/host.gd"')==1
    assert 'run/main_scene="res://shared_desktop_ui/desktop_boot.tscn"' in config
    runtime=[]
    rows=[{'path':rel(project/r['path'].removeprefix('res://')),'sha256':r['sha256'],'id':r['id']} for r in g['assets']]
    rows+=g['runtime']
    if game=='xiyou':rows.append({'path':rel(project/'scripts/game_audio.gd'),'sha256':g['bridgeSha256']})
    for row in rows:
        origin=ROOT/row['path'];assert sha(origin)==row['sha256']
        local=origin.relative_to(project);dest=frozen/local;dest.parent.mkdir(parents=True,exist_ok=True)
        if dest.exists():assert sha(dest)==sha(origin)
        elif origin.suffix=='.res':os.link(origin,dest)
        else:shutil.copy2(origin,dest)
        runtime.append({'runtimePath':'res://'+local.as_posix(),'frozen':rel(dest),'sha256':sha(dest),'bytes':dest.stat().st_size,'id':row.get('id')})
    evidence={}
    for label,name in [('integration','integration'),('loop','loop'),('cold-normal','cold'),('cold-muted','cold'),('ui-pause-final','ui')]:
        folder=QA/game/label;report=read(folder/(name+'.json'))
        assert report['passed'] and read(folder/'runner.json')['code']==0
        log=(folder/'console.log').read_text(encoding='utf-8');assert not any(x in log for x in ['ERROR:','WARNING:','SCRIPT ERROR'])
        evidence[label]={'path':rel(folder/(name+'.json')),'sha256':sha(folder/(name+'.json')),'checks':len(report.get('checks',[]))}
    games.append({'game':game,'resources':g['resources'],'resourceBytes':g['runtimeBytes'],
        'autoload':g['autoload'],'runtimeFiles':runtime,'nativeSourceChecks':evidence})
exit_report=read(QA/'exit-lifecycle/result.json');assert exit_report['passed'] and len(exit_report['runs'])==6
for row in exit_report['runs']:
    assert row['hostSha256']==sha(PACKAGE/'host.gd') and row['mixerSha256']==sha(PACKAGE/'mixer.gd')
pair=read(QA/'paired-export.json');assert pair['passed'] and pair['duplicateB2Tokens']==0 and pair['readonlyRulesChecks']==15
exports=read(QA/'export.json');assert exports['passed']
for row in exports['results']:
    assert sha(ROOT/row['video'])==row['videoSha256'] and row['loopPcmExact'] and row['nativeMasterPcmExact']
for row in pair['results']:assert sha(ROOT/row['video'])==row['sha256'] and row['nativeBusPcmExact']
callout=read(QA/'xiyou'/args.callout_label/'callout.json');assert callout['passed'] and callout['calls']>0
bindings=read(QA/'callout-bindings.json');assert bindings['passed']
legacy=read(ROOT/'.local/qa/xiyou-godot-audioB2/audio_native/audio-native.json');assert legacy['passed']
music=[]
b1=read(ROOT/'source/audio/godot-b-v1/prepared.json')
for row in prepared['resources']:
    if not row['id'].startswith('music-'):continue
    old=next(r for r in b1['resources'] if r['id']==row['id']);assert row['sha256']==old['sha256']
    music.append({'id':row['id'],'sha256':row['sha256'],'identicalToAcceptedB1':True})
record={'version':inputs['runtimeVersion'],'passed':True,'date':datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'acceptanceScope':'Audio source handoff only; not independent Windows EXE/ZIP acceptance or public website publication.',
    'windowsPackageAcceptance':False,'websitePublication':False,'incrementalRunwayCalls':1,'incrementalRunwayCredits':1,
    'b2FamilyCredits':inputs.get('b2FamilyCredits',1),'baseDelivery':inputs.get('baseDelivery'),
    'priorMaterialBatchCredits':27,'sourcePackage':'packages/godot-game-audio','common':common,
    'preparedResources':38,'games':games,'music':music,'mastering':rel(SOURCE/'mastering.json'),
    'calloutReview':rel(SOURCE/'callout-review.json'),'calloutChecks':len(callout['checks']),
    'calloutNativeEvidence':rel(QA/'xiyou'/args.callout_label/'callout.json'),
    'calloutInRealStaffAttack':callout['voiceSkillIndices'],'calloutHumanListeningApproval':False,
    'pairedComparison':{'path':rel(QA/'paired-export.json'),'sha256':sha(QA/'paired-export.json'),
        'b1RealReleases':pair['b1ActualReleases'],'b2RealReleases':pair['b2ActualReleases'],'readonlyRulesChecks':15},
    'legacyLv38Checks':len(legacy['checks']),'exitRuns':6,'exitSettingsChecks':40,
    'coverageNote':'Integration/loop/cold/UI captures precede the one-line/voice-eligibility revision. The final library is covered by native skill-order validation, a fresh paired real five-person run, and actual manual staff casts with nonzero Voice PCM. Mixer/host/director code is identical across these checks.',
    'mainGameplayWrittenByAudioBatch':False,'sharedDesktopUiWrittenByAudioBatch':False,
    'limitations':['No Shuihu character dialogue added.','No claim of final subjective voice approval or all skills/materials/bosses covered.',
        'Movie Maker fixed-FPS samples are not real-time performance benchmarks.','Package loops, actual transitions, four-volume cold recovery, normal launcher/save flow and same-build website materials remain required.'],
    'packageQaEntry':'scripts/audio-desktop-adopt/package_entry.gd','packageQaDocumentation':'docs/godot-audio-windows-b2.md',
    'storageGuard':'H:/codex/storage-guard/latest.json'}
write(SOURCE/'delivery.json',record)
write(PACKAGE/'current.json',{'version':inputs['runtimeVersion'],'source':rel(SOURCE),'qa':'.local/qa/godot-audio-b-v2',
    'delivery':rel(SOURCE/'delivery.json'),'deliverySha256':sha(SOURCE/'delivery.json')})
write(QA/('verification-r1.json' if inputs['runtimeVersion']=='B2.1' else 'verification.json'),{'passed':True,'delivery':rel(SOURCE/'delivery.json'),'sha256':sha(SOURCE/'delivery.json'),
    'common':common,'games':[{k:v for k,v in g.items() if k!='runtimeFiles'} for g in games]})
print(json.dumps({'passed':True,'delivery':rel(SOURCE/'delivery.json'),'sha256':sha(SOURCE/'delivery.json'),
    'games':[{k:g[k] for k in ['game','resources','resourceBytes']} for g in games],'incrementalCredits':1}))
