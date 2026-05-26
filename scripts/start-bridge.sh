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

echo "Bridge Python: $PYTHON"
echo "Bridge script: $BRIDGE_SCRIPT"
echo "Endpoint:      $ENDPOINT"
echo "Agent root:    $HERMES_AGENT_ROOT"
echo "---"

exec "$PYTHON" "$BRIDGE_SCRIPT" \
  --endpoint "$ENDPOINT" \
  --agent-root "$HERMES_AGENT_ROOT" \
  --hermes-home "$HERMES_HOME"
