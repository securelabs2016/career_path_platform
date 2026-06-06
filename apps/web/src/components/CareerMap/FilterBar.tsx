'use client';

interface Props {
  clusters: string[];
  searchQuery: string;
  degreeFilter: string;
  clusterFilter: string;
  matchCount: number;
  totalCount: number;
  onSearch: (q: string) => void;
  onDegree: (d: string) => void;
  onCluster: (c: string) => void;
  onClear: () => void;
}

const DEGREES = [
  { value: 'all',       label: 'All education' },
  { value: 'hs',        label: 'HS Diploma' },
  { value: '2yr',       label: "Associate's" },
  { value: '4yr',       label: "Bachelor's" },
  { value: 'graduate',  label: 'Graduate' },
  { value: 'sometimes', label: 'Sometimes required' },
];

export default function FilterBar({
  clusters, searchQuery, degreeFilter, clusterFilter,
  matchCount, totalCount, onSearch, onDegree, onCluster, onClear,
}: Props) {
  const hasActive =
    searchQuery.trim().length > 0 ||
    (degreeFilter && degreeFilter !== 'all') ||
    (clusterFilter && clusterFilter !== 'all');

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
      role="search"
      aria-label="Filter career map"
    >
      {/* Search */}
      <div className="relative flex-1 max-w-xs">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="search"
          placeholder="Search roles or skills…"
          value={searchQuery}
          onChange={e => onSearch(e.target.value)}
          className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-xl bg-white
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          aria-label="Search roles or skills"
        />
        {searchQuery && (
          <button
            onClick={() => onSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600
                       text-lg leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {/* Degree filter */}
      <select
        value={degreeFilter || 'all'}
        onChange={e => onDegree(e.target.value)}
        className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white cursor-pointer
                   focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Filter by education level"
      >
        {DEGREES.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {/* Cluster filter */}
      <select
        value={clusterFilter || 'all'}
        onChange={e => onCluster(e.target.value)}
        className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white cursor-pointer
                   focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Filter by cluster"
      >
        <option value="all">All clusters</option>
        {clusters.map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      {/* Match count + clear */}
      {hasActive && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span aria-live="polite">{matchCount} of {totalCount} roles</span>
          <button
            onClick={onClear}
            className="text-blue-600 hover:text-blue-700 font-semibold
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
