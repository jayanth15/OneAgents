"""Hello-world smoke test executed by qagent-worker.

Usage:
    python hello_world.py --name World --steps 3
"""

import argparse
import json
import os
import platform
import socket
import time


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="QAgents hello-world smoke test")
    parser.add_argument("--name", default="World", help="Name to greet")
    parser.add_argument("--steps", type=int, default=3, help="Progress steps to emit")
    parser.add_argument("--delay", type=float, default=0.4, help="Delay between steps (s)")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    host = socket.gethostname()

    print("Hello from the QAgents test runner!")
    print(f"Machine: {host} ({platform.system()} {platform.release()})")
    print(f"Python : {platform.python_version()}")
    print(f"PID    : {os.getpid()}")
    print("-" * 48)

    for step in range(1, max(1, args.steps) + 1):
        print(f"[{step}/{args.steps}] running step on target '{args.name}' ...")
        time.sleep(max(0.0, args.delay))

    greeting = f"Hello, {args.name}!"
    print("-" * 48)
    print(greeting)
    print("RESULT: " + json.dumps({"greeting": greeting, "host": host}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
