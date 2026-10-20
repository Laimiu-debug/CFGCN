"""Assemble rendered GLB frames with the installed OpenCV video encoder."""
from pathlib import Path
import json,cv2,hashlib
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
report=[]
for directory in (ROOT/'.local/qa/shadow-actions-v3/frames').iterdir():
    if not (directory/'timing.json').is_file():continue
    timing=json.loads((directory/'timing.json').read_text(encoding='utf-8'))
    out=HERE/directory.name/'new-actions.webm'
    writer=cv2.VideoWriter(str(out),cv2.VideoWriter_fourcc(*'VP80'),timing['fps'],(800,600))
    assert writer.isOpened(),'No installed VP8 encoder'
    for i in range(timing['frames']):
        frame=cv2.imread(str(directory/(f'{i:04d}.png')));assert frame is not None and frame.shape[:2]==(600,800)
        writer.write(frame)
    writer.release()
    reader=cv2.VideoCapture(str(out));count=0
    while True:
        ok,frame=reader.read()
        if not ok:break
        assert frame.shape[:2]==(600,800);count+=1
    reader.release();assert count==timing['frames'],(out,count,timing)
    report.append(dict(actor=directory.name,**timing,decoded_frames=count,bytes=out.stat().st_size,sha256=hashlib.sha256(out.read_bytes()).hexdigest()))
(ROOT/'.local/qa/shadow-actions-v3/films.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
