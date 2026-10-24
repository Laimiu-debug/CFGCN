"""Create one isolated, source-preserving actual project per game.
Keep the three-directory depth so existing ../../../ repository references work.
"""
from pathlib import Path
import hashlib, json, os, shutil
ROOT=Path(__file__).resolve().parents[2]
QA=ROOT/'.local/qa/desktop-audio-ab-v1'
TMP=Path('H:/codex/tmp/cfgcn-audio-ab-v1')
CACHE=Path('H:/codex/cache/cfgcn-audio-ab-v1')
QA.mkdir(parents=True,exist_ok=True);TMP.mkdir(parents=True,exist_ok=True)
records=[]
for game in ['xiyou','shuihu']:
 src=ROOT/f'apps/{game}/godot'
 dest=ROOT/f'.local/audio-ab-v1/{game}'
 dest.mkdir(parents=True,exist_ok=True)
 cache=CACHE/game
 cache.mkdir(parents=True,exist_ok=True)
 files=[]
 for directory,dirs,names in os.walk(src,followlinks=False):
  dirs[:]=[d for d in dirs if d!='.godot']
  for name in names:
   p=Path(directory)/name;relative=p.relative_to(src);to=dest/relative
   to.parent.mkdir(parents=True,exist_ok=True)
   before=hashlib.sha256(p.read_bytes()).hexdigest()
   if not to.exists():shutil.copy2(p,to)
   if hashlib.sha256(to.read_bytes()).hexdigest()!=before:raise RuntimeError('Snapshot differs: '+str(relative))
   files.append({'path':relative.as_posix(),'sha256':before,'bytes':p.stat().st_size})
 # Copy cache content to this batch's H directory, never share a writable cache.
 original=src/'.godot'
 for name in ['imported','uid_cache.bin','global_script_class_cache.cfg','extension_list.cfg']:
  p=original/name;to=cache/name
  if p.is_dir():shutil.copytree(p,to,dirs_exist_ok=True)
  elif p.is_file():shutil.copy2(p,to)
 link=dest/'.godot'
 if not link.exists():
  import subprocess
  # The verified literal source and target are our own snapshot and H cache.
  command=f"New-Item -ItemType Junction -Path '{link}' -Target '{cache}' | Out-Null"
  subprocess.run(['powershell.exe','-NoProfile','-Command',command],check=True)
 if link.resolve()!=cache.resolve():raise RuntimeError('Unexpected cache target')
 (dest/'comparison').mkdir(exist_ok=True)
 records.append({'game':game,'project':str(dest),'cache':str(cache.resolve()),'files':files})
 print(json.dumps({'game':game,'files':len(files),'bytes':sum(f['bytes'] for f in files)}),flush=True)
(QA/'project-inputs.json').write_text(json.dumps({'date':'2026-10-24','scope':'isolated copies of actual current game projects; source code and default live entry unchanged','projects':records},indent=2)+'\n',encoding='utf-8')
