#!/usr/bin/env bash
set -euo pipefail

# Integration test for start-bridge.sh single-instance / stale socket handling.
# Uses dry-run mode to verify logic without spawning processes.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BRIDGE_SCRIPT="$SCRIPT_DIR/start-bridge.sh"
TMPDIR_TEST="$(mktemp -d)"
SOCK="$TMPDIR_TEST/test-bridge.sock"
PASS=0
FAIL=0

cleanup() {
  [[ -n "${LISTENER_PID:-}" ]] && kill "$LISTENER_PID" 2>/dev/null || true
  rm -rf "$TMPDIR_TEST"
}
trap cleanup EXIT

assert_contains() {
  local label="$1" output="$2" expected="$3"
  if echo "$output" | grep -qF "$expected"; then
    PASS=$((PASS + 1))
    echo "  ✓ $label"
  else
    FAIL=$((FAIL + 1))
    echo "  ✗ $label"
    echo "    expected to contain: $expected"
    echo "    got: $(echo "$output" | head -5)"
  fi
}

assert_exit_code() {
  local label="$1" actual="$2" expected="$3"
  if [[ "$actual" == "$expected" ]]; then
    PASS=$((PASS + 1))
    echo "  ✓ $label"
  else
    FAIL=$((FAIL + 1))
    echo "  ✗ $label (exit $actual, expected $expected)"
  fi
}

start_listener() {
  python3 -c "
import socket, os, sys, time
s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
s.bind(sys.argv[1])
s.listen(1)
sys.stdout.write('ready\n')
sys.stdout.flush()
while True:
    conn, _ = s.accept()
    conn.close()
" "$SOCK" &
  LISTENER_PID=$!
  # Wait for listener to be ready
  sleep 0.5
}

stop_listener() {
  if [[ -n "${LISTENER_PID:-}" ]]; then
    kill "$LISTENER_PID" 2>/dev/null || true
    wait "$LISTENER_PID" 2>/dev/null || true
    LISTENER_PID=""
  fi
  rm -f "$SOCK"
}

# Provide a dummy bridge script so resolution succeeds
DUMMY_BRIDGE="$TMPDIR_TEST/hermes_bridge.py"
echo "# dummy" > "$DUMMY_BRIDGE"

export HERMES_BRIDGE_SCRIPT="$DUMMY_BRIDGE"
export HERMES_AGENT_BRIDGE_PYTHON="python3"
export HERMES_AGENT_BRIDGE_ENDPOINT="ipc://$SOCK"
export ROOSTER_BRIDGE_DRY_RUN=1

echo "=== Test 1: No socket file → starts normally ==="
output="$(bash "$BRIDGE_SCRIPT" 2>&1)" || true
assert_contains "prints dry-run exec" "$output" "[dry-run] would exec"

echo ""
echo "=== Test 2: Stale socket (regular file, not a real socket) → removes and starts ==="
touch "$SOCK"
output="$(bash "$BRIDGE_SCRIPT" 2>&1)" || true
assert_contains "detects stale" "$output" "stale socket"
assert_contains "dry-run remove" "$output" "[dry-run] would remove stale socket"
assert_contains "proceeds to exec" "$output" "[dry-run] would exec"
rm -f "$SOCK"

echo ""
echo "=== Test 3: Live socket (something listening) → suggests reuse ==="
start_listener
output="$(bash "$BRIDGE_SCRIPT" 2>&1)"
rc=$?
assert_exit_code "exits 0" "$rc" "0"
assert_contains "suggests reuse" "$output" "Bridge already running"
assert_contains "mentions restart env" "$output" "ROOSTER_BRIDGE_RESTART=1"
stop_listener

echo ""
echo "=== Test 4: Live socket + ROOSTER_BRIDGE_RESTART=1 → kill + start ==="
start_listener
export ROOSTER_BRIDGE_RESTART=1
output="$(bash "$BRIDGE_SCRIPT" 2>&1)" || true
assert_contains "announces restart" "$output" "killing existing bridge"
assert_contains "dry-run kill" "$output" "[dry-run] would kill owner"
assert_contains "proceeds to exec" "$output" "[dry-run] would exec"
unset ROOSTER_BRIDGE_RESTART
stop_listener

echo ""
echo "=== Test 5: Stale Unix socket (socket file but nothing listening) → removes and starts ==="
# Create a real socket file that no one is listening on
python3 -c "
import socket, sys
s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
s.bind(sys.argv[1])
s.close()
" "$SOCK"
output="$(bash "$BRIDGE_SCRIPT" 2>&1)" || true
assert_contains "detects stale socket" "$output" "stale socket"
assert_contains "dry-run remove" "$output" "[dry-run] would remove stale socket"
assert_contains "proceeds to exec" "$output" "[dry-run] would exec"
rm -f "$SOCK"

echo ""
echo "---"
echo "Results: $PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]] && exit 0 || exit 1
