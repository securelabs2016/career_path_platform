'use client';

import { useRef, useState } from 'react';
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
  isRecommended:  boolean;
  industryColor:  string;
  onClick:        (id: string) => void;
  onShowDetails:  (id: string) => void;
}

/**
 * Circle role node.
 *
 *   • (small) → ● (2x, filled) on hover or selection
 *  Title
 *
 * Hover→tooltip→DETAILS click flow:
 *  - When mouse enters card OR tooltip, the tooltip stays open
 *  - When mouse leaves either, a 120ms grace timer starts before closing
 *  - Re-entering either side cancels the timer
 *  - Tooltip has pointer-events-auto so DETAILS is clickable
 *
 * This bridge pattern fixes the "tooltip closes before I can click DETAILS"
 * bug because mouse movement from card to tooltip momentarily leaves both
 * elements; the grace timer covers the gap.
 */
export default function RoleCard({
  role, position, isSelected, isDimmed, onClick, onShowDetails,
}: Props) {
  // isAdjacent (passed by parent) is reserved for the hover-graph effect (J8)
  // and isn't visually distinct yet — destructure it to silence the warning.
  const [hovered, setHovered] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { CARD_W, CARD_H, NODE_R, NODE_R_ACTIVE } = LAYOUT;

  const clusterColor = CLUSTER_COLORS[role.cluster];
  const clusterHex   = clusterColor?.light ?? '#6b7280';

  const showActive = isSelected || (hovered && !isDimmed);
  const r          = showActive ? NODE_R_ACTIVE : NODE_R;

  const openTooltip = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setHovered(true);
  };
  const closeTooltip = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setHovered(false), 120);
  };

  const nodeStyle: React.CSSProperties = {
    width:           r * 2,
    height:          r * 2,
    borderRadius:    '50%',
    borderWidth:     showActive ? 0 : 1.5,
    borderStyle:     'solid',
    borderColor:     clusterHex,
    backgroundColor: showActive ? clusterHex : 'white',
    transition:      'width 140ms, height 140ms, background-color 140ms',
    boxShadow:       showActive ? `0 0 0 4px ${clusterHex}22` : 'none',
  };

  const opacityClass = isDimmed ? 'opacity-30' : 'opacity-100';

  return (
    <div
      className={`absolute ${opacityClass} transition-opacity duration-150`}
      style={{ left: position.x, top: position.y, width: CARD_W, height: CARD_H, zIndex: isSelected ? 20 : hovered ? 30 : 1 }}
      onMouseEnter={openTooltip}
      onMouseLeave={closeTooltip}
    >
      {/* Hover tooltip — bridges via shared hover handlers above, so moving the
          mouse from circle to DETAILS button keeps the tooltip open. */}
      {hovered && !isDimmed && (
        <div
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-0 pt-0 w-56"
          onMouseEnter={openTooltip}
          onMouseLeave={closeTooltip}
        >
          {/* 8px transparent bridge so the mouse can travel from circle to
              tooltip card without "leaving" the hover region. */}
          <div className="h-2" aria-hidden="true" />
          <div
            className="bg-white text-gray-900 rounded border border-gray-200 p-3 text-xs"
            style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.18)' }}
          >
            <p className="font-semibold text-sm leading-snug mb-2.5">{role.title}</p>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onShowDetails(role.id); }}
              className="inline-block px-3 py-1.5 rounded text-[11px] font-semibold uppercase tracking-wide text-white
                         hover:opacity-90 transition-opacity
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
              style={{ backgroundColor: clusterHex }}
            >
              Details
            </button>
          </div>
        </div>
      )}

      {/* The role itself — circle + title */}
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onClick(role.id); }}
        aria-pressed={isSelected}
        aria-label={`${role.title}${isSelected ? ' (in path)' : ''}`}
        className="w-full h-full flex flex-col items-center gap-1 px-1 pt-1
                   cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
      >
        <span className="flex-shrink-0 flex items-center justify-center" style={nodeStyle} aria-hidden="true">
          {isSelected && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </span>
        <span className="text-[10px] text-gray-800 leading-tight text-center px-0.5 line-clamp-2 font-medium">
          {role.title}
        </span>
      </button>
    </div>
  );
}
