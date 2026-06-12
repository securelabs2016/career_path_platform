"""
One-shot migration: generate reference-quality adjacency graphs for the
Additive Manufacturing and Space industries via Gemini, then write:
  - apps/web/src/data/adjacencies-am.json
  - apps/web/src/data/adjacencies-space.json
and rewrite each role's `adjacent_role_ids` in the main industry JSON files.

Why this script exists:
The reference HTML at from_client/career-lattice/index.html only baked an
adjacency graph (`pathData`) for Semiconductors. AM and Space shipped as
static lists (HTML line 3464 explicitly says: "The fully interactive
click-through map for this industry is in development."). Our prior
hand-curated adjacencies were effectively undirected role-similarity:
~60 of 189 AM edges and ~52 of 156 Space edges went BACKWARD (mid→entry),
and only 4-5% crossed clusters. This script replaces them with directional
career-progression edges generated per-role by Gemini against the full
catalog.

Reads GEMINI_API_KEY from apps/web/.env.local (no python-dotenv needed —
parsed by hand). Uses the REST endpoint, no SDK install required.

Idempotent: re-running overwrites cleanly.
"""
from __future__ import annotations
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
ENV_FILE = ROOT / "apps" / "web" / ".env.local"
DATA_DIR = ROOT / "apps" / "web" / "src" / "data"

GEMINI_MODEL = "gemini-2.5-flash-lite"
GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
)
OPENAI_MODEL = "gpt-4o-mini"
OPENAI_URL = "https://api.openai.com/v1/chat/completions"
# Which provider to use this run. Override per role-call inside generate_adjacencies if needed.
PROVIDER = os.environ.get("ADJ_PROVIDER", "openai")
SLEEP_BETWEEN_CALLS = 0.5  # openai has generous limits; gemini gets bumped up at call site
MAX_RETRIES = 4


def load_env(key_name: str) -> str:
    env_val = os.environ.get(key_name)
    if env_val:
        return env_val
    if not ENV_FILE.exists():
        sys.exit(f"missing {ENV_FILE} and no {key_name} in environment")
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if line.startswith(f"{key_name}="):
            val = line.split("=", 1)[1].strip().strip('"').strip("'")
            if val:
                return val
    sys.exit(f"{key_name} not found in environment or .env.local")


def build_catalog(roles: list[dict]) -> str:
    lines = []
    for r in roles:
        lines.append(
            f"  {r['id']}  |  {r['title']}  |  {r['cluster']}  |  {r['seniority']}"
        )
    return "\n".join(lines)


PROMPT_TEMPLATE = """You are a workforce-development career advisor for the U.S. {industry} industry.

A user is currently working as **{src_title}** in cluster *{src_cluster}* at the *{src_seniority}* level.

Their description: {src_description}
Their skills: {src_skills}
Their typical experience: {src_experience}

Below is the FULL catalog of other roles in this industry. Pick the realistic NEXT career steps this person could move into within the next 2-5 years. Rules:

- Return between 2 and 6 role IDs (more for entry/mid, fewer for senior leadership).
- Direction: prefer FORWARD (next tier up) or LATERAL (same tier, related skills). Avoid BACKWARD moves to lower tiers — those are demotions, not career steps. Only allow backward if it's a clear specialization pivot.
- Cross-cluster moves are GOOD when skills genuinely transfer (e.g. an engineer pivoting to product management or sales engineering). Include at least 1 cross-cluster option when plausible.
- Do NOT include the source role itself.
- Senior/Lead roles ("Chief", "Director", "VP", "Principal") should have only 1-2 next steps (they're near the top — dead-end ceiling is realistic).

Output ONLY a JSON object in this exact shape, no markdown, no commentary:
{{"next_step_role_ids": ["id1", "id2", ...]}}

CATALOG (id | title | cluster | tier):
{catalog}
"""


def call_openai(api_key: str, prompt: str) -> dict:
    body = {
        "model": OPENAI_MODEL,
        "temperature": 0.4,
        "response_format": {"type": "json_object"},
        "messages": [{"role": "user", "content": prompt}],
    }
    data = json.dumps(body).encode("utf-8")
    last_err = None
    for attempt in range(MAX_RETRIES):
        req = urllib.request.Request(
            OPENAI_URL,
            data=data,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
                text = payload["choices"][0]["message"]["content"]
                return json.loads(text)
        except urllib.error.HTTPError as e:
            body_text = e.read().decode("utf-8", errors="ignore")[:200]
            last_err = f"HTTP {e.code}: {body_text}"
            if e.code in (429, 500, 502, 503, 504):
                backoff = (2 ** attempt) * 2
                print(f"    retry {attempt + 1} after {backoff}s ({last_err})", flush=True)
                time.sleep(backoff)
                continue
            raise RuntimeError(last_err)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, KeyError) as e:
            last_err = f"{type(e).__name__}: {e}"
            backoff = (2 ** attempt) * 2
            print(f"    retry {attempt + 1} after {backoff}s ({last_err})", flush=True)
            time.sleep(backoff)
    raise RuntimeError(f"openai call failed after {MAX_RETRIES} retries: {last_err}")


def call_gemini(api_key: str, prompt: str) -> dict:
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.4,
            "responseMimeType": "application/json",
        },
    }
    data = json.dumps(body).encode("utf-8")
    last_err = None
    for attempt in range(MAX_RETRIES):
        req = urllib.request.Request(
            f"{GEMINI_URL}?key={api_key}",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
                text = payload["candidates"][0]["content"]["parts"][0]["text"]
                return json.loads(text)
        except urllib.error.HTTPError as e:
            body_text = e.read().decode("utf-8", errors="ignore")[:200]
            last_err = f"HTTP {e.code}: {body_text}"
            if e.code in (429, 500, 502, 503, 504):
                backoff = (2 ** attempt) * 2
                print(f"    retry {attempt + 1} after {backoff}s ({last_err})")
                time.sleep(backoff)
                continue
            raise RuntimeError(last_err)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, KeyError) as e:
            last_err = f"{type(e).__name__}: {e}"
            backoff = (2 ** attempt) * 2
            print(f"    retry {attempt + 1} after {backoff}s ({last_err})")
            time.sleep(backoff)
    raise RuntimeError(f"gemini call failed after {MAX_RETRIES} retries: {last_err}")


def generate_adjacencies(industry_label: str, fn_base: str, api_key: str, adj_filename: str) -> None:
    industry_path = DATA_DIR / f"{fn_base}.json"
    industry = json.loads(industry_path.read_text())
    roles = industry["roles"]
    role_ids = {r["id"] for r in roles}
    catalog = build_catalog(roles)

    adj_path = DATA_DIR / adj_filename
    # Resume mode: load any previous successful results so we skip re-querying.
    existing: dict[str, list[str]] = {}
    if adj_path.exists():
        try:
            existing = json.loads(adj_path.read_text())
        except json.JSONDecodeError:
            existing = {}
    resume_count = sum(1 for v in existing.values() if v)
    print(f"\n=== {industry_label} — {len(roles)} roles (resuming from {resume_count} cached) ===", flush=True)
    adjacencies: dict[str, list[str]] = {rid: (existing.get(rid) or []) for rid in role_ids}
    total_edges = sum(len(v) for v in adjacencies.values())

    for i, r in enumerate(roles, 1):
        if adjacencies.get(r["id"]):
            print(f"  [{i}/{len(roles)}] {r['id']:40s}  cached ({len(adjacencies[r['id']])} edges)", flush=True)
            continue
        skills = ", ".join(r.get("skills") or [])
        prompt = PROMPT_TEMPLATE.format(
            industry=industry_label,
            src_title=r["title"],
            src_cluster=r["cluster"],
            src_seniority=r["seniority"],
            src_description=r.get("description") or "(none)",
            src_skills=skills or "(none)",
            src_experience=r.get("experience") or "(none)",
            catalog=catalog,
        )
        try:
            if PROVIDER == "openai":
                result = call_openai(api_key, prompt)
            else:
                result = call_gemini(api_key, prompt)
            raw_next = result.get("next_step_role_ids") or []
        except Exception as e:
            print(f"  [{i}/{len(roles)}] {r['id']:40s}  FAILED: {str(e)[:80]}", flush=True)
            adjacencies[r["id"]] = []
            # Persist progress so a kill mid-run doesn't lose everything.
            adj_path.write_text(json.dumps(adjacencies, indent=2) + "\n")
            continue

        # Validate: drop unknown ids, drop self, dedupe preserving order
        seen: set[str] = set()
        cleaned: list[str] = []
        for nid in raw_next:
            if nid == r["id"]:
                continue
            if nid not in role_ids:
                continue
            if nid in seen:
                continue
            seen.add(nid)
            cleaned.append(nid)
        adjacencies[r["id"]] = cleaned
        total_edges += len(cleaned)
        print(f"  [{i}/{len(roles)}] {r['id']:40s}  -> {len(cleaned)} edges", flush=True)
        # Persist after every successful call so partial runs are recoverable.
        adj_path.write_text(json.dumps(adjacencies, indent=2) + "\n")
        time.sleep(SLEEP_BETWEEN_CALLS)

    total_edges = sum(len(v) for v in adjacencies.values())
    print(f"  total: {total_edges} edges, avg {total_edges / len(roles):.2f}/role", flush=True)
    print(f"  wrote {adj_path.relative_to(ROOT)}", flush=True)

    # Update each role's `adjacent_role_ids` in the main industry JSON
    for r in roles:
        r["adjacent_role_ids"] = adjacencies.get(r["id"], [])
    industry_path.write_text(json.dumps(industry, indent=2) + "\n")
    print(f"  updated {industry_path.relative_to(ROOT)}")


def main() -> None:
    key_name = "OPENAI_API_KEY" if PROVIDER == "openai" else "GEMINI_API_KEY"
    api_key = load_env(key_name)
    model = OPENAI_MODEL if PROVIDER == "openai" else GEMINI_MODEL
    print(f"provider={PROVIDER}, model={model}, key={key_name} (len={len(api_key)})", flush=True)
    generate_adjacencies("Additive Manufacturing", "additive-manufacturing", api_key, "adjacencies-am.json")
    generate_adjacencies("Space", "space", api_key, "adjacencies-space.json")
    print("\nDone.", flush=True)


if __name__ == "__main__":
    main()
