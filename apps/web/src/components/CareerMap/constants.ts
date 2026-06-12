/**
 * Cluster → color mapping. Palette matches the Critical Materials reference
 * site (Julius Education / NLR): a teal → green → cream → peach gradient
 * across columns, left to right. Same palette is applied to every industry
 * by column position; the cluster NAME is just the lookup key.
 *
 * Hex stops:
 *   0  deep teal     #1f6f7a
 *   1  medium teal   #3a8a8a
 *   2  sea green     #5fa896
 *   3  light green   #8ec48d
 *   4  cream         #d4d089
 *   5  peach         #f0a868
 */
export const CLUSTER_COLORS: Record<string, {
  dot:   string;     // tailwind bg class for the indicator bullet
  ring:  string;     // tailwind ring class for selected card border
  light: string;     // hex used for SVG line color
  band:  string;     // hex for the column header solid band
  tint:  string;     // hex (with alpha) for the cell background tint
}> = {
  // ── Additive Manufacturing (5 clusters) ────────────────────────────────
  'Design & Engineering':              { dot: 'bg-[#1f6f7a]', ring: 'ring-[#1f6f7a]', light: '#1f6f7a', band: '#1f6f7a', tint: '#1f6f7a14' },
  'Materials & Process Development':   { dot: 'bg-[#3a8a8a]', ring: 'ring-[#3a8a8a]', light: '#3a8a8a', band: '#3a8a8a', tint: '#3a8a8a14' },
  'Machine Operation & Production':    { dot: 'bg-[#5fa896]', ring: 'ring-[#5fa896]', light: '#5fa896', band: '#5fa896', tint: '#5fa89614' },
  'Post-Processing & Quality':         { dot: 'bg-[#8ec48d]', ring: 'ring-[#8ec48d]', light: '#8ec48d', band: '#8ec48d', tint: '#8ec48d14' },
  'Business, Sales & Supply Chain':    { dot: 'bg-[#f0a868]', ring: 'ring-[#f0a868]', light: '#f0a868', band: '#f0a868', tint: '#f0a86814' },

  // ── Semiconductors (5 clusters — reference site names, post-v3 migration) ─
  'Research, Design & Engineering':                  { dot: 'bg-[#1f6f7a]', ring: 'ring-[#1f6f7a]', light: '#1f6f7a', band: '#1f6f7a', tint: '#1f6f7a14' },
  'Wafer Fabrication':                               { dot: 'bg-[#3a8a8a]', ring: 'ring-[#3a8a8a]', light: '#3a8a8a', band: '#3a8a8a', tint: '#3a8a8a14' },
  'Assembly, Packaging & Testing':                   { dot: 'bg-[#5fa896]', ring: 'ring-[#5fa896]', light: '#5fa896', band: '#5fa896', tint: '#5fa89614' },
  'Facilities & Equipment Maintenance':              { dot: 'bg-[#8ec48d]', ring: 'ring-[#8ec48d]', light: '#8ec48d', band: '#8ec48d', tint: '#8ec48d14' },
  'Supply Chain, Logistics & Business Operations':   { dot: 'bg-[#f0a868]', ring: 'ring-[#f0a868]', light: '#f0a868', band: '#f0a868', tint: '#f0a86814' },

  // ── Space Industry (6 clusters) ────────────────────────────────────────
  'Spacecraft Design & Engineering':     { dot: 'bg-[#1f6f7a]', ring: 'ring-[#1f6f7a]', light: '#1f6f7a', band: '#1f6f7a', tint: '#1f6f7a14' },
  'Propulsion & Systems':                { dot: 'bg-[#3a8a8a]', ring: 'ring-[#3a8a8a]', light: '#3a8a8a', band: '#3a8a8a', tint: '#3a8a8a14' },
  'Manufacturing & Assembly (AIT)':      { dot: 'bg-[#5fa896]', ring: 'ring-[#5fa896]', light: '#5fa896', band: '#5fa896', tint: '#5fa89614' },
  'Mission Operations & Ground Systems': { dot: 'bg-[#8ec48d]', ring: 'ring-[#8ec48d]', light: '#8ec48d', band: '#8ec48d', tint: '#8ec48d14' },
  'Launch & Test Operations':            { dot: 'bg-[#d4d089]', ring: 'ring-[#d4d089]', light: '#d4d089', band: '#d4d089', tint: '#d4d08914' },
  'Business, Policy & Supply Chain':     { dot: 'bg-[#f0a868]', ring: 'ring-[#f0a868]', light: '#f0a868', band: '#f0a868', tint: '#f0a86814' },
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
