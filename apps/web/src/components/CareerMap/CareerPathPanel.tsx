'use client';

import { useState } from 'react';
import type { Role, Industry } from '@/lib/types';
import { CLUSTER_COLORS, formatSalary } from './constants';

interface Props {
  selectedIds: string[];
  roleById: Map<string, Role>;
  industry: Industry;
  onRemove: (id: string) => void;
  onClear: () => void;
}

export default function CareerPathPanel({
  selectedIds, roleById, industry, onRemove, onClear,
}: Props) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  const chain = selectedIds
    .map(id => roleById.get(id))
    .filter((r): r is Role => Boolean(r));

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 2000);
    }
  };

  if (chain.length === 0) {
    return (
      <section
        className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-white p-5"
        aria-label="Your career path"
      >
        <div className="flex items-center gap-2 mb-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               className="text-gray-400" aria-hidden="true">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
          <h2 className="text-sm font-bold text-gray-700">Your Career Path</h2>
        </div>
        <p className="text-sm text-gray-500">
          Click roles on the map to build a path. Multiple clicks chain into a journey you can share.
        </p>
      </section>
    );
  }

  return (
    <section
      className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
      aria-label="Your career path"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               style={{ color: industry.color }} aria-hidden="true">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
          <h2 className="text-sm font-bold text-gray-900">Your Career Path</h2>
          <span className="text-xs font-semibold text-gray-400">
            {chain.length} role{chain.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-opacity hover:opacity-90
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
            style={{ backgroundColor: industry.color }}
            aria-label="Copy shareable link to clipboard"
          >
            {copyState === 'copied' ? '✓ Link copied' : copyState === 'error' ? 'Copy failed' : 'Save & Share'}
          </button>
          <button
            onClick={onClear}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg text-gray-600 bg-gray-100 hover:bg-gray-200
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Clear career path"
          >
            Clear path
          </button>
        </div>
      </div>

      <ol className="flex flex-col gap-2" role="list">
        {chain.map((role, i) => {
          const clusterColor = CLUSTER_COLORS[role.cluster] ?? CLUSTER_COLORS['Design & Engineering'];
          return (
            <li
              key={role.id}
              className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5"
            >
              {/* Step number */}
              <span
                className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ backgroundColor: industry.color }}
                aria-hidden="true"
              >
                {i + 1}
              </span>

              {/* Cluster dot */}
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${clusterColor?.dot ?? 'bg-gray-400'}`}
                aria-hidden="true"
              />

              {/* Role info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-900 truncate">{role.title}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    {role.seniority}
                  </span>
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                  <span>{role.cluster}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium">{formatSalary(role.salary_min, role.salary_max)}</span>
                </div>
              </div>

              {/* Remove button */}
              <button
                onClick={() => onRemove(role.id)}
                className="flex-shrink-0 w-6 h-6 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200
                           flex items-center justify-center text-lg leading-none
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-label={`Remove ${role.title} from path`}
                title="Remove from path"
              >
                ×
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
