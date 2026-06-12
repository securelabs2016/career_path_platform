'use client';

import { useMemo } from 'react';
import type { CardPosition } from '@/lib/map-layout';
import { LAYOUT } from '@/lib/map-layout';

/** Trim each endpoint of a segment inward along the line vector by an
 *  independent radius. Geometry stays center-to-center; only the rendered
 *  portion is shortened so the visible line starts/ends at the outer edge
 *  of each role's circle (with a small 2px breathing gap baked into the caller). */
function trimEnd(
  x1: number, y1: number, x2: number, y2: number,
  sourceR: number, targetR: number
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len === 0) return { x1, y1, x2, y2 };
  const ux = dx / len;
  const uy = dy / len;
  return {
    x1: x1 + ux * sourceR,
    y1: y1 + uy * sourceR,
    x2: x2 - ux * targetR,
    y2: y2 - uy * targetR,
  };
}

const SMALL_R = LAYOUT.NODE_R + 2;        // committed dot / resting circle edge + 2px gap
const BLOOM_R = LAYOUT.NODE_R_ACTIVE + 2; // bloom edge + 2px gap

interface Props {
  /** Ordered list of role IDs the user has clicked, in click order. */
  selectedPath: string[];
  /** Adjacency list keyed by role ID — the roles you can step to from this one. */
  adjacencyById: Map<string, string[]>;
  /** Pixel position of every role on the map. */
  positions: Map<string, CardPosition>;
  width: number;
  height: number;
}

/**
 * The "roads" drawn between role nodes when a path is being built.
 *
 *  • Committed segments — solid lines between consecutive roles in
 *    selectedPath.  These represent the path the user has built.
 *  • Exploration fan — animated lines from the LAST selected role to each
 *    of its (not-already-in-path) adjacent roles.  These animate in via
 *    stroke-dashoffset so they look like roads "drawing themselves" to
 *    the possible next steps.
 *
 *  The animation is driven by giving each exploration line a React `key`
 *  that includes the source role ID.  When the user clicks a new role, the
 *  source changes, the keys change, the lines re-mount, and the animation
 *  fires again.
 */
export default function PathChain({
  selectedPath,
  adjacencyById,
  positions,
  width,
  height,
}: Props) {
  const lastId = selectedPath.length > 0 ? selectedPath[selectedPath.length - 1] : null;

  // Trim each endpoint by the radius of whatever circle it touches:
  //   • Committed (non-last) role  → SMALL_R (resting circle + 2px gap)
  //   • Last role (the bloom)      → BLOOM_R (active bloom + 2px gap)
  // Exploration target (adjacent small circle) is left at the center so the
  // line still reaches into the adjacent dot.
  const committedSegments = useMemo(() => {
    const segs: { id: string; x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let i = 0; i < selectedPath.length - 1; i++) {
      const a = positions.get(selectedPath[i]);
      const b = positions.get(selectedPath[i + 1]);
      if (!a || !b) continue;
      const isLastSegment = i === selectedPath.length - 2;
      const trimmed = trimEnd(a.cx, a.cy, b.cx, b.cy, SMALL_R, isLastSegment ? BLOOM_R : SMALL_R);
      segs.push({ id: `cs-${selectedPath[i]}-${selectedPath[i + 1]}`, ...trimmed });
    }
    return segs;
  }, [selectedPath, positions]);

  const explorationSegments = useMemo(() => {
    if (!lastId) return [];
    const lastPos = positions.get(lastId);
    if (!lastPos) return [];
    const pathSet = new Set(selectedPath);
    const nexts = adjacencyById.get(lastId) ?? [];
    const segs: { id: string; x1: number; y1: number; x2: number; y2: number; length: number }[] = [];
    for (const adjId of nexts) {
      if (pathSet.has(adjId)) continue;
      const adjPos = positions.get(adjId);
      if (!adjPos) continue;
      const trimmed = trimEnd(lastPos.cx, lastPos.cy, adjPos.cx, adjPos.cy, BLOOM_R, 0);
      const dx = trimmed.x2 - trimmed.x1;
      const dy = trimmed.y2 - trimmed.y1;
      segs.push({
        id: `ex-${lastId}-${adjId}`,
        ...trimmed,
        length: Math.hypot(dx, dy),
      });
    }
    return segs;
  }, [lastId, selectedPath, adjacencyById, positions]);

  if (selectedPath.length === 0) return null;

  return (
    <svg
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none"
      style={{ overflow: 'visible', zIndex: 25 }}
      aria-hidden="true"
    >
      {/* Committed segments — gray, solid, no animation. Previously-walked
          edges fade back; only the current exploration fan stays white. */}
      {committedSegments.map(seg => (
        <line
          key={seg.id}
          x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
          stroke="#9ca3af"
          strokeWidth={5}
          strokeLinecap="round"
          opacity={0.9}
        />
      ))}

      {/* Exploration fan — animated draw via stroke-dashoffset.
          Each line's `style` sets the initial dasharray = length so the CSS
          animation can ease dashoffset from length → 0. */}
      {explorationSegments.map(seg => (
        <line
          key={seg.id}
          x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
          stroke="#ffffff"
          strokeWidth={5}
          strokeLinecap="round"
          opacity={0.9}
          className="path-chain-draw"
          style={{
            strokeDasharray:  seg.length,
            strokeDashoffset: seg.length,
          }}
        />
      ))}
    </svg>
  );
}
