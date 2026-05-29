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
import time
import os
import logging
from anthropic import Anthropic, RateLimitError as AnthropicRateLimit
from supabase import Client

log = logging.getLogger(__name__)

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
    """Jaccard-like overlap between two skill lists (case-insensitive)."""
    if not job_skills or not role_skills:
        return 0.0
    job_set  = {s.lower() for s in job_skills}
    role_set = {s.lower() for s in role_skills}
    intersection = job_set & role_set
    union        = job_set | role_set
    return len(intersection) / len(union)


def title_similarity(job_title: str, role_title: str) -> float:
    """Simple word overlap between titles."""
    j_words = set(job_title.lower().split())
    r_words = set(role_title.lower().split())
    if not j_words or not r_words:
        return 0.0
    return len(j_words & r_words) / max(len(j_words), len(r_words))


def rank_candidates(extracted_job: dict, canonical_roles: list[dict]) -> list[dict]:
    """Score all canonical roles and return top-3."""
    job_skills  = extracted_job.get("skills", [])
    job_title   = extracted_job.get("normalized_title", "")
    job_seniority = extracted_job.get("seniority", "mid")

    scored = []
    for role in canonical_roles:
        skill_score  = skill_overlap_score(job_skills, role.get("skills", []))
        title_score  = title_similarity(job_title, role.get("title", ""))
        seniority_match = 1.0 if role.get("seniority") == job_seniority else 0.5
        combined = skill_score * 0.5 + title_score * 0.35 + seniority_match * 0.15
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


def _judge_with_gemini(prompt: str) -> dict | None:
    """Gemini fallback — only used if GEMINI_API_KEY is set."""
    gemini_key = os.environ.get("GEMINI_API_KEY")
    if not gemini_key:
        return None
    try:
        import google.generativeai as genai
        genai.configure(api_key=gemini_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(prompt)
        return _parse_judgment(response.text)
    except Exception as e:
        log.warning(f"Gemini judgment failed: {e}")
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
    if confidence >= 0.85:
        return "approved"
    if confidence >= 0.50:
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
        .select("id, normalized_title, skills, seniority, location")
        .limit(batch_size)
        .execute()
    )
    all_extracted = [r for r in (extracted_result.data or []) if r["id"] not in already_matched]

    log.info(f"Matching {len(all_extracted)} jobs against {len(canonical_roles)} canonical roles for {industry_slug}…")

    stats = {"matched": 0, "pending": 0, "rejected": 0}

    for job in all_extracted:
        top3 = rank_candidates(job, canonical_roles)
        if not top3 or top3[0]["score"] < 0.1:
            # Too weak a candidate — save as rejected without calling Claude
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
            # Flag for human review but don't match to an existing role
            confidence = 0.3
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

        # Auto-approved: update job count on canonical role
        if status == "approved":
            supabase.rpc("increment_job_count", {"role_id": best["id"]}).execute()

    log.info(f"  {industry_slug}: {stats}")
    return stats
