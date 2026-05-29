import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import IndustryPageClient from '@/components/IndustryPageClient';
import type { IndustryData } from '@/lib/types';

import amData   from '@/data/additive-manufacturing.json';
import semiData from '@/data/semiconductors.json';

const INDUSTRY_MAP: Record<string, IndustryData> = {
  'additive-manufacturing': amData   as IndustryData,
  'semiconductors':         semiData as IndustryData,
};

const ALL_INDUSTRIES = [
  { slug: 'additive-manufacturing', name: 'Additive Manufacturing', short: 'AM' },
  { slug: 'semiconductors',         name: 'Semiconductors',         short: 'Semi' },
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
            <span
              className="px-3 sm:px-3.5 py-1.5 rounded-lg text-sm font-semibold
                         bg-gray-50 text-gray-300 cursor-default border border-dashed border-gray-200"
              aria-label="Space industry — coming soon"
            >
              Space ✦
            </span>
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
