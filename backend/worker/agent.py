"""qagent-worker - a standalone daemon that runs test jobs dispatched by the
QAgents orchestrator.

It uses outbound-only HTTP (poll/claim) so it works behind NAT/firewalls with no
inbound ports. Flow:

    register -> heartbeat loop -> claim job -> run script -> ship logs -> complete

Run it with:

    python -m worker.agent --orchestrator http://localhost:8000 --name devbox
"""

import argparse
import json
import os
import queue
import socket
import subprocess
import sys
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx

try:  # pragma: no cover - import shim for both `-m` and direct execution
    from worker.runner import SCRIPTS_DIR, list_tests, run_job
except ImportError:  # pragma: no cover
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from worker.runner import SCRIPTS_DIR, list_tests, run_job


def detect_gpu() -> str:
    """Best-effort GPU description via nvidia-smi."""
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"],
            capture_output=True,
            text=True,
            timeout=4,
        )
        if result.returncode == 0 and result.stdout.strip():
            return ", ".join(
                line.strip() for line in result.stdout.splitlines() if line.strip()
            )
    except (FileNotFoundError, subprocess.SubprocessError):
        pass
    return ""


class Worker:
    def __init__(
        self,
        orchestrator: str,
        name: str,
        capabilities: str,
        gpu: str,
        scripts_dir: Path,
        poll_interval: float,
        heartbeat_interval: float,
    ) -> None:
        self.orchestrator = orchestrator.rstrip("/")
        self.name = name
        self.capabilities = capabilities
        self.gpu = gpu or detect_gpu()
        self.scripts_dir = scripts_dir
        self.poll_interval = poll_interval
        self.heartbeat_interval = heartbeat_interval

        self.machine_id: Optional[int] = None
        self.token: str = ""
        self._current_job_id: Optional[int] = None
        self._state = {"status": "online"}
        self._stop = threading.Event()

        self.log_queue: "queue.Queue[Dict[str, str]]" = queue.Queue()
        self._client = httpx.Client(base_url=self.orchestrator, timeout=30.0)

    # ---------- lifecycle ----------

    def register(self) -> None:
        payload = {
            "name": self.name,
            "hostname": socket.gethostname(),
            "os": f"{sys.platform}",
            "gpu": self.gpu,
            "capabilities": self.capabilities,
        }
        res = self._client.post("/api/machines/register", json=payload)
        res.raise_for_status()
        data = res.json()
        self.machine_id = data["id"]
        self.token = data.get("token", "")
        print(
            f"[worker] registered as '{self.name}' (id={self.machine_id}) "
            f"with {self.orchestrator}"
        )

    def heartbeat_loop(self) -> None:
        while not self._stop.is_set():
            try:
                self._client.post(
                    f"/api/machines/{self.machine_id}/heartbeat",
                    json={
                        "token": self.token,
                        "status": self._state["status"],
                        "capabilities": self.capabilities,
                        "gpu": self.gpu,
                    },
                    timeout=10.0,
                )
            except httpx.HTTPError as exc:
                print(f"[worker] heartbeat failed: {exc}")
            self._stop.wait(self.heartbeat_interval)

    def log_ship_loop(self) -> None:
        while not self._stop.is_set():
            batch = self._drain_logs()
            if batch:
                self._ship_logs(batch)
            else:
                self._stop.wait(0.3)

    def _drain_logs(self) -> List[Dict[str, str]]:
        batch: List[Dict[str, str]] = []
        try:
            while len(batch) < 200:
                batch.append(self.log_queue.get_nowait())
        except queue.Empty:
            pass
        return batch

    def _ship_logs(self, batch: List[Dict[str, str]]) -> None:
        try:
            self._client.post(
                f"/api/worker/jobs/{self._current_job_id}/logs",
                json={"token": self.token, "logs": batch},
                timeout=15.0,
            )
        except httpx.HTTPError as exc:
            print(f"[worker] failed to ship {len(batch)} log lines: {exc}")

    def _flush_logs(self) -> None:
        batch = self._drain_logs()
        if batch:
            self._ship_logs(batch)

    # ---------- job execution ----------

    def claim_job(self) -> Optional[Dict[str, Any]]:
        try:
            res = self._client.post(
                "/api/worker/jobs/claim",
                json={"machine_id": self.machine_id, "token": self.token},
                timeout=20.0,
            )
        except httpx.HTTPError as exc:
            print(f"[worker] claim failed: {exc}")
            return None
        if res.status_code == 204 or not res.content:
            return None
        res.raise_for_status()
        return res.json()

    def execute(self, job: Dict[str, Any]) -> None:
        job_id = job["id"]
        label = job.get("test_id") or job.get("command") or "job"
        print(f"[worker] running job #{job_id} ({label})")
        self._state["status"] = "busy"
        self._current_job_id = job_id

        def on_log(stream: str, line: str) -> None:
            self.log_queue.put({"stream": stream, "line": line})
            # Print locally too, so the worker terminal shows live output.
            print(f"  [{job_id}] {line}")

        result = run_job(job, on_log, scripts_dir=self.scripts_dir)

        self._flush_logs()
        self._complete_job(job_id, result)
        self._state["status"] = "online"
        print(
            f"[worker] job #{job_id} finished: {result.get('status')} "
            f"(exit={result.get('exit_code')})"
        )

    def _complete_job(self, job_id: int, result: Dict[str, Any]) -> None:
        try:
            self._client.post(
                f"/api/worker/jobs/{job_id}/complete",
                json={
                    "token": self.token,
                    "status": result.get("status", "failed"),
                    "exit_code": result.get("exit_code"),
                    "result": result,
                },
                timeout=20.0,
            )
        except httpx.HTTPError as exc:
            print(f"[worker] failed to report completion for job #{job_id}: {exc}")

    # ---------- main loop ----------

    def run(self) -> None:
        self.register()
        threading.Thread(target=self.heartbeat_loop, daemon=True).start()
        threading.Thread(target=self.log_ship_loop, daemon=True).start()

        print("[worker] polling for jobs (Ctrl+C to stop) ...")
        try:
            while not self._stop.is_set():
                job = self.claim_job()
                if job:
                    self.execute(job)
                else:
                    self._stop.wait(self.poll_interval)
        except KeyboardInterrupt:
            print("\n[worker] shutting down")
        finally:
            self._state["status"] = "offline"
            try:
                self._client.post(
                    f"/api/machines/{self.machine_id}/heartbeat",
                    json={"token": self.token, "status": "offline"},
                    timeout=5.0,
                )
            except httpx.HTTPError:
                pass
            self._stop.set()
            self._client.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="QAgents remote test worker")
    parser.add_argument(
        "--orchestrator",
        default=os.getenv("QAGENT_ORCHESTRATOR", "http://localhost:8000"),
        help="Base URL of the orchestrator API",
    )
    parser.add_argument(
        "--name",
        default=os.getenv("QAGENT_NAME", socket.gethostname()),
        help="Machine name shown in the fleet console",
    )
    parser.add_argument(
        "--capabilities",
        default=os.getenv("QAGENT_CAPABILITIES", "python"),
        help="Comma-separated capability tags",
    )
    parser.add_argument(
        "--gpu",
        default=os.getenv("QAGENT_GPU", ""),
        help="GPU description (auto-detected via nvidia-smi when omitted)",
    )
    parser.add_argument(
        "--scripts-dir",
        default=os.getenv("QAGENT_SCRIPTS_DIR", str(SCRIPTS_DIR)),
        help="Directory containing test scripts",
    )
    parser.add_argument("--poll-interval", type=float, default=2.0)
    parser.add_argument("--heartbeat-interval", type=float, default=10.0)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    worker = Worker(
        orchestrator=args.orchestrator,
        name=args.name,
        capabilities=args.capabilities,
        gpu=args.gpu,
        scripts_dir=Path(args.scripts_dir),
        poll_interval=args.poll_interval,
        heartbeat_interval=args.heartbeat_interval,
    )
    print(f"[worker] advertised tests: {json.dumps(list_tests())}")
    worker.run()


if __name__ == "__main__":
    main()
