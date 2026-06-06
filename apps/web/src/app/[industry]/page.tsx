import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import IndustryPageClient from '@/components/IndustryPageClient';
import WelcomeBanner from '@/components/WelcomeBanner';
import type { IndustryData } from '@/lib/types';

import amData    from '@/data/additive-manufacturing.json';
import semiData  from '@/data/semiconductors.json';
import spaceData from '@/data/space.json';

const INDUSTRY_MAP: Record<string, IndustryData> = {
  'additive-manufacturing': amData    as IndustryData,
  'semiconductors':         semiData  as IndustryData,
  'space':                  spaceData as IndustryData,
};

const ALL_INDUSTRIES = [
  { slug: 'additive-manufacturing', name: 'Additive Manufacturing', short: 'AM' },
  { slug: 'semiconductors',         name: 'Semiconductors',         short: 'Semi' },
  { slug: 'space',                  name: 'Space Industry',         short: 'Space' },
];

interface Props {
  params: Promise<{ industry: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { industry } = await params;
  const data = INDUSTRY_MAP[industry];
  if (!data) return { title: 'Not Found' };
  return {
    title:       `${data.industry.name} Career Map`,
    description: data.industry.description,
    openGraph: {
      title:       `${data.industry.name} Career Map`,
      description: data.industry.description,
      type:        'website',
    },
  };
}

export default async function IndustryMapPage({ params }: Props) {
  const { industry: industrySlug } = await params;
  const data = INDUSTRY_MAP[industrySlug];
  if (!data) notFound();

  const { industry, roles, pathways } = data;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Skip to main content (accessibility) ─────────────────────────────── */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50
                   focus:bg-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-blue-600
                   focus:font-semibold focus:shadow-lg focus:outline-none focus-visible:ring-2
                   focus-visible:ring-blue-500"
      >
        Skip to main content
      </a>

      {/* ── Sticky header ────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30" role="banner">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4 flex-wrap">

          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <Link
              href="/"
              className="text-sm text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            >
              ← All industries
            </Link>
            <div className="h-4 w-px bg-gray-200 flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="text-base font-bold text-gray-900 truncate">{industry.name}</h1>
              <p className="text-xs text-gray-400 hidden sm:block">
                {roles.length} roles · {data.clusters.length} clusters · {pathways.length} pathways
              </p>
            </div>
          </div>

          {/* Industry switcher */}
          <nav aria-label="Switch industry" className="flex items-center gap-1.5">
            {ALL_INDUSTRIES.map(ind => (
              <Link
                key={ind.slug}
                href={`/${ind.slug}`}
                aria-current={ind.slug === industrySlug ? 'page' : undefined}
                className={[
                  'px-3 sm:px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                  ind.slug === industrySlug
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                ].join(' ')}
              >
                <span className="hidden sm:inline">{ind.name}</span>
                <span className="sm:hidden">{ind.short}</span>
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* ── Industry context bar ─────────────────────────────────────────────── */}
      <div className="border-b border-gray-100" style={{ backgroundColor: `${industry.color}08` }}>
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-3">
          <p className="text-sm text-gray-600 leading-relaxed max-w-3xl">
            {industry.description}
          </p>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <main id="main-content" className="flex-1 max-w-[1320px] mx-auto w-full px-4 sm:px-6 py-6">

        {/* Light welcome banner — first visit only (localStorage flag) */}
        <WelcomeBanner />

        {/* About / How to use — uses native <details> so it works without JS */}
        <details className="mb-4 rounded-2xl border border-gray-200 bg-white shadow-sm group">
          <summary
            className="cursor-pointer list-none px-5 py-3 flex items-center justify-between gap-3
                       hover:bg-gray-50 rounded-2xl select-none
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <span className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                   className="text-gray-500" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span className="text-sm font-bold text-gray-900">About this Map &amp; How to use it</span>
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                 className="text-gray-400 group-open:rotate-180 transition-transform" aria-hidden="true">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </summary>

          <div className="px-5 pb-5 pt-1 grid grid-cols-1 md:grid-cols-3 gap-5 text-sm text-gray-700 leading-relaxed">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
                How to use the map
              </h3>
              <ul className="space-y-1.5">
                <li><strong className="text-gray-900">Click a role</strong> to add it to your career path. Click again to remove it.</li>
                <li><strong className="text-gray-900">Hover</strong> any card for a quick preview with salary and top skills.</li>
                <li><strong className="text-gray-900">Search and filter</strong> by title, skill, education, or cluster.</li>
                <li><strong className="text-gray-900">Build a path</strong> by clicking multiple roles — they appear in order under the map.</li>
                <li><strong className="text-gray-900">Save &amp; Share</strong> copies a link that recreates your exact path for anyone.</li>
                <li>Press <kbd className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-[10px]">Esc</kbd> to clear the whole path.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
                Reading the layout
              </h3>
              <ul className="space-y-1.5">
                <li>Columns are <strong className="text-gray-900">value-chain clusters</strong> — left to right shows different functional areas of the industry.</li>
                <li>Rows are <strong className="text-gray-900">seniority bands</strong> — entry at the bottom, lead/principal at the top.</li>
                <li>Curved lines mark <strong className="text-gray-900">common career pathways</strong> between roles.</li>
                <li>An <span className="text-amber-600 font-semibold">amber dot</span> means we found live job openings for that role this week.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
                Data sources
              </h3>
              <ul className="space-y-1.5">
                <li><strong className="text-gray-900">Salary ranges</strong>: U.S. BLS OEWS, adjusted with industry market data.</li>
                <li><strong className="text-gray-900">Role definitions &amp; pathways</strong>: workforce research, BLS occupational frameworks, and industry-body input.</li>
                <li><strong className="text-gray-900">Live job counts</strong>: scraped weekly from Greenhouse / Lever and matched to canonical roles by AI.</li>
                <li className="text-gray-500 text-xs pt-1">
                  AI-generated content (chat, job matching) may be inaccurate. Verify before major decisions.
                </li>
              </ul>
            </div>
          </div>
        </details>

        {/*
          IndustryPageClient manages:
          - GetStartedWizard (overlay, first visit only)
          - CareerMap (interactive grid + filters + URL sync)
          Both are client components sharing recommendedIds state
        */}
        <IndustryPageClient data={data} />
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 bg-white" role="contentinfo">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs text-gray-400">
            Salary data: BLS OEWS. Job counts update weekly via live ingestion pipeline.
          </p>
          <p className="text-xs text-gray-400">
            Career Pathways Platform · {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
