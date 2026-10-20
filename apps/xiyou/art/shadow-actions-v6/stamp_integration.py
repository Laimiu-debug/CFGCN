"""Record the concrete prototype integration without claiming campaign acceptance."""
from pathlib import Path
import json
HERE=Path(__file__).resolve().parent
manifest=json.loads((HERE/'manifest.json').read_text(encoding='utf-8'))
for record in manifest['characters']:
    record['in_game']=True
    record['status']='used in five-person map trial; final art and campaign integration pending'
    record['integration']={'mode':'five-person map trial','asset':'shadow/'+record['id']+'.glb','hero_skills':12 if record['id'] not in ['wolf','tiger','baigufuren'] else 0,'enemy_basic_attacks':1 if record['id'] in ['wolf','tiger','baigufuren'] else 0,'campaign':False}
    (HERE/record['id']/'manifest.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
manifest['status']='60 hero skill actions and five-person map trial; campaign, final balance and art acceptance pending'
(HERE/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
