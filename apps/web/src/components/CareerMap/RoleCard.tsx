'use client';

import { useState } from 'react';
import type { Role } from '@/lib/types';
import type { CardPosition } from '@/lib/map-layout';
import { LAYOUT } from '@/lib/map-layout';
import { CLUSTER_COLORS } from './constants';

interface Props {
  role:           Role;
  position:       CardPosition;
  isSelected:     boolean;
  isDimmed:       boolean;
  isAdjacent:     boolean;
  isRecommended:  boolean;     // legacy prop — wizard removed in Phase J1 but kept for compat
  industryColor:  string;
  onClick:        (id: string) => void;
  onShowDetails:  (id: string) => void;
}

/**
 * Circle role node — Critical Materials reference visual.
 *
 *   ●  ← circle (cluster color, filled when selected/hovered, outlined otherwise)
 *  Role
 *  Title
 *
 * A small hover tooltip carries the title and a DETAILS button.
 * The DETAILS button currently links to the standalone role detail page;
 * Phase J6 swaps it for the in-place role detail modal.
 */
export default function RoleCard({
  role, position, isSelected, isDimmed, isAdjacent, onClick, onShowDetails,
}: Props) {
  const [hovered, setHovered] = useState(false);
  const { CARD_W, CARD_H, NODE_R } = LAYOUT;

  const clusterColor = CLUSTER_COLORS[role.cluster];
  const clusterHex   = clusterColor?.light ?? '#6b7280';

  // Visual states for the circle node
  const showFilled = isSelected || (hovered && !isDimmed);
  const nodeStyle: React.CSSProperties = {
    width:           NODE_R * 2,
    height:          NODE_R * 2,
    borderRadius:    '50%',
    borderWidth:     isSelected ? 2 : 1.5,
    borderStyle:     'solid',
    borderColor:     clusterHex,
    backgroundColor: showFilled ? clusterHex : 'white',
    transition:      'background-color 120ms, border-width 120ms, transform 120ms',
    transform:       isSelected ? 'scale(1.15)' : 'scale(1)',
    boxShadow:       showFilled ? `0 0 0 4px ${clusterHex}22` : 'none',
  };

  const opacityClass = isDimmed ? 'opacity-30' : isAdjacent ? 'opacity-100' : 'opacity-100';

  return (
    <div
      className={`absolute ${opacityClass} transition-opacity duration-150`}
      style={{ left: position.x, top: position.y, width: CARD_W, height: CARD_H, zIndex: isSelected ? 20 : hovered ? 10 : 1 }}
    >
      {/* Hover tooltip — title + DETAILS button. Salary lives in the modal. */}
      {hovered && !isDimmed && (
        <div
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1 w-56 pointer-events-none"
          style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.18))' }}
        >
          <div className="bg-white text-gray-900 rounded border border-gray-200 p-3 text-xs">
            <p className="font-semibold text-sm leading-snug mb-2">{role.title}</p>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onShowDetails(role.id); }}
              className="inline-block pointer-events-auto px-3 py-1 rounded text-[11px] font-semibold uppercase tracking-wide text-white
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
              style={{ backgroundColor: clusterHex }}
            >
              Details
            </button>
          </div>
          <div className="w-0 h-0 mx-auto border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-white" />
        </div>
      )}

      {/* The role node itself — circle + title underneath */}
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onClick(role.id); }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-pressed={isSelected}
        aria-label={`${role.title}${isSelected ? ' (in path)' : ''}`}
        className="w-full h-full flex flex-col items-center gap-1 px-1 pt-1
                   cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
      >
        {/* The circle — shows a check mark when selected */}
        <span className="flex-shrink-0 flex items-center justify-center" style={nodeStyle} aria-hidden="true">
          {isSelected && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </span>

        {/* Title — small, two-line clamp, centered */}
        <span className="text-[10px] text-gray-800 leading-tight text-center px-0.5 line-clamp-2 font-medium">
          {role.title}
        </span>
      </button>
    </div>
  );
}
