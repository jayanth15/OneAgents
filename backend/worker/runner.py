"""Test-script catalog and subprocess runner used by qagent-worker.

A worker resolves a logical ``test_id`` to a Python script in ``scripts/`` and
runs it, streaming stdout/stderr back through the ``on_log`` callback. Ad-hoc
shell commands are supported too, which is what powers the "run hello world on
machine X" flow.
"""

import shlex
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

SCRIPTS_DIR = Path(__file__).resolve().parent / "scripts"

# Logical test id -> script metadata. Extend this as real vLLM/Triton tests land.
TEST_CATALOG: Dict[str, Dict[str, Any]] = {
    "hello_world": {
        "script": "hello_world.py",
        "description": "Print a hello-world greeting (smoke test)",
        "timeout_s": 60,
    },
}

LogCallback = Callable[[str, str], None]


def list_tests() -> List[Dict[str, Any]]:
    """Return the worker's advertised test catalog."""
    tests = []
    for test_id, spec in TEST_CATALOG.items():
        tests.append({
            "test_id": test_id,
            "description": spec.get("description", ""),
            "timeout_s": spec.get("timeout_s", 300),
        })
    return tests


def build_command(
    test_id: str,
    command: str,
    params: Optional[Dict[str, Any]],
    scripts_dir: Path = SCRIPTS_DIR,
) -> Tuple[Optional[List[str]], Optional[str]]:
    """Resolve a job spec to an argv list, or return an error string."""
    if test_id:
        spec = TEST_CATALOG.get(test_id)
        if not spec:
            known = ", ".join(TEST_CATALOG) or "(none)"
            return None, f"Unknown test_id '{test_id}'. Known tests: {known}"
        script = Path(scripts_dir) / spec["script"]
        if not script.exists():
            return None, f"Script not found for '{test_id}': {script}"
        argv = [sys.executable, str(script)]
        for key, value in (params or {}).items():
            argv += [f"--{key}", str(value)]
        return argv, None

    if command:
        try:
            parts = shlex.split(command)
        except ValueError as exc:
            return None, f"Invalid command: {exc}"
        # Resolve a bare python interpreter to the worker's interpreter so
        # ad-hoc commands work even when `python` is not on PATH.
        if parts and parts[0] in ("python", "python3", "py"):
            parts[0] = sys.executable
        return parts, None

    return None, "No test_id or command provided"


def run_job(
    job: Dict[str, Any],
    on_log: LogCallback,
    *,
    scripts_dir: Path = SCRIPTS_DIR,
    default_timeout_s: int = 300,
) -> Dict[str, Any]:
    """Execute a job and return a structured result dict."""
    test_id = (job.get("test_id") or "").strip()
    command = (job.get("command") or "").strip()
    params = job.get("params") or {}
    if isinstance(params, str):
        import json
        try:
            params = json.loads(params)
        except (ValueError, TypeError):
            params = {}

    timeout_s = int(job.get("timeout_s") or default_timeout_s or 300)

    argv, error = build_command(test_id, command, params, scripts_dir)
    if error or argv is None:
        on_log("system", f"error: {error}")
        return {
            "status": "failed",
            "exit_code": 127,
            "duration_s": 0.0,
            "error": error,
        }

    started = time.time()
    on_log("system", f"$ {' '.join(argv)}")
    try:
        proc = subprocess.Popen(
            argv,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            text=True,
            bufsize=1,
            cwd=str(scripts_dir),
        )
    except FileNotFoundError as exc:
        on_log("system", f"error: {exc}")
        return {
            "status": "failed",
            "exit_code": 127,
            "duration_s": 0.0,
            "error": str(exc),
        }

    def _pump() -> None:
        if proc.stdout is None:
            return
        for raw_line in proc.stdout:
            on_log("stdout", raw_line.rstrip("\n"))

    reader = threading.Thread(target=_pump, daemon=True)
    reader.start()

    timed_out = False
    try:
        proc.wait(timeout=timeout_s)
    except subprocess.TimeoutExpired:
        timed_out = True
        on_log("system", f"timeout after {timeout_s}s - killing process")
        proc.kill()
        proc.wait()

    reader.join(timeout=5)
    duration = round(time.time() - started, 3)

    if timed_out:
        status = "timeout"
    elif proc.returncode == 0:
        status = "passed"
    else:
        status = "failed"

    on_log("system", f"process exited with code {proc.returncode} in {duration}s")
    return {
        "status": status,
        "exit_code": proc.returncode,
        "duration_s": duration,
        "script": argv[1] if len(argv) > 1 else "",
    }
