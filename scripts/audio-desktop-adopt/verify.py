"""Final source, staging, native evidence and ownership-boundary handoff."""
from pathlib import Path
import ast,datetime,hashlib,json,re
ROOT=Path(__file__).resolve().parents[2];QA=ROOT/'.local/qa/godot-audio-b-v1';SOURCE=ROOT/'source/audio/godot-b-v1'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text(encoding='utf-8'))
inputs=read(SOURCE/'inputs.json');prepared=read(SOURCE/'prepared.json');staged=read(QA/'main-integration.json')
for row in inputs['resources']:assert sha(Path(row['source']))==row['sourceSha256']
for row in prepared['resources']:assert sha(Path(row['output']))==row['sha256']
for p in (ROOT/'scripts/audio-desktop-adopt').glob('*.py'):ast.parse(p.read_text(encoding='utf-8'),filename=str(p))
def func(path,name):
    source=path.read_text(encoding='utf-8')
    return re.search(r'^func '+name+r'\(.*?(?=^func |\Z)',source,re.S|re.M)[0]
unchanged=[]
for file,name in [('mixer.gd','tick'),('mixer.gd','set_context'),('host.gd','_process')]:
    old=func(QA/'exit-lifecycle/before'/file,name);new=func(ROOT/'packages/godot-game-audio'/file,name)
    assert old==new
    unchanged.append({'source':file,'function':name,'sha256':hashlib.sha256(new.encode()).hexdigest()})
games=[]
for g in staged['games']:
    game=g['game'];project=ROOT/'apps'/game/'godot'
    config=(project/'project.godot').read_text(encoding='utf-8-sig')
    assert config.count('CFGCNAudio="*res://game_audio_b/host.gd"')==1
    assert 'run/main_scene="res://shared_desktop_ui/desktop_boot.tscn"' in config
    cache=(project/'.godot').resolve();assert str(cache).lower().startswith('h:')
    for row in g['assets']:
        p=project/row['path'].removeprefix('res://');source=SOURCE/'resources'/p.name
        assert sha(p)==row['sha256']==sha(source)
    for row in g['runtime']:
        p=ROOT/row['path'];assert sha(p)==row['sha256']
        if p.name!='library.gd':assert sha(p)==sha(ROOT/'packages/godot-game-audio'/p.name)
    if game=='xiyou':assert sha(project/'scripts/game_audio.gd')==sha(ROOT/'packages/godot-game-audio/xiyou_bridge.gd')
    cases={}
    for label,file in [('integration','integration'),('loop','loop'),('cold-normal','cold'),('cold-muted','cold'),('ui-pause-final','ui')]:
        folder=QA/game/label;data=read(folder/(file+'.json'));assert data['passed'] and read(folder/'runner.json')['code']==0
        log=(folder/'console.log').read_text(encoding='utf-8')
        assert not any(x in log for x in ['ERROR:','WARNING:','SCRIPT ERROR'])
        cases[label]={'report':str((folder/(file+'.json')).relative_to(ROOT)),'sha256':sha(folder/(file+'.json')),'checks':len(data.get('checks',[]))}
    games.append({'game':game,'resources':g['resources'],'resourceBytes':g['runtimeBytes'],'autoload':g['autoload'],
        'defaultEntryPreserved':True,'importCacheResolved':str(cache),'nativeChecks':cases,
        'projectSettingsSha256':sha(project/'project.godot'),'runtime':g['runtime']})
old=read(ROOT/'.local/qa/xiyou-godot-audioB/audio_native/audio-native.json');assert old['passed']
exit_data=read(QA/'exit-lifecycle/result.json');assert exit_data['passed'] and len(exit_data['runs'])==6
for row in exit_data['runs']:
    assert row['hostSha256']==sha(ROOT/'packages/godot-game-audio/host.gd') and row['mixerSha256']==sha(ROOT/'packages/godot-game-audio/mixer.gd')
exports=read(QA/'export.json');assert exports['passed']
for row in exports['results']:assert sha(ROOT/row['video'])==row['videoSha256'] and row['loopPcmExact'] and row['nativeMasterPcmExact']
cleanup=read(QA/'cleanup.json')
sources=[{'path':str(p.relative_to(ROOT)),'sha256':sha(p)} for p in (ROOT/'packages/godot-game-audio').glob('*') if p.is_file()]
record={'accepted':True,'userDecision':'采用B版，接入西游和水浒Godot主工程，先本地试','date':datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'incrementalRunwayCalls':0,'incrementalRunwayCredits':0,'priorMaterialBatchCredits':27,'sourcePackage':'packages/godot-game-audio',
    'sources':sources,'preparedResources':len(prepared['resources']),'games':games,'mainGameplayScriptsWrittenByThisBatch':False,'sharedDesktopUiWrittenByThisBatch':False,
    'currentOwnerUiWiringObserved':{'path':'packages/godot-desktop-ui/boot.gd','interface':'/root/CFGCNAudio.ui_event','scope':'Shared UI owner wired actions; this batch verifies actual paused menu repeats and mute.'},
    'exitAndUiPatch':{'report':str((QA/'exit-lifecycle/result.json').relative_to(ROOT)),'runs':6,'settingsChecks':40,'loopFunctionsUnchanged':unchanged,
        'scope':'Main recordings and complete natural loops precede exit/API/cooldown patch; final source separately passed UI/pause and fast process exit regressions.'},
    'legacyLv38RegressionChecks':len(old['checks']),'mainMovies':exports['results'],'cleanup':{'files':cleanup['deletedFiles'],'logicalBytesByDrive':cleanup['logicalBytesByDrive'],'physicalClustersMeasured':False},
    'deliveryScope':'Actual local source projects, not a rebuilt public Windows package, source-control publication, production deployment, full-game or multi-hardware acceptance.',
    'storageGuard':'H:/codex/storage-guard/latest.json','notionEvidence':'.local/qa/godot-audio-b-v1/notion-readback.json'}
(SOURCE/'delivery.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
(QA/'verification.json').write_text(json.dumps({'passed':True,'delivery':str((SOURCE/'delivery.json').relative_to(ROOT)),'sha256':sha(SOURCE/'delivery.json'),'sources':sources,'gameplayLoopCodeUnchangedAfterExitPatch':unchanged},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'passed':True,'games':len(games),'resources':len(prepared['resources']),'legacyChecks':len(old['checks']),'exitRuns':6,'incrementalCredits':0},ensure_ascii=False))
