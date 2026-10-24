"""Verify archived sources, final take provenance and native loop output."""
from pathlib import Path
import hashlib,json,wave
import numpy as np
ROOT=Path(__file__).resolve().parents[2];QA=ROOT/'.local/qa/desktop-audio-ab-v1'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def pcm(p):
    with wave.open(str(p)) as w:return np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').reshape(-1,2).astype(float)/32768
manifest=json.loads((ROOT/'source/audio/desktop-ab-v1/manifest.json').read_text(encoding='utf-8'))
review=json.loads((ROOT/'.local/audio/desktop-ab-v1/review.json').read_text(encoding='utf-8'))
assert manifest['credits']==27 and manifest['generationCount']==10 and manifest['automaticRegenerations']==0
checks=[]
for a in manifest['assets']:
    assert sha(ROOT/a['source'])==a['sourceSha256'] and sha(ROOT/a['runtime'])==a['sha256']
    checks.append({'asset':a['id'],'sourceAndRuntimeSha':True})
for case in review['cases']:
    directory=QA/case['take'];start=json.loads((directory/'start.json').read_text(encoding='utf-8'))
    assert start['mixerSha256']==sha(directory/'mixer.gd')==sha(ROOT/'scripts/audio-desktop-ab/mixer.gd')
    assert start['driverSha256']==sha(directory/'capture.gd')==sha(ROOT/'scripts/audio-desktop-ab/capture.gd')
    log=(directory/'console.log').read_text(encoding='utf-8')
    assert 'AB_CAPTURE_DONE' in log and 'ERROR:' not in log and 'WARNING:' not in log
    assert case['sourceShaUnchanged']
    for side in 'AB':assert sha(ROOT/case['versions'][side]['file'])==case['versions'][side]['sha256']
    checks.append({'flow':case['id'],'frozenDriverAndMixerSha':True,'nativeLogClean':True,'exportSha':True})
loop_result=json.loads((QA/'loops/native-loop-check.json').read_text(encoding='utf-8'))
assert loop_result['passed']
loop_pcm=[]
for a in manifest['assets']:
    if a['kind']!='music':continue
    source=pcm(ROOT/a['runtime']);recorded=pcm(QA/'loops'/(a['id']+'-native-loops.wav'))
    template=source[-9600:].mean(1);measurements=[]
    for start in [0,3*48000]:
        window=recorded[start:start+int(2.8*48000)].mean(1)
        n=1<<(len(window)+len(template)-1).bit_length()
        corr=np.fft.irfft(np.fft.rfft(window,n)*np.fft.rfft(template[::-1],n),n)
        pos=int(corr[len(template)-1:len(window)].argmax())+len(template)
        actual=window[pos:pos+24000];expected=source[a['loopStartFrame']:a['loopStartFrame']+len(actual)].mean(1)
        r=float(np.corrcoef(actual,expected)[0,1]);assert r>.995
        measurements.append({'nativeBoundarySample':start+pos,'postBoundaryCorrelation':r,'halfSecondRms':float(np.sqrt(np.mean(actual**2)))})
    loop_pcm.append({'id':a['id'],'nativeCrossings':measurements})
(QA/'final-verification.json').write_text(json.dumps({'passed':True,'credits':27,'generationCount':10,
    'checks':checks,'nativeLoopPcm':loop_pcm,'scope':'Technical archive, event provenance and native loop checks. User musical/material listening acceptance remains pending.'},indent=2),encoding='utf-8')
print(json.dumps({'passed':True,'sources':10,'actualGamePairs':4,'nativeLoopCrossings':4,'minimumLoopCorrelation':min(r['postBoundaryCorrelation'] for a in loop_pcm for r in a['nativeCrossings'])}))
