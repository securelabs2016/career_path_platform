# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Monorepo with two independently-deployable apps:

- `apps/web/` — Next.js 16 + TypeScript + Tailwind v4 website (deploys to Vercel)
- `apps/pipeline/` — Python data ingestion (runs on GitHub Actions cron)
- `schema.sql` (repo root) — Supabase Postgres schema, run once in the SQL editor
- `apps/web/src/data/*.json` — hand-curated taxonomy JSON, source of truth for the website rendering even after the DB is seeded

Every `cd` for npm/python commands below assumes you are at the repo root.

## Commands

### Web app (`apps/web/`)
```bash
cd apps/web
npm install              # first-time setup
npm run dev              # localhost:3000
npm run build            # MUST pass before committing — verifies TypeScript + Next routing
npm run lint             # eslint via eslint-config-next
npm start                # serve a production build locally
```

There is no test framework configured. Verify changes by running `npm run build` (catches all type errors) and exercising the UI via `npm run dev`.

### Python pipeline (`apps/pipeline/`)
```bash
cd apps/pipeline
pip install -r requirements.txt
cp .env.example .env                  # fill in SUPABASE_* and one AI key
python seed_taxonomy.py               # PHASE_B: one-time, idempotent
python main.py                        # full pipeline run
python main.py --skip-scrape          # re-run only extract+match
python main.py --industries semiconductors --skip-scrape --skip-extract
```

The pipeline can also be triggered without a local Python install — use the GitHub Actions workflows:
- **Seed taxonomy data** (`.github/workflows/seed.yml`) — manual trigger, one-off
- **Weekly ingestion pipeline** (`.github/workflows/ingest.yml`) — cron Mondays 10:00 UTC, also manual trigger with skip-step inputs

## Architecture

### Two-system design (this is the load-bearing distinction)

**System A** — the public website. Stateless, reads JSON taxonomies, calls AI providers. Runs on Vercel.

**System B** — the ingestion pipeline. Stateful, writes to Postgres weekly. Runs on GitHub Actions. The website does NOT depend on the pipeline being up; the pipeline does NOT depend on the website being up. They communicate only via Supabase.

### Two sources of taxonomy truth

The taxonomy lives in TWO places by design:

1. **`apps/web/src/data/*.json`** — the website reads these directly via `import` at build/request time. Fast, no DB roundtrip, no cold starts.
2. **Supabase `canonical_roles` table** — seeded from the same JSON via `seed_taxonomy.py`. The pipeline matches scraped jobs against these rows.

The pipeline writes back to `canonical_roles.open_jobs_count` when it auto-approves a match. The website currently does not surface those live counts — the heat-map UI is wired but reads `open_jobs_count` from the static JSON (always 0 locally). To make live counts appear on the map, add an API route that reads `open_jobs_count` from Supabase and merge it into the rendered roles client-side.

If you change the taxonomy JSON, re-run the seeder to keep DB in sync — but be aware re-seeding does `DELETE then INSERT`, which resets `open_jobs_count` to 0 until the next pipeline run.

### Multi-provider AI (TypeScript: `apps/web/src/lib/ai-providers.ts`)

The chat endpoint never calls one specific provider — it goes through `streamWithFallback({ system, messages })` which iterates the configured providers in order:

1. Claude (Haiku) — primary
2. Gemini (1.5 Flash) — first fallback
3. OpenAI (gpt-4o-mini) — second fallback

A provider is considered "configured" only if its env var is set. **An empty `ANTHROPIC_API_KEY` is a valid configuration meaning "skip Claude"** — do not add code that errors on missing keys; let the existing filter do its job. Each provider has its own `CircuitBreaker` instance: 3 consecutive failures → OPEN for 10 minutes → one trial in HALF-OPEN. Errors classified as rate-limit / transient trigger fallback; other errors bubble up.

The Python pipeline (`apps/pipeline/extractor.py`, `matcher.py`) mirrors this pattern but at a smaller scale: Claude → Gemini, with exponential backoff retry. When `anthropic` is `None`, both files short-circuit straight to Gemini.

### Rate limiting (`apps/web/src/lib/rate-limit.ts`)

In-memory sliding-window per-IP. Three preset budgets in `LIMITS`:
- `chat_hourly` — 15 / hour
- `chat_daily` — 80 / day
- `admin` — 300 / hour (admin actions, generous because authed)

Admin login (`/api/admin/auth`) gets its own tighter limit (5 / 15 min, brute-force protection) defined inline.

To migrate to Upstash Redis at production scale, only `checkRateLimit()` in this file needs to change — the call sites use it generically.

### Career map layout pipeline

The `<CareerMap>` component is purely a renderer. Coordinates come from `apps/web/src/lib/map-layout.ts::computeLayout(roles)` which:
1. Groups roles by `(grid_col, grid_row)` cell
2. Stacks multiple roles in one cell vertically
3. Computes pixel positions including band header / seniority label gutters
4. Returns a `Map<roleId, {x, y, cx, cy}>` plus total canvas dimensions

When adding a new industry, the JSON must specify `grid_col` (column index, 0-based, matches the `clusters` array) and `grid_row` (0 = entry, 3 = lead) for every role. The layout engine handles overflow stacking automatically.

### Ingestion pipeline state machine

Each scraped job moves through these tables in order:

```
raw_jobs ─[extractor.py + Claude/Gemini]─→ extracted_jobs ─[matcher.py + skill/title scoring + Claude/Gemini judge]─→ role_matches
                                                                                                                       │
                                                                  confidence ≥ 0.85 ──────────────────────────────────→├─ status='approved' + increment_job_count RPC
                                                                  0.50 ≤ confidence < 0.85 ────────────────────────────├─ status='pending' (admin queue)
                                                                  confidence < 0.50 ────────────────────────────────────└─ status='rejected'
```

`scrapers/greenhouse.py` and `lever.py` use `upsert(on_conflict="url")` so re-runs are idempotent. Extractor and matcher dedupe by checking the downstream table for existing `raw_job_id` / `extracted_job_id` references.

The admin `/admin` UI changes `status` between buckets and writes audit rows to `review_decisions`. Approving a previously-pending match also calls the `increment_job_count` SQL function.

## Important gotchas

### Next.js 16 + Turbopack
This repo uses the Next.js stable build (not `--turbo` flag in dev). It is Next 16 — App Router only. Route handlers are async functions in `route.ts`. `params` is a `Promise` in page components — `await params` before destructuring.

The auto-generated `apps/web/AGENTS.md` warns that this Next.js version differs from training data — when in doubt, consult `node_modules/next/dist/docs/` rather than assuming older Next.js patterns.

### Supabase client compatibility (`apps/pipeline/seed_taxonomy.py`)
Do not use `supabase.table(...).upsert(..., on_conflict=...)` with the current supabase-py + PostgREST 13 combo — it returns `PGRST125 "Invalid path"`. Use the explicit select-then-insert/update pattern shown in the seeder.

### Vercel vs GitHub Actions secrets
These are independent runtime environments. Most secrets must be set in BOTH (Supabase URL, AI keys). Some are runtime-specific:
- Only Vercel needs `ADMIN_PASSWORD`, `NEXT_PUBLIC_SUPABASE_*`, `OPENAI_API_KEY`
- Only GitHub Actions runs the pipeline, so it gets the same Supabase + AI keys plus nothing else

`.env.local` is gitignored at both `/.gitignore` and `apps/web/.gitignore` — verify with `git check-ignore -v <file>` before committing if uncertain.

### Print CSS for PDF export
The "Save PDF" button on role detail pages uses `window.print()` plus `@media print` rules in `apps/web/src/app/globals.css` that hide nav/chat/header chrome. When adding new UI elements to that page that should NOT appear in the PDF, add `class="no-print"` rather than introducing a new media query.

## Reference docs

- `schema.sql` — every table, plus `increment_job_count()` and `match_canonical_roles()` SQL helper functions
- `apps/web/.env.example` — all env vars with descriptions of which are optional
- `apps/pipeline/.env.example` — pipeline-specific env (a subset of the web env)
- `career-platform-build-doc.pdf` (repo root) — the original client spec; useful for understanding the "why" behind design decisions like the confidence routing thresholds and the AM/Semi/Space prioritization

---

## Session Checkpoint — Version 2 (need to complete in next session)

> When the user says **"load version 2"**, read this section to recover full state. Trigger phrase is the user's contract; don't act on this section unless explicitly asked.

### Completed in this version

**Deployment infrastructure**
- Supabase project provisioned; `schema.sql` run successfully (all 7 tables exist + pgvector extension)
- GitHub Actions secrets configured: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`
- `apps/pipeline/.env` created locally (was missing); seeder ran successfully → `industries` has 2 rows, `canonical_roles` has ~95 rows
- Vercel project deployed and connected to GitHub. Public URL live.
- Vercel env vars set (per user): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ADMIN_PASSWORD`. User has NOT set `ANTHROPIC_API_KEY` — they're using Gemini + OpenAI only.

**Code fixes pushed to main**
- Commit `1b4d0db` — Fixed 4 lint errors (apostrophe escape in role detail; setState-in-effect in AdminClient and GetStartedWizard; explicit `any` in AgentChat)
- Commit `9be8b96` — Bumped `actions/checkout@v5` and `actions/setup-python@v6` (silenced Node 20 deprecation)
- Commit `ec4fe13` — Bumped `actions/upload-artifact@v5` (silenced remaining Node 20 warning)
- Commit `c97c898` — Two critical fixes:
  - Gemini model: `gemini-1.5-flash` → `gemini-2.5-flash` in `apps/web/src/lib/ai-providers.ts`, `apps/pipeline/extractor.py`, `apps/pipeline/matcher.py` (old model returns 404 from v1beta API)
  - Admin cookie path: `/admin` → `/` in `apps/web/src/app/api/admin/auth/route.ts` so `/api/admin/*` requests receive the session cookie

**Confirmed working by user**
- AI chat streams real responses (Gemini)
- Admin password login succeeds

### Currently broken — next-session focus

**Problem 1: Admin panel shows "Database not connected" 503 banner**
- Symptom: `/admin` Pending tab shows the yellow banner: "Supabase is not configured yet. After deploying, set these environment variables and re-run the pipeline: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`". Also still seeing 401s on `/api/admin/matches` from Vercel logs.
- Root code that's triggering it: `apps/web/src/lib/supabase.ts::getSupabaseAdmin()` returns `null` when `NEXT_PUBLIC_SUPABASE_URL` OR `SUPABASE_SERVICE_ROLE_KEY` is missing. That null causes `/api/admin/matches/route.ts` to return 503, which the AdminClient renders as the "Database not connected" banner.
- Likely root causes (in order of probability):
  1. User added these Vercel env vars **after** the initial deploy — Vercel only picks up env vars on **new** deployments. Need to redeploy from Vercel dashboard → Deployments → ⋯ → Redeploy.
  2. Env vars set in **Preview** environment only, not **Production** (Vercel scopes env vars per environment).
  3. Variable name typo in Vercel — e.g., `SUPABASE_URL` instead of `NEXT_PUBLIC_SUPABASE_URL` (the prefix is mandatory because supabase.ts reads `process.env.NEXT_PUBLIC_SUPABASE_URL`).
  4. Stale browser cookie with old `path=/admin` still present — sign out + back in to refresh. (Less likely now since the 503 indicates the server-side issue is the db client, not the cookie. But worth checking after fixing env vars.)
- First diagnostic step next session: ask user to open Vercel dashboard → Settings → Environment Variables → confirm both `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` exist for **Production**, then redeploy and verify.

**Problem 2: Supabase pipeline tables still empty**
- Symptom: `raw_jobs` has rows but `extracted_jobs`, `role_matches` are empty.
- Cause is **known** — last pipeline run was on commit `9be8b96` which predates the Gemini model fix (`c97c898`). Extractor still called `gemini-1.5-flash` → 404 → 0 jobs extracted.
- Fix: re-trigger **Actions → Weekly ingestion pipeline → Run workflow** so it runs against `ec4fe13` (current `main`). Should populate `extracted_jobs` and `role_matches` on the next run. No code change required.
- After populated, Admin Pending tab should show matches (assuming Problem 1 is also fixed).

### Not in scope for next session unless user requests

- **Save-PDF redesign** (D5.1) — user wants browser/OS-independent PDF. Proposed approach: server-side `@react-pdf/renderer` route. User explicitly deferred to a later session.
- **Client's extra UI/UX feedback** — user mentioned the client has given additional info about how the website should look/behave. To be addressed in a later session.
- **Pipeline log artifact** — `upload-artifact` warning "No files found at apps/pipeline/*.log". Pipeline only logs to stderr; would need to add a `FileHandler` to `main.py` if log artifacts are wanted. Non-blocking.
- **Pathways table empty** — `seed_taxonomy.py` only seeds `industries` and `canonical_roles`. The taxonomy JSONs contain `pathways` data that isn't currently seeded. Cosmetic for now.
- **AI fallback chain doesn't trigger on stream-time errors** — in `apps/web/src/lib/ai-providers.ts::wrapWithBreaker()`, stream errors are caught silently and don't fall over to the next provider. Currently masked by the Gemini fix; would resurface if Gemini fails again.
- **Migrate Python `google.generativeai` → `google.genai`** — old package is officially deprecated (FutureWarning in pipeline log). Works for now but eventually needs migration.

### Open commits on main, status

- `main` is at `ec4fe13` (Bump upload-artifact to v5)
- All fixes from this session are pushed and live in `main`
- No uncommitted local changes expected (next session should `git status` to confirm)

### How to resume

1. User says "load version 2" (or equivalent).
2. Read this Session Checkpoint section in full.
3. Confirm git is on `main` and clean.
4. Start with **Problem 1** (Vercel env vars for admin DB connection) — ask user to verify env vars in Vercel and redeploy.
5. Once admin loads without the banner, move to **Problem 2** (re-trigger pipeline workflow).
6. Then continue with D5.1 PDF redesign and client UX feedback if user is ready.

