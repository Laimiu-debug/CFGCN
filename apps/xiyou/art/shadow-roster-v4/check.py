from pathlib import Path
exec(compile(Path(__file__).with_name("verify.py").read_text(encoding="utf-8"), str(Path(__file__).with_name("verify.py")), "exec"))
