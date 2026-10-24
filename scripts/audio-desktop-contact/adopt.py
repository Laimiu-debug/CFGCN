"""Adopt a SHA-pinned audio increment without writing gameplay, settings or saves."""
from pathlib import Path
import argparse
import hashlib
import json
import shutil

ROOT = Path(__file__).resolve().parents[2]
p = argparse.ArgumentParser()
p.add_argument('--game', choices=['xiyou', 'shuihu'])
p.add_argument('--project', help='Optional main-owner project snapshot inside this workspace')
p.add_argument('--source', default='source/audio/godot-b-v2-r2')
p.add_argument('--qa', default='.local/qa/godot-audio-contact-v1')
p.add_argument('--dry-run', action='store_true')
a = p.parse_args()
assert not a.project or a.game, '--project requires one --game'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


source = (ROOT / a.source).resolve()
assert source.is_relative_to((ROOT / 'source/audio').resolve())
delivery_path = source / 'delivery.json'
delivery = json.loads(delivery_path.read_text(encoding='utf-8-sig'))
assert delivery['version'] == 'B2.2' and delivery['passed'] and delivery['humanMixDirectionAccepted']
baseline_path = ROOT / delivery['baseDelivery']['path']
assert sha(baseline_path) == delivery['baseDelivery']['sha256']
baseline = json.loads(baseline_path.read_text(encoding='utf-8-sig'))
games = [a.game] if a.game else ['xiyou', 'shuihu']
plans = []

# Validate every game's input before writing either game's two changed files.
for game in games:
    project = Path(a.project).resolve() if a.project else (ROOT / 'apps' / game / 'godot').resolve()
    assert project.is_relative_to(ROOT) and (project / 'project.godot').is_file()
    config = (project / 'project.godot').read_text(encoding='utf-8-sig')
    assert 'run/main_scene="res://shared_desktop_ui/desktop_boot.tscn"' in config
    assert 'CFGCNAudio="*res://game_audio_b/host.gd"' in config
    old = next(row for row in baseline['games'] if row['game'] == game)
    new = next(row for row in delivery['games'] if row['game'] == game)
    known = {row['runtimePath']: row for row in old['runtimeFiles']}
    writes = []
    for row in new['runtimeFiles']:
        relative = row['runtimePath'].removeprefix('res://')
        target = (project / relative).resolve()
        assert target.is_relative_to(project) and target.is_file(), str(target)
        frozen = (ROOT / row['frozen']).resolve()
        assert frozen.is_relative_to(ROOT) and sha(frozen) == row['sha256'], str(frozen)
        before = sha(target)
        assert before in [known[row['runtimePath']]['sha256'], row['sha256']], 'Concurrent audio edit: ' + str(target)
        if before != row['sha256']:
            assert relative in ['game_audio_b/mixer.gd', 'game_audio_b/library.gd']
            writes.append({'target': str(target), 'frozen': str(frozen), 'before': before, 'sha256': row['sha256']})
    plans.append({'game': game, 'project': str(project), 'writes': writes, 'filesValidated': len(new['runtimeFiles'])})

if not a.dry_run:
    for plan in plans:
        for row in plan['writes']:
            assert sha(Path(row['target'])) == row['before']
            # Never overwrite through a hard link to an immutable old snapshot.
            temporary = Path(row['target']).with_suffix('.audio-b22-new')
            assert not temporary.exists()
            shutil.copyfile(row['frozen'], temporary)
            assert sha(temporary) == row['sha256']
            temporary.replace(row['target'])
    qa = (ROOT / a.qa).resolve()
    assert qa.is_relative_to((ROOT / '.local/qa').resolve())
    qa.mkdir(parents=True, exist_ok=True)
    report = {'passed': True, 'version': 'B2.2', 'deliverySha256': sha(delivery_path), 'games': plans,
              'mainGameplayWritten': False, 'sharedUiWritten': False, 'settingsOrSavesWritten': False,
              'windowsExportOrPackageAcceptance': False, 'scope': 'Two audio code files per game; actual receiver package acceptance remains separate.'}
    suffix = '-' + a.game if a.project else ''
    (qa / ('audio-adoption' + suffix + '.json')).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')

print(json.dumps({'dryRun': a.dry_run, 'games': [{'game': r['game'], 'validated': r['filesValidated'], 'writes': len(r['writes'])} for r in plans]}, ensure_ascii=False))
