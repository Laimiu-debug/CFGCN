"""Check source syntax without importing bpy into the system interpreter."""
from pathlib import Path
import ast,re,subprocess
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
for path in HERE.glob('*.py'):ast.parse(path.read_text(encoding='utf-8'),filename=str(path))
html=(HERE/'preview.html').read_text(encoding='utf-8')
script=re.search(r'<script type="module">(.*?)</script>',html,re.S).group(1)
temporary=ROOT/'.local/qa/shadow-actions-v3/preview-module.mjs';temporary.write_text(script,encoding='utf-8')
for path in [temporary,*HERE.glob('*.mjs'),HERE/'loadout-ui.js']:
    subprocess.run(['node','--check',str(path)],check=True)
print('Python AST, generated viewer, server, scheduler and UI passed syntax checks.')
