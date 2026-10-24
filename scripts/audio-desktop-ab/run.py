"""Run one isolated native A/B take, with all transient writes on H."""
import argparse, json, os, pathlib, shutil, subprocess, time

ROOT=pathlib.Path(__file__).resolve().parents[2]
ENGINE=pathlib.Path('H:/codex/tools/godot-4.7.2/Godot_v4.7.2-stable_win64_console.exe')
TEMP=pathlib.Path('H:/codex/tmp/cfgcn-audio-ab-v1')
p=argparse.ArgumentParser();p.add_argument('flow',choices=['XY-A','XY-B','SH-A','SH-B'])
p.add_argument('--seconds',type=float);p.add_argument('--take',default='final')
a=p.parse_args();game='xiyou' if a.flow.startswith('XY') else 'shuihu'
project=ROOT/'.local/audio-ab-v1'/game
label=a.flow if a.take=='final' else a.flow+'-'+a.take
out=ROOT/'.local/qa/desktop-audio-ab-v1'/label
media=TEMP/label;profile=TEMP/'qa'/label
for folder in [out,media,profile/'appdata',profile/'settings',profile/'campaign']:
    folder.mkdir(parents=True,exist_ok=True)
for name in ['capture.gd','mixer.gd']:
    shutil.copyfile(ROOT/'scripts/audio-desktop-ab'/name,project/'comparison'/name)
    shutil.copyfile(ROOT/'scripts/audio-desktop-ab'/name,out/name)
env=os.environ.copy();env.update(APPDATA=str(profile/'appdata'),TEMP=str(TEMP),TMP=str(TEMP),
    CFGCN_DESKTOP_PROFILE_DIR=str(profile/'settings'),CFGCN_SHUIHU_USER_DIR=str(profile/'campaign'),
    CFGCN_AB_FLOW=a.flow,CFGCN_AB_OUTPUT=out.as_posix(),CFGCN_AB_MEDIA_DIR=media.as_posix())
if a.seconds:env['CFGCN_AB_SECONDS']=str(a.seconds)
cmd=[str(ENGINE),'--path',str(project),'--script','res://comparison/capture.gd',
     '--write-movie',str(media/'raw.avi'),'--fixed-fps','30','--resolution',
     '1280x720' if game=='xiyou' else '1280x800','--log-file',str(out/'godot.log')]
start=time.time()
with open(out/'console.log','w',encoding='utf-8') as log:
    process=subprocess.Popen(cmd,env=env,stdout=log,stderr=subprocess.STDOUT,
        creationflags=subprocess.CREATE_NO_WINDOW)
    print(json.dumps({'pid':process.pid,'flow':a.flow,'take':a.take,'output':str(out)},ensure_ascii=False),flush=True)
    code=process.wait()
(out/'process.json').write_text(json.dumps({'returncode':code,'wallSeconds':time.time()-start,
    'command':cmd,'transientMedia':str(media),'isolatedProfile':str(profile)},indent=2),encoding='utf-8')
print(json.dumps({'flow':a.flow,'returncode':code,'wallSeconds':round(time.time()-start,2)}),flush=True)
raise SystemExit(code)
