# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See also: [AGENTS.md](AGENTS.md) for repository guidelines, agent-specific notes, and PR workflows.

## Project Structure

```
mtbot/
├── src/                          # Core platform source
│   ├── gateway/                  # WebSocket server, HTTP, protocol, auth, bridge
│   ├── agents/                   # Pi RPC agent runtime, tool exec, model auth
│   ├── routing/                  # Message routing, session keys, allowlists
│   ├── db/                       # PostgreSQL (Drizzle ORM): schema, repos, migrations
│   ├── memory/                   # Memory system (episodic, knowledge, profile, pluggable)
│   ├── infrastructure/           # Milvus vector DB, MinIO storage, Redis cache/pubsub
│   ├── channels/                 # Shared channel logic (routing, pairing, onboarding)
│   ├── telegram/                 # Built-in channel: Telegram
│   ├── discord/                  # Built-in channel: Discord
│   ├── slack/                    # Built-in channel: Slack
│   ├── signal/                   # Built-in channel: Signal
│   ├── imessage/                 # Built-in channel: iMessage
│   ├── cli/                      # Commander.js CLI wiring
│   ├── commands/                 # CLI command implementations
│   ├── media/                    # Image/audio/video pipeline
│   ├── media-understanding/      # Transcription, media analysis
│   ├── browser/                  # CDP-based Chrome automation
│   ├── canvas-host/              # A2UI visual workspace host
│   ├── security/                 # Sandboxing, tool approval
│   ├── hooks/bundled/            # Extensible event hooks
│   ├── plugin-sdk/               # Extension SDK (mtbot/plugin-sdk)
│   ├── services/                 # Business logic services
│   ├── sessions/                 # Session management
│   ├── assistant/                # AI assistant module
│   └── config/                   # Configuration management
├── apps/                         # Companion applications
│   ├── admin-console/            # Admin dashboard (React + TailwindCSS + Zustand)
│   ├── api-server/               # REST API server (Fastify 5 + Drizzle ORM)
│   ├── windows/                  # Windows desktop app (Electron 28 + React)
│   ├── macos/                    # macOS menu bar app (Swift/SwiftUI)
│   ├── ios/                      # iOS companion (Swift)
│   ├── android/                  # Android companion (Kotlin)
│   └── shared/                   # Shared code (MtBotKit for iOS/macOS)
├── ui/                           # Control UI / WebChat (React + Vite)
├── extensions/                   # 40+ channel plugins (pnpm workspace packages)
├── skills/                       # 50+ pre-built skills/tools
├── packages/                     # Shared npm packages (api-client, etc.)
├── docs/                         # Documentation site (Mintlify)
├── scripts/                      # Build, test, and utility scripts
├── docker-init/                  # Docker infra configs (Grafana, Loki, Postgres, Prometheus)
└── patches/                      # pnpm patched dependencies
```

## Setup & Prerequisites

**Required:**

- Node.js >= 22.12.0
- pnpm 10.23.0
- PostgreSQL 16+

**Optional (for full stack):**

- Redis (cache + pub/sub between Gateway and API Server)
- MinIO (object storage for files/skill packages)
- Milvus (vector search for memory system; pgvector as alternative)
- Docker & Docker Compose (`docker-compose.infra.yml` for local infra)

```bash
# Install dependencies
pnpm install

# Start infrastructure (PostgreSQL, Redis, MinIO, Milvus)
docker compose -f docker-compose.infra.yml up -d

# Apply database migrations
pnpm db:migrate

# Seed development data
pnpm db:seed

# Start Gateway (dev mode, no channels)
pnpm gateway:dev

# Start API Server (in separate terminal)
cd apps/api-server && pnpm dev
```

## Key Environment Variables

| Variable            | Default                                | Description                               |
| ------------------- | -------------------------------------- | ----------------------------------------- |
| `DATABASE_URL`      | `postgresql://localhost:5432/mtbot` | PostgreSQL connection string              |
| `JWT_SECRET`        | —                                      | JWT signing key (required for API Server) |
| `GATEWAY_PORT`      | `18789`                                | Gateway WebSocket port                    |
| `API_SERVER_PORT`   | `3000`                                 | API Server HTTP port                      |
| `ANTHROPIC_API_KEY` | —                                      | Anthropic Claude API key                  |
| `CORS_ORIGINS`      | `http://localhost:5173,5174`           | CORS allowed origins                      |
| `NODE_ENV`          | `development`                          | Environment mode                          |

See `src/gateway/config-loader.ts` for all Gateway env vars (`MTBOT_SKIP_*`, `MTBOT_DISABLE_*`, etc.).

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
pnpm test:live               # real API key tests (needs MTBOT_LIVE_TEST=1)

# Run a single test file
pnpm vitest run src/path/to/file.test.ts

# Docker test suite
pnpm test:docker:all

# Dev run
pnpm mtbot ...            # run CLI via tsx
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

# Multi-platform app development
pnpm mac:package             # package macOS app
pnpm ios:build               # build iOS app (xcodegen + xcodebuild)
pnpm ios:open                # open iOS Xcode project
pnpm android:assemble        # assemble Android debug APK
pnpm android:test            # run Android unit tests
# Windows: cd apps/windows && pnpm dev / pnpm build
```

## Architecture Overview

MtBot is a personal AI assistant platform with a **dual-service architecture**: Gateway (real-time WebSocket control plane) + API Server (RESTful business logic). The Gateway bridges messaging channels, agent sessions, companion apps, and tools; the API Server handles user management, skill store, subscriptions, payments, and admin operations.

### Core Data Flow

```
Messaging Channels (WhatsApp/Telegram/Slack/Discord/Signal/iMessage/Teams/etc.)
    │
    ▼
┌─────────────────────────────────┐    ┌─────────────────────────────────┐
│  Gateway (ws://localhost:18789) │    │  API Server (http://localhost:3000) │
│  ┌─────────┐  ┌──────────────┐ │    │  ┌──────────┐  ┌─────────────┐ │
│  │ Routing  │→│ Pi Agent RPC │ │    │  │ Auth/JWT │  │ Skill Store │ │
│  └─────────┘  └──────────────┘ │    │  └──────────┘  └─────────────┘ │
│  ┌─────────┐  ┌──────────────┐ │    │  ┌──────────┐  ┌─────────────┐ │
│  │ Sessions │  │   Tools      │ │    │  │ Payments │  │ Admin API   │ │
│  └─────────┘  └──────────────┘ │    │  └──────────┘  └─────────────┘ │
└────────────────┬────────────────┘    └────────────────┬────────────────┘
                 │                                      │
    ├─ CLI (mtbot ...)                 ├─ admin-console (React)
    ├─ WebChat UI                         └─ Windows client (REST)
    ├─ macOS menu bar app
    └─ iOS / Android nodes
                 │                                      │
                 └──────── Shared: PostgreSQL + Redis ───┘
```

### Key Subsystems (by directory)

| Directory                                                                     | Purpose                                                                                     |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/gateway/`                                                                | WebSocket server, HTTP server, protocol methods, auth, bridge                               |
| `src/agents/`                                                                 | Pi RPC agent runtime, tool execution, auth profiles, model auth, sandbox                    |
| `src/routing/`                                                                | Inbound message routing, session key derivation, allowlist matching                         |
| `src/db/`                                                                     | PostgreSQL via Drizzle ORM — schema (`schema/`), repositories, migrations, connection pool  |
| `src/memory/`                                                                 | Memory system: episodic, knowledge, profile; pluggable providers, embeddings, vector search |
| `src/infrastructure/`                                                         | External services: Milvus (vector DB), MinIO (object storage), Redis (cache/pubsub)         |
| `src/channels/`                                                               | Shared channel logic (routing, pairing, onboarding)                                         |
| `src/telegram/`, `src/discord/`, `src/slack/`, `src/signal/`, `src/imessage/` | Built-in channel implementations                                                            |
| `src/cli/`                                                                    | Commander.js CLI wiring                                                                     |
| `src/commands/`                                                               | CLI command implementations                                                                 |
| `src/services/`                                                               | Business logic services                                                                     |
| `src/media/`, `src/media-understanding/`                                      | Image/audio/video pipeline, transcription                                                   |
| `src/browser/`                                                                | CDP-based Chrome automation                                                                 |
| `src/canvas-host/`                                                            | A2UI visual workspace host                                                                  |
| `src/security/`                                                               | Sandboxing, tool approval                                                                   |
| `src/hooks/bundled/`                                                          | Extensible event hooks                                                                      |
| `src/plugin-sdk/`                                                             | Extension SDK (exported as `mtbot/plugin-sdk`)                                           |
| `apps/admin-console/`                                                         | Admin dashboard (React + TailwindCSS + Zustand + TanStack Query)                            |
| `apps/api-server/`                                                            | REST API server (Fastify 5 + JWT auth + Drizzle ORM)                                        |
| `apps/windows/`                                                               | Windows desktop client (Electron 28 + React + WebSocket)                                    |
| `apps/macos/`                                                                 | Swift/SwiftUI macOS menu bar app                                                            |
| `apps/ios/`                                                                   | Swift iOS node app                                                                          |
| `apps/android/`                                                               | Kotlin Android node app                                                                     |
| `extensions/`                                                                 | 40+ channel plugins (workspace packages)                                                    |
| `ui/`                                                                         | React-based frontend (Control UI, WebChat)                                                  |
| `skills/`                                                                     | 50+ pre-built skills and tools                                                              |

### Gateway Protocol

The Gateway exposes a JSON-RPC 2.0-style WebSocket protocol at `/ws` with methods namespaced as:
`agent.*`, `chat.*`, `config.*`, `sessions.*`, `nodes.*`, `cron.*`, `skills.*`, `browser.*`, `talk.*`, `send.*`

Protocol schema is defined in `src/gateway/protocol/` and auto-generated to `dist/protocol.schema.json` + Swift models (`apps/macos/Sources/MtBotProtocol/GatewayModels.swift`). Run `pnpm protocol:check` to verify they stay in sync.

### Database Layer

- **ORM**: Drizzle ORM with `postgres.js` driver
- **Schema**: `src/db/schema/` (users, admins, subscriptions, audit, skill-store, system-config, memories, profile-memory)
- **Repositories**: `src/db/repositories/` (data access layer with tenant-scoped base class)
- **Migrations**: `src/db/migrations/` (managed via `drizzle-kit`)
- **Connection**: `src/db/connection.ts` (pool with graceful shutdown)
- **Config**: `DATABASE_URL` env var, defaults to `postgresql://localhost:5432/mtbot`

### Memory System

The memory system (`src/memory/`) provides pluggable memory providers:

- **Episodic memory**: Conversation-based memories stored in PostgreSQL
- **Knowledge memory**: Factual knowledge with vector search (Milvus or pgvector)
- **Profile memory**: User profiles, facts, preferences, behavior patterns
- **Pluggable providers**: Factory-based provider selection (`src/memory/pluggable/providers/`)
- **Embeddings**: OpenAI and Gemini embedding providers for vector search

### Infrastructure Layer

External services managed via `src/infrastructure/`:

- **Milvus** (`milvus/`): Vector database for semantic search
- **MinIO** (`minio/`): Object storage for files and skill packages
- **Redis** (`redis/`): Cache, session state, pub/sub between Gateway and API Server

### Auth Architecture (multi-layer)

1. **Gateway auth** (`src/gateway/auth.ts`): token/password/Tailscale identity/loopback bypass
2. **Channel auth**: OAuth profiles (Anthropic/OpenAI) with fallback chains, model-specific auth (`src/agents/model-auth.ts`), auth profile rotation with cooldown (`src/agents/auth-profiles.ts`)
3. **DM pairing**: QR code pairing for unknown senders, per-channel allowlists

### Plugin/Extension System

Extensions live in `extensions/` as workspace packages. Plugin deps go in the extension's own `package.json`, not root. Runtime resolves `mtbot/plugin-sdk` via jiti alias. Install runs `npm install --omit=dev` in plugin dir.

## Tech Stack

- **Language**: TypeScript (ESM, strict, ES2023 target)
- **Runtime**: Node.js >= 22.12.0 (Bun optional for TS execution)
- **Package Manager**: pnpm 10.23.0
- **Build**: `tsc` + rolldown for bundles
- **Lint**: oxlint (type-aware) + oxfmt
- **Test**: Vitest 4 (V8 coverage, 70% thresholds for lines/functions/statements, 55% branches)
- **Database**: PostgreSQL 16+ via Drizzle ORM
- **CLI**: Commander.js 14
- **Gateway HTTP**: Express 5
- **API Server**: Fastify 5 (REST API, JWT auth, rate limiting)
- **WebSocket**: ws 8
- **Agent**: Pi RPC agent (@mariozechner/pi-agent-core)
- **Schema Validation**: TypeBox + Zod + AJV
- **Infrastructure**: Redis (cache/pubsub), MinIO (object storage), Milvus (vector DB)
- **Desktop**: Electron 28 (Windows), Swift/SwiftUI (macOS)
- **Mobile**: Swift (iOS), Kotlin (Android)
- **Admin UI**: React 18 + TailwindCSS + shadcn/ui + Zustand + TanStack Query/Table

## Coding Conventions

- Naming: **MtBot** for product/docs headings; `mtbot` for CLI/package/paths/config keys.
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
