"""Build the local four-scene review from completed, paired native captures."""
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / '.local/audio/godot-b-v2/contact'
QA = ROOT / '.local/qa/godot-audio-contact-v1'


def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


specs = [
    dict(id='shuihu015-contact', game='shuihu', identity='preview015-v2-contact-v1',
         gameName='水浒', version='0.0.15-preview.2', title='刀枪交锋',
         listenFor='听同一场交锋中，挥空、命中和伤亡是否更容易分开；轻伤不再频繁压住整段音乐。',
         coverage='实际 M01 出征、单刀与长枪／棍、真实落空及气血／护甲伤害，直至战后。',
         limit='已含新版 HUD 与 source050 散匪身体／动作；M03—M05 枪盾兵和独立身体转身仍待接入。这段没有实际盾接触，不把普通落空配成盾挡。',
         extraNote='本场实际有一名队员战死，保留原结果。早先 0.0.13-preview.2 的听审录制保留为历史，当前本页水浒两段绑定新版 0.0.15-preview.2。'),
    dict(id='shuihu015-bow', game='shuihu', identity='preview015-v2-bow-contact-v1',
         gameName='水浒', version='0.0.15-preview.2', title='弓弦与落箭',
         listenFor='听弓弦放箭与结算反馈的先后；箭已射出并不代表已经命中。',
         coverage='在实际 M01 用正常预览／下令接口射箭，保留真实命中、落空与弹药结算。',
         limit='只覆盖这场实际弓箭结果；格挡、金属甲、不同距离及全部弓兵尚未逐项听审。',
         extraNote='没有修改随机结果、伤害或命中率；动作接触时点沿主工程现行实现。'),
    dict(id='xiyou-ordinary', game='xiyou', identity='v14-ordinary-contact-v1',
         gameName='西游', version='v14 · 0.1.13.0', title='敌群、投石与符术',
         listenFor='听投石的干短发力、符术的笔墨声，以及敌群拥来时悟空等人的招式是否仍有层次。',
         coverage='实际普通敌群释放事件，含近战、山魈投石和狐妖符术；真实气血伤害与拾光。普通释放最多同时保留两声。',
         limit='投石／符术在本段确认的是出手事件；当前受创信息不能精确逐个反推来袭者，不冒称每颗石头／符纸都完成独立命中配声。',
         extraNote='使用主工程合法输入过程留下的原生检查点，未编辑血量、位置、经验或章节。原有皮影技能画面沿 v14，后续画风修订另验。'),
    dict(id='xiyou-qingmao', game='xiyou', identity='v14-qingmao-contact-r2',
         gameName='西游', version='v14 · 0.1.13.0', title='青毛狮的危险来临',
         listenFor='重点听 Boss 起手预警：普通出招和受击声退后，危险提示应当先听清；音乐随后平顺回到前景。',
         coverage='乌鸡国青毛狮真实六招，40 秒内 11 次实际起手预警；同场真实出招、受创与角色喊招。',
         limit='本段不含普通小怪群，不代表其他 Boss、全章胜利或整款音频验收。青毛狮身份为 qingmao。',
         extraNote='使用主工程完整章录像留下的真实交锋前备份；保留当前保存时回到段前检查点的原有语义。'),
]

cases = []
for spec in specs:
    q = ROOT / '.local/qa/godot-audio-b-v2/packages' / spec['game'] / spec['identity'] / 'contact'
    result, export, picture, runner = [read(q / name) for name in ['contact.json', 'export.json', 'picture-check.json', 'runner.json']]
    assert result['passed'] and export['passed'] and runner['code'] == 0
    assert runner['packageFilesUnchanged'] and runner['qaInputsUnchanged']
    assert export['samePictureBytes'] and picture['uniqueFrames'] > 20
    videos = {}
    for video in export['videos']:
        path = ROOT / video['path']
        assert sha(path) == video['sha256']
        videos[video['side']] = '/b2/contact/' + path.name
    cases.append({**spec, 'seconds': result['seconds'], 'videos': videos,
                  'proof': {'report': str((q / 'export.json').relative_to(ROOT)).replace('\\', '/'),
                            'sha256': sha(q / 'export.json'),
                            'samePictureBytes': True, 'picture': picture,
                            'candidateHashEmbeddedAtStart': export['candidateHashEmbeddedAtStart']}})

review = {'version': 'B2.2', 'status': 'human mix direction accepted, main-owner receiver packages pending',
          'creditsThisBatch': 0, 'cases': cases, 'recordedPackagesStillB21': True,
          'sameRulesInstance': True, 'perSideLoudnessNormalization': False,
          'extraFoleyOrMusic': False,
          'scope': 'Four representative paired native scenes; external audio candidate is explicitly labeled. Not a new main-project export or public release.'}
DEST.mkdir(parents=True, exist_ok=True)
(DEST / 'review.json').write_text(json.dumps(review, ensure_ascii=False, indent=2), encoding='utf-8')
QA.mkdir(parents=True, exist_ok=True)
(QA / 'review-build.json').write_text(json.dumps({'passed': True, 'review': str((DEST / 'review.json').relative_to(ROOT)).replace('\\', '/'),
                                                'sha256': sha(DEST / 'review.json'), 'cases': len(cases)}, indent=2), encoding='utf-8')
print(json.dumps({'passed': True, 'cases': len(cases), 'reviewSha256': sha(DEST / 'review.json')}, ensure_ascii=False))
