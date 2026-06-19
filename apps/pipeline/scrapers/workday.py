"""
Workday public-board scraper.

Used for large employers whose ATS is Workday (Intel, NVIDIA, Micron, Applied
Materials, HP, Blue Origin, Boeing, Leidos, etc.).

API shape:
  POST https://{tenant}.wd{N}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs
  Body: { "appliedFacets": {}, "limit": 20, "offset": 0, "searchText": "" }
  Returns: { "total": N, "jobPostings": [ {title, externalPath, locationsText, postedOn, bulletFields} ] }

WHAT WE STORE (v1 trade-off):
  Workday's list endpoint does NOT include the job description — only title,
  location, and a few short bullet fields. Fetching the full description per
  job would mean an extra API call each, multiplied by ~12k jobs per week.
  That blows past GitHub Actions' run-time limit.
  For v1 we store title + locations + bullets as the raw_description. Workday
  titles tend to be self-describing ("Senior SoC Compute/Memory Subsystem
  Architect") so the AI extractor still has enough signal for matching by
  title + seniority.
  If matching quality is poor after the first real cron, the upgrade is to
  do a second detail-fetch per job, capped at the freshest N.

PER-COMPANY CAP:
  Workday companies post a lot — Leidos has ~2000, NVIDIA ~2000, Boeing ~1000.
  Without a cap, the AI extractor + matcher would run for hours on the
  first week alone. We cap at MAX_JOBS_PER_COMPANY to keep the run sane and
  ramp up gradually. Most-recent jobs are what Workday returns first.

Company list is loaded from ../companies.json (single source of truth).
"""

import requests
import time
import logging
from datetime import datetime, timezone
from supabase import Client

from companies_loader import companies_for

log = logging.getLogger(__name__)

# Cap per company per cron run. Sized for free-tier AI compatibility — at
# 25 × 8 companies = 200 Workday jobs/week. Raise when paid AI credit is
# available; the rest of the pipeline scales with this number.
MAX_JOBS_PER_COMPANY = 25

# Workday paginates with a small limit. 20 is the typical default they use.
PAGE_SIZE = 20

HEADERS = {
    "Content-Type": "application/json",
    "Accept":       "application/json",
    "User-Agent":   "CareerPathwaysPlatform/1.0 (workforce-research)",
}


def _build_api_url(tenant: str, wd: int, site: str) -> str:
    return f"https://{tenant}.wd{wd}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs"


def _build_human_url(tenant: str, wd: int, site: str, external_path: str) -> str:
    # The human-facing URL we store on raw_jobs.url so the apply-link works
    return f"https://{tenant}.wd{wd}.myworkdayjobs.com/en-US/{site}{external_path}"


def _build_raw_description(title: str, locations: str, bullets: list[str], posted_on: str) -> str:
    """
    Workday's list endpoint has no description, only short metadata.
    Concatenate what we have into a pseudo-description. The LOCATION: prefix
    matches the format used by greenhouse + lever scrapers so the deterministic
    extractor can read location with a single regex across all three sources.
    """
    parts = []
    if locations:
        parts.append(f"LOCATION: {locations}")
    parts.append(f"Title: {title}")
    if bullets:
        parts.append(f"Tags: {', '.join(bullets)}")
    if posted_on:
        parts.append(f"Posted: {posted_on}")
    return "\n\n".join(parts)


def scrape_company(company: dict, supabase: Client, dead_slugs: list[str]) -> int:
    """Fetch jobs for one Workday company, capped at MAX_JOBS_PER_COMPANY."""
    slug   = company["slug"]
    tenant = company.get("tenant")
    wd     = company.get("wd")
    site   = company.get("site")
    if not (tenant and wd and site):
        log.error(f"Workday company {slug!r} missing tenant/wd/site in companies.json")
        return 0

    api_url = _build_api_url(tenant, wd, site)
    inserted = 0
    offset = 0
    seen_total = None

    while offset < MAX_JOBS_PER_COMPANY:
        body = {
            "appliedFacets": {},
            "limit":         min(PAGE_SIZE, MAX_JOBS_PER_COMPANY - offset),
            "offset":        offset,
            "searchText":    "",
        }
        try:
            resp = requests.post(api_url, headers=HEADERS, json=body, timeout=15)
            resp.raise_for_status()
        except requests.exceptions.HTTPError as e:
            status = resp.status_code if resp is not None else "?"
            if status == 404:
                log.warning(f"Workday board not found for {slug!r} ({tenant}/{site})")
                dead_slugs.append(slug)
            elif status == 500:
                # Common when the site name is wrong — Workday tenant exists, path doesn't
                log.warning(f"Workday {slug!r} returned 500 — site path likely incorrect ({site!r})")
                dead_slugs.append(slug)
            else:
                log.error(f"HTTP {status} for {slug!r}: {e}")
            return inserted
        except requests.RequestException as e:
            log.error(f"Workday request failed for {slug!r}: {e}")
            return inserted

        payload = resp.json()
        postings = payload.get("jobPostings", [])
        if seen_total is None:
            seen_total = payload.get("total", 0)
            log.info(f"  {slug}: {seen_total} total jobs at source (capped at {MAX_JOBS_PER_COMPANY})")
        if not postings:
            break

        for posting in postings:
            external_path = posting.get("externalPath", "")
            title         = (posting.get("title") or "").strip()
            if not external_path or not title:
                continue

            row = {
                "source":          "workday",
                "company":         slug,
                "raw_title":       title,
                "raw_description": _build_raw_description(
                    title,
                    posting.get("locationsText") or "",
                    posting.get("bulletFields") or [],
                    posting.get("postedOn") or "",
                )[:8000],
                "url":             _build_human_url(tenant, wd, site, external_path),
                "industry":        company.get("industry"),
                "scraped_at":      datetime.now(timezone.utc).isoformat(),
            }

            try:
                result = (
                    supabase.table("raw_jobs")
                    .upsert(row, on_conflict="url", ignore_duplicates=True)
                    .execute()
                )
                if result.data:
                    inserted += 1
            except Exception as e:
                log.error(f"DB insert error for {slug} job {external_path}: {e}")

        offset += len(postings)
        # Stop if Workday returned fewer than we asked for (end of list)
        if len(postings) < body["limit"]:
            break

        # Polite pause between paginated calls to one company
        time.sleep(0.5)

    log.info(f"  {slug}: {inserted} new jobs inserted")
    return inserted


def run_workday(supabase: Client, industries: list[str] | None = None) -> dict[str, int]:
    """Run the Workday scraper for all companies in companies.json with ats=='workday'."""
    totals: dict[str, int] = {}
    dead_slugs: list[str] = []
    rows = companies_for("workday", industries)

    # Group for per-industry logging
    by_industry: dict[str, list[dict]] = {}
    for row in rows:
        by_industry.setdefault(row["industry"], []).append(row)

    for industry, companies in by_industry.items():
        total = 0
        log.info(f"Scraping Workday for {industry} ({len(companies)} companies)…")
        for company in companies:
            n = scrape_company(company, supabase, dead_slugs)
            total += n
            time.sleep(1)  # be polite between companies
        totals[industry] = total
        log.info(f"  {industry} total: {total} new jobs")

    if dead_slugs:
        log.warning(
            f"Workday 404/500 summary — {len(dead_slugs)} board(s) unreachable: "
            f"{', '.join(dead_slugs)}. "
            f"These companies' Workday tenant/site path likely changed — verify and update companies.json."
        )

    return totals
