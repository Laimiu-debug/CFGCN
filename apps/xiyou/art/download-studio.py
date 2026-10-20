"""Download one exact CDN asset already observed through the Studio UI."""
import hashlib,json,sys,urllib.parse,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
request=Path(sys.argv[1]);item=json.loads(request.read_text(encoding='utf-8'))
target=(ROOT/item['target']).resolve()
assert target.is_relative_to(ROOT/'apps/xiyou/art/source/raw')
url=urllib.parse.urlsplit(item['url']);assert url.scheme=='https' and url.hostname=='studio.cdn.tripo3d.com'
try:
    with urllib.request.urlopen(item['url'],timeout=90) as response:data=response.read(150000001)
    assert 100<len(data)<=150000000 and data[:4]==b'glTF'
    if target.exists():assert target.read_bytes()==data
    else:target.write_bytes(data)
    print(json.dumps({'name':target.name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}))
except Exception as error:
    print('Studio download failed: '+type(error).__name__,file=sys.stderr);sys.exit(1)
finally:request.unlink(missing_ok=True)
