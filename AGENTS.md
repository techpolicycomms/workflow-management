# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is a React + TypeScript + Vite single-page application ("Executive Workflow Prototype") for SG memo authoring and approval workflows. It works fully standalone in **demo mode** (LocalStorage with seeded data) — no external services required.

### Development commands

See `package.json` scripts and `README.md` for full details. Quick reference:

| Task | Command |
|------|---------|
| Dev server | `npm run dev` (port 5173) |
| Lint | `npm run lint` |
| Build | `npm run build` (runs `tsc -b && vite build`) |
| AI proxy (optional) | `npm run ai:server` (port 8787, needs `OPENAI_API_KEY`) |

### Caveats

- The app gracefully falls back to LocalStorage demo mode when Supabase env vars are not configured. No `.env` file is needed for development/testing.
- `npm run lint` has 4 pre-existing `no-extra-boolean-cast` errors in `App.tsx`. These are auto-fixable (`--fix`) but are present on `main`.
- The optional AI proxy server (`local-ai-server.mjs`) requires `OPENAI_API_KEY` in `.env.local` — skip it unless testing AI features.
