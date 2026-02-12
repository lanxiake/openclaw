# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

AGENTS.md

## Build, Test, and Lint Commands

```bash
# Install
pnpm install

# Build (type-check + bundle A2UI + copy hooks)
pnpm build

# Lint and format
pnpm lint                    # oxlint with type-aware checking
pnpm format                  # oxfmt --check
pnpm format:fix              # oxfmt --write
pnpm lint:fix                # format + oxlint --fix

# Tests
pnpm test                    # unit tests (vitest, parallel forks)
pnpm test:coverage           # unit tests + V8 coverage report
pnpm test:e2e                # e2e tests (separate vitest config)
pnpm test:watch              # vitest in watch mode
pnpm test:live               # real API key tests (needs OPENCLAW_LIVE_TEST=1)

# Run a single test file
pnpm vitest run src/path/to/file.test.ts

# Docker test suite
pnpm test:docker:all

# Dev run
pnpm openclaw ...            # run CLI via tsx
pnpm dev                     # alias for node scripts/run-node.mjs
pnpm gateway:dev             # gateway without channels
pnpm gateway:watch           # gateway with auto-reload on TS changes

# Database (Drizzle ORM + PostgreSQL)
pnpm db:generate             # generate migration from schema changes
pnpm db:migrate              # apply migrations
pnpm db:push                 # push schema directly (dev only)
pnpm db:studio               # drizzle-kit studio UI
pnpm db:seed                 # seed dev data

# Full CI gate (run before pushing)
pnpm lint && pnpm build && pnpm test

# Protocol validation
pnpm protocol:check          # verify protocol schema + Swift codegen matches
```

## Architecture Overview

OpenClaw is a personal AI assistant platform with a **Gateway-centric architecture**. The Gateway is a WebSocket control plane that bridges messaging channels, agent sessions, companion apps, and tools.

### Core Data Flow

```
Messaging Channels (WhatsApp/Telegram/Slack/Discord/Signal/iMessage/Teams/etc.)
    │
    ▼
┌─────────────────────────────────┐
│     Gateway (ws://localhost:18789)  │
│  ┌─────────┐  ┌──────────────┐  │
│  │ Routing  │→│ Pi Agent RPC │  │
│  └─────────┘  └──────────────┘  │
│  ┌─────────┐  ┌──────────────┐  │
│  │ Sessions │  │   Tools      │  │
│  └─────────┘  └──────────────┘  │
└─────────────────────────────────┘
    │
    ├─ CLI (openclaw ...)
    ├─ WebChat UI
    ├─ macOS menu bar app
    └─ iOS / Android nodes
```

### Key Subsystems (by directory)

| Directory                                                                     | Purpose                                                                                    |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `src/gateway/`                                                                | WebSocket server, HTTP server, protocol methods, auth, bridge                              |
| `src/agents/`                                                                 | Pi RPC agent runtime, tool execution, auth profiles, model auth, sandbox                   |
| `src/routing/`                                                                | Inbound message routing, session key derivation, allowlist matching                        |
| `src/db/`                                                                     | PostgreSQL via Drizzle ORM — schema (`schema/`), repositories, migrations, connection pool |
| `src/channels/`                                                               | Shared channel logic (routing, pairing, onboarding)                                        |
| `src/telegram/`, `src/discord/`, `src/slack/`, `src/signal/`, `src/imessage/` | Built-in channel implementations                                                           |
| `src/cli/`                                                                    | Commander.js CLI wiring                                                                    |
| `src/commands/`                                                               | CLI command implementations                                                                |
| `src/media/`, `src/media-understanding/`                                      | Image/audio/video pipeline, transcription                                                  |
| `src/browser/`                                                                | CDP-based Chrome automation                                                                |
| `src/canvas-host/`                                                            | A2UI visual workspace host                                                                 |
| `src/security/`                                                               | Sandboxing, tool approval                                                                  |
| `src/hooks/bundled/`                                                          | Extensible event hooks                                                                     |
| `src/plugin-sdk/`                                                             | Extension SDK (exported as `openclaw/plugin-sdk`)                                          |
| `extensions/`                                                                 | 40+ channel plugins (workspace packages)                                                   |
| `apps/macos/`                                                                 | Swift/SwiftUI macOS menu bar app                                                           |
| `apps/ios/`                                                                   | Swift iOS node app                                                                         |
| `apps/android/`                                                               | Kotlin Android node app                                                                    |
| `ui/`                                                                         | React-based frontend (Control UI, WebChat)                                                 |

### Gateway Protocol

The Gateway exposes a JSON-RPC 2.0-style WebSocket protocol at `/ws` with methods namespaced as:
`agent.*`, `chat.*`, `config.*`, `sessions.*`, `nodes.*`, `cron.*`, `skills.*`, `browser.*`, `talk.*`, `send.*`

Protocol schema is defined in `src/gateway/protocol/` and auto-generated to `dist/protocol.schema.json` + Swift models (`apps/macos/Sources/OpenClawProtocol/GatewayModels.swift`). Run `pnpm protocol:check` to verify they stay in sync.

### Database Layer

- **ORM**: Drizzle ORM with `postgres.js` driver
- **Schema**: `src/db/schema/` (users, admins, subscriptions, audit, skill-store, system-config)
- **Repositories**: `src/db/repositories/` (data access layer)
- **Migrations**: `src/db/migrations/` (managed via `drizzle-kit`)
- **Connection**: `src/db/connection.ts` (pool with graceful shutdown)
- **Config**: `DATABASE_URL` env var, defaults to `postgresql://localhost:5432/openclaw`

### Auth Architecture (multi-layer)

1. **Gateway auth** (`src/gateway/auth.ts`): token/password/Tailscale identity/loopback bypass
2. **Channel auth**: OAuth profiles (Anthropic/OpenAI) with fallback chains, model-specific auth (`src/agents/model-auth.ts`), auth profile rotation with cooldown (`src/agents/auth-profiles.ts`)
3. **DM pairing**: QR code pairing for unknown senders, per-channel allowlists

### Plugin/Extension System

Extensions live in `extensions/` as workspace packages. Plugin deps go in the extension's own `package.json`, not root. Runtime resolves `openclaw/plugin-sdk` via jiti alias. Install runs `npm install --omit=dev` in plugin dir.

## Tech Stack

- **Language**: TypeScript (ESM, strict, ES2023 target)
- **Runtime**: Node.js >= 22.12.0 (Bun optional for TS execution)
- **Package Manager**: pnpm 10.23.0
- **Build**: `tsc` + rolldown for bundles
- **Lint**: oxlint (type-aware) + oxfmt
- **Test**: Vitest 4 (V8 coverage, 70% thresholds for lines/functions/statements, 55% branches)
- **Database**: PostgreSQL + Drizzle ORM
- **CLI**: Commander.js 14
- **HTTP**: Express 5
- **WebSocket**: ws 8
- **Agent**: Pi RPC agent (@mariozechner/pi-agent-core)
- **Schema Validation**: TypeBox + Zod + AJV

## Coding Conventions

- Naming: **OpenClaw** for product/docs headings; `openclaw` for CLI/package/paths/config keys.
- Files: aim for ~500 LOC, split when clarity improves. Max guideline ~700 LOC.
- Tests: colocated `*.test.ts`; e2e in `*.e2e.test.ts`; live in `*.live.test.ts`.
- Dependency injection via `createDefaultDeps()` pattern.
- CLI progress: use `src/cli/progress.ts` (osc-progress + @clack/prompts spinner).
- Status output: tables via `src/terminal/table.ts`; colors via shared palette in `src/terminal/palette.ts`.
- Tool schemas: avoid `Type.Union`/`anyOf`/`oneOf`/`allOf`; use `stringEnum`/`optionalStringEnum` for string lists; avoid raw `format` property name.
- Patched deps (in `pnpm.patchedDependencies`) must use exact versions (no `^`/`~`).
- Never update the Carbon dependency.
- Commits: use `scripts/committer "<msg>" <file...>` to keep staging scoped.
- When touching messaging channels, always consider all built-in + extension channels.

## CI Matrix

CI runs on push/PR with these checks (Ubuntu + Windows + macOS):

- `tsgo` (TypeScript native preview type-check)
- `pnpm build && pnpm lint`
- `pnpm canvas:a2ui:bundle && pnpm test`
- `pnpm protocol:check`
- `pnpm format`
- Bun: `bunx vitest run` + `bunx tsc`
- Secret scanning via `detect-secrets`
- macOS app: SwiftLint + SwiftFormat + `swift build` + `swift test`
- Android: Gradle unit test + assemble debug
