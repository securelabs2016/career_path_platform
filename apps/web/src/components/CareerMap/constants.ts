// Cluster → color mapping (covers AM, Semi, and Space cluster names)
export const CLUSTER_COLORS: Record<string, {
  dot: string;        // tailwind bg class for the indicator dot
  ring: string;       // tailwind ring class for selected card border
  light: string;      // hex — used for SVG line color
}> = {
  // ── Additive Manufacturing (per client research, 5 clusters) ───────────
  'Design & Engineering':              { dot: 'bg-blue-500',    ring: 'ring-blue-400',    light: '#3b82f6' },
  'Materials & Process Development':   { dot: 'bg-emerald-500', ring: 'ring-emerald-400', light: '#10b981' },
  'Machine Operation & Production':    { dot: 'bg-orange-500',  ring: 'ring-orange-400',  light: '#f97316' },
  'Post-Processing & Quality':         { dot: 'bg-rose-500',    ring: 'ring-rose-400',    light: '#f43f5e' },
  'Business, Sales & Supply Chain':    { dot: 'bg-violet-500',  ring: 'ring-violet-400',  light: '#8b5cf6' },

  // ── Semiconductors (existing) ──────────────────────────────────────────
  'Process R&D':                       { dot: 'bg-emerald-500', ring: 'ring-emerald-400', light: '#10b981' },
  'Design & Verification':             { dot: 'bg-blue-500',    ring: 'ring-blue-400',    light: '#3b82f6' },
  'Fabrication Operations':            { dot: 'bg-orange-500',  ring: 'ring-orange-400',  light: '#f97316' },
  'Equipment Engineering':             { dot: 'bg-amber-500',   ring: 'ring-amber-400',   light: '#f59e0b' },
  'Test, Package & Quality':           { dot: 'bg-rose-500',    ring: 'ring-rose-400',    light: '#f43f5e' },

  // ── Space Industry (per client research, 6 clusters) ───────────────────
  'Spacecraft Design & Engineering':   { dot: 'bg-indigo-500',  ring: 'ring-indigo-400',  light: '#6366f1' },
  'Propulsion & Systems':              { dot: 'bg-red-500',     ring: 'ring-red-400',     light: '#ef4444' },
  'Manufacturing & Assembly (AIT)':    { dot: 'bg-orange-500',  ring: 'ring-orange-400',  light: '#f97316' },
  'Mission Operations & Ground Systems': { dot: 'bg-cyan-500',  ring: 'ring-cyan-400',    light: '#06b6d4' },
  'Launch & Test Operations':          { dot: 'bg-amber-500',   ring: 'ring-amber-400',   light: '#f59e0b' },
  'Business, Policy & Supply Chain':   { dot: 'bg-violet-500',  ring: 'ring-violet-400',  light: '#8b5cf6' },
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
