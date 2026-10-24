"""Check real fast process exit, including complete stdout/stderr and WAV leaks."""
from pathlib import Path
import argparse,concurrent.futures,hashlib,json,os,subprocess,shutil
parser=argparse.ArgumentParser();parser.add_argument('--batch',choices=['godot-audio-b-v1','godot-audio-b-v2'],default='godot-audio-b-v1');args=parser.parse_args()
ROOT=Path(__file__).resolve().parents[2];QA=ROOT/'.local/qa'/args.batch/'exit-lifecycle'
def run(game,case):
    out=QA/(game+'-'+case);out.mkdir(parents=True,exist_ok=True)
    temp=Path('H:/codex/tmp')/('cfgcn-audio-adopt-v2' if args.batch.endswith('v2') else 'cfgcn-audio-adopt-v1')/'exit-lifecycle'/(game+'-'+case)
    for part in ['appdata','settings','campaign','temp']:(temp/part).mkdir(parents=True,exist_ok=True)
    env={**os.environ,'APPDATA':str(temp/'appdata'),'LOCALAPPDATA':str(temp/'appdata'),
         'CFGCN_DESKTOP_PROFILE_DIR':str(temp/'settings'),'CFGCN_SHUIHU_USER_DIR':str(temp/'campaign'),
         'CFGCN_DESKTOP_QA_DIR':str(out),'TEMP':str(temp/'temp'),'TMP':str(temp/'temp')}
    cmd=['H:/codex/tools/godot-4.7.2/Godot_v4.7.2-stable_win64_console.exe','--path',str(ROOT/'apps'/game/'godot'),'--verbose','--log-file',str(out/'engine.log')]
    if case=='settings':
        target=ROOT/'apps'/game/'godot/tests/audio_b_settings.gd';target.parent.mkdir(exist_ok=True);shutil.copyfile(ROOT/'packages/godot-desktop-ui/tests/settings_test.gd',target)
        cmd+=['--headless','--script','res://tests/audio_b_settings.gd']
    elif case=='fast':cmd+=['--headless','--quit-after','10']
    else:cmd+=['--rendering-method','gl_compatibility','--quit-after','20']
    result=subprocess.run(cmd,env=env,capture_output=True,timeout=60)
    log=result.stdout.decode('utf-8','replace')+'\n'+result.stderr.decode('utf-8','replace')
    (out/'console.log').write_text(log,encoding='utf-8')
    clean=result.returncode==0 and not any(x in log for x in ['SCRIPT ERROR','ERROR:','WARNING:','Leaked instance:','Resource still in use:'])
    settings=json.loads((out/'settings-tests.json').read_text(encoding='utf-8')) if case=='settings' else None
    return {'game':game,'case':case,'passed':clean and (settings is None or settings['failed']==0),
        'code':result.returncode,'settingsChecks':len(settings['checks']) if settings else None,
        'command':cmd,'stdoutStderrSha256':hashlib.sha256(log.encode()).hexdigest(),
        'hostSha256':hashlib.sha256((ROOT/'packages/godot-game-audio/host.gd').read_bytes()).hexdigest(),
        'mixerSha256':hashlib.sha256((ROOT/'packages/godot-game-audio/mixer.gd').read_bytes()).hexdigest()}
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    results=list(pool.map(lambda x:run(*x),[(g,c) for g in ['xiyou','shuihu'] for c in ['settings','fast','gpu']]))
(QA/'result.json').write_text(json.dumps({'passed':all(x['passed'] for x in results),'runs':results},indent=2),encoding='utf-8')
print(json.dumps(results),flush=True)
assert all(x['passed'] for x in results),'See complete real process exit logs'
