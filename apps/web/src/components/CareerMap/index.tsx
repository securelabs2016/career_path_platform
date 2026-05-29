'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import type { IndustryData, SeniorityLevel } from '@/lib/types';
import {
  computeLayout, LAYOUT, SENIORITY_DISPLAY_ORDER,
  SENIORITY_LABELS, SENIORITY_TO_ROW,
} from '@/lib/map-layout';
import { roleMatchesFilter } from '@/lib/role-utils';
import { CLUSTER_COLORS, DEGREE_BADGES, formatSalary } from './constants';
import FilterBar from './FilterBar';
import MobileList from './MobileList';
import RoleCard from './RoleCard';
import PathwayLines from './PathwayLines';

interface Props {
  data: IndustryData;
  recommendedIds?: string[];
}

export default function CareerMap({ data, recommendedIds = [] }: Props) {
  const router     = useRouter();
  const pathname   = usePathname();
  const searchParams = useSearchParams();

  const { roles, pathways, clusters, industry } = data;

  // ── State ─────────────────────────────────────────────────────────────────
  const [selectedId,   setSelectedId]   = useState<string | null>(searchParams.get('role'));
  const [searchQuery,  setSearchQuery]  = useState('');
  const [degreeFilter, setDegreeFilter] = useState('all');
  const [clusterFilter,setClusterFilter]= useState('all');

  // ── Derived lookups ────────────────────────────────────────────────────────
  const roleById = useMemo(() => new Map(roles.map(r => [r.id, r])), [roles]);
  const layout   = useMemo(() => computeLayout(roles), [roles]);
  const { positions, totalWidth, totalHeight, rowStartY, rowBandHeight } = layout;

  // ── Filter roles ──────────────────────────────────────────────────────────
  const filteredIds = useMemo(() => {
    const active = searchQuery.trim() || degreeFilter !== 'all' || clusterFilter !== 'all';
    if (!active) return null; // null = no filter active
    return new Set(
      roles
        .filter(r => roleMatchesFilter(r, searchQuery.trim(), degreeFilter, clusterFilter))
        .map(r => r.id),
    );
  }, [roles, searchQuery, degreeFilter, clusterFilter]);

  const matchCount = filteredIds ? filteredIds.size : roles.length;

  // ── Related ids for selection dimming ─────────────────────────────────────
  const relatedIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    const role = roleById.get(selectedId);
    if (!role) return new Set<string>();
    const set = new Set<string>([selectedId]);
    role.adjacent_role_ids.forEach(id => set.add(id));
    role.pathway_ids.forEach(pid => {
      pathways.find(p => p.id === pid)?.role_ids.forEach(id => set.add(id));
    });
    return set;
  }, [selectedId, roleById, pathways]);

  const highlightedPathwayIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    return new Set(roleById.get(selectedId)?.pathway_ids ?? []);
  }, [selectedId, roleById]);

  // ── Visibility logic ──────────────────────────────────────────────────────
  // Priority: filter match → selection state → recommendation highlight
  function getVisibility(roleId: string): 'selected' | 'adjacent' | 'normal' | 'dimmed' {
    const filteredOut = filteredIds !== null && !filteredIds.has(roleId);
    if (filteredOut) return 'dimmed';
    if (selectedId === roleId) return 'selected';
    if (selectedId && !relatedIds.has(roleId)) return 'dimmed';
    if (selectedId && relatedIds.has(roleId) && roleId !== selectedId) return 'adjacent';
    return 'normal';
  }

  // ── URL sync: write selected role to URL ──────────────────────────────────
  const handleRoleClick = useCallback((id: string) => {
    const next = selectedId === id ? null : id;
    setSelectedId(next);

    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set('role', next);
    else params.delete('role');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [selectedId, searchParams, router, pathname]);

  const handleDeselect = useCallback(() => {
    if (!selectedId) return;
    setSelectedId(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('role');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [selectedId, searchParams, router, pathname]);

  // ── Keyboard: Escape to deselect ─────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleDeselect();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleDeselect]);

  const clearFilters = () => {
    setSearchQuery('');
    setDegreeFilter('all');
    setClusterFilter('all');
  };

  const selectedRole = selectedId ? roleById.get(selectedId) : null;
  const { CARD_W, CARD_H, COL_W, HEADER_H, LEFT_W, ROW_GAP, OUTER_PAD } = LAYOUT;

  return (
    <div className="flex flex-col gap-4">

      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
      <FilterBar
        clusters={clusters}
        searchQuery={searchQuery}
        degreeFilter={degreeFilter}
        clusterFilter={clusterFilter}
        matchCount={matchCount}
        totalCount={roles.length}
        onSearch={setSearchQuery}
        onDegree={setDegreeFilter}
        onCluster={setClusterFilter}
        onClear={clearFilters}
      />

      {/* ── Legend (desktop only) ──────────────────────────────────────────── */}
      <div className="hidden md:flex items-center gap-5 flex-wrap px-1">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Education:</span>
        {Object.entries(DEGREE_BADGES).map(([key, badge]) => (
          <span key={key} className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${badge.className}`}>
            {key === 'hs' ? 'HS Diploma' : key === '2yr' ? "Associate's" : key === '4yr' ? "Bachelor's" : 'Graduate'}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-xs text-amber-600 font-semibold ml-4">
          <span className="w-2 h-2 rounded-full bg-amber-400" aria-hidden="true" />
          Live openings
        </span>
        <span className="text-xs text-gray-400 ml-auto hidden lg:block">
          Tip: click a role to highlight its career pathway
        </span>
      </div>

      {/* ── MOBILE: list view ─────────────────────────────────────────────── */}
      <div className="md:hidden">
        <MobileList
          roles={filteredIds ? roles.filter(r => filteredIds.has(r.id)) : roles}
          clusters={clusters}
          industrySlug={industry.slug}
          industryColor={industry.color}
        />
      </div>

      {/* ── DESKTOP: interactive map canvas ──────────────────────────────── */}
      <div className="hidden md:block">
        <div
          className="overflow-auto rounded-2xl border border-gray-200 bg-gray-50/80 shadow-inner"
          role="region"
          aria-label={`${industry.name} career pathway map`}
        >
          <div
            className="relative"
            style={{ width: totalWidth, height: totalHeight, userSelect: 'none' }}
            onClick={handleDeselect}
          >
            {/* Cluster headers */}
            <div
              className="absolute top-0 flex"
              style={{ left: LEFT_W, height: HEADER_H, width: totalWidth - LEFT_W - OUTER_PAD }}
            >
              {clusters.map(cluster => {
                const color = CLUSTER_COLORS[cluster];
                return (
                  <div
                    key={cluster}
                    className="flex flex-col items-center justify-center gap-1"
                    style={{ width: COL_W }}
                  >
                    <span className={`w-2 h-2 rounded-full ${color?.dot ?? 'bg-gray-400'}`} aria-hidden="true" />
                    <span className="text-[11px] font-bold text-gray-600 text-center px-1 leading-tight">
                      {cluster}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Seniority band backgrounds + labels */}
            {SENIORITY_DISPLAY_ORDER.map((seniority, idx) => {
              const row  = SENIORITY_TO_ROW[seniority];
              const y    = rowStartY[row];
              const h    = rowBandHeight[row];
              const pad  = 10;
              return (
                <div key={seniority}>
                  <div
                    className={`absolute rounded-xl ${idx % 2 === 0 ? 'bg-white/70' : 'bg-gray-100/50'}`}
                    style={{ left: LEFT_W - 8, top: y - pad, width: totalWidth - LEFT_W + 8 - OUTER_PAD, height: h + pad * 2 }}
                  />
                  <div
                    className="absolute flex items-center justify-end pr-3"
                    style={{ left: 0, top: y, width: LEFT_W - 8, height: h }}
                  >
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right leading-tight">
                      {SENIORITY_LABELS[seniority]}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Column dividers */}
            {clusters.map((_, i) => {
              if (i === 0) return null;
              return (
                <div
                  key={i}
                  className="absolute bg-gray-200/50"
                  style={{ left: LEFT_W + i * COL_W - 1, top: HEADER_H, width: 1, height: totalHeight - HEADER_H - OUTER_PAD }}
                />
              );
            })}

            {/* SVG pathway lines */}
            <PathwayLines
              roles={roles}
              pathways={pathways}
              positions={positions}
              highlightedPathwayIds={highlightedPathwayIds}
              selectedId={selectedId}
              width={totalWidth}
              height={totalHeight}
              industryColor={industry.color}
            />

            {/* Role cards */}
            {roles.map(role => {
              const pos = positions.get(role.id);
              if (!pos) return null;
              const vis = getVisibility(role.id);
              // Recommended roles glow faintly when nothing is selected and no filter
              const isRecommended = !selectedId && filteredIds === null && recommendedIds.includes(role.id);
              return (
                <RoleCard
                  key={role.id}
                  role={role}
                  position={pos}
                  isSelected={vis === 'selected'}
                  isDimmed={vis === 'dimmed'}
                  isAdjacent={vis === 'adjacent'}
                  isRecommended={isRecommended}
                  industryColor={industry.color}
                  onClick={handleRoleClick}
                />
              );
            })}
          </div>
        </div>

        {/* ── Selected role panel ─────────────────────────────────────────── */}
        {selectedRole && (
          <div
            className="mt-4 rounded-2xl border border-gray-200 bg-white shadow-sm p-5"
            role="region"
            aria-label="Selected role details"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              {/* Left */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${CLUSTER_COLORS[selectedRole.cluster]?.dot ?? 'bg-gray-400'}`} aria-hidden="true" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {selectedRole.cluster} · {selectedRole.seniority}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">{selectedRole.title}</h2>
                <p className="text-sm text-gray-600 leading-relaxed max-w-2xl line-clamp-3">{selectedRole.description}</p>
              </div>

              {/* Right: stats */}
              <div className="flex flex-col gap-2 min-w-[160px]">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Salary</p>
                  <p className="text-lg font-bold text-gray-900">
                    ${Math.round(selectedRole.salary_min / 1000)}k–${Math.round(selectedRole.salary_max / 1000)}k
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Education</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {selectedRole.degree_required === 'hs'       ? 'HS Diploma'
                     : selectedRole.degree_required === '2yr'    ? "Associate's"
                     : selectedRole.degree_required === '4yr'    ? "Bachelor's"
                     : 'Graduate Degree'}
                  </p>
                </div>
              </div>
            </div>

            {/* Skills */}
            {selectedRole.skills.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Key skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedRole.skills.map(skill => (
                    <span key={skill} className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full font-medium">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Pathways */}
            {selectedRole.pathway_ids.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Career pathways</p>
                <div className="flex flex-wrap gap-2">
                  {selectedRole.pathway_ids.map(pid => {
                    const p = pathways.find(pw => pw.id === pid);
                    if (!p) return null;
                    return (
                      <span key={pid}
                        className="text-xs font-semibold px-3 py-1.5 rounded-full text-white"
                        style={{ backgroundColor: industry.color }}
                      >
                        {p.name}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between flex-wrap gap-3">
              <p className="text-xs text-gray-400">
                Press <kbd className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-mono text-[10px]">Esc</kbd> to deselect ·
                Click a different role to compare
              </p>
              <Link
                href={`/${industry.slug}/role/${selectedRole.id}`}
                className="text-sm font-semibold px-4 py-2 rounded-xl text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: industry.color }}
              >
                Full details + skill gap →
              </Link>
            </div>
          </div>
        )}

        {!selectedId && (
          <p className="text-center text-sm text-gray-400 mt-2">
            {recommendedIds.length > 0
              ? 'Highlighted roles match your profile — click any role to explore'
              : 'Click any role to see details, salary, and career pathways'}
          </p>
        )}
      </div>
    </div>
  );
}
