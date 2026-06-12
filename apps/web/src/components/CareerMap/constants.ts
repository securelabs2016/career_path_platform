/**
 * Cluster → color mapping. Palette is applied to every industry by column
 * position; the cluster NAME is just the lookup key.
 *
 * Hex stops:
 *   0  jade green     #2d9159
 *   1  ocean blue     #2e7eb0
 *   2  mint           #a3d9a3
 *   3  teal           #5fb9b1
 *   4  warm orange    #f0a868
 *   5  dark orange    #c2410c   (Space only — 6th column)
 */
export const CLUSTER_COLORS: Record<string, {
  dot:   string;     // tailwind bg class for the indicator bullet
  ring:  string;     // tailwind ring class for selected card border
  light: string;     // hex used for SVG line color
  band:  string;     // hex for the column header solid band
  tint:  string;     // hex (with alpha) for the cell background tint
}> = {
  // ── Additive Manufacturing (5 clusters) ────────────────────────────────
  'Design & Engineering':              { dot: 'bg-[#2d9159]', ring: 'ring-[#2d9159]', light: '#2d9159', band: '#2d9159', tint: '#2d915914' },
  'Materials & Process Development':   { dot: 'bg-[#2e7eb0]', ring: 'ring-[#2e7eb0]', light: '#2e7eb0', band: '#2e7eb0', tint: '#2e7eb014' },
  'Machine Operation & Production':    { dot: 'bg-[#a3d9a3]', ring: 'ring-[#a3d9a3]', light: '#a3d9a3', band: '#a3d9a3', tint: '#a3d9a314' },
  'Post-Processing & Quality':         { dot: 'bg-[#5fb9b1]', ring: 'ring-[#5fb9b1]', light: '#5fb9b1', band: '#5fb9b1', tint: '#5fb9b114' },
  'Business, Sales & Supply Chain':    { dot: 'bg-[#f0a868]', ring: 'ring-[#f0a868]', light: '#f0a868', band: '#f0a868', tint: '#f0a86814' },

  // ── Semiconductors (5 clusters — reference site names, post-v3 migration) ─
  'Research, Design & Engineering':                  { dot: 'bg-[#2d9159]', ring: 'ring-[#2d9159]', light: '#2d9159', band: '#2d9159', tint: '#2d915914' },
  'Wafer Fabrication':                               { dot: 'bg-[#2e7eb0]', ring: 'ring-[#2e7eb0]', light: '#2e7eb0', band: '#2e7eb0', tint: '#2e7eb014' },
  'Assembly, Packaging & Testing':                   { dot: 'bg-[#a3d9a3]', ring: 'ring-[#a3d9a3]', light: '#a3d9a3', band: '#a3d9a3', tint: '#a3d9a314' },
  'Facilities & Equipment Maintenance':              { dot: 'bg-[#5fb9b1]', ring: 'ring-[#5fb9b1]', light: '#5fb9b1', band: '#5fb9b1', tint: '#5fb9b114' },
  'Supply Chain, Logistics & Business Operations':   { dot: 'bg-[#f0a868]', ring: 'ring-[#f0a868]', light: '#f0a868', band: '#f0a868', tint: '#f0a86814' },

  // ── Space Industry (6 clusters) ────────────────────────────────────────
  'Spacecraft Design & Engineering':     { dot: 'bg-[#2d9159]', ring: 'ring-[#2d9159]', light: '#2d9159', band: '#2d9159', tint: '#2d915914' },
  'Propulsion & Systems':                { dot: 'bg-[#2e7eb0]', ring: 'ring-[#2e7eb0]', light: '#2e7eb0', band: '#2e7eb0', tint: '#2e7eb014' },
  'Manufacturing & Assembly (AIT)':      { dot: 'bg-[#a3d9a3]', ring: 'ring-[#a3d9a3]', light: '#a3d9a3', band: '#a3d9a3', tint: '#a3d9a314' },
  'Mission Operations & Ground Systems': { dot: 'bg-[#5fb9b1]', ring: 'ring-[#5fb9b1]', light: '#5fb9b1', band: '#5fb9b1', tint: '#5fb9b114' },
  'Launch & Test Operations':            { dot: 'bg-[#f0a868]', ring: 'ring-[#f0a868]', light: '#f0a868', band: '#f0a868', tint: '#f0a86814' },
  'Business, Policy & Supply Chain':     { dot: 'bg-[#c2410c]', ring: 'ring-[#c2410c]', light: '#c2410c', band: '#c2410c', tint: '#c2410c14' },
};

export const DEGREE_BADGES: Record<string, { label: string; className: string }> = {
  hs:        { label: 'HS',     className: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200' },
  '2yr':     { label: '2yr',    className: 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200' },
  '4yr':     { label: '4yr',    className: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' },
  graduate:  { label: 'Grad',   className: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200' },
  sometimes: { label: 'Some',   className: 'bg-teal-50 text-teal-700 ring-1 ring-teal-200' },
};

export function formatSalary(min: number, max: number): string {
  const k = (n: number) => `$${Math.round(n / 1000)}k`;
  return `${k(min)}–${k(max)}`;
}
