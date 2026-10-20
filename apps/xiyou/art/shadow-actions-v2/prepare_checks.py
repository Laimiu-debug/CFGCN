"""Specialize the existing exported-surface inspection for v2 actions."""
from pathlib import Path
HERE=Path(__file__).resolve().parent
source=(HERE.parent/'shadow-actions-v1/check.py').read_text(encoding='utf-8')
source=source.replace('motion=0.','motion=0.;intentional_flight=0')
source=source.replace('if side=="back" and spec["clip"]!="DodgeBack":sole_error=max(sole_error,abs(sole))', 'air=spec.get("airborne",{});in_air=air.get("start",2)<phase<air.get("end",-1)\n                if side=="back" and spec["clip"]!="DodgeBack" and not spec.get("footwork") and not in_air:sole_error=max(sole_error,abs(sole))\n                if side=="back" and air and not in_air:sole_error=max(sole_error,abs(sole))')
source=source.replace('if min(soles)>.025*h:flight+=1','if min(soles)>.025*h:\n                if in_air:intentional_flight+=1\n                else:flight+=1')
source=source.replace('assert flight==0,','if spec.get("airborne"):assert intentional_flight>3,(record["id"],spec["clip"],"missing intended leap")\n        assert flight==0,')
source=source.replace('flight_samples=flight))','flight_samples=flight,intentional_air_samples=intentional_flight))')
source=source.replace('full_action_samples=605,moving_cast_samples=111','full_action_samples=121*len(record["modules"]),moving_cast_samples=37*sum(bool(s["upper_clip"]) for s in record["modules"])')
source=source.replace('shadow-actions-v1/assets.json','shadow-actions-v2/assets.json')
source=source.replace('["foot.front","foot.back","weapon","forearm.back"]','["foot.front","foot.back","weapon","forearm.back","upper_arm.back","upper_arm.front","forearm.front","body"]')
source=source.replace('weapon_path=[];hand_path=[];','arm_depth_clearance=1e9\n        weapon_path=[];hand_path=[];')
source=source.replace('            soles=[]','            body_y=float(visible(evaluated,working,parts["body"])[:,1].min())\n            for name in ["upper_arm.back","forearm.back","upper_arm.front","forearm.front"]:\n                arm_y=float(visible(evaluated,working,parts[name])[:,1].max())\n                arm_depth_clearance=min(arm_depth_clearance,body_y-arm_y)\n                assert body_y-arm_y>.003,(record["id"],spec["clip"],name,"torso occludes arm",body_y-arm_y)\n            soles=[]')
source=source.replace('intentional_air_samples=intentional_flight))','intentional_air_samples=intentional_flight,arm_depth_clearance=arm_depth_clearance))')
(HERE/'check.py').write_text(source,encoding='utf-8')
print('Prepared exported-model inspection for v2; original v1 remains unchanged.')
