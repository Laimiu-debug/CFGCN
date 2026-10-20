"""Keep v2 checks intact and inspect the actual v3 native/GLB exports."""
from pathlib import Path
HERE=Path(__file__).resolve().parent
source=(HERE.parent/'shadow-actions-v2/check.py').read_text(encoding='utf-8').replace('shadow-actions-v2/assets.json','shadow-actions-v3/assets.json')
# Flight span is checked after the path has actually been evaluated.
source=source.replace('        assert max(path_span', '        if spec.get("weapon_flight"):assert path_span>h*.65,(record["id"],"staff did not leave hand",path_span)\n        assert max(path_span')
source=source.replace('        weapon_path=[];', '        detached=0;catch_error=0.\n        weapon_path=[];')
source=source.replace('            evaluated.to_mesh_clear()', '''            if spec.get("weapon_flight"):
                palm=marker(evaluated,working,parts["forearm.front"],record["surface_sockets"]["hand.front"]["uv"])
                grip=marker(evaluated,working,parts["weapon"],record["weapon_grip_surface_marker"])
                separation=(palm-grip).xz.length
                if .40<phase<.72 and separation>h*.20:detached+=1
                if phase<=.34 or phase>=.78:catch_error=max(catch_error,separation)
            evaluated.to_mesh_clear()''')
source=source.replace('        assert flight==0,', '        if spec.get("weapon_flight"):\n            assert detached>20,(record["id"],"staff stayed in palm",detached)\n            assert catch_error<h*.008,(record["id"],"staff missed catch",catch_error)\n        assert flight==0,')
source=source.replace('arm_depth_clearance=arm_depth_clearance))','arm_depth_clearance=arm_depth_clearance,staff_detached_samples=detached,staff_catch_error=catch_error))')
(HERE/'check.py').write_text(source,encoding='utf-8')
source=(HERE.parent/'shadow-actions-v2/render.py').read_text(encoding='utf-8')
(HERE/'render.py').write_text(source,encoding='utf-8')
source=(HERE.parent/'shadow-actions-v2/serve.mjs').read_text(encoding='utf-8').replace('8879','8880')
source=source.replace("'/catalog.json':", "'/director.mjs': path.join(art, 'director.mjs'),\n  '/catalog.json':")
source=source.replace("'.js': 'text/javascript',", "'.js': 'text/javascript',\n  '.mjs': 'text/javascript',")
source=source.replace("'.mp4': 'video/mp4',", "'.mp4': 'video/mp4',\n  '.webm': 'video/webm',")
(HERE/'serve.mjs').write_text(source,encoding='utf-8')
