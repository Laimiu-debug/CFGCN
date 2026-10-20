"""Verify media and package the editable action candidates with file hashes."""
from pathlib import Path
import hashlib,json,zipfile
import cv2
from PIL import Image

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
qa=ROOT/".local/qa/shadow-actions-v1"
records=json.loads((HERE/"manifest.json").read_text(encoding="utf-8"))["characters"]
checks=json.loads((qa/"assets.json").read_text(encoding="utf-8"))
assert checks["characters_checked"]==8 and checks["clips_checked"]==96
browser=[]
for record in records:
    for index,spec in enumerate(record["modules"][:3],start=1):
        name="final-browser-"+record["id"]+"-"+str(index)
        screenshot=qa/(name+".png");state=(qa/(name+".txt")).read_text(encoding="utf-8")
        assert screenshot.exists() and screenshot.stat().st_mtime>=(HERE/record["id"]/record["runtime"]).stat().st_mtime
        assert spec["label"] in state and "Value: 60, ID: phase" in state
        browser.append(dict(character=record["id"],clip=spec["clip"],phase=.6,screenshot=screenshot.name,
                            screenshot_sha256=hashlib.sha256(screenshot.read_bytes()).hexdigest()))
(qa/"browser.json").write_text(json.dumps(dict(poses=browser,count=len(browser),
    scope="24 final GLB skill pose/control checks, not full game or continuous-video acceptance",
    moving_cast="checked on Wukong; separate gait clock survives skill change",
    phase_evidence="browser-phase-continuity.txt",reduced_motion="initially paused",gameplay=False),ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
images=[]
for path in sorted(HERE.rglob("*.png")):
    with Image.open(path) as image:
        size=image.size;image.verify()
    images.append(dict(path=str(path.relative_to(HERE)).replace("\\","/"),size=list(size)))
blade=Image.open(HERE/"xiaobailong/unsheathed-sword-source.png")
assert blade.mode=="RGBA"
minimum_alpha,maximum_alpha=blade.getchannel("A").getextrema()
assert minimum_alpha==0 and maximum_alpha>=250
path=HERE/"wukong/exported-glb-actions.mp4"
capture=cv2.VideoCapture(str(path));assert capture.isOpened()
fps=capture.get(cv2.CAP_PROP_FPS);width=round(capture.get(cv2.CAP_PROP_FRAME_WIDTH));height=round(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
count=0
while True:
    ok,frame=capture.read()
    if not ok:break
    assert frame.shape[:2]==(720,960);count+=1
capture.release()
timing=json.loads((qa/"frames/wukong/timing.json").read_text(encoding="utf-8"))
assert count==timing["frames"] and abs(fps-24)<.01
media=dict(pngs_verified=len(images),images=images,video=dict(path=str(path.relative_to(HERE)).replace("\\","/"),
           bytes=path.stat().st_size,frames=count,fps=fps,width=width,height=height,duration=count/fps,
           source="actual exported GLB; not gameplay",clips=timing["clips"]))
(qa/"media.json").write_text(json.dumps(media,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")

files=[p for p in sorted(HERE.rglob("*")) if p.is_file() and "__pycache__" not in p.parts and p.name!="files.sha256.json"]
hashes={str(p.relative_to(HERE)).replace("\\","/"):hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
hash_path=HERE/"files.sha256.json";hash_path.write_text(json.dumps(hashes,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
files.append(hash_path);files.append(ROOT/"docs/xiyou-shadow-actions.md")
destination=ROOT/".local/exports/xiyou-shadow-actions-v1.zip";destination.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(destination,"w",zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
    for file in files:archive.write(file,str(file.relative_to(ROOT)).replace("\\","/"))
with zipfile.ZipFile(destination) as archive:
    assert archive.testzip() is None
    for name,digest in hashes.items():
        data=archive.read("apps/xiyou/art/shadow-actions-v1/"+name)
        assert hashlib.sha256(data).hexdigest()==digest
result=dict(path=str(destination.relative_to(ROOT)).replace("\\","/"),bytes=destination.stat().st_size,files=len(files),
            hashed_files=len(hashes),blends=8,glbs=8,full_body_actions=40,upper_actions=24,total_clips=96,
            runtime_bytes=sum(r["runtime_bytes"] for r in records),pngs=len(images),video=media["video"],
            source_inputs="v4 remains in repository; native blend images are packed",browser_skill_poses=len(browser),zip_verified=True)
(qa/"package.json").write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps(result,ensure_ascii=False,indent=2))
