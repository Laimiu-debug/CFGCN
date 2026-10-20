"""v4 checks are handwritten source, never overwrite them with an older template."""
from pathlib import Path
import ast
HERE=Path(__file__).resolve().parent
for name in ['check.py','render.py','serve.mjs']:
    assert (HERE/name).is_file(),name
source=(HERE/'check.py').read_text(encoding='utf8')
assert 'arm_surface_markers' in source and 'grip_distance_ratio' in source
ast.parse(source)
print('Native elbow/contact checker retained; run check.py with Blender.')
