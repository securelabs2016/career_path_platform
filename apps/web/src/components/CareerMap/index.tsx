'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { IndustryData } from '@/lib/types';
import {
  computeLayout, LAYOUT, SENIORITY_DISPLAY_ORDER,
  SENIORITY_LABELS, SENIORITY_TO_ROW,
} from '@/lib/map-layout';
import { roleMatchesFilter } from '@/lib/role-utils';
import { CLUSTER_COLORS } from './constants';
import FilterBar from './FilterBar';
import MobileList from './MobileList';
import RoleCard from './RoleCard';
import PathwayLines from './PathwayLines';
import CareerPathPanel from './CareerPathPanel';
import SaveShareModal from './SaveShareModal';
import ErrorModal from './ErrorModal';
import RoleDetailModal from './RoleDetailModal';

interface Props {
  data: IndustryData;
}

export default function CareerMap({ data }: Props) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const { roles, pathways, clusters, industry } = data;

  const roleById = useMemo(() => new Map(roles.map(r => [r.id, r])), [roles]);

  // Path chain — hydrated from ?path=am-r-01,am-r-05 on first render.
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const raw = searchParams.get('path');
    if (!raw) {
      const single = searchParams.get('role');
      return single && roleById.has(single) ? [single] : [];
    }
    return raw.split(',').map(s => s.trim()).filter(id => roleById.has(id));
  });
  const [searchQuery,   setSearchQuery]   = useState('');
  const [degreeFilter,  setDegreeFilter]  = useState('all');
  const [clusterFilter, setClusterFilter] = useState('all');
  const [saveOpen,      setSaveOpen]      = useState(false);
  const [errorOpen,     setErrorOpen]     = useState(false);
  const [detailRoleId,  setDetailRoleId]  = useState<string | null>(null);

  const layout = useMemo(() => computeLayout(roles), [roles]);
  const { positions, totalWidth, totalHeight, rowStartY, rowBandHeight } = layout;

  const filteredIds = useMemo(() => {
    const active = searchQuery.trim() || degreeFilter !== 'all' || clusterFilter !== 'all';
    if (!active) return null;
    return new Set(
      roles
        .filter(r => roleMatchesFilter(r, searchQuery.trim(), degreeFilter, clusterFilter))
        .map(r => r.id),
    );
  }, [roles, searchQuery, degreeFilter, clusterFilter]);

  const matchCount = filteredIds ? filteredIds.size : roles.length;

  const relatedIds = useMemo(() => {
    if (selectedIds.length === 0) return new Set<string>();
    const set = new Set<string>(selectedIds);
    selectedIds.forEach(id => {
      const role = roleById.get(id);
      if (!role) return;
      role.adjacent_role_ids.forEach(adj => set.add(adj));
      role.pathway_ids.forEach(pid => {
        pathways.find(p => p.id === pid)?.role_ids.forEach(rid => set.add(rid));
      });
    });
    return set;
  }, [selectedIds, roleById, pathways]);

  const highlightedPathwayIds = useMemo(() => {
    const set = new Set<string>();
    selectedIds.forEach(id => {
      roleById.get(id)?.pathway_ids.forEach(pid => set.add(pid));
    });
    return set;
  }, [selectedIds, roleById]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  function getVisibility(roleId: string): 'selected' | 'adjacent' | 'normal' | 'dimmed' {
    const filteredOut = filteredIds !== null && !filteredIds.has(roleId);
    if (filteredOut) return 'dimmed';
    if (selectedIdSet.has(roleId)) return 'selected';
    if (selectedIds.length > 0 && !relatedIds.has(roleId)) return 'dimmed';
    if (selectedIds.length > 0 && relatedIds.has(roleId)) return 'adjacent';
    return 'normal';
  }

  const syncUrl = useCallback((ids: string[]) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('role');
    if (ids.length > 0) params.set('path', ids.join(','));
    else params.delete('path');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, router, pathname]);

  const handleRoleClick = useCallback((id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter(x => x !== id)
      : [...selectedIds, id];
    setSelectedIds(next);
    syncUrl(next);
  }, [selectedIds, syncUrl]);

  const handleClearPath = useCallback(() => {
    setSelectedIds([]);
    syncUrl([]);
  }, [syncUrl]);

  // Save & Share opens the modal (Phase J4)
  const handleShare = useCallback(() => {
    setSaveOpen(true);
  }, []);

  // Esc clears the entire path
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedIds.length > 0) handleClearPath();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClearPath, selectedIds.length]);

  const clearFilters = () => {
    setSearchQuery('');
    setDegreeFilter('all');
    setClusterFilter('all');
  };

  const { COL_W, HEADER_H, LEFT_W, OUTER_PAD } = LAYOUT;

  const selectedLabel = selectedIds.length === 1
    ? '1 Job Selected'
    : `${selectedIds.length} Jobs Selected`;

  return (
    <div className="flex flex-col gap-4">

      {/* Intro + instructions block (reference layout: heading + 3-step list on left, search on right) */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 mb-1.5">
            Paths to new career opportunities in the {industry.name} industry.
          </p>
          <ol className="text-sm text-gray-700 space-y-0.5 leading-relaxed">
            <li>(1) Click jobs that interest you and follow the lines that appear to see where they can take you.</li>
            <li>(2) Click the next job to build entire chains of career paths across as many jobs as you&apos;d like!</li>
            <li>(3) Click &quot;Clear Map&quot; to start over.</li>
          </ol>
        </div>
        <div className="md:flex-shrink-0 md:w-72">
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
        </div>
      </div>

      {/* Control row: learning-paths anchor (left) · jobs-selected counter (center) · CLEAR MAP (right) */}
      <div className="flex items-center justify-between gap-3 flex-wrap text-sm">
        <a
          href="#learning-paths"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-gray-300 bg-white
                     text-gray-700 hover:bg-gray-50 transition-colors
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          See related learning paths below
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </a>
        <span className="font-semibold text-gray-700" aria-live="polite">
          {selectedLabel}
        </span>
        <button
          type="button"
          onClick={handleClearPath}
          disabled={selectedIds.length === 0}
          className="inline-flex items-center gap-1.5 text-gray-600 hover:text-gray-900 disabled:opacity-40
                     disabled:cursor-not-allowed transition-colors uppercase font-semibold tracking-wide text-xs
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
        >
          Clear Map
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <polyline points="3 4 3 10 9 10" />
          </svg>
        </button>
      </div>

      {/* MOBILE: list view */}
      <div className="md:hidden">
        <MobileList
          roles={filteredIds ? roles.filter(r => filteredIds.has(r.id)) : roles}
          clusters={clusters}
          industrySlug={industry.slug}
          industryColor={industry.color}
        />
      </div>

      {/* DESKTOP: interactive map canvas */}
      <div className="hidden md:block">
        <div
          className="overflow-auto rounded border border-gray-200 bg-gray-50/40"
          role="region"
          aria-label={`${industry.name} career pathway map`}
        >
          <div
            className="relative"
            style={{ width: totalWidth, height: totalHeight, userSelect: 'none' }}
          >
            {/* Column tint backgrounds */}
            {clusters.map((cluster, i) => {
              const color = CLUSTER_COLORS[cluster];
              if (!color) return null;
              return (
                <div
                  key={`tint-${cluster}`}
                  className="absolute"
                  style={{
                    left:   LEFT_W + i * COL_W,
                    top:    HEADER_H,
                    width:  COL_W,
                    height: totalHeight - HEADER_H - OUTER_PAD,
                    backgroundColor: color.tint,
                  }}
                />
              );
            })}

            {/* Cluster headers — solid colored band, uppercase white text */}
            <div
              className="absolute top-0 flex"
              style={{ left: LEFT_W, height: HEADER_H, width: totalWidth - LEFT_W - OUTER_PAD }}
            >
              {clusters.map(cluster => {
                const color = CLUSTER_COLORS[cluster];
                return (
                  <div
                    key={cluster}
                    className="flex items-center justify-center px-2"
                    style={{ width: COL_W, backgroundColor: color?.band ?? '#6b7280' }}
                  >
                    <span className="text-[11px] font-bold uppercase text-white text-center leading-tight tracking-wide">
                      {cluster}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Seniority row labels */}
            {SENIORITY_DISPLAY_ORDER.map(seniority => {
              const row = SENIORITY_TO_ROW[seniority];
              const y   = rowStartY[row];
              const h   = rowBandHeight[row];
              return (
                <div
                  key={seniority}
                  className="absolute flex items-center justify-end pr-3"
                  style={{ left: 0, top: y, width: LEFT_W - 8, height: h }}
                >
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right leading-tight">
                    {SENIORITY_LABELS[seniority]}
                  </span>
                </div>
              );
            })}

            {/* Column dividers */}
            {clusters.map((_, i) => {
              if (i === 0) return null;
              return (
                <div
                  key={i}
                  className="absolute bg-white/40"
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
              hasSelection={selectedIds.length > 0}
              width={totalWidth}
              height={totalHeight}
              industryColor={industry.color}
            />

            {/* Role cards */}
            {roles.map(role => {
              const pos = positions.get(role.id);
              if (!pos) return null;
              const vis = getVisibility(role.id);
              return (
                <RoleCard
                  key={role.id}
                  role={role}
                  position={pos}
                  isSelected={vis === 'selected'}
                  isDimmed={vis === 'dimmed'}
                  isAdjacent={vis === 'adjacent'}
                  isRecommended={false}
                  industryColor={industry.color}
                  onClick={handleRoleClick}
                  onShowDetails={setDetailRoleId}
                />
              );
            })}
          </div>
        </div>

        {/* Single-line degree legend + clear-map echo (matches reference) */}
        <div className="mt-2 flex items-center justify-between text-xs text-gray-600 px-1">
          <span className="flex items-center gap-1.5">
            <span className="text-base leading-none" aria-hidden="true">♦</span>
            4-year College Degree is Typically Required
          </span>
          <button
            type="button"
            onClick={handleClearPath}
            disabled={selectedIds.length === 0}
            className="inline-flex items-center gap-1.5 text-gray-600 hover:text-gray-900 disabled:opacity-40
                       disabled:cursor-not-allowed transition-colors uppercase font-semibold tracking-wide
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          >
            Clear Map
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 3-6.7" />
              <polyline points="3 4 3 10 9 10" />
            </svg>
          </button>
        </div>

        {/* Save & Share CTA bar — matches reference site styling */}
        <div className="mt-6 border-t border-gray-200 pt-5 flex items-center justify-end gap-3 flex-wrap">
          <span className="text-sm italic text-gray-600">
            Build a Career Path with the map, then <span aria-hidden="true">→</span>
          </span>
          <button
            type="button"
            onClick={handleShare}
            disabled={selectedIds.length === 0}
            className="px-6 py-2.5 rounded text-sm font-semibold text-white transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1f6f7a]"
            style={{ backgroundColor: '#1f6f7a' }}
          >
            Save it &amp; Share it here
          </button>
        </div>

        {/* Your Career Path panel — simplified display only (Phase J5) */}
        <CareerPathPanel
          selectedIds={selectedIds}
          roleById={roleById}
        />

        {/* Learning paths anchor — Phase J4 will populate; placeholder for "See related learning paths below" link */}
        <div id="learning-paths" className="mt-12 pt-8 border-t border-gray-100">
          <p className="text-xs text-gray-400 italic">
            Related learning paths will be added in a future update.
          </p>
        </div>
      </div>

      {/* Modals (Phase J4 + J6) — controlled by state above */}
      <SaveShareModal open={saveOpen}  onClose={() => setSaveOpen(false)} />
      <ErrorModal     open={errorOpen} onClose={() => setErrorOpen(false)} />
      <RoleDetailModal
        role={detailRoleId ? roleById.get(detailRoleId) ?? null : null}
        onClose={() => setDetailRoleId(null)}
      />
    </div>
  );
}
