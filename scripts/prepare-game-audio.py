"""Prepare the approved local music and original SFX. Never regenerates cloud assets.

Requires numpy, scipy and ffmpeg (or the existing local imageio_ffmpeg package).
Original downloads and synthetic stems remain under .local/audio/ unchanged.
"""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import sys
import wave

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'apps/website/public/audio/ink-v1'
ART = ROOT / 'apps/website/art/audio/ink-v1'
LOCAL = ROOT / '.local/audio'
RATE = 48000
sys.path.insert(0, str(LOCAL / 'ink-trial-v1/tools'))
try:
    import imageio_ffmpeg
    FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
except ImportError:
    FFMPEG = shutil.which('ffmpeg')
if not FFMPEG:
    raise RuntimeError('ffmpeg is required; no paid generation will be performed')


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def decode(path):
    data = subprocess.check_output([
        FFMPEG, '-v', 'error', '-i', str(path), '-ar', str(RATE),
        '-ac', '2', '-f', 'f32le', '-'])
    return np.frombuffer(data, dtype='<f4').reshape(-1, 2).copy()


def save(name, samples):
    # Constant input gains are retained; no per-loop AGC or loudness pumping.
    pcm = np.rint(np.clip(samples, -1, 1) * 32767).astype('<i2')
    temp = PUBLIC / (name + '.wav')
    with wave.open(str(temp), 'wb') as out:
        out.setnchannels(2)
        out.setsampwidth(2)
        out.setframerate(RATE)
        out.writeframes(pcm.tobytes())
    sha = digest(temp)
    target = temp.with_name(f'{name}-{sha[:12]}.wav')
    temp.replace(target)
    return {'url': '/audio/ink-v1/' + target.name, 'sha256': sha,
            'bytes': target.stat().st_size, 'duration': len(pcm) / RATE,
            'sampleRate': RATE, 'frames': len(pcm), 'peak': float(np.max(np.abs(pcm))) / 32767}


def join_report(samples, start, end):
    # Report the actual wrap discontinuity against ordinary adjacent samples,
    # as well as 100ms energy on both sides. This does not certify taste/phrasing.
    delta = np.abs(samples[end - 1] - samples[start])
    around = np.concatenate([samples[end - 4800:end], samples[start:start + 4800]])
    adjacent = np.abs(np.diff(around, axis=0))
    rms = lambda x: float(np.sqrt(np.mean(x.astype(np.float64) ** 2)))
    return {'wrapDelta': float(np.max(delta)),
            'nearbyAdjacentP99': float(np.quantile(adjacent, .99)),
            'rmsBefore100ms': rms(samples[end - 4800:end]),
            'rmsAfter100ms': rms(samples[start:start + 4800]),
            'zeroFramesAtJoin': int(np.sum(np.all(around == 0, axis=1)))}


PUBLIC.mkdir(parents=True, exist_ok=True)
ART.mkdir(parents=True, exist_ok=True)
music = {}
edits = {}
# Periods follow the commissioned nominal pulse. Natural rubato is retained;
# these are edited local audition candidates, not a claim of measured metronomy.
recipes = {
    'menu': ('01-menu', .20, 12 * 60 / 68, 1.60),
    'exploration': ('02-exploration', .30, 32 * 60 / 88, 1.36),
    'battle': ('03-battle', .25, 48 * 60 / 118, 1.02),
}
for name, (source_id, head, period, overlap) in recipes.items():
    source = LOCAL / f'runway-ink-v1/music/{source_id}.mp3'
    original = LOCAL / f'runway-ink-v1/source/originals/{source_id}.mp3'
    x = decode(source)
    s, p, f = (round(v * RATE) for v in (head, period, overlap))
    if s + p + f > len(x):
        raise ValueError('Loop recipe exceeds original source: ' + name)
    t = np.linspace(0, 1, f, dtype=np.float64)[:, None]
    blend = .5 - .5 * np.cos(np.pi * t)
    cross = x[s + p:s + p + f] * (1 - blend) + x[s:s + f] * blend
    # Intro plays once. The last crossfade frame joins the immediately following
    # source frame at loopStart; repeating does not cut an attack or add silence.
    edited = np.concatenate([x[:s + p], cross]).astype(np.float32)
    start, end = s + f, s + p + f
    asset = save(name, edited)
    asset.update(loopStart=start / RATE, loopEnd=end / RATE,
                 loopStartFrame=start, loopEndFrame=end, periodFrames=p)
    music[name] = asset
    edits[name] = {
        'source': str(source.relative_to(ROOT)).replace('\\', '/'),
        'sourceSha256': digest(source), 'originalSha256': digest(original),
        'headFrame': s, 'periodFrames': p, 'crossfadeFrames': f,
        'method': 'one-time intro, raised-cosine tail/head overlap, PCM sample loop',
        'joinQA': join_report(edited, start, end),
    }
    if name == 'menu':
        audition = np.concatenate([edited, edited[start:end], edited[start:end]])
        target = LOCAL / 'runway-ink-v1/music/01-menu-loop-audition.wav'
        with wave.open(str(target), 'wb') as out:
            out.setnchannels(2)
            out.setsampwidth(2)
            out.setframerate(RATE)
            out.writeframes(np.rint(audition * 32767).astype('<i2').tobytes())

environment = {}
for name in ['wind', 'water', 'birds']:
    source = LOCAL / f'ink-trial-v1/source/stems/env-{name}.wav'
    samples = decode(source)
    asset = save('environment-' + name, samples)
    asset.update(loopStart=0, loopEnd=len(samples) / RATE)
    environment[name] = asset
    edits['environment-' + name] = {'sourceSha256': digest(source),
                                    'joinQA': join_report(samples, 0, len(samples))}

effects = {}
for source in sorted((LOCAL / 'ink-trial-v1/effects').glob('*.mp3')):
    sha = digest(source)
    target = PUBLIC / f'{source.stem}-{sha[:12]}.mp3'
    shutil.copyfile(source, target)
    effects[source.stem] = {'url': '/audio/ink-v1/' + target.name,
                            'sha256': sha, 'bytes': target.stat().st_size}

manifest = {'version': 1, 'date': '2026-10-20', 'music': music,
            'environment': environment, 'effects': effects}
(ART / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(ART / 'loop-edit.json').write_text(json.dumps(edits, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
brief = json.loads((LOCAL / 'runway-ink-v1/source/brief.json').read_text(encoding='utf-8'))
(ART / 'source.json').write_text(json.dumps({
    'date': '2026-10-20', 'provider': 'Runway', 'generations': 3,
    'creditsPreviouslyUsed': 12, 'additionalCreditsForIntegration': 0,
    'musicBriefs': brief['music'],
    'effects': 'Existing original locally synthesized ink-trial-v1; no third-party samples.',
    'originals': '.local/audio/runway-ink-v1/source/originals/',
    'editableEffects': '.local/audio/ink-trial-v1/source/compose.py',
    'acceptance': 'Local integration candidate; user listening and hardware acceptance remain separate.',
}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'assets': len(music) + len(environment) + len(effects),
                  'music': music, 'loopQA': {k: v['joinQA'] for k, v in edits.items()},
                  'totalBytes': sum(p.stat().st_size for p in PUBLIC.iterdir() if p.is_file())}, indent=2))
