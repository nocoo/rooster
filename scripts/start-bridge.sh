#!/usr/bin/env bash
set -euo pipefail

# Start the Hermes Agent Bridge with the correct Python environment.
# Resolution order for Python:
#   1. HERMES_AGENT_BRIDGE_PYTHON env var
#   2. Hermes venv: $HERMES_AGENT_ROOT/venv/bin/python3
#   3. Shebang from `hermes` binary
#   4. System python3 (will likely fail if deps missing)
#
# Resolution order for hermes_bridge.py:
#   1. HERMES_BRIDGE_SCRIPT env var
#   2. ~/.hermes/hermes-web-ui/dist/server/agent-bridge/hermes_bridge.py (npm global install)
#   3. Adjacent to hermes-web-ui reference: ~/workspace/reference/hermes-web-ui/dist/server/agent-bridge/hermes_bridge.py

DRY_RUN="${ROOSTER_BRIDGE_DRY_RUN:-0}"

HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
HERMES_AGENT_ROOT="${HERMES_AGENT_ROOT:-$HERMES_HOME/hermes-agent}"

# --- Resolve Python ---
resolve_python() {
  if [[ -n "${HERMES_AGENT_BRIDGE_PYTHON:-}" ]] && [[ -x "$HERMES_AGENT_BRIDGE_PYTHON" ]]; then
    echo "$HERMES_AGENT_BRIDGE_PYTHON"
    return
  fi

  local venv_python="$HERMES_AGENT_ROOT/venv/bin/python3"
  if [[ -x "$venv_python" ]]; then
    echo "$venv_python"
    return
  fi

  local hermes_bin
  hermes_bin="$(command -v hermes 2>/dev/null || true)"
  if [[ -n "$hermes_bin" ]] && [[ -f "$hermes_bin" ]]; then
    local shebang
    shebang="$(head -1 "$hermes_bin" | sed 's/^#!//' | awk '{print $1}')"
    if [[ -n "$shebang" ]] && [[ -x "$shebang" ]]; then
      echo "$shebang"
      return
    fi
  fi

  echo "python3"
}

# --- Resolve bridge script ---
resolve_bridge_script() {
  if [[ -n "${HERMES_BRIDGE_SCRIPT:-}" ]] && [[ -f "$HERMES_BRIDGE_SCRIPT" ]]; then
    echo "$HERMES_BRIDGE_SCRIPT"
    return
  fi

  local candidates=(
    "$HERMES_HOME/hermes-web-ui/dist/server/agent-bridge/hermes_bridge.py"
    "$HOME/workspace/reference/hermes-web-ui/dist/server/agent-bridge/hermes_bridge.py"
    "$HOME/workspace/reference/hermes-web-ui/packages/server/src/services/hermes/agent-bridge/hermes_bridge.py"
  )

  for candidate in "${candidates[@]}"; do
    if [[ -f "$candidate" ]]; then
      echo "$candidate"
      return
    fi
  done

  echo ""
}

PYTHON="$(resolve_python)"
BRIDGE_SCRIPT="$(resolve_bridge_script)"

if [[ -z "$BRIDGE_SCRIPT" ]]; then
  echo "ERROR: Cannot find hermes_bridge.py. Set HERMES_BRIDGE_SCRIPT env var." >&2
  echo "Searched:" >&2
  echo "  \$HERMES_HOME/hermes-web-ui/dist/server/agent-bridge/hermes_bridge.py" >&2
  echo "  ~/workspace/reference/hermes-web-ui/dist/server/agent-bridge/hermes_bridge.py" >&2
  exit 1
fi

ENDPOINT="${HERMES_AGENT_BRIDGE_ENDPOINT:-ipc:///tmp/hermes-agent-bridge.sock}"

# --- Single-instance / stale socket handling ---
#
# Behaviour:
#   - If endpoint is IPC and socket file exists:
#     - Try to connect; if bridge responds → exit with reuse suggestion
#       (unless ROOSTER_BRIDGE_RESTART=1 → kill owner, remove socket, start fresh)
#     - If socket file is stale (nothing listening) → remove it and start fresh
#   - TCP endpoints skip this check (port conflicts are caught at bind time)

resolve_socket_path() {
  local ep="$1"
  if [[ "$ep" == ipc://* ]]; then
    echo "${ep#ipc://}"
  else
    echo ""
  fi
}

is_bridge_alive() {
  local sock="$1"
  if [[ ! -S "$sock" ]]; then
    return 1
  fi
  # Use python for reliable cross-platform Unix socket probe
  "$PYTHON" -c "
import socket, sys
s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
try:
    s.settimeout(1)
    s.connect(sys.argv[1])
    s.close()
except Exception:
    sys.exit(1)
" "$sock" 2>/dev/null && return 0
  return 1
}

kill_socket_owner() {
  local sock="$1"
  local pids
  pids="$(lsof -t "$sock" 2>/dev/null || true)"
  if [[ -z "$pids" ]]; then
    return 0
  fi
  echo "Stopping existing bridge (PIDs: $pids)..."
  # shellcheck disable=SC2086
  kill $pids 2>/dev/null || true
  sleep 0.5
  # Force-kill stragglers
  for pid in $pids; do
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi
  done
}

SOCK_PATH="$(resolve_socket_path "$ENDPOINT")"

if [[ -n "$SOCK_PATH" ]] && [[ -e "$SOCK_PATH" ]]; then
  if is_bridge_alive "$SOCK_PATH"; then
    if [[ "${ROOSTER_BRIDGE_RESTART:-0}" == "1" ]]; then
      echo "ROOSTER_BRIDGE_RESTART=1: killing existing bridge on $SOCK_PATH"
      if [[ "$DRY_RUN" == "1" ]]; then
        echo "[dry-run] would kill owner of $SOCK_PATH and remove socket"
      else
        kill_socket_owner "$SOCK_PATH"
        rm -f "$SOCK_PATH"
      fi
    else
      echo "Bridge already running on $SOCK_PATH"
      echo "Reuse the existing bridge or set ROOSTER_BRIDGE_RESTART=1 to replace it."
      exit 0
    fi
  else
    echo "Removing stale socket: $SOCK_PATH"
    if [[ "$DRY_RUN" != "1" ]]; then
      rm -f "$SOCK_PATH"
    else
      echo "[dry-run] would remove stale socket $SOCK_PATH"
    fi
  fi
fi

echo "Bridge Python: $PYTHON"
echo "Bridge script: $BRIDGE_SCRIPT"
echo "Endpoint:      $ENDPOINT"
echo "Agent root:    $HERMES_AGENT_ROOT"
echo "---"

if [[ "$DRY_RUN" == "1" ]]; then
  echo "[dry-run] would exec: $PYTHON $BRIDGE_SCRIPT --endpoint $ENDPOINT --agent-root $HERMES_AGENT_ROOT --hermes-home $HERMES_HOME"
  exit 0
fi

exec "$PYTHON" "$BRIDGE_SCRIPT" \
  --endpoint "$ENDPOINT" \
  --agent-root "$HERMES_AGENT_ROOT" \
  --hermes-home "$HERMES_HOME"
