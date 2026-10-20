"""Download an already-observed Studio CDN model; never print signed URLs."""
import hashlib
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
request = Path(sys.argv[1])
item = json.loads(request.read_text(encoding="utf-8"))
parsed = urllib.parse.urlsplit(item["url"])
assert parsed.scheme == "https" and parsed.hostname == "studio.cdn.tripo3d.com"
target = (ROOT / item["target"]).resolve()
assert target.is_relative_to(ROOT / "apps/website/art/source/raw")
try:
    with urllib.request.urlopen(item["url"], timeout=90) as response:
        data = response.read(150_000_001)
    assert 100 < len(data) <= 150_000_000 and data[:4] == b"glTF"
    if target.exists():
        assert target.read_bytes() == data, "An immutable Studio source already exists"
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    print(json.dumps({"name": target.name, "bytes": len(data),
                      "sha256": hashlib.sha256(data).hexdigest()}))
except Exception as error:
    print("Studio download failed: " + type(error).__name__, file=sys.stderr)
    sys.exit(1)
finally:
    request.unlink(missing_ok=True)
