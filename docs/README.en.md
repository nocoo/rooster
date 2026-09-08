<p align="center">
  <img src="../assets/brand/icon-rounded.png" alt="Rooster" width="128" height="128" />
</p>

<h1 align="center">Rooster</h1>

<p align="center">Chat with your local Hermes Agent in a browser and inspect sessions and tool activity.</p>

<p align="center">
  <a href="../README.md">简体中文</a>
</p>

## What it does

Rooster is a personal web panel for Hermes Agent. The browser connects to a Hermes bridge through a Hono and Socket.IO server, displays streamed replies, reasoning, and tool calls, and stores sessions and messages in local SQLite.

It is intended for people who already have Hermes Agent configured and want to chat and review history in a browser. Hermes Agent, model configuration, and the Python bridge are managed externally. This repository supplies the panel and server, with no built-in sign-in or multi-user management.

## Features

- Stream replies, Markdown, code blocks, reasoning, and tool status, with support for interrupting a running response.
- Respond to tool approval and clarification requests from the bridge; see context compression progress and connection status.
- Browse, search, rename, and delete local sessions; export JSON or Markdown and upload chat attachments.
- Discover profiles, models, and providers from existing bridge sessions and select them for new conversations.
- Use light or dark themes and inspect protocol events in a debug panel.

Profiles and Models in the admin area currently provide read-only previews of information found in existing sessions. Skills, Plugins, Memory, Files, Logs, Jobs, and Settings pages are not connected to their respective bridge protocols or server APIs and cannot manage those resources. Chat, approval, and compression behavior depends on support in the connected bridge.

## Usage

### Prepare Hermes and the bridge

Install and configure Hermes Agent locally first, and confirm it can call your chosen model. You also need a compatible `hermes_bridge.py` and a Python environment with its dependencies. That script comes from an external `hermes-web-ui` installation or checkout and is not included in this repository.

The startup script looks for a Hermes virtual environment and a bridge under `~/.hermes/hermes-web-ui/`, or accepts explicit paths. After cloning the project and installing dependencies, set the actual paths in the terminal used to start Rooster:

```bash
export HERMES_AGENT_ROOT="/absolute/path/to/hermes-agent"
export HERMES_AGENT_BRIDGE_PYTHON="/absolute/path/to/hermes-agent/venv/bin/python3"
export HERMES_BRIDGE_SCRIPT="/absolute/path/to/hermes-web-ui/dist/server/agent-bridge/hermes_bridge.py"

bun run dev:all
```

Open `http://localhost:7037`. The startup script connects to or starts the bridge before launching the server and client. The server defaults to `http://127.0.0.1:7038`. If a compatible bridge is already running, `bun run dev` starts only the server and client.

### Common configuration

Configuration is supplied through process environment variables:

| Variable | Purpose / default |
| --- | --- |
| `HERMES_HOME` | Hermes data directory; the bridge script defaults to `~/.hermes` |
| `HERMES_AGENT_ROOT` | Hermes Agent checkout; defaults to `~/.hermes/hermes-agent` |
| `HERMES_AGENT_BRIDGE_PYTHON` | Python executable used for the bridge |
| `HERMES_BRIDGE_SCRIPT` | Path to the external `hermes_bridge.py` |
| `HERMES_AGENT_BRIDGE_ENDPOINT` | Bridge IPC or TCP endpoint; defaults to the Unix socket `/tmp/hermes-agent-bridge.sock` |
| `ROOSTER_DB_PATH` | SQLite path; defaults to `rooster.db` in the server process's working directory |
| `BIND_HOST` / `PORT` | Server address and port; defaults to `127.0.0.1` / `7038` |

Uploaded files are stored under `uploads/` in the server process's working directory. The development proxy targets port `7038`; update `packages/client/vite.config.ts` if you change the server port. The server has no built-in authentication, so access from other machines needs restrictions in your reverse proxy or network access controls.

## Development

Requires Bun, Node.js 22.12+, Bash, and a working Python 3 environment. `better-sqlite3` is a native extension: if no prebuilt binary matches the Node ABI, Python and C/C++ build tools are required.

```bash
git clone https://github.com/nocoo/rooster.git
cd rooster
bun install --frozen-lockfile
bun run rebuild:native
```

Then configure the bridge as above and run `bun run dev:all`. `rebuild:native` checks the SQLite extension against the current Node runtime, downloading a prebuilt binary or invoking node-gyp if needed. Run it again after changing Node versions.

```bash
bun run build
bun run typecheck
bun run lint
```

`build` produces server JavaScript and client static files. The server's `start` script runs the compiled server, but the current Hono entry does not serve the client's static directory. An independent deployment needs separate serving or routing for the client, `/api`, `/health`, and Socket.IO.

```text
packages/client/    Preact UI, signals state, and Socket.IO client
packages/server/    Hono API, SQLite, chat orchestration, and bridge client
scripts/            Bridge lifecycle and native dependency helpers
docs/               Architecture, protocol records, and this English README
```

## Tests

Run from the repository root:

| Layer | Command |
| --- | --- |
| Server unit and frontend component tests | `bun run test` |
| HTTP / Socket.IO integration tests | `bun run test:e2e` |
| Bridge startup script integration tests | `bash scripts/test-bridge-lifecycle.sh` |

The first two commands check and rebuild the SQLite native extension first. HTTP / Socket.IO tests use temporary ports, in-memory databases, and a simulated bridge; they do not require a real Hermes installation or model credentials. The script tests require Bash, Python 3, and Unix sockets, and use temporary directories and dry-run mode. `bun run test:coverage` generates a coverage report. There is currently no configured browser end-to-end test command.

## Stack

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Preact](https://img.shields.io/badge/Preact-673AB8?logo=preact&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-E36002?logo=hono&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?logo=socketdotio&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)

| Area | Implementation |
| --- | --- |
| Web interface | Preact, Preact Signals, Primer CSS, Vite |
| Server | TypeScript, Node.js, Hono, Socket.IO, Pino |
| Local data | SQLite / better-sqlite3, file attachments |
| Agent connection | Newline-delimited JSON over a Unix socket or TCP to an external Python bridge |
| Tests | Vitest, Preact Testing Library, happy-dom |

See the root and workspace [package.json](../package.json) files for dependencies.

## Documentation

- [Documentation index](README.md)
- [Architecture overview](01-architecture-overview.md)
- [Server design](02-server-design.md)
- [Frontend design](03-frontend-design.md)
- [Communication protocol](04-communication-protocol.md)
- [WebSocket protocol](06-websocket-protocol.md)
- [Brand assets and usage](../assets/brand/README.md)

Design documents include plans and historical stages. The feature scope above reflects the current implementation.

## License

[Apache License 2.0](../LICENSE)
