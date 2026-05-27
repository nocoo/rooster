# 07 — Phase 2 Status

Phase 2 (Chat Polish) is complete. All items from the roadmap are implemented,
tested, and passing quality gates.

## Completed Features (Phase 2A–2I)

| Phase | Feature | Key Commits |
|-------|---------|-------------|
| 2A | Reasoning/thinking block (collapsible) | `9cb242d`, `a7c5e5e` |
| 2B | Abort button (stop mid-stream) | `99fc6ee`, `e55d000`, `02e3a21` |
| 2C | Approval/clarify flow UI | `457667c`, `5560476`, `c70a706`, `29389c6` |
| 2D | Auto-scroll + jump-to-bottom | `d7a6959`, `4ca1ed4` |
| 2E | Code block copy button | `576d1a4`, `e176cf1` |
| 2F | File attachment (upload) | `d78202f`–`347f9f2` |
| 2G | Context compression indicator | `841a1f2`–`79d4fd3` |
| 2H | Session search + export | `bd86579`–`781e87f` |
| 2I | Dark mode, responsive, keyboard shortcuts | `cd73769`, `afa62c2` |

## Quality Gates (Final)

| Gate | Result |
|------|--------|
| ESLint (`--max-warnings 0`) | Pass |
| TypeScript (strict + exactOptionalPropertyTypes) | Pass |
| Tests | 572 passed, 0 failed |
| Branch coverage | 95.4% (threshold: 95%) |
| Statement coverage | 98.63% |
| Build (`vite build`) | Verified |

## Known Non-Blocking Follow-ups (deferred)

These are intentionally deferred to Phase 3/4 scope:

- **Attachment file reads**: server stores refs but does not yet serve file content
  back for re-download. Upload endpoint validates session and stores to disk.
- **LIKE wildcard exactness**: search uses SQLite `LIKE %q%` — special characters
  (`%`, `_`) are not escaped. Acceptable for personal use; FTS5 upgrade is Phase 4.
- **KaTeX math rendering**: markdown parser does not handle LaTeX blocks. Low
  priority unless math-heavy agent workflows are needed.
- **Socket.IO reconnection indicator**: connection drops show no UI feedback
  currently. Phase 4 hardening scope.
- **Primer CSS build warnings**: `@primer/css` emits deprecation warnings during
  Vite build (legacy `color-*` fallback variables). Cosmetic only; output works.
- **Mobile sidebar navigation**: at <480px the sidebar is hidden with no hamburger
  toggle. Acceptable for desktop-first tool; mobile nav is Phase 3 scope.

## Architecture Summary

```
packages/
  server/        Hono REST + Socket.IO /chat-run + better-sqlite3
  client/        Vite + Preact + @preact/signals + @primer/css + socket.io-client
```

### Server layers
- `routes/sessions.ts` — REST CRUD + search + export
- `routes/bridge.ts` — proxy to Hermes bridge (profiles/models/providers)
- `routes/upload.ts` — file attachment upload
- `services/hermes/agent-bridge.ts` — IPC JSON+newline client
- `services/hermes/chat-run/` — Socket.IO streaming orchestration
- `services/hermes/session-store.ts` — sessions SQLite
- `services/hermes/message-store.ts` — messages SQLite
- `services/hermes/session-export.ts` — JSON/Markdown export formatter

### Client layers
- `ws/chat.ts` — Socket.IO typed client
- `state/chat.ts` — per-session streaming state (signals)
- `state/sessions.ts` — session list + search state
- `state/attachments.ts` — upload lifecycle
- `components/` — ChatInput, MessageHistory, SessionList, ReasoningBlock,
  StreamingMessage, ToolTrace, ApprovalDialog, ClarifyDialog, DebugPanel,
  CompressionIndicator, BridgeStatus, HeaderSettings, Markdown

## Startup

```bash
cd packages/server && bun run dev   # starts Hono + Socket.IO on :4080
cd packages/client && bun run dev   # starts Vite on :5173 (proxies /api → :4080)
```

Requires Hermes Agent running with bridge socket at `/tmp/hermes-agent-bridge.sock`.
