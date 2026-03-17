# Executive Actions Prototype

This is a local demo prototype for an executive action tracker built with React, TypeScript, Vite, and Supabase.

## What this prototype does

- Shows an executive action dashboard with summary metrics.
- Lets you add new actions (title, owner, due date, priority, notes).
- Lets you update action status inline.
- Filters actions by status.
- Works in two modes:
  - **Supabase mode** (when `.env` is configured)
  - **Demo mode** with browser local storage fallback (when `.env` is not configured)

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file from the example:

```bash
cp .env.example .env
```

3. Add your Supabase values into `.env`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

4. In Supabase SQL Editor, run `supabase-schema.sql`.

5. Start the app:

```bash
npm run dev
```

Then open the local URL shown by Vite (typically [http://localhost:5173](http://localhost:5173)).

## Supabase notes

- SDK used: `@supabase/supabase-js`.
- Client initialized with `createClient(url, anonKey)`.
- Table queried: `public.executive_actions`.
- Demo policies in `supabase-schema.sql` allow anon select/insert/update for prototype speed.
  Tighten these before production.
