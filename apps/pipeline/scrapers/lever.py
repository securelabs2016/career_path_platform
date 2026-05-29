"""
Lever public postings API scraper.
Used for AM and semi startups that use Lever instead of Greenhouse.
API: https://github.com/lever/postings-api
"""

import requests
import time
import logging
from datetime import datetime, timezone
from supabase import Client

log = logging.getLogger(__name__)

LEVER_COMPANIES = {
    "additive-manufacturing": [
        "formlabs", "materialise", "nikon-slm-solutions",
        "renishaw", "optomec", "exone",
    ],
    "semiconductors": [
        "micron", "qorvo", "macom", "akoustis",
        "indie-semiconductor", "pdf-solutions",
    ],
}

BASE_URL = "https://api.lever.co/v0/postings/{company}?mode=json"
HEADERS  = {"User-Agent": "CareerPathwaysPlatform/1.0 (workforce-research)"}


def scrape_company(company_slug: str, supabase: Client) -> int:
    url = BASE_URL.format(company=company_slug)
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
    except requests.exceptions.HTTPError as e:
        if resp.status_code == 404:
            log.warning(f"Lever board not found for {company_slug!r}")
        else:
            log.error(f"HTTP error for {company_slug!r}: {e}")
        return 0
    except requests.RequestException as e:
        log.error(f"Request failed for {company_slug!r}: {e}")
        return 0

    postings = resp.json() if isinstance(resp.json(), list) else []
    inserted = 0

    for posting in postings:
        job_url = posting.get("hostedUrl") or posting.get("applyUrl", "")
        if not job_url:
            continue

        # Lever returns description as HTML — store raw, extractor will clean it
        description = posting.get("descriptionPlain", "") or posting.get("description", "")

        row = {
            "source":           "lever",
            "company":          company_slug,
            "raw_title":        posting.get("text", "").strip(),
            "raw_description":  description[:8000],
            "url":              job_url,
            "scraped_at":       datetime.now(timezone.utc).isoformat(),
        }

        result = (
            supabase.table("raw_jobs")
            .upsert(row, on_conflict="url", ignore_duplicates=True)
            .execute()
        )
        if result.data:
            inserted += 1

    log.info(f"  {company_slug}: {len(postings)} jobs, {inserted} new")
    return inserted


def run_lever(supabase: Client, industries: list[str] | None = None) -> dict[str, int]:
    totals = {}
    target = industries or list(LEVER_COMPANIES.keys())

    for industry in target:
        companies = LEVER_COMPANIES.get(industry, [])
        total = 0
        log.info(f"Scraping Lever for {industry} ({len(companies)} companies)…")
        for company in companies:
            n = scrape_company(company, supabase)
            total += n
            time.sleep(1)
        totals[industry] = total
        log.info(f"  {industry} total: {total} new jobs")

    return totals
