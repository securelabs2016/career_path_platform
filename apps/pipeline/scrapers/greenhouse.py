"""
Greenhouse public API scraper.
Pulls job postings from companies that use Greenhouse ATS.
API docs: https://developers.greenhouse.io/job-board.html

Company list is loaded from ../companies.json (single source of truth).
"""

import requests
import time
import logging
from datetime import datetime, timezone
from supabase import Client

from companies_loader import grouped_by_industry

log = logging.getLogger(__name__)

# Cap per company per cron run — matches the Workday scraper. Keeps total
# weekly job volume in the free-tier-friendly range (~500/week across all
# sources). Raise when paid AI credit is available.
MAX_JOBS_PER_COMPANY = 25

BASE_URL = "https://boards-api.greenhouse.io/v1/boards/{company}/jobs"
HEADERS  = {"User-Agent": "CareerPathwaysPlatform/1.0 (workforce-research)"}


def scrape_company(company_slug: str, supabase: Client, industry: str, dead_slugs: list[str]) -> int:
    """Fetch all jobs for a Greenhouse company and upsert to raw_jobs.

    `dead_slugs` is a shared list the caller passes in; we append to it when
    we get a 404 so the orchestrator can summarise dead boards at the end
    of the run (the 404 summary required by Phase 2.3).
    """
    url = BASE_URL.format(company=company_slug)
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
    except requests.exceptions.HTTPError as e:
        if resp.status_code == 404:
            log.warning(f"Greenhouse board not found for {company_slug!r}")
            dead_slugs.append(company_slug)
        else:
            log.error(f"HTTP error for {company_slug!r}: {e}")
        return 0
    except requests.RequestException as e:
        log.error(f"Request failed for {company_slug!r}: {e}")
        return 0

    jobs = resp.json().get("jobs", [])[:MAX_JOBS_PER_COMPANY]
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
            "industry":         industry,
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
    """Run the Greenhouse scraper for all companies in companies.json."""
    totals: dict[str, int] = {}
    dead_slugs: list[str] = []
    by_industry = grouped_by_industry("greenhouse", industries)

    for industry, rows in by_industry.items():
        total = 0
        log.info(f"Scraping Greenhouse for {industry} ({len(rows)} companies)…")
        for row in rows:
            slug = row["slug"]
            n = scrape_company(slug, supabase, industry, dead_slugs)
            total += n
            time.sleep(1)  # be polite to the API
        totals[industry] = total
        log.info(f"  {industry} total: {total} new jobs")

    if dead_slugs:
        log.warning(
            f"Greenhouse 404 summary — {len(dead_slugs)} slug(s) not found: "
            f"{', '.join(dead_slugs)}. "
            f"These companies appear to have moved off Greenhouse — update companies.json."
        )

    return totals
