'use client';

import Link from 'next/link';
import type { Role } from '@/lib/types';
import Modal from '../Modal';
import { CLUSTER_COLORS, formatSalary } from './constants';

interface Props {
  role:    Role | null;
  /** Worldwide approved-match count — drives the "View live openings" button. */
  anyCount?: number;
  /** Industry slug, for routing to /[industry]/role/[id]/openings. */
  industrySlug?: string;
  onClose: () => void;
}

const DEGREE_LABEL: Record<string, string> = {
  hs:        'High School Diploma',
  '2yr':     "Associate's Degree",
  '4yr':     "Bachelor's Degree",
  graduate:  'Graduate Degree',
  sometimes: 'Sometimes Required',
};

const TIER_LABEL: Record<string, string> = {
  entry:  'Entry-level',
  mid:    'Mid-level',
  senior: 'Senior-level',
  lead:   'Senior-level',
};

/**
 * Role detail modal — Critical Materials reference layout.
 * Polished typography pass per user feedback (point 6): bigger body text,
 * stronger heading hierarchy, more breathing room.
 */
export default function RoleDetailModal({ role, anyCount, industrySlug, onClose }: Props) {
  if (!role) {
    return <Modal open={false} onClose={onClose}>{null}</Modal>;
  }

  // Phase 5 — worldwide match count drives the View live openings button.
  const worldwideCount = anyCount ?? 0;

  const clusterColor = CLUSTER_COLORS[role.cluster];
  const bandHex      = clusterColor?.band ?? '#374151';
  const tintHex      = clusterColor?.tint ?? '#e5e7eb';
  const degreeLabel  = DEGREE_LABEL[role.degree_required] ?? '—';
  const payText      = role.salary_range || `${formatSalary(role.salary_min, role.salary_max)} / year`;
  const tierLabel    = TIER_LABEL[role.seniority] ?? '';

  return (
    <Modal open={role !== null} onClose={onClose} maxWidth="960px" ariaLabel={`Details for ${role.title}`}>
      {/* Cluster band across the top */}
      <div
        className="absolute top-0 left-0 right-0 rounded-t-lg px-7 py-3"
        style={{ backgroundColor: bandHex }}
      >
        <span className="text-xs font-bold uppercase tracking-wider text-white">
          {role.cluster}
        </span>
      </div>

      <div className="pt-14">
        {/* Title + tier line */}
        <div className="mb-6 pr-12">
          <h2 className="text-3xl font-bold text-gray-900 leading-tight mb-1">{role.title}</h2>
          {tierLabel && (
            <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: bandHex }}>
              {tierLabel}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left column — description + skills (spans 2/3) */}
          <div className="md:col-span-2 space-y-7">
            {role.description && (
              <p className="text-[15px] text-gray-700 leading-relaxed">
                {role.description}
              </p>
            )}

            {role.skills.length > 0 && (
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">
                  Skills &amp; Requirements
                </h3>
                <ul className="space-y-2 text-[14px] text-gray-800 leading-relaxed">
                  {role.skills.map(skill => (
                    <li key={skill} className="flex items-start gap-2.5">
                      <span
                        className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: bandHex }}
                        aria-hidden="true"
                      />
                      <span>{skill}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {role.certifications.length > 0 && (
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">
                  Certifications
                </h3>
                <ul className="space-y-2 text-[14px] text-gray-800 leading-relaxed">
                  {role.certifications.map(cert => (
                    <li key={cert} className="flex items-start gap-2.5">
                      <span
                        className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: bandHex }}
                        aria-hidden="true"
                      />
                      <span>{cert}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Phase 5 — single CTA to the openings page. Country picker
                lives on that page; modal stays focused on role info. */}
            {worldwideCount > 0 && industrySlug && (
              <div>
                <Link
                  href={`/${industrySlug}/role/${role.id}/openings`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
                             text-white hover:opacity-90 transition-opacity
                             focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  style={{ backgroundColor: bandHex }}
                >
                  View {worldwideCount} live opening{worldwideCount === 1 ? '' : 's'} →
                </Link>
              </div>
            )}
          </div>

          {/* Right sidebar — icon-led meta */}
          <aside className="rounded-lg p-6 space-y-6 self-start" style={{ backgroundColor: tintHex }}>
            {/* Education */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ color: bandHex }} aria-hidden="true">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                  <path d="M6 12v5c3 3 9 3 12 0v-5" />
                </svg>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-700">
                  Required Education &amp; Training
                </h4>
              </div>
              <p className="text-base font-bold text-gray-900">{degreeLabel}</p>
              {role.degree_detail && (
                <p className="text-sm text-gray-700 mt-1.5 leading-relaxed">{role.degree_detail}</p>
              )}
            </div>

            {/* Experience */}
            {role.experience && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ color: bandHex }} aria-hidden="true">
                    <rect x="2" y="7" width="20" height="14" rx="2" />
                    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                  </svg>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-700">
                    Required Experience
                  </h4>
                </div>
                <p className="text-base font-bold text-gray-900">{role.experience}</p>
              </div>
            )}

            {/* Pay */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ color: bandHex }} aria-hidden="true">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-700">
                  Pay
                </h4>
              </div>
              <p className="text-base font-bold text-gray-900">{payText}</p>
            </div>
          </aside>
        </div>
      </div>
    </Modal>
  );
}
