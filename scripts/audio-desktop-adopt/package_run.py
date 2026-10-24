"""Audio acceptance against one owner's immutable Windows EXE/PCK/ZIP identity."""
from pathlib import Path
import argparse,hashlib,json,os,subprocess,time
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('game',choices=['xiyou','shuihu']);p.add_argument('case')
p.add_argument('--build',required=True);p.add_argument('--identity',required=True)
p.add_argument('--exe',required=True);p.add_argument('--pck',required=True);p.add_argument('--zip');p.add_argument('--dll')
p.add_argument('--delivery',default='source/audio/godot-b-v2-r1/delivery.json')
p.add_argument('--movie',action='store_true');p.add_argument('--headless',action='store_true');p.add_argument('--limit',type=int,default=360)
p.add_argument('--profile',default='integration');p.add_argument('--phase',default='normal');p.add_argument('--label');a=p.parse_args()
assert a.identity.replace('-','').replace('.','').isalnum() and a.case.replace('-','').isalnum()
label=a.label or a.case;assert label.replace('-','').isalnum()
build=Path(a.build).resolve();assert build.is_relative_to((ROOT/'.local/builds').resolve())
exe=(build/a.exe).resolve();pack=(build/a.pck).resolve();archive=(build/a.zip).resolve() if a.zip else None
dll=(build/a.dll).resolve() if a.dll else None
tracked_files=[exe,pack,*([archive] if archive else []),*([dll] if dll else [])]
for path in tracked_files:assert path.is_file() and path.is_relative_to(build)
def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda:f.read(1048576),b''):h.update(block)
    return h.hexdigest()
files={str(path):sha(path) for path in tracked_files}
out=ROOT/'.local/qa/godot-audio-b-v2/packages'/a.game/a.identity/label
assert not (out/'runner.json').exists(),'Do not overwrite a prior package take'
out.mkdir(parents=True,exist_ok=True)
temp=Path('H:/codex/tmp/cfgcn-audio-packages')/a.game/a.identity/label
profile=Path('H:/codex/tmp/cfgcn-audio-packages')/a.game/a.identity/('profile-'+a.profile)
for path in [temp,profile/'appdata',profile/'localappdata',profile/'settings',profile/'campaign']:path.mkdir(parents=True,exist_ok=True)
env={**os.environ,'APPDATA':str(profile/'appdata'),'LOCALAPPDATA':str(profile/'localappdata'),'TEMP':str(temp),'TMP':str(temp),
    'CFGCN_DESKTOP_PROFILE_DIR':str(profile/'settings'),'CFGCN_SHUIHU_USER_DIR':str(profile/'campaign'),
    'CFGCN_AUDIO_QA':out.as_posix(),'CFGCN_AUDIO_TEMP':temp.as_posix(),'CFGCN_AUDIO_GAME':a.game,'CFGCN_AUDIO_PHASE':a.phase,
    'CFGCN_AUDIO_OFFLINE_CAPTURE':'1' if a.movie else '0'}
if a.case=='probe':script=ROOT/'scripts/audio-desktop-adopt/package_probe.gd'
else:
    script=ROOT/'scripts/audio-desktop-adopt/package_entry.gd'
    driver=ROOT/'scripts/audio-desktop-adopt'/(a.case+'.gd');assert driver.is_file()
    env['CFGCN_AUDIO_DRIVER_SCRIPT']=driver.as_posix();env['CFGCN_AUDIO_DELIVERY']=(ROOT/a.delivery).resolve().as_posix()
qa_inputs={str(script):sha(script)}
if a.case!='probe':qa_inputs[str(driver)]=sha(driver)
assert pack.stem.lower()==exe.stem.lower(),'Use the actual adjacent shipped PCK, not a replacement main pack'
cmd=[str(exe),'--log-file',str(out/'engine.log')]
if a.headless:cmd+=['--headless']
if a.movie:cmd+=['--write-movie',str(temp/'native.avi'),'--fixed-fps','30']
cmd+=['--','--desktop-qa='+script.as_posix()]
started=time.monotonic();failure=''
with (out/'console.log').open('w',encoding='utf-8') as log:
    process=subprocess.Popen(cmd,env=env,cwd=build,stdout=log,stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW)
    print(json.dumps({'pid':process.pid,'game':a.game,'case':a.case,'identity':a.identity,'output':str(out)}),flush=True)
    while process.poll() is None:
        texts=[path.read_text(encoding='utf-8',errors='replace') for path in [out/'console.log',out/'engine.log'] if path.exists()]
        if any('SCRIPT ERROR' in s or '\nERROR:' in s for s in texts):failure='Real engine/script error in this owned QA process'
        elif time.monotonic()-started>a.limit:failure='Owned QA process exceeded its declared timeout'
        if failure:process.terminate();process.wait();break
        time.sleep(.25)
    code=process.returncode
texts=[path.read_text(encoding='utf-8',errors='replace') for path in [out/'console.log',out/'engine.log'] if path.exists()]
if any('SCRIPT ERROR' in s or '\nERROR:' in s for s in texts):failure=failure or 'Engine/script error in final logs'
unchanged=all(sha(Path(path))==digest for path,digest in files.items())
record={'code':code,'failure':failure,'wallSeconds':time.monotonic()-started,'identity':a.identity,'game':a.game,
    'command':cmd,'filesSha256':files,'packageFilesUnchanged':unchanged,'scriptSha256':sha(script),'temp':str(temp),
    'qaInputSha256':qa_inputs,'qaInputsUnchanged':all(sha(Path(path))==digest for path,digest in qa_inputs.items()),
    'profile':str(profile),'scope':'Real shipping EXE/PCK, isolated settings/saves; external QA script not distributed to players.'}
(out/'runner.json').write_text(json.dumps(record,indent=2),encoding='utf-8')
print(json.dumps({k:record[k] for k in ['code','failure','wallSeconds','identity','packageFilesUnchanged']}))
raise SystemExit(0 if code==0 and not failure and unchanged else 1)
