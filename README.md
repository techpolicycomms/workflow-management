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
