from pathlib import Path
import json, hashlib, copy, shutil

R=Path(__file__).resolve().parents[3];A=R/'apps/shuihu/art/pieces';O=R/'.local/ops/shuihu-collection052';Q=R/'.local/qa/shuihu-pieces/ceramic-production/collection052'
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
current=read(A/'ceramic/godot-static-equipped-v5.json')
assert sha(A/'ceramic/godot-static-equipped-v5.json')=='a52afd8a62fcc8fd77967e467d6e570e9be16d03c482e13438b36592d3f48142'
inspection={x['id']:x for x in read(A/'ceramic/godot-inspection-collection-v1.json')['models']}
people=read(A/'ceramic/roster.json')['characters'];roster={x['id']:x for x in people}
portraits={x['id']:x for x in read(A/'ceramic/godot-collection-portraits-v1.json')['entries']}
figures={x['id']:x for x in read(A/'ceramic/godot-figure-placement-v3.json')['figures']}
gear_names={x['id']:x['name'] for x in current['models'] if x['kind']!='character-body'}
entries=[]
for item in current['models']:
    ident=item['id'];is_person=item['kind']=='character-body'
    regions=copy.deepcopy(inspection[ident].get('inspectionRegionsGodotMetres',{}));regions.update(copy.deepcopy(item.get('inspectionRegionsGodotMetres',{})))
    regions['whole']=item['files']['inspector']['boundsGodotMetres']
    files={tier:{k:info[k] for k in ['file','sha256','bytes','triangles','boundsGodotMetres'] if k in info} for tier,info in item['files'].items()}
    record={'id':ident,'name':item['name'],'kind':item['kind'],'files':files,'inspectionRegionsGodotMetres':regions,'inspectionViewAnglesGodotRadians':copy.deepcopy(item.get('inspectionViewAnglesGodotRadians',{}))}
    if is_person:
        person=roster[ident];body=figures[ident]['tiers']['inspector']['bodyBoundsGodotMetres'];regions['body']=body
        record.update({'nickname':person.get('nickname',''),'rank':person.get('rank',0),'star':person.get('star',''),'role':person.get('role',''),'aliases':person.get('aliases',[]),'group':'liangshan' if ident.startswith('ls') else 'jianghu','thumbnail':portraits[ident]['thumbnail'],'equipmentNames':[gear_names.get(x,x) for x in person.get('weaponIds',[])]})
    else:record.update({'group':'equipment','nickname':'独立兵器 · 身份器物','rank':0,'aliases':[]})
    entries.append(record)
assert len(entries)==222 and sum(x['group']=='liangshan' for x in entries)==108 and sum(x['group']=='jianghu' for x in entries)==60
catalog={'schemaVersion':1,'collection':'shuihu-ceramic-codex052','entries':entries,'counts':{'liangshan':108,'jianghu':60,'equipment':54},'sourceStaticCatalogueSha256':sha(A/'ceramic/godot-static-equipped-v5.json'),'ordinaryTroopsAreNotNamedCollectionEntries':True,'defaultLocked':True,'defaultTier':'battle','highTierLoadedOnlyOnRequest':True,'openingViewerDoesNotDiscoverAnEntry':True}
out=A/'ceramic/godot-codex052-catalog.json';out.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
Q.mkdir(parents=True,exist_ok=True);(Q/'module/codex052').mkdir(parents=True,exist_ok=True)
for p in (A/'godot/codex052').glob('*'):
    if p.is_file():shutil.copy2(p,Q/'module/codex052'/p.name)
for name in ['ceramic_model_inspector.gd','ceramic_piece_loader_v2.gd']:shutil.copy2(A/'godot'/name,Q/'module'/name)
shutil.copy2(out,Q/'catalog.json')
(Q/'config.json').write_text(json.dumps({'assetRoot':A.as_posix(),'catalogSha256':sha(out),'previewFixture':True,'characterIds':['ls001','ls006','ls009','ls059'],'equipmentIds':['bow','rattan-shield','spear','abacus']},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(Q/'project.godot').write_text('''config_version=5
[application]
config/name="水浒图鉴 · 资源预览052"
run/main_scene="res://preview.tscn"
config/features=PackedStringArray("4.7", "Forward Plus")
[display]
window/size/viewport_width=1366
window/size/viewport_height=820
window/size/window_width_override=1366
window/size/window_height_override=820
window/stretch/mode="disabled"
[rendering]
renderer/rendering_method="forward_plus"
textures/default_filters/use_nearest_mipmap_filter=false
''',encoding='utf-8')
print('CODEX052_CATALOG',len(entries),sha(out),flush=True)
