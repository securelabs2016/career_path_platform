"""
Extractor — Step 2 of the pipeline.

For each unprocessed raw_job, calls an AI model to extract structured fields:
  normalized_title, skills[], seniority, location

Provider order: Claude Haiku (cheap+fast) → Gemini Flash (free tier fallback)

Retry policy:
  - Up to 3 attempts per job
  - Exponential backoff on rate limit errors (Claude: 2/4/8s, Gemini: 5/10/20s)
  - Pacing sleep when running Gemini-only (free tier: 15 RPM)
  - Skip the job if all retries fail (log + continue — don't crash the pipeline)
"""

import json
import re
import time
import os
import logging
from anthropic import Anthropic, RateLimitError as AnthropicRateLimit
from supabase import Client

# Gemini free tier is 15 requests/min. Pacing 4s ≈ 15 RPM exactly.
# Slightly aggressive at 3s — relies on retry-with-backoff for the occasional 429.
GEMINI_PACE_SECONDS = 3.0

log = logging.getLogger(__name__)

EXTRACTION_PROMPT = """Extract structured information from this job posting. Return ONLY a JSON object — no markdown, no explanation.

Required fields:
- normalized_title: string — clean job title, remove company name / location / level suffixes
- skills: array of strings — specific technical skills mentioned (max 10)
- seniority: one of "entry", "mid", "senior", "lead" — infer from title/requirements
- location: string — city/state or "Remote" or "Hybrid" (null if not found)
- country: 2-letter ISO code where the job is located ("US" for United States including Remote-US, "GB", "DE", "IN", "IL", etc.) — use "XX" if ambiguous like "Multiple Locations" or truly remote-anywhere

Job posting:
TITLE: {title}
COMPANY: {company}
DESCRIPTION: {description}"""

# ── US-location fast-path classifier ──────────────────────────────────────────
# Recognise obvious US-located jobs WITHOUT a separate AI call so the country
# tag is reliable even when the AI extractor misses it. Used as a safety net
# after the AI returns — if it didn't answer or guessed wrong on something
# obviously US, this overrides to "US".

import re as _re  # local alias to avoid shadowing top-of-file imports

_US_STATE_ABBREVS = (
    "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS "
    "MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV "
    "WI WY DC PR"
).split()
_US_STATE_NAMES = {
    "alabama","alaska","arizona","arkansas","california","colorado","connecticut",
    "delaware","florida","georgia","hawaii","idaho","illinois","indiana","iowa",
    "kansas","kentucky","louisiana","maine","maryland","massachusetts","michigan",
    "minnesota","mississippi","missouri","montana","nebraska","nevada",
    "new hampshire","new jersey","new mexico","new york","north carolina",
    "north dakota","ohio","oklahoma","oregon","pennsylvania","rhode island",
    "south carolina","south dakota","tennessee","texas","utah","vermont","virginia",
    "washington","west virginia","wisconsin","wyoming","district of columbia",
    "puerto rico",
}
_US_PATTERNS = _re.compile(
    r"\b(united states|u\.?s\.?a?\.?|remote\s*[-—–]\s*u\.?s\.?|remote\s*-\s*united\s*states)\b",
    _re.IGNORECASE,
)
_AMBIGUOUS_PATTERNS = _re.compile(
    r"\b(multiple\s+locations|remote\s*[-—–]\s*anywhere|various)\b",
    _re.IGNORECASE,
)


def classify_us_country(location_text: str) -> str | None:
    """
    Fast deterministic classifier. Returns:
      "US" if the text clearly names a US state, city+state, or US patterns
      "XX" if obviously ambiguous ("Multiple Locations", "Remote — Anywhere")
      None if can't tell — caller should fall back to the AI's answer
    """
    if not location_text:
        return None
    text = location_text.strip()

    if _AMBIGUOUS_PATTERNS.search(text):
        return "XX"
    if _US_PATTERNS.search(text):
        return "US"

    # State name appears as a word (case-insensitive)
    text_lower = text.lower()
    if any(state in text_lower for state in _US_STATE_NAMES):
        return "US"

    # State abbreviation right after a comma — "Hillsboro, OR" or "Austin, TX"
    if _re.search(rf",\s*({'|'.join(_US_STATE_ABBREVS)})\b", text):
        return "US"

    return None


def _parse_json_response(text: str) -> dict | None:
    """
    Strip markdown fences and parse JSON.
    Falls back to extracting the first {...} block if the model wrapped JSON
    in explanatory text. Gemini in particular sometimes prepends commentary.
    """
    if not text:
        return None
    text = text.strip()
    if text.startswith("```"):
        # Strip ```json ... ``` or ``` ... ``` fences
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Fallback: pull out the first JSON object anywhere in the text
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        return None


def _extract_with_claude(raw_job: dict, client: Anthropic) -> dict | None:
    prompt = EXTRACTION_PROMPT.format(
        title=raw_job.get("raw_title", ""),
        company=raw_job.get("company", ""),
        description=(raw_job.get("raw_description", "") or "")[:3000],
    )
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    return _parse_json_response(message.content[0].text)


def _is_rate_limit_error(err: Exception) -> bool:
    s = str(err).lower()
    return "429" in s or "rate" in s or "quota" in s or "resourceexhausted" in s


def _extract_with_gemini(raw_job: dict, max_retries: int = 3) -> dict | None:
    """
    Gemini fallback — only used if GEMINI_API_KEY is set.
    Retries on rate-limit errors with exponential backoff so we don't silently
    lose every other job once we hit the free tier's 15 RPM ceiling.
    """
    gemini_key = os.environ.get("GEMINI_API_KEY")
    if not gemini_key:
        return None
    try:
        import google.generativeai as genai
        genai.configure(api_key=gemini_key)
        model = genai.GenerativeModel("gemini-2.5-flash")
    except ImportError:
        log.warning("google-generativeai package not installed; Gemini fallback unavailable.")
        return None

    prompt = EXTRACTION_PROMPT.format(
        title=raw_job.get("raw_title", ""),
        company=raw_job.get("company", ""),
        description=(raw_job.get("raw_description", "") or "")[:3000],
    )

    for attempt in range(max_retries):
        try:
            response = model.generate_content(prompt)
            parsed = _parse_json_response(response.text)
            if parsed is None:
                # Log first 200 chars so the next run's log shows what failed
                log.warning(
                    f"Gemini returned unparseable response (attempt {attempt+1}): "
                    f"{(response.text or '')[:200]!r}"
                )
                if attempt < max_retries - 1:
                    time.sleep(2)
                    continue
            return parsed
        except Exception as e:
            if _is_rate_limit_error(e) and attempt < max_retries - 1:
                wait = 5 * (2 ** attempt)  # 5s, 10s, 20s
                log.warning(f"Gemini rate-limited (attempt {attempt+1}), waiting {wait}s…")
                time.sleep(wait)
                continue
            log.warning(f"Gemini extraction failed (attempt {attempt+1}): {e}")
            return None
    return None


def extract_job(raw_job: dict, client: Anthropic | None, max_retries: int = 3) -> dict | None:
    """
    Extract structured fields from one raw job.
    If Claude is configured: try Claude first with retry + backoff, fall back to Gemini.
    If not: go straight to Gemini.
    """
    # No Claude key → skip Claude entirely
    if client is None:
        return _extract_with_gemini(raw_job)

    for attempt in range(max_retries):
        try:
            result = _extract_with_claude(raw_job, client)
            if result:
                return result
        except AnthropicRateLimit:
            wait = 2 ** attempt  # 2s, 4s, 8s
            log.warning(f"Claude rate limit on attempt {attempt+1}, waiting {wait}s…")
            time.sleep(wait)
        except Exception as e:
            log.warning(f"Claude extraction error (attempt {attempt+1}): {e}")
            if attempt == max_retries - 1:
                break
            time.sleep(2)

    # All Claude attempts failed — try Gemini
    log.info(f"Falling back to Gemini for job {raw_job.get('id')}")
    return _extract_with_gemini(raw_job)


def run_extractor(supabase: Client, anthropic: Anthropic | None, batch_size: int = 50) -> int:
    """
    Find raw_jobs that have no extracted_job yet, extract each one.
    Returns the number of jobs successfully extracted.
    """
    raw_result = (
        supabase.table("raw_jobs")
        .select("id, raw_title, company, raw_description, industry")
        .limit(batch_size)
        .execute()
    )
    all_raw = raw_result.data or []
    if not all_raw:
        log.info("No raw jobs found.")
        return 0

    # Filter already-extracted
    raw_ids = [r["id"] for r in all_raw]
    extracted_result = (
        supabase.table("extracted_jobs")
        .select("raw_job_id")
        .in_("raw_job_id", raw_ids)
        .execute()
    )
    already_done = {r["raw_job_id"] for r in (extracted_result.data or [])}
    to_process   = [r for r in all_raw if r["id"] not in already_done]

    log.info(f"Extracting {len(to_process)} new jobs (skipping {len(already_done)} already done)…")

    # Pace Gemini-only runs to stay under the free tier's 15 RPM ceiling.
    gemini_only = anthropic is None

    extracted_count = 0
    for i, raw in enumerate(to_process):
        if gemini_only and i > 0:
            time.sleep(GEMINI_PACE_SECONDS)

        fields = extract_job(raw, anthropic)
        if not fields:
            log.warning(f"Skipping job {raw['id']} — all extraction attempts failed")
            continue

        # Country tagging — fast-path classifier overrides AI guess on obvious cases.
        # "US" if clearly located in the United States, "XX" if obviously ambiguous,
        # otherwise trust the AI's 2-letter ISO answer (defaulting to "XX").
        ai_country = (fields.get("country") or "").strip().upper()[:2] or None
        fast_country = classify_us_country(fields.get("location") or "")
        country = fast_country or ai_country or "XX"

        row = {
            "raw_job_id":       raw["id"],
            "normalized_title": fields.get("normalized_title") or raw["raw_title"],
            "skills":           fields.get("skills", [])[:10],
            "seniority":        fields.get("seniority", "mid"),
            "location":         fields.get("location"),
            "country":          country,
            "industry":         raw.get("industry"),  # Phase 3.6 — propagate from raw_jobs
        }
        try:
            supabase.table("extracted_jobs").insert(row).execute()
            extracted_count += 1
        except Exception as e:
            log.error(f"DB insert error for {raw['id']}: {e}")

    log.info(f"Extracted {extracted_count} / {len(to_process)} jobs.")
    return extracted_count
