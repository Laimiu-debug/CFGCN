"""Finish the independent Tripo seal-stone model; keep its raw source intact."""
import importlib.util
from pathlib import Path
path=Path(__file__).parent/"build_studio_party.py"
spec=importlib.util.spec_from_file_location("cfgcn_studio_party",path)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.build("seal_stone")
