"""Seal audio-only acceptance against a fixed Windows build, not the whole game."""
from pathlib import Path
import argparse,datetime,hashlib,json
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('game',choices=['xiyou','shuihu']);p.add_argument('identity');p.add_argument('--game-version',required=True);a=p.parse_args()
QA=ROOT/'.local/qa/godot-audio-b-v2/packages'/a.game/a.identity
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def file_sha(p):
    h=hashlib.sha256()
    with Path(p).open('rb') as f:
        for block in iter(lambda:f.read(1048576),b''):h.update(block)
    return h.hexdigest()
def rel(p):return p.relative_to(ROOT).as_posix()
proof=[];identity=None;total=0
for label,name in [('loop','loop'),('integration','integration'),('cold-normal','cold'),('cold-muted','cold')]:
    folder=QA/label;runner=read(folder/'runner.json');data=read(folder/(name+'.json'));runtime=read(folder/'package-runtime.json')
    assert runner['code']==0 and not runner['failure'] and runner['packageFilesUnchanged'] and data['passed'] and runtime['passed']
    assert runtime['audioVersion']=='B2.1' and runtime['deliverySha256']=='f222e4c49b931648b871f7016a9a20478693b350eea42479de9804b1583c00af'
    if identity is None:identity=runner['filesSha256']
    else:assert identity==runner['filesSha256']
    for logfile in ['console.log','engine.log']:
        text=(folder/logfile).read_text(encoding='utf-8');assert not any(s in text for s in ['ERROR:','WARNING:','SCRIPT ERROR','ObjectDB instances leaked'])
    count=len(data.get('checks',[]));total+=count
    proof.append({'label':label,'path':rel(folder/(name+'.json')),'sha256':sha(folder/(name+'.json')),'checks':count,
        'runtimeIdentityProof':rel(folder/'package-runtime.json')})
for path,digest in identity.items():assert file_sha(path)==digest
loop=read(QA/'loop-archive.json');movie=read(QA/'movie-export.json');assert loop['passed'] and movie['passed']
assert len(loop['wholeLengthNaturalCrossings'])==2 and loop['realTime']
for row in loop['archives']:assert sha(ROOT/row['path'])==row['sha256']
assert sha(ROOT/movie['video'])==movie['sha256']
integration=read(QA/'integration/integration.json')
listening=ROOT/'.local/qa/godot-audio-b-v2/callout-user-acceptance.json'
voice_acceptance=read(listening) if listening.exists() else None
if a.game=='xiyou':
    assert voice_acceptance and voice_acceptance['accepted'] and voice_acceptance['text']=='吃俺老孙一棒！'
    assert voice_acceptance['deliverySha256']=='f222e4c49b931648b871f7016a9a20478693b350eea42479de9804b1583c00af'
coverage={'actualEvents':integration['audio']['eventCounts'],'playedSounds':integration['audio']['played'],'voices':False if a.game=='shuihu' else {'existingFiveRoleBank':True,'wukongLineAcceptance':voice_acceptance,'otherVoiceLinesNewlyApproved':False},
    'unverified':'All chapters/bosses/weapon materials, complete campaign and skeletal-animation/art/gameplay acceptance are outside this audio report.'}
record={'passed':True,'scope':'Audio-only acceptance of this actual Windows EXE/PCK identity.',
    'date':datetime.datetime.now(datetime.timezone.utc).isoformat(),'game':a.game,'gameVersion':a.game_version,'identity':a.identity,
    'audioVersion':'B2.1','audioDelivery':'source/audio/godot-b-v2-r1/delivery.json',
    'audioDeliverySha256':'f222e4c49b931648b871f7016a9a20478693b350eea42479de9804b1583c00af',
    'sharedUiVersion':'desktop-ui-v2.1','sharedUiSourceManifestSha256':'29dee1b491ba5785fb3817896039eff333234d1ffb126c68d857b00679a4e9e5',
    'packageFilesSha256':identity,'packageFilesUnchanged':True,'checks':total,'processes':4,'proof':proof,
    'naturalWholeLengthCrossings':2,'minimumLoopCorrelation':min(c['postBoundaryCorrelation'] for c in loop['wholeLengthNaturalCrossings']),
    'firstPass':loop['firstPass'],'repeatSeconds':loop['repeatSeconds'],'loopArchive':rel(QA/'loop-archive.json'),
    'nativeMovie':movie,'audition':loop['audition'],'coverage':coverage,
    'playMethod':'Real default packaged shell plus an external QA driver invoking normal controls/orders. No HP/position/forced-victory injection. Normal launcher/menu gameplay acceptance is separately owned by the main/UI teams.',
    'zipIdentityPending':True,'websitePublication':False,'incrementalRunwayCreditsForPackageTests':0,
    'limitations':['This is not acceptance of the complete game or every new asset.','Movie Maker footage has intentional pause/mute/settings checks and is labeled accordingly; it is not a performance result or an uninterrupted trailer.',
        'The music audition is encoded from the exact native game PCM master; the gameplay sound is the original native mixed output, not a replacement soundtrack.'],
    'next':'Main owner binds the same EXE/PCK/DLL into the final ZIP and supplies normal playable scope, launcher, screenshots and continuous demo. Website/UI reuse this one audio report; do not rerun a parallel recording matrix.'}
(QA/'audio-acceptance.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'passed':True,'scope':'audio','game':a.game,'gameVersion':a.game_version,'checks':total,'processes':4,
    'path':str(QA/'audio-acceptance.json'),'sha256':sha(QA/'audio-acceptance.json')}))
