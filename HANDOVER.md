# Career Pathways Platform — Handover Document

This document is what an operations or workforce-development lead needs to **run, monitor, and update** the platform after handover. It assumes no familiarity with the codebase.

If you're a developer joining the project, also read `README.md` and `CLAUDE.md`.

---

## 1. Quick links

| Resource | URL / Location | Who needs it |
|---|---|---|
| Live website | _set after deploy_ — your Vercel project URL | Everyone |
| Admin queue | `/admin` on the live site | Reviewer |
| Vercel dashboard | https://vercel.com/dashboard | Developer |
| Supabase dashboard | https://app.supabase.com | Developer |
| GitHub repository | https://github.com/securelabs2016/career_path_platform | Developer |
| GitHub Actions | Repo → "Actions" tab | Developer / Reviewer |

---

## 2. What's running where

| Component | Hosting | Cost |
|---|---|---|
| Website (Next.js) | Vercel (Hobby tier during prototype) | $0 / month |
| Database + auth | Supabase Free tier (500 MB) | $0 / month |
| Ingestion pipeline | GitHub Actions cron (Mondays 10:00 UTC) | Free for public repos / 2k minutes free for private |
| AI advisor (dolphIQ) | Gemini Free → OpenAI fallback | $0–10 / month at v1 traffic |
| AI extraction + matching | Same providers | $5–20 / month at v1 traffic |
| Domain (if custom) | Registrar of your choice | ~$12 / year |

Total prototype operating cost: **~$0–30 / month** depending on AI usage.
See `STAKEHOLDER_REPORT.md` for projected costs at 1k and 10k users.

---

## 3. Credentials you must have

The developer should hand these to you in a password manager (1Password / Bitwarden) — **never in plain text or email**.

| Credential | Used by | Where stored |
|---|---|---|
| Admin password | The `/admin` review queue | Vercel env var `ADMIN_PASSWORD` |
| Supabase service role key | Pipeline + admin backend | Vercel + GitHub Actions secrets |
| Supabase URL + anon key | Public website | Vercel env var `NEXT_PUBLIC_SUPABASE_*` |
| Gemini API key | dolphIQ + pipeline | Vercel + GitHub Actions secrets |
| OpenAI API key | dolphIQ fallback | Vercel env var |
| Vercel login | Deployment management | Personal — invite team members in dashboard |
| Supabase login | Database administration | Personal — invite team members in dashboard |
| GitHub login | Repository management | Personal — invite team members in repo settings |

---

## 4. Weekly maintenance — what the reviewer does

The platform is designed to mostly run itself. Here is the one recurring task:

### Mondays after 10:30 UTC — review the admin queue

1. Open `/admin` on the live site, enter the admin password
2. The **Pending** tab shows job matches the AI was uncertain about (confidence 0.35–0.79)
3. For each: read the job posting (linked) and the proposed canonical role; click **Approve** if the match is right, **Reject** otherwise
4. Approved matches immediately update the "live openings" amber dots on the public map
5. Aim to keep the queue under 30 items — ~1 hour per week is enough

### What approve / reject means

| Action | What happens |
|---|---|
| Approve | The match becomes part of the canonical role's `open_jobs_count`. The website shows it as a real opening. The job's URL is logged in `hiring_companies` if the company is new. |
| Reject | The match is dismissed. The job is gone from the queue. Use this for "wrong role mapped" or "job posting is a scam / outdated." |

A reviewer should expect ~10–40 pending items per week at v1 traffic, depending on how many companies are hiring.

---

## 5. Updating role data

If the client publishes new research or wants to add/edit roles:

1. The role taxonomy lives in `apps/web/src/data/*.json` (one file per industry)
2. Edit a role in the JSON — `title`, `description`, `salary_min/max`, `salary_range`, `skills`, etc.
3. Push to `main`. Vercel redeploys automatically; the website shows new data immediately.
4. Run the **"Seed taxonomy data"** workflow in GitHub Actions to push the same changes to Supabase so the pipeline matches against the new data.

### Adding a brand-new industry

See `README.md` → "Adding a new industry" — it's a 5-step process and takes about 30 minutes once the role data is researched.

---

## 6. Common operational questions

### "The chat isn't answering."

1. Check the Vercel function logs (Vercel dashboard → Logs)
2. If you see `429` errors, an AI provider hit its rate limit. dolphIQ has automatic fallback (Gemini → OpenAI) — if both are exhausted, you'll need to wait or top up the OpenAI account.
3. If you see `503` errors, no AI provider is configured. Verify env vars are set in Vercel.

### "The map shows 0 open openings for every role."

1. Check that the pipeline has run recently: Actions tab → "Weekly ingestion pipeline" → most recent run should be within the last 7 days
2. Check the run log: each role match goes to `approved`, `pending`, or `rejected`. If everything is `rejected`, the matcher may be too strict — talk to the developer.
3. Approved matches update `canonical_roles.open_jobs_count` in Supabase. Verify in the Supabase Table Editor.

### "I want to change dolphIQ's tone / wording."

The dolphIQ persona is defined in `apps/web/src/app/api/agent/chat/route.ts` under `buildSystemPrompt`. Edit the prompt, commit, push — Vercel redeploys.

### "Costs are climbing."

Most likely an abuse pattern: someone is sending many chat requests from one IP. In-app rate limits are 15 messages/hour and 80/day per IP. If those aren't enough, raise them in `apps/web/src/lib/rate-limit.ts`. For runaway costs from the AI providers themselves, set spending caps in the Anthropic / OpenAI / Google billing dashboards.

---

## 7. Known issues at handover

| # | Issue | Impact | Plan |
|---|---|---|---|
| 1 | Save-PDF on role detail pages uses the browser's print dialog, not server-side PDF rendering | Output looks fine but column layout cramps on small print viewports; behavior varies slightly across browsers | Server-side render via `@react-pdf/renderer` — deferred to v2; estimated half-day of work |
| 2 | **AM adjacency data is hand-curated and not workforce-SME validated.** Edges were authored from public role-similarity heuristics, not BLS / America-Makes / AM-USA research | Click-chain paths on the AM map are plausible but not citation-grade. Senior reviewers may flag specific edges | v2: workforce-SME validation pass; budget ~1 week of domain-expert time |
| 3 | **Space adjacency data is hybrid: 22 of 38 roles use AI-generated forward-directional edges (Gemini), 16 fall back to hand-curated edges.** | Same quality caveat as #2. The 16 fallback roles can have backward-direction edges (mid → entry) which read as demotions | v2: re-run the AI migration once free-tier Gemini quota resets OR with paid OpenAI key, then SME validation |
| 4 | **Semi roles (84 from the reference taxonomy) have only `title` / `salary` / `degree` populated** — `description`, `skills`, `certifications` are empty | Role detail modal looks sparse on Semi vs AM/Space | Backfill from SEMI workforce hub / SIA reports; ~2 days per cluster |
| 5 | Curated `pathways` (the curved-arrow learning-path overlay) are intentionally empty on AM and Semi, retained on Space | None visible (we removed the overlay per UX feedback) — pathways still exist in the JSON shape, just empty arrays | Re-populate if the learning-paths UI is reintroduced |
| 6 | `AgentChat` citation regex `\[[a-z]+-r-\d+\]` matches AM/Space role IDs (e.g. `am-r-01`) but NOT descriptive Semi IDs (e.g. `chief-product-architect`) | Chat still answers correctly; auto-linking from cited role names is broken for Semi only | Broaden regex to `\[[a-z][a-z0-9-]+\]`, scope-checked against `roleById` so non-role square-brackets don't render as links |
| 7 | Python pipeline uses the deprecated `google.generativeai` package (FutureWarning in pipeline logs) | Works today; will need migration when Google removes the legacy SDK | Migrate to `google.genai` ahead of Google's EOL date |
| 8 | Supabase `pathways` table is empty (seeder loads `industries` + `canonical_roles` only) | None visible — pathways render directly from JSON, no DB roundtrip | Add pathways INSERT to `seed_taxonomy.py` if the pipeline ever needs them |

---

## 8. Support handoff

When something is genuinely broken (not "the chat is slow today"), here's the troubleshooting order:

1. **Check the live site** — does it load? If not, Vercel deploy is broken.
2. **Check Vercel function logs** — most runtime errors show here within 60 seconds.
3. **Check Supabase status** — sometimes the free tier pauses after 7 days of inactivity (Pro fixes this).
4. **Check GitHub Actions** — the last pipeline run shows the most recent state of the matcher.
5. **Check `STAKEHOLDER_REPORT.md` → Roadmap** — the issue may already be a known scaling threshold.

---

## 9. Going to production

The platform is designed to start free-tier and scale incrementally. Section 7 of `STAKEHOLDER_REPORT.md` outlines the four-phase production roadmap:

- **Phase 1 (months 1–2)**: add authentication, move Vercel Hobby → Pro, add Sentry, add analytics
- **Phase 2 (months 3–6)**: Supabase Pro, prompt caching, scheduled DB backups, monitoring dashboard
- **Phase 3 (months 6–12)**: multi-tenancy, real queue system, read replicas, A/B testing infra, SOC 2 prep
- **Phase 4 (12+)**: AWS RDS, public API, mobile app, ML on top of the taxonomy

Each phase is opt-in based on traffic and revenue.

---

## 10. Who to contact

| Topic | Contact |
|---|---|
| Code changes | _Developer name + email_ |
| Hosting / Vercel | _Account holder_ |
| Database / Supabase | _Account holder_ |
| AI billing (Anthropic / OpenAI / Google) | _Account holder_ |
| Domain | _Registrar contact_ |
| Workforce / role-data updates | _Client subject-matter expert_ |

**Recommendation**: keep all five accounts under a shared workspace where possible (Vercel team, Supabase org, GitHub org) so handover to a future developer doesn't require account migration.
