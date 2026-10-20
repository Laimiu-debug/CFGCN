"""Syntax validation without importing Blender into the system interpreter."""
from pathlib import Path
import ast,re,subprocess
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
for path in HERE.glob('*.py'):ast.parse(path.read_text(encoding='utf-8'),filename=str(path))
html=(HERE/'preview.html').read_text(encoding='utf-8')
script=re.search(r'<script type="module">(.*?)</script>',html,re.S).group(1)
temporary=ROOT/'.local/qa/shadow-actions-v2/preview-module.mjs';temporary.write_text(script,encoding='utf-8')
subprocess.run(['node','--check',str(temporary)],check=True)
subprocess.run(['node','--check',str(HERE/'serve.mjs')],check=True)
print('Python AST and both JavaScript modules passed syntax validation.')
