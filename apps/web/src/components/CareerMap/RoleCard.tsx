'use client';

import { useState } from 'react';
import type { Role } from '@/lib/types';
import type { CardPosition } from '@/lib/map-layout';
import { LAYOUT } from '@/lib/map-layout';
import { CLUSTER_COLORS, DEGREE_BADGES, formatSalary } from './constants';

interface Props {
  role: Role;
  position: CardPosition;
  isSelected: boolean;
  isDimmed: boolean;
  isAdjacent: boolean;
  isRecommended: boolean;
  industryColor: string;
  onClick: (id: string) => void;
}

export default function RoleCard({
  role, position, isSelected, isDimmed, isAdjacent, isRecommended, industryColor, onClick,
}: Props) {
  const [hovered, setHovered] = useState(false);
  const { CARD_W, CARD_H } = LAYOUT;

  const clusterColor = CLUSTER_COLORS[role.cluster] ?? CLUSTER_COLORS['Design & Engineering'];
  const degreeBadge = DEGREE_BADGES[role.degree_required];

  // ── Visual state classes ───────────────────────────────────────────────────
  const opacityClass = isDimmed ? 'opacity-30' : 'opacity-100';
  const scaleClass = isSelected || (hovered && !isDimmed) ? 'scale-[1.03]' : 'scale-100';
  const shadowClass = isSelected
    ? 'shadow-lg shadow-black/10'
    : hovered && !isDimmed
    ? 'shadow-md shadow-black/8'
    : 'shadow-sm shadow-black/5';
  const borderClass = isSelected
    ? `ring-2 ring-offset-1`
    : isAdjacent
    ? 'ring-1 ring-offset-1'
    : 'ring-0';
  const ringColor = isSelected || isAdjacent ? clusterColor.ring : '';

  const hasJobs = role.open_jobs_count > 0;
  // Recommended glow (from wizard) — subtle pulse border
  const recommendedStyle = isRecommended
    ? { boxShadow: `0 0 0 2px ${industryColor}55, 0 0 12px ${industryColor}33` }
    : {};
  const jobGlow = hasJobs ? 'bg-amber-50' : isRecommended ? 'bg-blue-50/40' : 'bg-white';

  return (
    <div
      className="absolute"
      style={{ left: position.x, top: position.y, width: CARD_W, height: CARD_H, zIndex: isSelected ? 20 : hovered ? 10 : 1 }}
    >
      {/* ── Tooltip (shown above card on hover) ────────────────────────────── */}
      {hovered && !isDimmed && (
        <div
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 pointer-events-none"
          style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.12))' }}
        >
          <div className="bg-gray-900 text-white rounded-xl p-3 text-xs">
            <p className="font-semibold text-sm leading-snug mb-1">{role.title}</p>
            <p className="text-gray-300 mb-2">{role.cluster}</p>
            <div className="flex items-center justify-between text-gray-200">
              <span>{formatSalary(role.salary_min, role.salary_max)}</span>
              <span className="bg-gray-700 px-1.5 py-0.5 rounded text-gray-300">
                {degreeBadge?.label}
              </span>
            </div>
            {role.skills.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {role.skills.slice(0, 3).map(skill => (
                  <span key={skill} className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-300 text-[10px]">
                    {skill}
                  </span>
                ))}
                {role.skills.length > 3 && (
                  <span className="text-gray-500 text-[10px]">+{role.skills.length - 3} more</span>
                )}
              </div>
            )}
            {hasJobs && (
              <p className="mt-2 text-amber-400 font-medium">
                {role.open_jobs_count} open role{role.open_jobs_count !== 1 ? 's' : ''}
              </p>
            )}
            <p className="mt-2 text-gray-500 text-[10px]">Click for full details</p>
          </div>
          {/* Tooltip arrow */}
          <div className="w-0 h-0 mx-auto border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-gray-900" />
        </div>
      )}

      {/* ── Role card ──────────────────────────────────────────────────────── */}
      <button
        className={[
          'w-full h-full rounded-xl border border-gray-200 px-3 py-2.5 text-left',
          'transition-all duration-150 cursor-pointer',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
          opacityClass, scaleClass, shadowClass, borderClass, ringColor, jobGlow,
        ].join(' ')}
        style={{ transformOrigin: 'center center', ...recommendedStyle }}
        onClick={e => { e.stopPropagation(); onClick(role.id); }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-pressed={isSelected}
        aria-label={`${role.title} — ${role.cluster}, ${role.seniority} level`}
      >
        {/* Cluster indicator + degree badge */}
        <div className="flex items-center justify-between mb-1.5">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${clusterColor.dot}`} />
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${degreeBadge?.className}`}>
            {degreeBadge?.label}
          </span>
        </div>

        {/* Role title */}
        <p className="text-[13px] font-semibold text-gray-900 leading-tight line-clamp-2">
          {role.title}
        </p>

        {/* Salary */}
        <p className="text-[11px] text-gray-500 mt-1 font-medium">
          {formatSalary(role.salary_min, role.salary_max)}
        </p>

        {/* Job count heat map indicator */}
        {hasJobs && (
          <div className="flex items-center gap-1 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="text-[10px] text-amber-600 font-medium">{role.open_jobs_count} jobs</span>
          </div>
        )}
      </button>
    </div>
  );
}
