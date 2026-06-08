import type { Role, SeniorityLevel } from './types';

/**
 * Map layout constants — sized to match the Critical Materials reference site:
 * compact circular nodes packed densely in tinted columns.
 *
 * Three tiers (Senior / Mid / Entry) — "lead" roles in the data render into
 * the Senior row visually. The four-tier data model is preserved so we can
 * restore it later without re-touching the JSONs.
 */
export const LAYOUT = {
  CARD_W: 96,        // total clickable footprint per role (circle + title)
  CARD_H: 56,
  STACK_GAP: 6,      // gap between cards stacked in the same cell
  COL_W: 210,        // width of each column zone (wider per user feedback)
  ROW_GAP: 24,       // vertical gap between seniority bands
  HEADER_H: 56,      // cluster name header height
  LEFT_W: 80,        // seniority label column width
  OUTER_PAD: 24,     // right + bottom padding
  NODE_R: 7,         // default circle node radius (14px diameter)
  NODE_R_ACTIVE: 14, // circle radius when hovered or selected (~2x default)
} as const;

// Display order — only 3 rows visible (Senior on top, Entry on bottom).
// "lead" still exists in the data model but renders into the Senior row.
export const SENIORITY_DISPLAY_ORDER: SeniorityLevel[] = ['senior', 'mid', 'entry'];

// "lead" maps to the Senior row so legacy data renders cleanly without
// JSON migration. Three-tier visual; four-tier underlying data.
export const SENIORITY_TO_ROW: Record<SeniorityLevel, number> = {
  entry: 0, mid: 1, senior: 2, lead: 2,
};

export const SENIORITY_LABELS: Record<SeniorityLevel, string> = {
  senior: 'Senior',
  mid:    'Mid',
  entry:  'Entry',
  lead:   'Senior',
};

export interface CardPosition {
  x: number;
  y: number;
  cx: number; // center x — used for SVG line endpoints
  cy: number; // center y
}

export interface LayoutResult {
  positions: Map<string, CardPosition>;
  totalWidth: number;
  totalHeight: number;
  rowStartY: Record<number, number>;
  rowBandHeight: Record<number, number>;
  numCols: number;
}

/**
 * Effective layout row for a role.
 *
 * Three-tier visual: "lead" roles render into the Senior row (row 2) even
 * though they have grid_row=3 in the underlying data. Keeps the data model
 * intact for any future return to four tiers.
 */
function effectiveRow(role: Role): number {
  return role.seniority === 'lead' ? SENIORITY_TO_ROW.senior : role.grid_row;
}

export function computeLayout(roles: Role[]): LayoutResult {
  const { CARD_W, CARD_H, COL_W, STACK_GAP, ROW_GAP, HEADER_H, LEFT_W, OUTER_PAD } = LAYOUT;

  // Group roles by their effective (col, row) cell
  const cellGroups = new Map<string, string[]>();
  roles.forEach(role => {
    const key = `${role.grid_col},${effectiveRow(role)}`;
    if (!cellGroups.has(key)) cellGroups.set(key, []);
    cellGroups.get(key)!.push(role.id);
  });

  // Max cards stacked per seniority row (only 3 rows visible: 0/1/2)
  const maxPerRow: Record<number, number> = { 0: 1, 1: 1, 2: 1 };
  cellGroups.forEach((ids, key) => {
    const row = parseInt(key.split(',')[1]);
    maxPerRow[row] = Math.max(maxPerRow[row], ids.length);
  });

  // Height of each seniority band
  const rowBandHeight: Record<number, number> = {};
  [0, 1, 2].forEach(row => {
    const n = maxPerRow[row];
    rowBandHeight[row] = n * CARD_H + (n - 1) * STACK_GAP;
  });

  // Y-start of each band (Senior at top in display order)
  const rowStartY: Record<number, number> = {};
  let currentY = HEADER_H;
  SENIORITY_DISPLAY_ORDER.forEach(seniority => {
    const row = SENIORITY_TO_ROW[seniority];
    rowStartY[row] = currentY;
    currentY += rowBandHeight[row] + ROW_GAP;
  });

  // Pixel position of every role card
  const positions = new Map<string, CardPosition>();
  roles.forEach(role => {
    const row = effectiveRow(role);
    const key = `${role.grid_col},${row}`;
    const group = cellGroups.get(key)!;
    const indexInCell = group.indexOf(role.id);

    const x = LEFT_W + role.grid_col * COL_W + (COL_W - CARD_W) / 2;
    const y = rowStartY[row] + indexInCell * (CARD_H + STACK_GAP);

    positions.set(role.id, {
      x,
      y,
      cx: x + CARD_W / 2,
      cy: y + CARD_H / 2,
    });
  });

  const numCols = Math.max(...roles.map(r => r.grid_col)) + 1;

  return {
    positions,
    totalWidth: LEFT_W + numCols * COL_W + OUTER_PAD,
    totalHeight: currentY + OUTER_PAD,
    rowStartY,
    rowBandHeight,
    numCols,
  };
}
