"""Launch the real default desktop entry with separate, persistent local trial saves."""
from pathlib import Path
import argparse,json,os,subprocess
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('game',choices=['xiyou','shuihu']);a=p.parse_args()
profile=Path('H:/codex/local-play/cfgcn-audio-b')/a.game
for part in ['appdata','localappdata','settings','campaign','temp']:(profile/part).mkdir(parents=True,exist_ok=True)
out=ROOT/'.local/qa/godot-audio-b-v1'/a.game/'local-play';out.mkdir(parents=True,exist_ok=True)
env={**os.environ,'APPDATA':str(profile/'appdata'),'LOCALAPPDATA':str(profile/'localappdata'),
     'TEMP':str(profile/'temp'),'TMP':str(profile/'temp'),'CFGCN_DESKTOP_PROFILE_DIR':str(profile/'settings'),
     'CFGCN_SHUIHU_USER_DIR':str(profile/'campaign')}
for key in ['CFGCN_AUDIO_QA','CFGCN_AUDIO_GAME','CFGCN_AUDIO_TEMP','CFGCN_AUDIO_PHASE','CFGCN_XIYOU_QA_OUTPUT']:env.pop(key,None)
command=['H:/codex/tools/godot-4.7.2/Godot_v4.7.2-stable_win64_console.exe','--path',str(ROOT/'apps'/a.game/'godot'),'--log-file',str(out/'engine.log')]
with open(out/'console.log','w',encoding='utf-8') as log:
    process=subprocess.Popen(command,env=env,stdout=log,stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW)
    (out/'launch.json').write_text(json.dumps({'pid':process.pid,'game':a.game,'profile':str(profile),'command':command,'scope':'Actual source project, isolated persistent local trial saves; no QA hooks or changes to existing user saves.'},indent=2),encoding='utf-8')
    print(json.dumps({'pid':process.pid,'game':a.game,'profile':str(profile)},ensure_ascii=False),flush=True)
    raise SystemExit(process.wait())
