#!/usr/bin/env python3
"""
Run Messenger backend in a self-restarting 24/7 loop.

Usage:
  python3 keep_backend_alive.py
"""

from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

# ---- EDIT THESE VALUES FOR YOUR VPS ----
PROJECT_DIR = Path("/home/ubuntu/messenger")
PORT = "3000"
CORS_ORIGINS = "http://YOUR_SERVER_IP:8080,https://YOUR_DOMAIN"
# ----------------------------------------

BACKEND_COMMAND = ["npm", "run", "start", "--workspace=apps/server"]
RESTART_DELAY_SECONDS = 2
MAX_RESTART_DELAY_SECONDS = 30

LOG_DIR_NAME = "logs"
OUT_LOG_NAME = "backend.out.log"
ERR_LOG_NAME = "backend.err.log"

stop_requested = False
child_process: subprocess.Popen[bytes] | None = None


def now_utc() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")


def log(message: str) -> None:
    print(f"[{now_utc()} UTC] {message}", flush=True)


def handle_stop_signal(signum: int, _frame: object) -> None:
    global stop_requested
    stop_requested = True
    log(f"Stop signal received: {signum}")


def stop_child_process() -> None:
    global child_process
    if child_process is None:
        return

    if child_process.poll() is not None:
        return

    child_process.terminate()
    try:
        child_process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        child_process.kill()
        child_process.wait(timeout=5)


def main() -> int:
    global child_process

    if not PROJECT_DIR.exists():
        log(f"PROJECT_DIR does not exist: {PROJECT_DIR}")
        return 1

    log_dir = PROJECT_DIR / LOG_DIR_NAME
    log_dir.mkdir(parents=True, exist_ok=True)
    out_log_path = log_dir / OUT_LOG_NAME
    err_log_path = log_dir / ERR_LOG_NAME

    signal.signal(signal.SIGINT, handle_stop_signal)
    signal.signal(signal.SIGTERM, handle_stop_signal)

    restart_delay = RESTART_DELAY_SECONDS

    log(f"Supervisor started in: {PROJECT_DIR}")
    log(f"Backend command: {' '.join(BACKEND_COMMAND)}")
    log(f"Logs: {out_log_path} / {err_log_path}")

    while not stop_requested:
        env = os.environ.copy()
        env["NODE_ENV"] = "production"
        env["PORT"] = PORT
        env["CORS_ORIGINS"] = CORS_ORIGINS

        with out_log_path.open("ab") as out_log, err_log_path.open("ab") as err_log:
            log("Starting backend...")
            child_process = subprocess.Popen(
                BACKEND_COMMAND,
                cwd=str(PROJECT_DIR),
                env=env,
                stdout=out_log,
                stderr=err_log,
            )

            while child_process.poll() is None and not stop_requested:
                time.sleep(1)

            if stop_requested:
                stop_child_process()
                break

            exit_code = child_process.returncode

        log(f"Backend exited with code {exit_code}. Restart in {restart_delay}s.")
        time.sleep(restart_delay)
        restart_delay = min(restart_delay * 2, MAX_RESTART_DELAY_SECONDS)

    stop_child_process()
    log("Supervisor stopped.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
