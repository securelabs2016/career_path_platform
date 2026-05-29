"""
Greenhouse public API scraper.
Pulls job postings from companies that use Greenhouse ATS.
API docs: https://developers.greenhouse.io/job-board.html
"""

import requests
import time
import logging
from datetime import datetime, timezone
from supabase import Client

log = logging.getLogger(__name__)

# Companies to scrape per industry.
# Verified to use Greenhouse public job board API.
GREENHOUSE_COMPANIES = {
    "additive-manufacturing": [
        "velo3d", "carbon", "desktopmetal", "markforged",
        "relativityspace", "stratasys", "sintavia",
        "carpenteradditive", "6kadditive", "divergent3d",
    ],
    "semiconductors": [
        "intel", "amd", "appliedmaterials", "lamresearch",
        "kla", "globalfoundries", "skywatertechnology",
        "wolfspeed", "onto", "axcelis",
    ],
}

BASE_URL = "https://boards-api.greenhouse.io/v1/boards/{company}/jobs"
HEADERS  = {"User-Agent": "CareerPathwaysPlatform/1.0 (workforce-research)"}


def scrape_company(company_slug: str, supabase: Client, industry: str) -> int:
    """Fetch all jobs for a Greenhouse company and upsert to raw_jobs."""
    url = BASE_URL.format(company=company_slug)
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
    except requests.exceptions.HTTPError as e:
        if resp.status_code == 404:
            log.warning(f"Greenhouse board not found for {company_slug!r}")
        else:
            log.error(f"HTTP error for {company_slug!r}: {e}")
        return 0
    except requests.RequestException as e:
        log.error(f"Request failed for {company_slug!r}: {e}")
        return 0

    jobs = resp.json().get("jobs", [])
    inserted = 0

    for job in jobs:
        job_url = job.get("absolute_url") or job.get("url", "")
        if not job_url:
            continue

        row = {
            "source":           "greenhouse",
            "company":          company_slug,
            "raw_title":        job.get("title", "").strip(),
            "raw_description":  job.get("content", "")[:8000],  # truncate to stay under limits
            "url":              job_url,
            "scraped_at":       datetime.now(timezone.utc).isoformat(),
        }

        # Upsert on URL — avoids duplicates across weekly runs
        result = (
            supabase.table("raw_jobs")
            .upsert(row, on_conflict="url", ignore_duplicates=True)
            .execute()
        )
        if result.data:
            inserted += 1

    log.info(f"  {company_slug}: {len(jobs)} jobs fetched, {inserted} new")
    return inserted


def run_greenhouse(supabase: Client, industries: list[str] | None = None) -> dict[str, int]:
    """Run the Greenhouse scraper for all configured companies."""
    totals = {}
    target = industries or list(GREENHOUSE_COMPANIES.keys())

    for industry in target:
        companies = GREENHOUSE_COMPANIES.get(industry, [])
        total = 0
        log.info(f"Scraping Greenhouse for {industry} ({len(companies)} companies)…")
        for company in companies:
            n = scrape_company(company, supabase, industry)
            total += n
            time.sleep(1)  # be polite to the API
        totals[industry] = total
        log.info(f"  {industry} total: {total} new jobs")

    return totals
