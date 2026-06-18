import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { IndustryData } from '@/lib/types';
import { CLUSTER_COLORS } from '@/components/CareerMap/constants';
import { getSupabaseAdmin } from '@/lib/supabase';
import OpeningsPageClient, { type OpeningJob } from './OpeningsPageClient';

import amData    from '@/data/additive-manufacturing.json';
import semiData  from '@/data/semiconductors.json';
import spaceData from '@/data/space.json';

const INDUSTRY_MAP: Record<string, IndustryData> = {
  'additive-manufacturing': amData    as IndustryData,
  'semiconductors':         semiData  as IndustryData,
  'space':                  spaceData as IndustryData,
};

interface Props {
  params: Promise<{ industry: string; id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { industry: slug, id } = await params;
  const data = INDUSTRY_MAP[slug];
  if (!data) return {};
  const role = data.roles.find(r => r.id === id);
  if (!role) return {};
  return {
    title:       `Open jobs — ${role.title} | ${data.industry.name}`,
    description: `Live job openings for ${role.title} in the ${data.industry.name} industry, scraped from public ATS APIs and matched by AI.`,
  };
}


/**
 * Server-side fetch — pulls every approved role_match for this canonical role,
 * joined to the raw job posting it came from. We do the join via embedded
 * PostgREST selects, then flatten into a clean array the client can filter
 * and render.
 *
 * Returns [] on any DB error so the page degrades gracefully to "No openings".
 */
async function fetchOpenings(industrySlug: string, roleTitle: string): Promise<OpeningJob[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  try {
    const { data: industry } = await supabase
      .from('industries')
      .select('id')
      .eq('slug', industrySlug)
      .single();
    if (!industry?.id) return [];

    // Look up the canonical role's DB UUID via case-insensitive title match —
    // same convention used elsewhere (the seeder writes JSON title → DB UUID).
    const { data: roleRow } = await supabase
      .from('canonical_roles')
      .select('id')
      .eq('industry_id', industry.id)
      .ilike('title', roleTitle.trim())
      .maybeSingle();
    if (!roleRow?.id) return [];

    const { data: matches } = await supabase
      .from('role_matches')
      .select(`
        id,
        confidence,
        extracted_jobs(
          normalized_title,
          country,
          location,
          raw_jobs(company, url, raw_title, source, scraped_at)
        )
      `)
      .eq('canonical_role_id', roleRow.id)
      .eq('status', 'approved');

    if (!matches) return [];

    const flattened: OpeningJob[] = [];
    for (const m of matches as Array<{
      id: string;
      confidence?: number;
      extracted_jobs?: {
        normalized_title?: string;
        country?: string;
        location?: string;
        raw_jobs?: {
          company?: string;
          url?: string;
          raw_title?: string;
          source?: string;
          scraped_at?: string;
        } | null;
      } | null;
    }>) {
      const ej = m.extracted_jobs;
      const rj = ej?.raw_jobs;
      if (!ej || !rj || !rj.url) continue;
      flattened.push({
        matchId:    m.id,
        title:      rj.raw_title || ej.normalized_title || 'Untitled role',
        company:    rj.company || 'Unknown company',
        location:   ej.location || '',
        country:    (ej.country || 'XX').toUpperCase(),
        url:        rj.url,
        source:     rj.source || 'unknown',
        scrapedAt:  rj.scraped_at || '',
        confidence: typeof m.confidence === 'number' ? m.confidence : null,
      });
    }
    // Sort newest first
    flattened.sort((a, b) => (b.scrapedAt || '').localeCompare(a.scrapedAt || ''));
    return flattened;
  } catch {
    return [];
  }
}


export default async function OpeningsPage({ params }: Props) {
  const { industry: slug, id } = await params;
  const data = INDUSTRY_MAP[slug];
  if (!data) notFound();
  const role = data.roles.find(r => r.id === id);
  if (!role) notFound();

  const clusterColor = CLUSTER_COLORS[role.cluster];
  const bandHex      = clusterColor?.band ?? '#374151';

  const openings = await fetchOpenings(slug, role.title);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={`/${slug}`}
              className="text-sm text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0"
            >
              ← {data.industry.name} map
            </Link>
            <div className="h-4 w-px bg-gray-200" />
            <p className="text-sm font-semibold text-gray-700 truncate">{role.title}</p>
          </div>
          <Link
            href={`/${slug}/role/${role.id}`}
            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5
                       rounded-lg text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            View role details →
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Title block */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: bandHex }}
              aria-hidden="true"
            />
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {role.cluster}
            </span>
            <span className="text-gray-300">·</span>
            <span className="text-xs text-gray-500 capitalize">{role.seniority}-level</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Open jobs — {role.title}
          </h1>
          <p className="text-gray-600 text-sm leading-relaxed max-w-2xl">
            Live postings scraped from public job boards (Greenhouse, Lever, Workday) and
            matched against this role by our AI. Click any posting to apply at the source.
          </p>
        </div>

        <OpeningsPageClient openings={openings} roleTitle={role.title} />
      </main>
    </div>
  );
}
