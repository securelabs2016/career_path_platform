'use client';

/**
 * HiringFilter — "Show only hiring" toggle.
 *
 * When ON, the CareerMap dims every role that has 0 live open jobs in the
 * currently-selected region. Roles with live jobs stay full-opacity, drawing
 * the eye to where the action actually is.
 *
 * Skeleton — checkbox style to match LocationFilter's visual weight. Polish
 * (segmented control, focus ring, etc.) deferred to a future phase.
 */

interface Props {
  value:    boolean;
  onChange: (next: boolean) => void;
}

export default function HiringFilter({ value, onChange }: Props) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-gray-700 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={value}
        onChange={e => onChange(e.target.checked)}
        className="w-3.5 h-3.5 rounded border-gray-300
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label="Show only roles with open jobs"
      />
      <span className="font-semibold uppercase tracking-wide">Show only hiring</span>
    </label>
  );
}
