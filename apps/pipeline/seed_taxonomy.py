"""
Taxonomy Seeder — PHASE_B of deployment.
==========================================
One-time script that uploads the JSON taxonomies (50 AM roles + 45 Semi roles)
into the Supabase database so the pipeline has something to match jobs against.

Idempotent: safe to run multiple times. For each industry, it:
  1. Upserts the industry row (matched by slug)
  2. Deletes existing canonical_roles for that industry
  3. Re-inserts all roles fresh

Note: re-running this resets canonical_roles.open_jobs_count to 0. The next
pipeline run will repopulate counts. For v1 this is acceptable.

Usage (in GitHub Actions):
    Triggered manually via the "Seed taxonomy data" workflow.

Usage (locally):
    cd apps/pipeline
    cp .env.example .env      # then fill in SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
    pip install -r requirements.txt
    python seed_taxonomy.py
"""

import json
import os
import sys
import logging
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("seeder")

JSON_DIR   = Path(__file__).parent.parent / "web" / "src" / "data"
JSON_FILES = ["additive-manufacturing.json", "semiconductors.json"]


def seed_industry(supabase, data: dict) -> int:
    """Seed one industry from its JSON. Returns number of roles inserted."""
    ind = data["industry"]
    log.info(f"Seeding industry: {ind['name']}")

    # 1. Upsert industry — match by slug (unique constraint in schema)
    industry_result = (
        supabase.table("industries")
        .upsert(
            {
                "name":        ind["name"],
                "slug":        ind["slug"],
                "description": ind["description"],
                "color":       ind["color"],
            },
            on_conflict="slug",
        )
        .execute()
    )
    industry_id = industry_result.data[0]["id"]
    log.info(f"  industry uuid = {industry_id}")

    # 2. Delete existing roles for this industry — fresh seed
    supabase.table("canonical_roles").delete().eq("industry_id", industry_id).execute()
    log.info(f"  cleared existing canonical_roles")

    # 3. Insert all roles from JSON
    rows = []
    for role in data["roles"]:
        rows.append({
            "industry_id":     industry_id,
            "title":           role["title"],
            "cluster":         role["cluster"],
            "seniority":       role["seniority"],
            "salary_min":      role["salary_min"],
            "salary_max":      role["salary_max"],
            "degree_required": role["degree_required"],
            "skills":          role["skills"],
            "certifications":  role["certifications"],
            "description":     role["description"],
        })

    # Bulk insert (Supabase handles batching internally)
    supabase.table("canonical_roles").insert(rows).execute()
    log.info(f"  inserted {len(rows)} canonical_roles")

    return len(rows)


def main() -> int:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        log.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.")
        log.error("In GitHub Actions: set as repository secrets.")
        log.error("Locally: put them in apps/pipeline/.env")
        return 1

    supabase = create_client(url, key)
    total_roles = 0

    log.info("=" * 50)
    log.info("Career Pathways — Taxonomy Seeder")
    log.info("=" * 50)

    for filename in JSON_FILES:
        path = JSON_DIR / filename
        if not path.exists():
            log.error(f"File not found: {path}")
            log.error("Are you running this from apps/pipeline/ ?")
            return 1

        with open(path) as f:
            data = json.load(f)

        total_roles += seed_industry(supabase, data)
        log.info("")

    log.info("=" * 50)
    log.info(f"Done. {total_roles} canonical roles seeded across {len(JSON_FILES)} industries.")
    log.info("Next: trigger the 'Weekly ingestion pipeline' workflow in GitHub Actions.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
