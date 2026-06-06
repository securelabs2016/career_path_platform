import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PrintButton from './PrintButton';
import type { IndustryData, Role } from '@/lib/types';
import { computeSkillGap, getSeniorityDelta } from '@/lib/role-utils';
import { CLUSTER_COLORS, DEGREE_BADGES, formatSalary } from '@/components/CareerMap/constants';

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
    title:       `${role.title} | ${data.industry.name} Career Path`,
    description: role.description,
    openGraph: {
      title:       `${role.title} — ${data.industry.name}`,
      description: `${role.cluster} · ${role.seniority} level · ${formatSalary(role.salary_min, role.salary_max)}`,
    },
  };
}

// ── Small arrow component for transition direction ─────────────────────────────
function DeltaBadge({ delta }: { delta: 'up' | 'lateral' | 'down' }) {
  const map = {
    up:      { icon: '↑', cls: 'bg-green-100 text-green-700' },
    lateral: { icon: '→', cls: 'bg-blue-100  text-blue-700'  },
    down:    { icon: '↓', cls: 'bg-gray-100  text-gray-600'  },
  };
  const { icon, cls } = map[delta];
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cls}`} aria-label={delta}>
      {icon}
    </span>
  );
}

export default async function RoleDetailPage({ params }: Props) {
  const { industry: slug, id } = await params;
  const data = INDUSTRY_MAP[slug];
  if (!data) notFound();

  const role = data.roles.find(r => r.id === id);
  if (!role) notFound();

  const roleById       = new Map(data.roles.map(r => [r.id, r]));
  const clusterColor   = CLUSTER_COLORS[role.cluster];
  const degreeBadge    = DEGREE_BADGES[role.degree_required];

  // ── Adjacent roles ─────────────────────────────────────────────────────────
  const adjacentRoles = role.adjacent_role_ids
    .map(aid => roleById.get(aid))
    .filter((r): r is Role => r !== undefined);

  // ── Pathway-based predecessors and successors ──────────────────────────────
  const rolePathways = role.pathway_ids
    .map(pid => data.pathways.find(p => p.id === pid))
    .filter(Boolean);

  const precedingIds  = new Set<string>();
  const followingIds  = new Set<string>();

  // Pathway-based: the role immediately before / after this one in any pathway sequence
  rolePathways.forEach(pw => {
    if (!pw) return;
    const idx = pw.role_ids.indexOf(role.id);
    if (idx > 0)                       precedingIds.add(pw.role_ids[idx - 1]);
    if (idx < pw.role_ids.length - 1)  followingIds.add(pw.role_ids[idx + 1]);
  });

  // Adjacency-based: also include adjacent roles that sit at a lower / higher seniority.
  // This widens "prerequisites" beyond pure pathway predecessors to include the typical
  // sideways-then-up moves that the client's research highlights.
  const SENIORITY_RANK: Record<string, number> = { entry: 0, mid: 1, senior: 2, lead: 3 };
  const myRank = SENIORITY_RANK[role.seniority] ?? 0;
  role.adjacent_role_ids.forEach(aid => {
    const r = roleById.get(aid);
    if (!r) return;
    const theirRank = SENIORITY_RANK[r.seniority] ?? 0;
    if (theirRank < myRank) precedingIds.add(aid);
    else if (theirRank > myRank) followingIds.add(aid);
  });

  const precedingRoles = [...precedingIds].map(rid => roleById.get(rid)).filter((r): r is Role => !!r);
  const followingRoles = [...followingIds].map(rid => roleById.get(rid)).filter((r): r is Role => !!r);

  const degreeLabel =
    role.degree_required === 'hs'        ? 'High School Diploma' :
    role.degree_required === '2yr'       ? "Associate's Degree"  :
    role.degree_required === '4yr'       ? "Bachelor's Degree"   :
    role.degree_required === 'sometimes' ? 'Sometimes Required'  :
                                           'Graduate Degree';

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Sticky header ──────────────────────────────────────────────────── */}
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
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
            <PrintButton />
            <Link
              href={`/${slug}?path=${role.id}`}
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2
                         rounded-xl text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: data.industry.color }}
            >
              View on map
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">

        {/* ── Hero card ─────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 mb-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-3 h-3 rounded-full ${clusterColor?.dot}`} aria-hidden="true" />
                <span className="text-sm font-semibold text-gray-500">{role.cluster}</span>
                <span className="text-gray-300">·</span>
                <span className="text-sm text-gray-500 capitalize">{role.seniority}-level</span>
                <span
                  className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded-full ${degreeBadge?.className}`}
                >
                  {degreeLabel}
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight">
                {role.title}
              </h1>
              <p className="text-gray-600 leading-relaxed text-base max-w-2xl">
                {role.description}
              </p>
            </div>

            {/* Salary card */}
            <div className="flex-shrink-0">
              <div
                className="rounded-2xl p-5 text-center min-w-[160px]"
                style={{ backgroundColor: `${data.industry.color}12` }}
              >
                <p className="text-xs font-semibold uppercase tracking-wide mb-1"
                  style={{ color: data.industry.color }}>
                  Salary range
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  ${Math.round(role.salary_min / 1000)}k
                </p>
                <p className="text-sm font-semibold text-gray-500">
                  to ${Math.round(role.salary_max / 1000)}k / yr
                </p>
                <p className="text-[11px] text-gray-400 mt-2">Source: BLS OEWS</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Two-column layout ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left column (2/3) ───────────────────────────────────────────── */}
          <div className="lg:col-span-2 flex flex-col gap-6">

            {/* Skills */}
            <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm"
              aria-labelledby="skills-heading">
              <h2 id="skills-heading" className="text-base font-bold text-gray-900 mb-4">
                Key skills ({role.skills.length})
              </h2>
              <div className="flex flex-wrap gap-2">
                {role.skills.map(skill => (
                  <span key={skill}
                    className="text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full font-medium">
                    {skill}
                  </span>
                ))}
              </div>
            </section>

            {/* Certifications */}
            {role.certifications.length > 0 && (
              <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm"
                aria-labelledby="certs-heading">
                <h2 id="certs-heading" className="text-base font-bold text-gray-900 mb-4">
                  Certifications
                </h2>
                <div className="flex flex-wrap gap-2">
                  {role.certifications.map(cert => (
                    <span key={cert}
                      className="text-sm bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full font-medium ring-1 ring-blue-100">
                      {cert}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Career transitions — two-column Prerequisite + Next-Step layout */}
            <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm"
              aria-labelledby="transitions-heading">
              <h2 id="transitions-heading" className="text-base font-bold text-gray-900 mb-5">
                Career transitions
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Prerequisite Roles */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                      ← Prerequisite Roles
                    </span>
                    {precedingRoles.length > 0 && (
                      <span className="text-[10px] font-semibold text-gray-400">
                        {precedingRoles.length}
                      </span>
                    )}
                  </div>
                  {precedingRoles.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {precedingRoles.map(r => (
                        <Link
                          key={r.id}
                          href={`/${slug}/role/${r.id}`}
                          className="flex items-center gap-2 text-sm bg-gray-50 border border-gray-200
                                     text-gray-700 px-3 py-2 rounded-xl hover:bg-gray-100 transition-colors
                                     font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                          <DeltaBadge delta={getSeniorityDelta(r, role)} />
                          <span className="truncate">{r.title}</span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">
                      An entry point into the industry — no prerequisite role required.
                    </p>
                  )}
                </div>

                {/* Next-Step Roles */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold uppercase tracking-wide"
                      style={{ color: data.industry.color }}>
                      Next-Step Roles →
                    </span>
                    {followingRoles.length > 0 && (
                      <span className="text-[10px] font-semibold text-gray-400">
                        {followingRoles.length}
                      </span>
                    )}
                  </div>
                  {followingRoles.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {followingRoles.map(r => {
                        const delta = getSeniorityDelta(role, r);
                        return (
                          <Link
                            key={r.id}
                            href={`/${slug}/role/${r.id}`}
                            className="flex items-center gap-2 text-sm font-semibold px-3 py-2
                                       rounded-xl text-white hover:opacity-90 transition-opacity
                                       focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-blue-500"
                            style={{ backgroundColor: data.industry.color }}
                          >
                            <DeltaBadge delta={delta} />
                            <span className="truncate">{r.title}</span>
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">
                      A senior endpoint — explore lateral pathways via the map.
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* ── Skill gap analysis ─────────────────────────────────────────── */}
            {followingRoles.length > 0 && (
              <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm"
                aria-labelledby="skillgap-heading">
                <h2 id="skillgap-heading" className="text-base font-bold text-gray-900 mb-1">
                  Skill gap analysis
                </h2>
                <p className="text-sm text-gray-500 mb-6">
                  What you&apos;d need to develop to step into the next role
                </p>

                <div className="flex flex-col gap-6">
                  {followingRoles.slice(0, 3).map(next => {
                    const { toGain, youBring } = computeSkillGap(role, next);
                    return (
                      <div key={next.id}
                        className="rounded-xl border border-gray-100 p-4 bg-gray-50">
                        <div className="flex items-center gap-2 mb-4">
                          <DeltaBadge delta={getSeniorityDelta(role, next)} />
                          <Link
                            href={`/${slug}/role/${next.id}`}
                            className="text-sm font-bold text-gray-900 hover:underline"
                          >
                            {next.title}
                          </Link>
                          <span className="text-xs text-gray-400 ml-auto">
                            {formatSalary(next.salary_min, next.salary_max)}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Skills to gain */}
                          <div>
                            <p className="text-[11px] font-bold text-rose-500 uppercase tracking-wide mb-2">
                              Skills to develop ({toGain.length})
                            </p>
                            {toGain.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {toGain.map(s => (
                                  <span key={s}
                                    className="text-xs bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full ring-1 ring-rose-100 font-medium">
                                    {s}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-400">You already have all the listed skills!</p>
                            )}
                          </div>

                          {/* Skills you bring */}
                          <div>
                            <p className="text-[11px] font-bold text-green-600 uppercase tracking-wide mb-2">
                              Skills you already have ({youBring.length})
                            </p>
                            {youBring.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {youBring.slice(0, 5).map(s => (
                                  <span key={s}
                                    className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full ring-1 ring-green-100 font-medium">
                                    {s}
                                  </span>
                                ))}
                                {youBring.length > 5 && (
                                  <span className="text-xs text-gray-400">+{youBring.length - 5} more</span>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-400">Build new skills for this role</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          {/* ── Right sidebar (1/3) ──────────────────────────────────────────── */}
          <div className="flex flex-col gap-4">

            {/* View on map */}
            <Link
              href={`/${slug}?path=${role.id}`}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold
                         text-sm text-white hover:opacity-90 transition-opacity shadow-sm
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
              style={{ backgroundColor: data.industry.color }}
              aria-label={`View ${role.title} on the ${data.industry.name} career map`}
            >
              View on career map →
            </Link>

            {/* Career pathways */}
            {rolePathways.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 mb-3">
                  Part of {rolePathways.length} career pathway{rolePathways.length !== 1 ? 's' : ''}
                </h3>
                <div className="flex flex-col gap-2">
                  {rolePathways.map(pw => {
                    if (!pw) return null;
                    return (
                      <div key={pw.id}
                        className="text-xs font-semibold px-3 py-2.5 rounded-xl text-white leading-snug"
                        style={{ backgroundColor: data.industry.color }}>
                        {pw.name}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Adjacent roles */}
            {adjacentRoles.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Adjacent roles</h3>
                <div className="flex flex-col divide-y divide-gray-50">
                  {adjacentRoles.map(r => {
                    const delta = getSeniorityDelta(role, r);
                    return (
                      <Link
                        key={r.id}
                        href={`/${slug}/role/${r.id}`}
                        className="flex items-center gap-2.5 py-2.5 hover:bg-gray-50 rounded-lg px-1
                                   transition-colors group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        <DeltaBadge delta={delta} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900 group-hover:text-blue-600
                                        truncate transition-colors">
                            {r.title}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {formatSalary(r.salary_min, r.salary_max)}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Share this role */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
              <p className="text-xs font-semibold text-gray-500 mb-2">Share this role</p>
              <p className="text-[11px] text-gray-400 break-all font-mono">
                /{slug}/role/{role.id}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                Send this URL to share this exact role page.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
