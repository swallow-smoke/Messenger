# GameDev Messenger

All-in-one collaboration tool for game development teams: Slack-style messaging, document editor, task tracker, and Notion/Obsidian integration.

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose

## Quick Start

```bash
# 1. Start infrastructure
docker compose up -d

# 2. Copy env
cp .env.example .env

# 3. Install dependencies
pnpm install

# 4. Run database migrations
pnpm db:migrate

# 5. Start development servers
pnpm dev
```

`pnpm dev` starts both the API server (port 4000) and the Electron app. The renderer Vite dev server runs on port 5173.

## Packages

| Package | Description |
|---------|------------:|
| `packages/server` | Express API + Socket.io. All REST endpoints under `/api/v1`. PostgreSQL via Prisma, Redis for pub/sub and session, MinIO for file storage. |
| `packages/renderer` | React 18 SPA. Zustand stores, CodeMirror 6 markdown editor, react-virtuoso virtual scroll, @dnd-kit kanban drag-and-drop. |
| `packages/electron` | Electron main process + preload. Exposes `window.electron` for Obsidian vault file access, OS keychain storage, native notifications, and asset thumbnails. |

## Architecture Notes

- Messages (channel + DM + threads) all live in one `messages` table with `context_type`/`context_id` polymorphism.
- Obsidian vault files are read/written directly via Electron IPC — nothing is copied to the database.
- All integration config values (API tokens) are AES-256-CBC encrypted before being stored in the `integrations` table.
- JWT access tokens (15 min) + refresh tokens (7 days) stored in OS keychain via `safeStorage`.
