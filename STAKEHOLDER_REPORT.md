# Career Pathways Platform — Stakeholder Report

**Prepared:** June 2026
**Status:** Prototype complete, live on Vercel
**Document version:** 1.0

This is a 5-section report covering what was built, how it works, what it costs, how to demo it, and what comes next. Suitable for non-technical stakeholders, funders, and workforce-development partners.

---

## 1. Executive Summary

### What was built

A live web platform that gives anyone — students, career changers, workforce advisors, policy makers — a way to **explore the U.S. workforce landscape in three strategic industries**:

- **Additive Manufacturing** — 36 roles across 5 functional clusters
- **Semiconductors** — ~45 roles across 5 clusters
- **Space Industry** — 38 roles across 6 clusters

Each industry is rendered as an interactive career lattice (a 2-D map: functional clusters across the top, seniority tiers down the side). Users can:
- **Click any role** to see its details, salary range, education requirements, prerequisite roles, and next-step opportunities
- **Build a multi-role career path** by chaining roles together — and share that path as a URL
- **Talk to dolphIQ**, the AI guide, in natural language: "How do I become a propulsion engineer?" or "Which space roles pay over $150k without an aerospace degree?"
- **See live job openings** — a background pipeline scrapes real postings weekly and matches them to roles on the map, surfacing "amber dots" on any role with current hiring activity

### Key numbers

| Metric | Value |
|---|---|
| Live industries | **3** (Additive Manufacturing, Semiconductors, Space) |
| Total canonical roles | **119** |
| Career pathways | **16** |
| AI providers configured | **3** (Gemini primary, OpenAI fallback, Claude when key available) |
| Job-board sources scraped | **2** (Greenhouse + Lever) |
| Pipeline frequency | **Weekly** (Mondays 10:00 UTC) |
| Operating cost at prototype scale | **~$0–30 / month** |

### What makes this v1 unusually strong

The original build plan called for two industries (AM + Semi) and "Space documented as next-up scope." In delivery, **Space is fully built**, the platform has a branded AI character (**dolphIQ**) with its own identity and tagline, the role detail page supports bidirectional career exploration (prerequisite + next-step), and the path builder lets users construct multi-role journeys they can share via URL.

All three industries also have a self-contained "About this Map" panel explaining methodology, layout, and data sources — making the platform credible enough to drop into a stakeholder meeting on day one.

---

## 2. Architecture (simplified)

Two systems that work together but ship independently. Either can be deployed, updated, or temporarily taken down without affecting the other.

```
┌─────────────────────────────────────────────────────────────┐
│                          USER                               │
│  (student / advisor / policy maker — any modern browser)    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  SYSTEM A — The Website  (Next.js on Vercel)                │
│                                                             │
│  • Static role taxonomies (JSON, edited in-repo)            │
│  • Interactive career map                                   │
│  • Role detail pages                                        │
│  • Path builder + Save-and-Share URLs                       │
│  • dolphIQ AI guide (streaming chat with provider fallback) │
│  • Admin queue for reviewing AI job matches                 │
└──────────────────────────┬──────────────────────────────────┘
                           │ reads + writes
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  SHARED STATE — Supabase (Postgres + pgvector)              │
│                                                             │
│  Tables:                                                    │
│    industries · canonical_roles · pathways                  │
│    raw_jobs · extracted_jobs · role_matches                 │
│    review_decisions                                         │
└──────────────────────────▲──────────────────────────────────┘
                           │ writes only
                           │
┌─────────────────────────────────────────────────────────────┐
│  SYSTEM B — Ingestion Pipeline  (GitHub Actions, weekly)    │
│                                                             │
│  Step 1  Scrape Greenhouse + Lever public job boards        │
│  Step 2  AI extracts structured fields from each posting    │
│  Step 3  Skill+title scoring picks the best canonical role  │
│  Step 4  AI judges the match: match / new-role / noise      │
│  Step 5  Route by confidence:                               │
│            ≥0.80  → auto-approved (live on map)             │
│            ≥0.35  → pending (admin queue)                   │
│            <0.35  → rejected                                │
└─────────────────────────────────────────────────────────────┘
```

### Why this design

- **Editing role data is just a pull request** — no specialized CMS, no separate admin app to maintain
- **The website can serve millions of users without database hits** — taxonomy is statically generated at build time
- **The pipeline runs on free GitHub Actions minutes** — no servers to manage
- **dolphIQ has automatic failover** — if Gemini hits its free-tier rate limit, OpenAI takes over within milliseconds; users never see a "service unavailable" message
- **Adding a new industry takes ~30 minutes** once the role research is in JSON form

---

## 3. Live cost dashboard

### Today (prototype scale)

| Item | Monthly cost | Notes |
|---|---|---|
| Vercel Hobby | $0 | Non-commercial — flag for paid pilot |
| Supabase Free | $0 | 500 MB database, 5 GB bandwidth |
| GitHub Actions | $0 | Public repo, or 2,000 free private-repo minutes |
| Gemini API (primary) | $0 | Free tier: 10 req/min, 250 req/day |
| OpenAI API (fallback) | $0–5 | Only kicks in when Gemini is rate-limited |
| Anthropic API | not configured | Optional primary; not currently active |
| Domain | $1 / month equivalent | Annualized from $12/year if a custom domain is registered |
| **Total** | **~$1–6 / month** | |

### Projected — 1,000 monthly active users

| Item | Monthly cost |
|---|---|
| Vercel Hobby | $0–20 (may need Pro if commercial) |
| Supabase Free | $0 |
| AI usage (chat + pipeline) | $10–40 |
| **Total** | **~$10–60 / month** |

### Projected — 10,000 monthly active users (production)

Assumptions: 30% of users engage with dolphIQ (~3,000 chat sessions), 5 questions average per session, pipeline processes ~5,000 jobs per week.

| Item | Monthly cost | Notes |
|---|---|---|
| Vercel Pro | $20 | 1 seat — required for commercial use |
| Vercel bandwidth overage | $0–40 | Depends on traffic |
| Supabase Pro | $25 | 8 GB DB, point-in-time restore |
| Supabase compute | $0–60 | Most apps stay in base |
| AI agent (chat) | $80–250 | Heavy fluctuation based on model mix |
| AI pipeline | $30–80 | Extraction + matching at scale |
| Prompt caching savings | -$60 | Stable system prompts qualify for cache discounts |
| Sentry error tracking | $26 | |
| PostHog analytics | $0–80 | Free up to 1M events |
| Resend transactional email | $20 | For digest emails and password resets when auth is added |
| **Total** | **~$420–600 / month** | At 10,000 monthly active users |

### Cost levers if budget is tight at scale

- **Prompt caching on Anthropic** — cuts agent costs 50–80% when the system prompt is stable
- **Route simple queries to Haiku, complex ones to Sonnet** — 5–10× cheaper
- **Cache common dolphIQ queries in Redis** — career-advisor questions follow patterns
- **Run pipeline biweekly instead of weekly** on stable industries

---

## 4. Demo script — 90 seconds

A narrative for showing the platform to a stakeholder, funder, or partner. Practiced delivery: 90 seconds.

> *"This is the Career Pathways Platform — three industries we believe matter for the next decade of American workforce: Additive Manufacturing, Semiconductors, and the Space Industry."*
>
> **[click into Additive Manufacturing]**
>
> *"Every role in this industry, laid out as a map. Across the top — what the company does. Down the side — how senior the role is. Entry level on the bottom, principal and director on top. So you can immediately see: where does someone with a high-school diploma enter, and what paths do they have upward?"*
>
> **[click on a machine technician card]**
>
> *"Here's a machine technician — $48k to $65k. Click it: you see prerequisite roles on the left, next-step roles on the right. So this isn't just a list — it's a career navigation tool."*
>
> **[click an adjacent role, then another, building a path]**
>
> *"And users can build their own path. I just chained three roles together — technician, supervisor, operations manager. That's a 10-year journey, going from $48k to $150k. I can save and share this exact path as a link."*
>
> **[click the floating dolphIQ icon]**
>
> *"And if you have a specific question — meet dolphIQ. Smart AI guide named after the most intelligent species in the ocean. Watch — I'll ask 'how do I become a process engineer without a four-year degree?' It pulls real roles from the map, with salaries, and tells me exactly the cert and the technician role I need to start from. Every role it mentions is a clickable link."*
>
> **[switch to Space Industry]**
>
> *"And we have the same depth in Space — propulsion, mission ops, launch operations, all the way up to chief engineer at $250k. This is workforce-development infrastructure that scales to any strategic industry the country invests in."*

### Stakeholder Q&A — anticipated questions

| Question | Short answer |
|---|---|
| "Is the data live?" | Yes — a weekly background process pulls real job postings from Greenhouse and Lever, AI matches them to canonical roles, and surfaces them as amber dots on the map. |
| "How accurate is dolphIQ?" | It's grounded in our role taxonomy — it can't make up roles or salaries. There's an explicit disclaimer telling users to verify with a human advisor before major decisions. |
| "Can we add my industry?" | Yes. Once the role research is in spreadsheet form, technical onboarding is ~30 minutes. Research itself is the expensive part — ~1 week of domain-expert time per industry. |
| "What's it cost to run?" | $0–6 today, ~$60/month at 1,000 users, ~$500/month at 10,000 users. |
| "Who owns the data?" | All taxonomy and code is in a private GitHub repository. Custodian is whoever holds repo access; portable to any cloud. |

---

## 5. Roadmap

### Where the prototype lands (today)

✅ Live at a public URL with HTTPS
✅ All three industries fully populated (119 roles)
✅ Interactive map, role detail with Prerequisites + Next-Step, multi-role path builder
✅ dolphIQ AI guide with multi-provider fallback
✅ Mobile responsive
✅ Filters + search + URL-based sharing
✅ Admin review queue (accessible)
✅ Pipeline runs weekly via GitHub Actions
✅ README + License + handover documentation

### Phase 1 — Soft launch (months 1–2)

| Initiative | Why it matters |
|---|---|
| Add user authentication | Lets users save pathways across visits and receive email digests |
| Move Vercel Hobby → Pro ($20/mo) | Required for commercial use; unlocks 60-second function timeouts |
| Add Sentry error tracking ($0–26/mo) | Catch errors before users report them |
| Add analytics with funnel tracking | Understand which industries get traffic, what users ask dolphIQ, where they drop off |
| Add SEO content per role | ~150 roles × 300 words = 45,000 words of indexed content driving organic traffic |

### Phase 2 — Scaling to 1k–10k users (months 3–6)

| Initiative | Why it matters |
|---|---|
| Supabase Free → Pro ($25/mo) | Removes the 7-day pause and adds point-in-time restore |
| Add prompt caching on AI calls | Reduces agent costs 50–80% |
| Implement abuse rate limiting at edge | Prevents runaway bills from bots |
| CDN-cache static taxonomy data | Serve from Vercel edge instead of API on every page load |
| Set up scheduled DB backups to S3 | Defense in depth beyond Supabase's auto-backups |
| Add monitoring dashboard | Single page with DAU, agent chats/day, jobs ingested this week, error rate, cost burn |
| Set weekly content review cadence | Reviewer keeps the admin queue under 30 items |
| Legal review for scraping | Even with public APIs, a one-page memo from a lawyer is good practice before any government or DoD-adjacent contracts |

### Phase 3 — 10,000+ users and revenue (months 6–12)

| Initiative | Why it matters |
|---|---|
| Multi-tenancy | Workforce boards, community colleges, and corporate L&D teams want their own branded views |
| Lightcast/Emsi integration | State-level wage and projection data — required credibility for selling to government and education |
| Move ingestion to a real queue system | GitHub Actions cron is fine through ~50k jobs/week; beyond that, Modal/Inngest/Fly.io adds retry and observability |
| Database read replicas | Supabase Pro supports this — reads dominate traffic |
| Background queue for heavy AI calls | Long RAG queries should be enqueued, not run inline |
| A/B testing infrastructure | Test prompts, page layouts, conversion flows |
| Customer support tooling | Linear or HubSpot — expect 5–20 support emails per week at 10k MAU |
| SOC 2 prep | $10k/year starting; required for enterprise or DoD-adjacent buyers |
| Accessibility audit | WCAG 2.1 AA compliance is non-negotiable for government buyers |

### Phase 4 — Beyond 10,000 (months 12+)

If/when the platform is clearly a business:

- Move database off Supabase to AWS RDS or Aurora — required for AWS-region-specific data residency (especially Space + defense customers needing GovCloud)
- Dedicated AI inference contracts with Anthropic at committed-spend discounts
- Public API for workforce boards and EdTech partners to integrate against
- React Native mobile app — the map is naturally touch-friendly
- Spanish localization first (large workforce overlap in U.S. AM/manufacturing), then EU languages
- ML on top of the taxonomy — predict career transitions from cohort data, recommend pathways probabilistically rather than rule-based

---

## Closing note

This platform was built free-tier as a prototype. Every architectural choice — from the static-JSON taxonomy to the multi-provider AI fallback to the GitHub Actions cron pipeline — was made so the path from $0/month to $500/month at 10k users is a series of incremental flips, not a rewrite.

The hard part — establishing a credible role taxonomy, a working AI agent grounded in that taxonomy, a live ingestion pipeline, and the workforce-credibility surface (About panel, prerequisite roles, exact salary ranges from research) — is done.

The remaining roadmap is mostly operational scaling, not technical reinvention.

---

*This report should be read alongside `README.md` (technical) and `HANDOVER.md` (operational). For source code and deployment history, see the GitHub repository.*
