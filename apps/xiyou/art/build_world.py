"""Canonical entry point; never restore the former sphere-wall blockout."""
import importlib.util
from pathlib import Path

def build():
    spec=importlib.util.spec_from_file_location('painted_world',Path(__file__).parent/'build_painted_world.py')
    world=importlib.util.module_from_spec(spec);spec.loader.exec_module(world)
    return world.build('mountain_world')

if __name__=='__main__':
    build()
