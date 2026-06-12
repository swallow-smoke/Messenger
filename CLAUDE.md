# GameDev Messenger

## Stack
- Electron 32 + React 18 + Vite + TypeScript + Tailwind
- Node.js + Express + Socket.io (Docker)
- PostgreSQL 16 + Prisma | Redis | MinIO
- pnpm workspaces monorepo

## Structure
```
packages/electron — main + preload + ipc/
packages/renderer — React SPA
packages/server   — API + socket/
```

## Key files (read these directly, don't search for them)
| File | Purpose |
|---|---|
| `renderer/src/lib/config.ts` | API URL, WS URL, env vars |
| `renderer/src/lib/api.ts` | axios instance + interceptors |
| `renderer/src/lib/socket.ts` | Socket.io singleton |
| `renderer/src/store/` | Zustand stores |
| `electron/src/config.ts` | Electron config, CSP, window options |
| `electron/src/ipc/` | obsidian, storage, notify, asset, shell |
| `server/src/app.ts` | Express + Socket.io init |
| `server/src/routes/` | REST endpoints |
| `server/src/socket/` | Socket.io handlers |
| `server/prisma/schema.prisma` | DB schema |

## Patterns
- Router: `const router: Router = express.Router()`
- Prisma JSON field: `field as Prisma.InputJsonValue`
- Socket room: `channelId` or `conversationId`
- Temp msg id: `"temp-{uuid}"` → replaced on `message:new` with `clientTempId`
- Theme: `data-theme` on `<html>`, CSS vars in `index.css`

## Rules
- No TODOs, no stubs — working code only
- No `any` types
- Errors → `react-hot-toast`, never `alert()`
- All storage → `window.electron.storage` (not localStorage)
- All URLs → `config.ts` (never hardcoded)
- DB queries → Prisma only
- Reuse existing components before making new ones
- Minimal imports — don't add packages if native or existing dep works

## Workflow
- `pnpm dev` — renderer + electron (server runs in Docker)
- `pnpm db:migrate` — prisma migrate dev
- `docker compose up -d` — start server + postgres + redis + minio
- **After editing server code**: <!-- TODO: confirm — `docker compose restart server`? watch/nodemon? -->
- Don't start server locally (always runs in Docker on :4000)

## Search policy (token control)
- If the task only touches files listed in "Key files" + their direct imports, do NOT grep/search the broader codebase.
- Before editing, read only: the target file(s) + files they directly import. Don't traverse the whole monorepo "for context."
- If a needed file isn't in "Key files," locate it once, then add it to this list for next time.

## Avoid
- Don't use localStorage
- Don't hardcode colors — use CSS vars
- Don't duplicate socket + REST for the same action

## Edit discipline (prevents broken/duplicated code)
- Before editing a file, read the WHOLE file first (not just a snippet), especially if it's
  been edited earlier in this session. Stale view output = broken old_str matches.
- When replacing a block (e.g. an upsert, a handler, a return statement), the old_str must
  cover the ENTIRE block being replaced — start to finish — not just the part that changed.
  Partial-block replacement is what causes leftover/duplicated code (two `return`s, two
  `update:` keys, etc.).
- If a function/route/handler already has logic similar to what you're adding, REPLACE it
  wholesale — don't append a second version above/below the old one "to be safe."
- One logical change = one edit. Don't queue up 5+ edits across files and verify at the end;
  verify after each file (see below).
- Never register the same socket event (`socket.on('x', ...)`) or the same Express route
  twice. If adding a handler for an event/route that already exists, edit the existing one.

## Verification (run after EVERY file edit, not just at the end)
- After editing a `.ts`/`.tsx` file: run the package's typecheck immediately
  (e.g. `pnpm --filter server exec tsc --noEmit`, `pnpm --filter renderer exec tsc --noEmit`).
- If typecheck fails, fix it before moving to the next file. Do not accumulate errors across
  multiple files and debug them all at the end — fix-as-you-go is cheaper.
- After all edits in a feature are done, do one final full read of each changed file to confirm
  no duplicate blocks, dangling code, or unused imports remain.

## Session hygiene
- For features touching 3+ files, state a short plan (files + what changes in each) BEFORE
  editing anything. Don't start writing code mid-exploration.
- Don't re-explore files already read this session unless they were edited since.