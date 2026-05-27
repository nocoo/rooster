#!/usr/bin/env bash
set -euo pipefail

# dev-all.sh — Start bridge + server + client with lifecycle management.
# Bridge is started first; if it fails quickly, we abort.
# If it exits 0 (reusing existing bridge), we continue without owning a pid.
# On exit, we kill any bridge we started.

BRIDGE_PID=""

cleanup() {
  if [[ -n "$BRIDGE_PID" ]] && kill -0 "$BRIDGE_PID" 2>/dev/null; then
    kill "$BRIDGE_PID" 2>/dev/null || true
    wait "$BRIDGE_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

# Start bridge in background
bun run dev:bridge &
BRIDGE_PID=$!

# Give bridge a moment to start or fail
sleep 1

if ! kill -0 "$BRIDGE_PID" 2>/dev/null; then
  # Bridge exited — check if it was success (reuse) or failure
  set +e
  wait "$BRIDGE_PID" 2>/dev/null
  EXIT_CODE=$?
  set -e
  BRIDGE_PID=""
  if [[ $EXIT_CODE -ne 0 ]]; then
    echo "ERROR: Bridge failed to start (exit $EXIT_CODE). Aborting." >&2
    exit 1
  fi
  # Exit 0 means bridge is already running (reused), continue without owning pid
  echo "Bridge already running (reused). Starting server + client..."
else
  echo "Bridge started (pid $BRIDGE_PID). Starting server + client..."
fi

# Run server + client in foreground (no exec — keep trap alive)
set +e
bun run --filter '*' dev
DEV_EXIT=$?
set -e
exit "$DEV_EXIT"
