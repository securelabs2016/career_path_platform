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
                                                                  confidence ≥ 0.80 ──────────────────────────────────→├─ status='approved' + increment_job_count RPC
                                                                  0.35 ≤ confidence < 0.80 ────────────────────────────├─ status='pending' (admin queue)
                                                                  confidence < 0.35 ────────────────────────────────────└─ status='rejected'
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
- `docs/career-platform-build-doc.pdf` — the original client spec; useful for understanding the "why" behind design decisions like the confidence routing thresholds and the AM/Semi/Space prioritization

