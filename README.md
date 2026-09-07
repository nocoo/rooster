<p align="center">
  <img src="assets/brand/icon-rounded.png" alt="Rooster" width="128" height="128" />
</p>

<h1 align="center">Rooster</h1>

<p align="center">A personal web panel for Hermes Agent.</p>

Stream conversations, inspect tool traces, browse sessions, and manage the connected agent through a Preact interface. Rooster connects a Hono and Socket.IO server to Hermes over its IPC bridge.

## Development

```sh
bun install
bun run rebuild:native
bun run dev:all
```

`dev:all` starts the local server, client, and configured bridge. See the [architecture overview](docs/01-architecture-overview.md) and [development scripts](scripts/) for configuration and runtime details.

```sh
bun run build
bun run typecheck
bun run lint
bun run test:coverage
bun run test:e2e
```

The copper rooster pauses beside one multicolored morning-glory flower. Large documentation uses the rounded presentation; the application header and browser use the transparent foreground. [Brand assets and usage](assets/brand/README.md).
