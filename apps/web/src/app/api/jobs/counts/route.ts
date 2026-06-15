/**
 * GET /api/jobs/counts?industry=<slug>
 *
 * Returns live open-job counts and hiring-company lists per canonical role
 * for a given industry. The website reads this on map mount and merges
 * counts into the rendered role nodes.
 *
 * Mapping: roles are keyed by lowercased title because the website's static
 * JSON IDs (e.g. "am-r-01") are NOT preserved through the seeder — only the
 * title is shared between the two. Titles are unique per industry in this
 * project's taxonomy.
 *
 * Cache: 60s in-memory per industry. The pipeline updates these numbers at
 * most weekly, so 60s is generous freshness with cheap response time for
 * concurrent page loads.
 *
 * Degrades gracefully:
 *   - Supabase env vars missing → empty {} response, 200. UI shows zero counts.
 *   - DB error                  → empty {} response, 200. UI shows zero counts.
 */

import { getSupabaseAdmin } from '@/lib/supabase';

interface RoleCount {
  count:     number;
  companies: string[];
}

type CountsByTitle = Record<string, RoleCount>;

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { at: number; data: CountsByTitle }>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const industrySlug = (searchParams.get('industry') ?? '').trim();

  if (!industrySlug) {
    return Response.json({}, { status: 400 });
  }

  // ── 1. Cache hit?
  const hit = cache.get(industrySlug);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return Response.json(hit.data, {
      headers: { 'X-Cache': 'HIT' },
    });
  }

  // ── 2. Fetch fresh
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return Response.json({}, { headers: { 'X-Cache': 'BYPASS-NO-DB' } });
  }

  try {
    const { data: industry } = await supabase
      .from('industries')
      .select('id')
      .eq('slug', industrySlug)
      .single();

    if (!industry?.id) {
      return Response.json({});
    }

    const { data: roles } = await supabase
      .from('canonical_roles')
      .select('title, open_jobs_count, hiring_companies')
      .eq('industry_id', industry.id);

    const out: CountsByTitle = {};
    for (const r of roles ?? []) {
      const title = (r.title ?? '').toLowerCase().trim();
      if (!title) continue;
      out[title] = {
        count:     r.open_jobs_count ?? 0,
        companies: r.hiring_companies ?? [],
      };
    }

    cache.set(industrySlug, { at: Date.now(), data: out });
    return Response.json(out, { headers: { 'X-Cache': 'MISS' } });
  } catch (err) {
    console.warn('[api/jobs/counts] DB error:', (err as Error)?.message);
    return Response.json({}, { headers: { 'X-Cache': 'ERROR' } });
  }
}
