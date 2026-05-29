import type { Role, SeniorityLevel } from './types';

export const LAYOUT = {
  CARD_W: 172,
  CARD_H: 78,
  STACK_GAP: 10,     // gap between cards stacked in the same cell
  COL_W: 228,        // width of each column zone (card is centered inside)
  ROW_GAP: 48,       // vertical gap between seniority bands
  HEADER_H: 60,      // cluster name header height
  LEFT_W: 100,       // seniority label column width
  OUTER_PAD: 28,     // right + bottom padding
} as const;

// Display order — lead at top, entry at bottom
export const SENIORITY_DISPLAY_ORDER: SeniorityLevel[] = ['lead', 'senior', 'mid', 'entry'];

export const SENIORITY_TO_ROW: Record<SeniorityLevel, number> = {
  entry: 0, mid: 1, senior: 2, lead: 3,
};

export const SENIORITY_LABELS: Record<SeniorityLevel, string> = {
  lead: 'Lead',
  senior: 'Senior',
  mid: 'Mid-level',
  entry: 'Entry-level',
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

export function computeLayout(roles: Role[]): LayoutResult {
  const { CARD_W, CARD_H, COL_W, STACK_GAP, ROW_GAP, HEADER_H, LEFT_W, OUTER_PAD } = LAYOUT;

  // ── Group roles by their (col, row) cell ──────────────────────────────────
  const cellGroups = new Map<string, string[]>();
  roles.forEach(role => {
    const key = `${role.grid_col},${role.grid_row}`;
    if (!cellGroups.has(key)) cellGroups.set(key, []);
    cellGroups.get(key)!.push(role.id);
  });

  // ── Max cards stacked per seniority row ───────────────────────────────────
  const maxPerRow: Record<number, number> = { 0: 1, 1: 1, 2: 1, 3: 1 };
  cellGroups.forEach((ids, key) => {
    const row = parseInt(key.split(',')[1]);
    maxPerRow[row] = Math.max(maxPerRow[row], ids.length);
  });

  // ── Height of each seniority band ─────────────────────────────────────────
  const rowBandHeight: Record<number, number> = {};
  [0, 1, 2, 3].forEach(row => {
    const n = maxPerRow[row];
    rowBandHeight[row] = n * CARD_H + (n - 1) * STACK_GAP;
  });

  // ── Y-start of each band (lead at top) ────────────────────────────────────
  const rowStartY: Record<number, number> = {};
  let currentY = HEADER_H;
  SENIORITY_DISPLAY_ORDER.forEach(seniority => {
    const row = SENIORITY_TO_ROW[seniority];
    rowStartY[row] = currentY;
    currentY += rowBandHeight[row] + ROW_GAP;
  });

  // ── Pixel position of every role card ─────────────────────────────────────
  const positions = new Map<string, CardPosition>();
  roles.forEach(role => {
    const key = `${role.grid_col},${role.grid_row}`;
    const group = cellGroups.get(key)!;
    const indexInCell = group.indexOf(role.id);

    const x = LEFT_W + role.grid_col * COL_W + (COL_W - CARD_W) / 2;
    const y = rowStartY[role.grid_row] + indexInCell * (CARD_H + STACK_GAP);

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
