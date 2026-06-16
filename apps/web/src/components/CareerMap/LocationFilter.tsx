'use client';

/**
 * LocationFilter — Phase 3.4 skeleton.
 *
 * USA / Worldwide toggle that the CareerMap uses to choose which open-jobs
 * count to display on the map and inside the role detail modal.
 *
 * v1 skeleton: simple <select>. Polish (segmented control, country flag icons)
 * is deliberately deferred to a future phase.
 */

export type RegionFilter = 'US' | 'worldwide';

interface Props {
  value:    RegionFilter;
  onChange: (next: RegionFilter) => void;
}

export default function LocationFilter({ value, onChange }: Props) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-gray-700">
      <span className="font-semibold uppercase tracking-wide">Region:</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value as RegionFilter)}
        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label="Filter open jobs by region"
      >
        <option value="US">USA only</option>
        <option value="worldwide">Worldwide</option>
      </select>
    </label>
  );
}
