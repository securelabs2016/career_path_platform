"""
Ontology Matcher — Step 3 of the pipeline.

For each extracted_job:
1. Score against all canonical_roles using skill overlap + title similarity
2. Take top-3 candidates
3. Ask Claude Sonnet to make the final judgment: match / new-role / noise
4. Assign confidence score 0–1
5. Route: ≥0.85 → auto-approve | 0.50–0.84 → pending (human review) | <0.50 → rejected

We use skill overlap scoring instead of pgvector embeddings in the prototype
to avoid a third API dependency. The embedding column in the DB schema is
reserved for Phase 3 production upgrade (switch to pgvector + OpenAI embeddings
for better cross-industry matching at scale).
"""

import json
import re
import time
import os
import logging
from anthropic import Anthropic, RateLimitError as AnthropicRateLimit
from supabase import Client

log = logging.getLogger(__name__)

# Free-tier Gemini pacing — keep matcher under 15 RPM when Claude is absent.
GEMINI_PACE_SECONDS = 3.0

SENIORITY_RANK = {"entry": 0, "mid": 1, "senior": 2, "lead": 3}

MATCH_PROMPT = """You are an expert workforce taxonomist. Decide whether a scraped job posting matches a canonical career role.

CANONICAL ROLE:
Title: {role_title}
Cluster: {role_cluster}
Seniority: {role_seniority}
Skills: {role_skills}

SCRAPED JOB:
Normalized title: {job_title}
Seniority: {job_seniority}
Skills: {job_skills}

Rules:
- "match" = this job is clearly an instance of the canonical role (same function, similar level)
- "new_role" = this job represents a real role that doesn't exist in our taxonomy
- "noise" = not relevant to the industry, a stretch match, or too ambiguous to classify

Respond with ONLY a JSON object, no explanation:
{{"verdict": "match"|"new_role"|"noise", "confidence": 0.0-1.0, "reason": "one sentence"}}"""


def skill_overlap_score(job_skills: list[str], role_skills: list[str]) -> float:
    """
    Coverage of the smaller skill set by the intersection (not Jaccard).

    Why not Jaccard: scraped job postings often list 3–5 skills while
    canonical roles list 8+. Jaccard penalises this gap brutally — a job
    with 3 skills, 2 of which match a role's 8 skills, gets 2/9 = 0.22.
    Smaller-set normalisation gives 2/3 = 0.67, which better reflects
    "most of what the job needs is in this role."
    """
    if not job_skills or not role_skills:
        return 0.0
    job_set  = {s.lower().strip() for s in job_skills if s}
    role_set = {s.lower().strip() for s in role_skills if s}
    if not job_set or not role_set:
        return 0.0
    intersection = job_set & role_set
    smaller = min(len(job_set), len(role_set))
    return len(intersection) / smaller


def title_similarity(job_title: str, role_title: str) -> float:
    """Word overlap between titles, ignoring common filler tokens."""
    stop = {"the", "a", "of", "and", "for", "in", "to", "i", "ii", "iii", "1", "2", "3"}
    j_words = {w for w in re.findall(r"\w+", job_title.lower()) if w not in stop}
    r_words = {w for w in re.findall(r"\w+", role_title.lower()) if w not in stop}
    if not j_words or not r_words:
        return 0.0
    return len(j_words & r_words) / max(len(j_words), len(r_words))


def seniority_score(job_seniority: str, role_seniority: str) -> float:
    """Graded match — adjacent tiers are still good signal."""
    js = SENIORITY_RANK.get(job_seniority, 1)
    rs = SENIORITY_RANK.get(role_seniority, 1)
    diff = abs(js - rs)
    if diff == 0: return 1.0
    if diff == 1: return 0.7
    if diff == 2: return 0.4
    return 0.2


def rank_candidates(extracted_job: dict, canonical_roles: list[dict]) -> list[dict]:
    """
    Score all canonical roles and return top-3.

    Weights tuned for workforce taxonomy matching:
    - Title is the strongest signal humans use (40%)
    - Skill overlap is noisy but informative (40%)
    - Seniority alignment graded — adjacent tiers still count (20%)
    """
    job_skills    = extracted_job.get("skills", [])
    job_title     = extracted_job.get("normalized_title", "")
    job_seniority = extracted_job.get("seniority", "mid")

    scored = []
    for role in canonical_roles:
        skill_score = skill_overlap_score(job_skills, role.get("skills", []))
        title_score = title_similarity(job_title, role.get("title", ""))
        sen_score   = seniority_score(job_seniority, role.get("seniority", "mid"))
        combined    = title_score * 0.4 + skill_score * 0.4 + sen_score * 0.2
        scored.append({"role": role, "score": combined})

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:3]


def _parse_judgment(text: str) -> dict | None:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def _judge_with_claude(prompt: str, client: Anthropic) -> dict | None:
    message = client.messages.create(
        model="claude-sonnet-4-6",  # Sonnet for accuracy on judgment calls
        max_tokens=200,
        messages=[{"role": "user", "content": prompt}],
    )
    return _parse_judgment(message.content[0].text)


def _is_rate_limit_error(err: Exception) -> bool:
    s = str(err).lower()
    return "429" in s or "rate" in s or "quota" in s or "resourceexhausted" in s


def _judge_with_gemini(prompt: str, max_retries: int = 3) -> dict | None:
    """Gemini fallback — only used if GEMINI_API_KEY is set.
    Retries on rate-limit errors so we don't silently drop every other judgment
    once we hit the free tier's 15 RPM ceiling."""
    gemini_key = os.environ.get("GEMINI_API_KEY")
    if not gemini_key:
        return None
    try:
        import google.generativeai as genai
        genai.configure(api_key=gemini_key)
        model = genai.GenerativeModel("gemini-2.5-flash")
    except ImportError:
        return None

    for attempt in range(max_retries):
        try:
            response = model.generate_content(prompt)
            parsed = _parse_judgment(response.text)
            if parsed is None and attempt < max_retries - 1:
                log.warning(
                    f"Gemini judgment unparseable (attempt {attempt+1}): "
                    f"{(response.text or '')[:200]!r}"
                )
                time.sleep(2)
                continue
            return parsed
        except Exception as e:
            if _is_rate_limit_error(e) and attempt < max_retries - 1:
                wait = 5 * (2 ** attempt)
                log.warning(f"Gemini rate-limited (attempt {attempt+1}), waiting {wait}s…")
                time.sleep(wait)
                continue
            log.warning(f"Gemini judgment failed (attempt {attempt+1}): {e}")
            return None
    return None


def claude_judge(
    extracted_job: dict,
    candidate_role: dict,
    client: Anthropic | None,
    max_retries: int = 3,
) -> dict | None:
    """
    Judge whether a job matches a canonical role.
    If Claude is configured: tries Claude with retries, falls back to Gemini.
    If not: goes straight to Gemini.
    Returns None if everything fails — caller treats as low-confidence rejection.
    """
    prompt = MATCH_PROMPT.format(
        role_title=candidate_role.get("title", ""),
        role_cluster=candidate_role.get("cluster", ""),
        role_seniority=candidate_role.get("seniority", ""),
        role_skills=", ".join(candidate_role.get("skills", [])[:8]),
        job_title=extracted_job.get("normalized_title", ""),
        job_seniority=extracted_job.get("seniority", ""),
        job_skills=", ".join(extracted_job.get("skills", [])[:8]),
    )

    # No Claude key → skip directly to Gemini
    if client is None:
        return _judge_with_gemini(prompt)

    for attempt in range(max_retries):
        try:
            result = _judge_with_claude(prompt, client)
            if result:
                return result
        except AnthropicRateLimit:
            wait = 2 ** attempt
            log.warning(f"Claude rate limit on attempt {attempt+1}, waiting {wait}s…")
            time.sleep(wait)
        except Exception as e:
            log.warning(f"Claude judgment error (attempt {attempt+1}): {e}")
            if attempt == max_retries - 1:
                break
            time.sleep(2)

    # Fall back to Gemini
    log.info("Falling back to Gemini for judgment")
    return _judge_with_gemini(prompt)


def route_confidence(confidence: float) -> str:
    """
    Confidence → moderation bucket.
    Lower thresholds than the initial design — the original 0.85/0.50 gates
    produced ~100% rejections on the first real-world run because most
    scraped roles are not perfect-fit matches. 0.80/0.35 keeps the auto-approve
    bar high but gives the human admin queue more borderline cases to review,
    which is what the queue is for.
    """
    if confidence >= 0.80:
        return "approved"
    if confidence >= 0.35:
        return "pending"
    return "rejected"


def run_matcher(
    supabase: Client,
    anthropic: Anthropic | None,
    industry_slug: str,
    batch_size: int = 30,
) -> dict:
    """Match unmatched extracted_jobs against canonical_roles for one industry."""

    # Load canonical roles for this industry
    industry_result = (
        supabase.table("industries")
        .select("id")
        .eq("slug", industry_slug)
        .single()
        .execute()
    )
    if not industry_result.data:
        log.error(f"Industry {industry_slug!r} not found in DB — has the schema been seeded?")
        return {"matched": 0, "pending": 0, "rejected": 0}

    industry_id = industry_result.data["id"]

    roles_result = (
        supabase.table("canonical_roles")
        .select("id, title, cluster, seniority, skills")
        .eq("industry_id", industry_id)
        .execute()
    )
    canonical_roles = roles_result.data or []
    if not canonical_roles:
        log.warning(f"No canonical roles found for {industry_slug!r}.")
        return {"matched": 0, "pending": 0, "rejected": 0}

    # Load unmatched extracted_jobs
    matched_result = (
        supabase.table("role_matches")
        .select("extracted_job_id")
        .execute()
    )
    already_matched = {r["extracted_job_id"] for r in (matched_result.data or [])}

    extracted_result = (
        supabase.table("extracted_jobs")
        .select("id, normalized_title, skills, seniority, location, raw_jobs(company)")
        .limit(batch_size)
        .execute()
    )
    all_extracted = [r for r in (extracted_result.data or []) if r["id"] not in already_matched]

    log.info(f"Matching {len(all_extracted)} jobs against {len(canonical_roles)} canonical roles for {industry_slug}…")

    stats = {"matched": 0, "pending": 0, "rejected": 0}
    gemini_only = anthropic is None

    for i, job in enumerate(all_extracted):
        # Pace Gemini-only runs to stay under the free-tier 15 RPM ceiling.
        if gemini_only and i > 0:
            time.sleep(GEMINI_PACE_SECONDS)

        top3 = rank_candidates(job, canonical_roles)
        if not top3 or top3[0]["score"] < 0.05:
            # Almost no signal at all — reject pre-AI without spending API calls.
            # Threshold lowered from 0.10 to 0.05 so more borderline candidates
            # get a real AI judgment instead of being thrown away.
            supabase.table("role_matches").insert({
                "extracted_job_id":  job["id"],
                "canonical_role_id": top3[0]["role"]["id"] if top3 else canonical_roles[0]["id"],
                "confidence":        0.0,
                "status":            "rejected",
            }).execute()
            stats["rejected"] += 1
            continue

        best = top3[0]["role"]
        judgment = claude_judge(job, best, anthropic)
        if not judgment or judgment.get("verdict") == "noise":
            confidence = 0.1
        elif judgment.get("verdict") == "new_role":
            # "new_role" means the AI thinks this is a real job that doesn't
            # fit any existing canonical role. The whole point of this verdict
            # is to surface it to a human reviewer — so it must land in the
            # pending bucket (>=0.35), not auto-rejected.
            confidence = 0.5
        else:
            confidence = float(judgment.get("confidence", 0.5))

        status = route_confidence(confidence)
        stats[status if status == "rejected" else ("matched" if status == "approved" else "pending")] += 1

        supabase.table("role_matches").insert({
            "extracted_job_id":  job["id"],
            "canonical_role_id": best["id"],
            "confidence":        round(confidence, 2),
            "status":            status,
        }).execute()

        # Auto-approved: update job count + hiring company on the canonical role
        if status == "approved":
            supabase.rpc("increment_job_count", {"role_id": best["id"]}).execute()
            # Phase 2.3 — doc Step 5 requires "company list" on each canonical role
            company = ((job.get("raw_jobs") or {}).get("company") or "").strip()
            if company:
                _add_hiring_company(supabase, best["id"], company)

    log.info(f"  {industry_slug}: {stats}")
    return stats


def _add_hiring_company(supabase: Client, role_id: str, company: str) -> None:
    """Append `company` to canonical_roles.hiring_companies if not already present.

    Read-then-write keeps the array deduplicated. Postgres has no native
    array_distinct, and the matcher is single-threaded per industry so there's
    no race here. If concurrency is added later, switch to a SQL RPC that does
    DISTINCT-style append atomically.
    """
    try:
        row = (
            supabase.table("canonical_roles")
            .select("hiring_companies")
            .eq("id", role_id)
            .single()
            .execute()
        )
        current = (row.data or {}).get("hiring_companies") or []
        if company in current:
            return
        updated = current + [company]
        supabase.table("canonical_roles").update(
            {"hiring_companies": updated}
        ).eq("id", role_id).execute()
    except Exception as e:
        # Don't crash the pipeline if this one update fails — the job count
        # already incremented and the match is still recorded.
        log.warning(f"Could not update hiring_companies for role {role_id}: {e}")
