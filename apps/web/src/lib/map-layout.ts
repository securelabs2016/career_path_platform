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
  CARD_W: 100,        // total clickable footprint per role (circle + title)
  CARD_H: 60,
  STACK_GAP: 6,      // gap between cards stacked in the same cell
  COL_W: 234,        // width of each column zone — sized so 5 cols + LEFT_W + OUTER_PAD ≈ 1272px container
  ROW_GAP: 24,       // vertical gap between seniority bands
  HEADER_H: 56,      // cluster name header height
  LEFT_W: 80,        // seniority label column width
  OUTER_PAD: 0,      // right + bottom padding (kept at 0 so the grid edge meets the page edge cleanly)
  NODE_R: 8,         // default circle node radius (16px diameter)
  NODE_R_ACTIVE: 29, // halo radius when hovered or selected (diameter ≈ 58px)
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
  x:  number;
  y:  number;
  cx: number; // center x — used for SVG line endpoints
  cy: number; // center y
  w:  number; // role-card width (may shrink for industries with more columns)
  h:  number; // role-card height
}

export interface LayoutResult {
  positions: Map<string, CardPosition>;
  totalWidth: number;
  totalHeight: number;
  rowStartY: Record<number, number>;
  rowBandHeight: Record<number, number>;
  numCols: number;
  /** Actual column width chosen for this industry — may differ from LAYOUT.COL_W. */
  colW: number;
  /** Actual card width chosen for this industry — may differ from LAYOUT.CARD_W. */
  cardW: number;
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

/**
 * Target page-container width that the map must fit inside (in pixels).
 * Matches the website's <main className="max-w-[1320px] ... sm:px-6">:
 *   1320 (max width) − 2 × 24 (sm:px-6 padding) = 1272px usable.
 * Tune this if you change the page container width.
 */
const TARGET_TOTAL_WIDTH = 1272;

/**
 * Sub-column count per cell.
 *   1 role                       → 1 sub-col (centered)
 *   2+ roles in a 5-col industry  → 2 sub-cols (side-by-side)
 *   any cell in a 6+-col industry → 1 sub-col (narrow columns → vertical stack
 *                                              gives labels the full width)
 */
function subColsForCount(n: number, numCols: number): number {
  if (n <= 1) return 1;
  if (numCols >= 6) return 1;
  return 2;
}

export function computeLayout(roles: Role[]): LayoutResult {
  const {
    CARD_W: MAX_CARD_W, CARD_H, STACK_GAP, ROW_GAP,
    HEADER_H, LEFT_W, OUTER_PAD,
  } = LAYOUT;

  // ── Step 1: figure out how many cluster columns we have ──────────────────
  const numCols = Math.max(...roles.map(r => r.grid_col)) + 1;

  // ── Step 2: derive COL_W and CARD_W from the available width ─────────────
  // Dynamic so AM/Semi (5 columns) and Space (6 columns) BOTH fit the
  // page container exactly — no horizontal scroll, no white margin.
  const COL_W  = Math.floor((TARGET_TOTAL_WIDTH - LEFT_W - OUTER_PAD) / numCols);
  // If 2 sub-columns don't fit at MAX_CARD_W, shrink the card.
  const fitFor2SubCols = Math.floor((COL_W - STACK_GAP) / 2);
  const CARD_W = Math.min(MAX_CARD_W, fitFor2SubCols);

  // ── Step 3: group roles into (col, row) cells ────────────────────────────
  const cellGroups = new Map<string, string[]>();
  roles.forEach(role => {
    const key = `${role.grid_col},${effectiveRow(role)}`;
    if (!cellGroups.has(key)) cellGroups.set(key, []);
    cellGroups.get(key)!.push(role.id);
  });

  // ── Step 4: UNIFORM cell height across all cells ─────────────────────────
  // The tallest cell in the entire grid sets the height for every other cell.
  // This guarantees all 5 × 3 = 15 (or 6 × 3 = 18 for Space) cells are the
  // same dimensions.
  let maxSubRowsOverall = 1;
  cellGroups.forEach(ids => {
    const subCols = subColsForCount(ids.length, numCols);
    const subRows = Math.ceil(ids.length / subCols);
    maxSubRowsOverall = Math.max(maxSubRowsOverall, subRows);
  });
  const uniformCellH =
    maxSubRowsOverall * CARD_H + (maxSubRowsOverall - 1) * STACK_GAP;

  // All 3 tier bands now use the same height.
  const rowBandHeight: Record<number, number> = {
    0: uniformCellH,
    1: uniformCellH,
    2: uniformCellH,
  };

  // ── Step 5: Y-start of each band (Senior on top in display order) ────────
  const rowStartY: Record<number, number> = {};
  let currentY = HEADER_H;
  SENIORITY_DISPLAY_ORDER.forEach(seniority => {
    const row = SENIORITY_TO_ROW[seniority];
    rowStartY[row] = currentY;
    currentY += uniformCellH + ROW_GAP;
  });

  // ── Step 6: compute each role's pixel position ───────────────────────────
  // The sub-grid (subCols × subRows of role cards) is centered inside the
  // (COL_W × uniformCellH) cell.
  const positions = new Map<string, CardPosition>();
  roles.forEach(role => {
    const row    = effectiveRow(role);
    const key    = `${role.grid_col},${row}`;
    const group  = cellGroups.get(key)!;
    const idx    = group.indexOf(role.id);

    const subCols = subColsForCount(group.length, numCols);
    const subRows = Math.ceil(group.length / subCols);
    const subRow  = Math.floor(idx / subCols);
    const subCol  = idx % subCols;

    const contentW = subCols * CARD_W + (subCols - 1) * STACK_GAP;
    const contentH = subRows * CARD_H + (subRows - 1) * STACK_GAP;

    const xCellOffset = (COL_W - contentW) / 2;
    const yCellOffset = (uniformCellH - contentH) / 2;

    const x = LEFT_W + role.grid_col * COL_W + xCellOffset + subCol * (CARD_W + STACK_GAP);
    const y = rowStartY[row] + yCellOffset + subRow * (CARD_H + STACK_GAP);

    positions.set(role.id, {
      x,
      y,
      cx: x + CARD_W / 2,
      // cy = visual center of the circle, NOT the card's geometric middle.
      // RoleCard's button has `pt-1` (4px) + circle (NODE_R*2 tall) + title BELOW.
      // The circle's center is `pt-1 + NODE_R` below the card's top.
      cy: y + 4 + LAYOUT.NODE_R,
      w:  CARD_W,
      h:  CARD_H,
    });
  });

  return {
    positions,
    totalWidth:  LEFT_W + numCols * COL_W + OUTER_PAD,
    totalHeight: currentY + OUTER_PAD,
    rowStartY,
    rowBandHeight,
    numCols,
    colW:  COL_W,
    cardW: CARD_W,
  };
}
