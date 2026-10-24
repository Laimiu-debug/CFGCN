"""Freeze the accepted mix as a small B2.2 source increment; never export a game."""
from pathlib import Path
import argparse
import datetime
import hashlib
import json

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'source/audio/godot-b-v2-r2'
BASE = ROOT / 'source/audio/godot-b-v2-r1/delivery.json'
PACKAGE = ROOT / 'packages/godot-game-audio'
QA = ROOT / '.local/qa/godot-audio-contact-v1'
p = argparse.ArgumentParser()
p.add_argument('--promote', action='store_true', help='Update the audio-owned current source after the recorded human listening decision')
a = p.parse_args()


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def rel(path):
    return path.relative_to(ROOT).as_posix()


def describe(path):
    return {'path': rel(path), 'sha256': sha(path), 'bytes': path.stat().st_size}


def write_new(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        assert path.read_bytes() == data, 'Existing freeze differs: ' + str(path)
    else:
        path.write_bytes(data)


assert sha(BASE) == 'f222e4c49b931648b871f7016a9a20478693b350eea42479de9804b1583c00af'
base = read(BASE)
decision_path = SOURCE / 'listening-decision.json'
decision = read(decision_path)
assert decision['humanMixDirectionAccepted'] and decision['newRunwayCredits'] == 0
review_path = ROOT / '.local/audio/godot-b-v2/contact/review.json'
review = read(review_path)
assert len(review['cases']) == 4
candidate_path = SOURCE / 'common/mixer.gd'
candidate_bytes = candidate_path.read_bytes()
# These replacements change only reporting labels. The approved playback code
# remains byte identical after normalizing the version string.
approved_bytes = candidate_bytes.replace(b'B2.2-contact-candidate', b'B2.2')
assert approved_bytes.replace(b'B2.2', b'B2.2-contact-candidate') == candidate_bytes
approved_path = SOURCE / 'runtime-package/common/mixer.gd'
write_new(approved_path, approved_bytes)
common = []
for row in base['common']:
    frozen = approved_path if Path(row['path']).name == 'mixer.gd' else ROOT / row['frozen']
    assert sha(ROOT / row['path']) in [row['sha256'], sha(frozen)], 'Concurrent canonical audio change'
    common.append({'path': row['path'], 'frozen': rel(frozen), 'sha256': sha(frozen), 'bytes': frozen.stat().st_size})

games = []
for old in base['games']:
    game = old['game']
    rows = []
    for row in old['runtimeFiles']:
        frozen = ROOT / row['frozen']
        assert sha(frozen) == row['sha256']
        if row['runtimePath'] == 'res://game_audio_b/mixer.gd':
            frozen = approved_path
        elif row['runtimePath'] == 'res://game_audio_b/library.gd':
            text = frozen.read_text(encoding='utf-8-sig')
            start = text.index('const META = ') + len('const META = ')
            meta, used = json.JSONDecoder().raw_decode(text[start:])
            meta['version'] = 'B2.2'
            meta['mixPolicy']['version'] = 'B2.2'
            meta.pop('manifestSha256')
            meta['manifestSha256'] = hashlib.sha256(json.dumps(meta, sort_keys=True).encode()).hexdigest()
            updated = text[:start] + json.dumps(meta, ensure_ascii=False, indent='\t') + text[start+used:]
            frozen = SOURCE / 'runtime-package' / game / 'game_audio_b/library.gd'
            write_new(frozen, updated.encode('utf-8'))
        rows.append({**row, 'frozen': rel(frozen), 'sha256': sha(frozen), 'bytes': frozen.stat().st_size})
    games.append({'game': game, 'resources': old['resources'], 'resourceBytes': old['resourceBytes'],
                  'autoload': old['autoload'], 'runtimeFiles': rows,
                  'changedRuntimePaths': [row['runtimePath'] for row in rows if row['sha256'] != next(r['sha256'] for r in old['runtimeFiles'] if r['runtimePath'] == row['runtimePath'])],
                  'newReceiverWindowsAcceptance': False})

evidence = []
for c in review['cases']:
    q = ROOT / '.local/qa/godot-audio-b-v2/packages' / c['game'] / c['identity'] / 'contact'
    data, run, export = [read(q / name) for name in ['contact.json', 'runner.json', 'export.json']]
    assert data['passed'] and run['code'] == 0 and run['packageFilesUnchanged'] and run['qaInputsUnchanged'] and export['samePictureBytes']
    assert sha(q / 'candidate-mixer-at-run.gd') == sha(candidate_path)
    evidence.append({'game': c['game'], 'identity': c['identity'], 'gameVersion': c['version'],
                     'result': describe(q / 'contact.json'), 'runner': describe(q / 'runner.json'),
                     'export': describe(q / 'export.json'), 'seconds': data['seconds'],
                     'cueCallbackReadonlyChecks': next(ch['details']['checks'] for ch in data['checks'] if ch['name'] == 'actual-audio-calls-preserve-full-current-rules'),
                     'candidateHashEmbeddedAtStart': export['candidateHashEmbeddedAtStart'],
                     'candidateExplicitlyExternalToThisPck': True})

delivery = {'version': 'B2.2', 'passed': True, 'date': datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'acceptanceScope': 'Accepted audio source increment and representative real-package paired QA; new main-owner receiver export and public release are separate.',
            'humanMixDirectionAccepted': True, 'humanListeningDecision': describe(decision_path),
            'windowsPackageAcceptance': False, 'websitePublication': False,
            'incrementalRunwayCalls': 0, 'incrementalRunwayCredits': 0, 'b2FamilyCredits': 2, 'priorMaterialBatchCredits': 27,
            'baseDelivery': describe(BASE), 'sourcePackage': 'packages/godot-game-audio', 'common': common, 'games': games,
            'approvedCandidate': describe(candidate_path), 'playbackCodeIdenticalAfterVersionLabelNormalization': True,
            'sameMusicPcmAndLoopMetadata': True, 'sameAllSoundResources': True, 'sameWukongVoice': True,
            'music': base['music'], 'representativeEvidence': evidence, 'review': describe(review_path),
            'adoptScript': 'scripts/audio-desktop-contact/adopt.py',
            'mainGameplayWrittenByAudioBatch': False, 'sharedDesktopUiWrittenByAudioBatch': False,
            'limits': ['New receiver PCK/ZIP must be bound to this delivery and tested by its actual identity.',
                       'M01 is not a shield-troop encounter or proof of the complete M01-M05 volume.',
                       'shield_contact is shield durability damage; normal attack_miss does not identify a block.',
                       'Xiyou stone/talisman releases are actual, but incoming contact attribution is not yet complete.',
                       'Legacy external Jin/Yin warnings use their existing fixed players; the first new warning comparison is qingmao.',
                       'Prior full natural loop proofs retain their old package identity; unchanged resources are inherited evidence.'],
            'storageGuard': 'H:/codex/storage-guard/latest.json'}
delivery_path = SOURCE / 'delivery.json'
assert not delivery_path.exists(), 'Never replace an immutable delivery'
delivery_path.write_text(json.dumps(delivery, ensure_ascii=False, indent=2), encoding='utf-8')
if a.promote:
    replacement = PACKAGE / 'mixer.audio-b22-new'
    assert not replacement.exists()
    replacement.write_bytes(approved_bytes)
    replacement.replace(PACKAGE / 'mixer.gd')
    current = {'version': 'B2.2', 'source': rel(SOURCE), 'qa': rel(QA), 'delivery': rel(delivery_path),
               'deliverySha256': sha(delivery_path), 'syncScript': 'scripts/audio-desktop-contact/adopt.py',
               'newReceiverWindowsAcceptance': False}
    replacement = PACKAGE / 'current.audio-b22-new'
    assert not replacement.exists()
    replacement.write_text(json.dumps(current, ensure_ascii=False, indent=2), encoding='utf-8')
    replacement.replace(PACKAGE / 'current.json')
print(json.dumps({'version': 'B2.2', 'deliverySha256': sha(delivery_path), 'promoted': a.promote,
                  'changedPerGame': {g['game']: g['changedRuntimePaths'] for g in games}}))
