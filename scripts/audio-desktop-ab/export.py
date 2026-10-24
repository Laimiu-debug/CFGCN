"""Export native simultaneous A/B bus recordings; never add music or foley."""
from pathlib import Path
import hashlib,json,re,subprocess,sys,wave
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'.local/audio/ink-trial-v1/tools'))
import imageio_ffmpeg
FF=imageio_ffmpeg.get_ffmpeg_exe()
QA=ROOT/'.local/qa/desktop-audio-ab-v1';DEST=ROOT/'.local/audio/desktop-ab-v1'
TEMP=Path('H:/codex/tmp/cfgcn-audio-ab-v1')
CASES=[('XY-A','XY-A-finalmix',55),('XY-B','XY-B-finalmix',43),
       ('SH-A','SH-A-finalmix',None),('SH-B','SH-B-finalmix',None)]
def ff(args):
    p=subprocess.run([FF,'-nostdin','-hide_banner',*map(str,args)],capture_output=True)
    if p.returncode:raise RuntimeError(p.stderr.decode('utf-8','replace')[-2000:])
    return p
def sha(path):
    h=hashlib.sha256()
    with open(path,'rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
    return h.hexdigest()
def measure(path):
    r=ff(['-i',path,'-af','loudnorm=I=-21:TP=-2.5:LRA=9:print_format=json','-f','null','-'])
    return json.loads(re.findall(r'\{\s*"input_i".*?\}',r.stderr.decode(),re.S)[-1])
def video_hash(path):
    return hashlib.sha256(ff(['-i',path,'-map','0:v:0','-f','framemd5','-']).stdout).hexdigest()
def pcm_hash(path):return hashlib.sha256(ff(['-i',path,'-map','0:a:0','-f','s16le','-']).stdout).hexdigest()
def native_sync(media,start):
    moment=start+3
    with wave.open(str(media/'AB-A.wav')) as w:
        rate=w.getframerate();aa=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').reshape(-1,2).mean(1)
    a=aa[int(moment*rate):int((moment+2)*rate)]
    b=np.frombuffer(ff(['-i',media/'raw.avi','-ss',moment-.1,'-t','2.2','-vn','-f','f32le','-ac','2','-ar',rate,'-']).stdout,dtype='<f4').reshape(-1,2).mean(1)
    assert np.max(np.abs(a))>50
    n=1<<(len(a)+len(b)-1).bit_length()
    correlation=np.fft.irfft(np.fft.rfft(b,n)*np.fft.rfft(a[::-1],n),n)
    offset=int(correlation[len(a)-1:len(b)].argmax())
    coefficient=float(np.corrcoef(a,b[offset:offset+len(a)])[0,1])
    delay=offset-round(.1*rate)
    print(json.dumps({'syncCase':media.name,'offsetSamples':delay,'correlation':coefficient}),flush=True)
    assert abs(delay)<=rate*.1 and coefficient>.98
    return {'nativeMasterVersusRecordedBusOffsetSamples':delay,'sampleRate':rate,'correlation':coefficient,
            'exportAudioTrimCorrectionSeconds':-delay/rate}
DEST.mkdir(parents=True,exist_ok=True)
report=[]
for flow,label,limit in CASES:
    case=QA/label;media=TEMP/label
    capture=json.loads((case/'capture.json').read_text(encoding='utf-8'))
    if 'SCRIPT ERROR' in (case/'console.log').read_text(encoding='utf-8'):raise RuntimeError('Invalid take '+label)
    start=capture['startFrame']/30
    synchronization=native_sync(media,start)
    audio_start=start+synchronization['exportAudioTrimCorrectionSeconds']
    duration=min(capture['seconds'],limit or capture['seconds'])
    duration=int(duration*30)/30
    # Record taps begin with native frame zero, before the game loads. Keep the
    # exact original taps as lossless FLAC and verify decoded PCM byte equality.
    archived={};original={};cuts={}
    for side in 'AB':
        original[side]=media/('AB-'+side+'.wav')
        archived[side]=case/('native-'+side+'.flac')
        ff(['-y','-i',original[side],'-c:a','flac',archived[side]])
        assert pcm_hash(original[side])==pcm_hash(archived[side])
        cuts[side]=media/('trim-'+side+'.wav')
        if audio_start>=0:filter=f'atrim=start={audio_start}:duration={duration},asetpts=PTS-STARTPTS'
        else:filter=f'adelay={-audio_start*1000}:all=1,atrim=duration={duration},asetpts=PTS-STARTPTS'
        ff(['-y','-i',original[side],'-af',filter,'-c:a','pcm_s16le',cuts[side]])
    levels={s:measure(cuts[s]) for s in 'AB'}
    target=min(-21.0,*[float(m['input_i'])-2.5-float(m['input_tp']) for m in levels.values()])
    video=media/'review-video.mp4'
    ff(['-y','-i',media/'raw.avi','-ss',start,'-t',duration,'-an','-c:v','libx264',
        '-preset','fast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',video])
    pair={};vhash=[]
    for side in 'AB':
        gain=target-float(levels[side]['input_i']);audio=media/('review-'+side+'.m4a')
        # Identical short edge fades and a documented constant gain only.
        ff(['-y','-i',cuts[side],'-af',f'volume={gain}dB,afade=t=in:d=0.02,afade=t=out:st={duration-.04}:d=0.04',
            '-c:a','aac','-b:a','256k',audio])
        final=DEST/(flow+'-'+side+'.mp4')
        ff(['-y','-i',video,'-i',audio,'-map','0:v:0','-map','1:a:0','-c','copy','-movflags','+faststart',final])
        vhash.append(video_hash(final));encoded=measure(final)
        assert float(encoded['input_tp'])<-.5
        pair[side]={'file':final.relative_to(ROOT).as_posix(),'sha256':sha(final),'bytes':final.stat().st_size,
            'inputLufs':float(levels[side]['input_i']),'fixedGainDb':round(gain,4),
            'exportLufs':float(encoded['input_i']),'exportTruePeakDb':float(encoded['input_tp']),
            'nativeLossless':archived[side].relative_to(ROOT).as_posix(),'nativeSha256':sha(archived[side]),
            'nativeDecodedPcmSha256':pcm_hash(archived[side])}
    assert vhash[0]==vhash[1]
    assert abs(pair['A']['exportLufs']-pair['B']['exportLufs'])<.6
    events=json.loads((case/'events.json').read_text(encoding='utf-8'))
    row={'id':flow,'take':label,'duration':duration,'nativeStartFrame':capture['startFrame'],
        'audioVideoSynchronization':synchronization,
        'nativeTrimSeconds':start,'sameNativeTimeline':True,'identicalDecodedVideoSha256':vhash[0],
        'loudnessTargetLufs':round(target,2),'versions':pair,'events':events['events'],
        'final':capture['final'],'sourceShaUnchanged':capture['sourceShaUnchanged'],
        'processing':'Native bus PCM only; fixed gain and identical 20/40ms edge fades; AAC mux. No music/foley inserted after capture.',
        'captureScope':'Actual Godot GPU render and normal rules at fixed 30 FPS; not a real-time performance benchmark.'}
    (case/'export.json').write_text(json.dumps(row,ensure_ascii=False,indent=2),encoding='utf-8')
    ff(['-y','-i',video,'-ss',min(20,duration/2),'-frames:v','1',DEST/(flow+'-poster.jpg')])
    report.append(row);print(json.dumps({'id':flow,'duration':duration,'levels':{s:pair[s]['exportLufs'] for s in 'AB'},'videoIdentical':True}),flush=True)
(DEST/'review.json').write_text(json.dumps({'credits':27,'cases':report},ensure_ascii=False,indent=2),encoding='utf-8')
(QA/'export-verification.json').write_text(json.dumps({'passed':True,'pairs':4,'videoEquality':True,
    'nativePcmLossless':True,'maxLoudnessDifference':max(abs(r['versions']['A']['exportLufs']-r['versions']['B']['exportLufs']) for r in report),
    'manifest':str(DEST/'review.json')},indent=2),encoding='utf-8')
