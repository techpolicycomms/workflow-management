# Executive Workflow Prototype

SG memo and executive decision workflow prototype with adaptive approvals, auditability, and mobile-first UX.

Built with React + TypeScript + Vite, with dual storage modes:
- **Supabase mode** (configured `.env`)
- **Demo mode** (LocalStorage fallback with seeded data)

## Feature Highlights

- Structured memo authoring:
  - `Background` (required)
  - `Analysis` (optional)
  - `Recommendation` (required)
  - Optional attachment name capture
- Adaptive workflow engine:
  - automatic `Light` / `Standard` / `Strict` scenario mode inference
  - sequential approvals, send-back, reject, and completion flow
  - role-based and person-based approver chains
- Chain resilience:
  - out-of-office and departed-user resolution paths
  - runtime chain editing (reorder, role/person swap, add/remove step)
  - audit event logging for chain changes and workflow actions
- UX and accessibility:
  - keyboard-first interactions and focus-visible support
  - responsive layout with mobile quick action bar
  - progressive disclosure via collapsible timelines

## Screenshots

![Executive Workflow UI](./src/assets/hero.png)

## Local Setup

1) Install dependencies:

```bash
npm install
```

2) Create `.env` from the example:

```bash
cp .env.example .env
```

3) Add Supabase keys to `.env`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

4) In Supabase SQL Editor, run:

```sql
-- file: supabase-schema.sql
```

5) Start development server:

```bash
npm run dev
```

Then open the Vite URL (typically [http://localhost:5173](http://localhost:5173)).

## Local-Only AI Integration (OpenAI)

This project supports local AI assist without exposing your API key to the browser.

1) Copy AI env template:

```bash
cp .env.local.example .env.local
```

2) Set your local secret in `.env.local`:

```env
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
OPENAI_MODEL=gpt-4o-mini
AI_PORT=8787
VITE_AI_BASE_URL=http://127.0.0.1:8787
```

3) Run local AI proxy in one terminal:

```bash
npm run ai:server
```

4) Run app in another terminal:

```bash
npm run dev
```

Security model:
- OpenAI key is read only by `local-ai-server.mjs` on your machine.
- Frontend only calls `http://127.0.0.1:8787` (localhost).
- Key is never bundled into frontend code.

## Keyboard Shortcuts

- `Ctrl/Cmd + K`: focus search
- `Alt + N`: focus new memo title
- On selected memo card:
  - `A`: approve
  - `B`: send back
  - `R`: reject
  - `T`: toggle timeline

## Build

```bash
npm run build
```

## Data and Schema Notes

- Supabase client: `@supabase/supabase-js`
- Table: `public.executive_actions`
- Extended memo fields include:
  - `memo_background`
  - `memo_analysis`
  - `memo_recommendation`
  - `attachment_name`
- Workflow metadata includes:
  - `mode`
  - `workflow_steps`
  - `current_step_index`
  - `approval_history`

## UN Web Compliance Alignment

This prototype now includes a compliance scaffold aligned with UN public guidance:
- Official language bar in native order: عربي, 中文, English, Français, Русский, Español
- `lang`/`dir` switching support (including RTL for Arabic)
- Translation dictionaries stored in `src/i18n/*.json` (one file per official language)
- In-app translation export/import controls (`Export i18n` / `Import i18n`) for language team workflows
- Strict dictionary schema validation on import (rejects missing/extra keys)
- In-app validation export (`i18n report`) for governance handoff
- Keyboard-first navigation and focus-visible support
- WCAG-oriented contrast and reduced-motion handling

To complete full institutional compliance, you should validate against DGC/WSS branding assets and multilingual publication standards before production release.

## Backend Operational Checks

Run these checks locally:

1) Frontend build check:
```bash
npm run build
```

2) Local AI proxy health check:
```bash
npm run ai:server
# then visit http://127.0.0.1:8787/health
```

3) Supabase data path:
- Ensure `.env` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Run `supabase-schema.sql` in SQL editor
- Create/update a memo in UI and verify row updates in `public.executive_actions`
