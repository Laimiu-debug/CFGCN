"""Run the real default desktop entry with an isolated local audio QA hook."""
from pathlib import Path
import argparse,hashlib,json,os,shutil,subprocess,time
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('game',choices=['xiyou','shuihu']);p.add_argument('case');p.add_argument('--movie',action='store_true');p.add_argument('--label');p.add_argument('--limit',type=int,default=360);p.add_argument('--profile');p.add_argument('--phase',default='normal');p.add_argument('--batch',default='godot-audio-b-v1')
a=p.parse_args();label=a.label or a.case
assert label.replace('-','').isalnum() and a.case.replace('-','').isalnum()
assert a.batch in ['godot-audio-b-v1','godot-audio-b-v2']
out=ROOT/'.local/qa'/a.batch/a.game/label;out.mkdir(parents=True,exist_ok=True)
temp_root=Path('H:/codex/tmp')/('cfgcn-audio-adopt-v2' if a.batch.endswith('v2') else 'cfgcn-audio-adopt-v1')
temp=temp_root/a.game/label
profile=temp_root/a.game/(a.profile or label)
for d in [temp,profile/'appdata',profile/'settings',profile/'campaign']:d.mkdir(parents=True,exist_ok=True)
project=ROOT/'apps'/a.game/'godot';driver=ROOT/'scripts/audio-desktop-adopt'/(a.case+'.gd')
(project/'tests').mkdir(exist_ok=True)
shutil.copy2(driver,project/'tests'/('audio_b_'+a.case+'.gd'));shutil.copy2(driver,out/'driver.gd')
env={**os.environ,'APPDATA':str(profile/'appdata'),'LOCALAPPDATA':str(profile/'localappdata'),
     'TEMP':str(temp),'TMP':str(temp),'CFGCN_DESKTOP_PROFILE_DIR':str(profile/'settings'),
     'CFGCN_SHUIHU_USER_DIR':str(profile/'campaign'),'CFGCN_AUDIO_QA':out.as_posix(),
     'CFGCN_AUDIO_GAME':a.game,'CFGCN_AUDIO_TEMP':temp.as_posix(),'CFGCN_AUDIO_PHASE':a.phase,
     'CFGCN_AUDIO_OFFLINE_CAPTURE':'1' if a.movie else '0'}
cmd=['H:/codex/tools/godot-4.7.2/Godot_v4.7.2-stable_win64_console.exe','--path',str(project),'--log-file',str(out/'engine.log')]
if a.movie:cmd+=['--write-movie',str(temp/'native.avi'),'--fixed-fps','30']
cmd+=['--','--desktop-qa=res://tests/audio_b_'+a.case+'.gd']
start=time.time()
with open(out/'console.log','w',encoding='utf-8') as log:
    process=subprocess.Popen(cmd,env=env,stdout=log,stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW)
    print(json.dumps({'pid':process.pid,'game':a.game,'case':a.case,'output':str(out)}),flush=True)
    try:code=process.wait(timeout=a.limit)
    except subprocess.TimeoutExpired:
        process.terminate();process.wait();code=124
log_text=(out/'console.log').read_text(encoding='utf-8',errors='replace')
if 'SCRIPT ERROR' in log_text or '\nERROR:' in log_text:code=code or 2
(out/'runner.json').write_text(json.dumps({'code':code,'wallSeconds':time.time()-start,'command':cmd,
    'temp':str(temp),'profile':str(profile/'settings'),'actualProject':str(project),'driverSha256':hashlib.sha256(driver.read_bytes()).hexdigest()},indent=2),encoding='utf-8')
print(json.dumps({'game':a.game,'case':a.case,'code':code,'wallSeconds':round(time.time()-start,2)}),flush=True)
raise SystemExit(code)
