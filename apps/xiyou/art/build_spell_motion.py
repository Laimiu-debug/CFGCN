"""Compatibility entry point for the complete accepted-party motion pipeline.

All five clip indices are retained. Rebuilding a base Studio character must
also reapply planted feet, weight shift and the shared stride/cadence profile.
"""
import importlib.util
from pathlib import Path

def spells(name):
    path=Path(__file__).parent/'build_party_motion.py'
    spec=importlib.util.spec_from_file_location('party_motion',path)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module.rebuild(name)

if __name__=='__main__':
    for name in ['monk','wukong','white_dragon']:spells(name)
