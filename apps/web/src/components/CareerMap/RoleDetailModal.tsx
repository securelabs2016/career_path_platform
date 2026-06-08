'use client';

import type { Role } from '@/lib/types';
import Modal from '../Modal';
import { CLUSTER_COLORS, formatSalary } from './constants';

interface Props {
  role:    Role | null;
  onClose: () => void;
}

const DEGREE_LABEL: Record<string, string> = {
  hs:        'High School Diploma',
  '2yr':     "Associate's Degree",
  '4yr':     "Bachelor's Degree",
  graduate:  'Graduate Degree',
  sometimes: 'Sometimes Required',
};

/**
 * Role detail modal — matches the Critical Materials reference layout.
 *
 *   ┌─────────────────────────────────────────────────────────┐
 *   │  [cluster band]                                    [×]  │
 *   │  ROLE TITLE                                              │
 *   │  ┌──────────────────────────────┬────────────────────┐  │
 *   │  │ Description paragraph         │ 🎓 Education       │  │
 *   │  │                                │ 💼 Experience      │  │
 *   │  │ Skills & Requirements:         │ 💲 Pay             │  │
 *   │  │  • Skill 1                     │                    │  │
 *   │  │  • Skill 2                     │                    │  │
 *   │  └──────────────────────────────┴────────────────────┘  │
 *   └─────────────────────────────────────────────────────────┘
 */
export default function RoleDetailModal({ role, onClose }: Props) {
  if (!role) {
    return <Modal open={false} onClose={onClose}>{null}</Modal>;
  }

  const clusterColor = CLUSTER_COLORS[role.cluster];
  const bandHex      = clusterColor?.band ?? '#374151';
  const tintHex      = clusterColor?.tint ?? '#e5e7eb';
  const degreeLabel  = DEGREE_LABEL[role.degree_required] ?? '—';
  const payText      = role.salary_range || `${formatSalary(role.salary_min, role.salary_max)} / year`;

  return (
    <Modal open={role !== null} onClose={onClose} maxWidth="900px" ariaLabel={`Details for ${role.title}`}>
      {/* Cluster band above the title */}
      <div
        className="absolute top-0 left-0 right-0 rounded-t-lg px-6 py-3"
        style={{ backgroundColor: bandHex }}
      >
        <span className="text-[11px] font-bold uppercase tracking-wide text-white">
          {role.cluster}
        </span>
      </div>

      <div className="pt-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 pr-12">{role.title}</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left column — description + skills (spans 2/3) */}
          <div className="md:col-span-2">
            {role.description && (
              <p className="text-sm text-gray-700 leading-relaxed mb-5">
                {role.description}
              </p>
            )}

            {role.skills.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3">Skills &amp; Requirements:</h3>
                <ul className="space-y-1.5 text-sm text-gray-700">
                  {role.skills.map(skill => (
                    <li key={skill} className="flex items-start gap-2">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-gray-500 flex-shrink-0" aria-hidden="true" />
                      <span>{skill}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {role.certifications.length > 0 && (
              <div className="mt-5">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Certifications:</h3>
                <ul className="space-y-1.5 text-sm text-gray-700">
                  {role.certifications.map(cert => (
                    <li key={cert} className="flex items-start gap-2">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-gray-500 flex-shrink-0" aria-hidden="true" />
                      <span>{cert}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Right sidebar — icon-led meta (Education / Experience / Pay) */}
          <aside
            className="rounded p-5 space-y-5"
            style={{ backgroundColor: tintHex }}
          >
            {/* Education */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: bandHex }} aria-hidden="true">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                  <path d="M6 12v5c3 3 9 3 12 0v-5" />
                </svg>
                <h4 className="text-[10px] font-bold uppercase tracking-wide text-gray-600">
                  Required Education &amp; Training
                </h4>
              </div>
              <p className="text-sm font-semibold text-gray-900">{degreeLabel}</p>
              {role.degree_detail && (
                <p className="text-xs text-gray-600 mt-1 leading-snug">{role.degree_detail}</p>
              )}
            </div>

            {/* Experience */}
            {role.experience && (
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: bandHex }} aria-hidden="true">
                    <rect x="2" y="7" width="20" height="14" rx="2" />
                    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                  </svg>
                  <h4 className="text-[10px] font-bold uppercase tracking-wide text-gray-600">
                    Required Experience
                  </h4>
                </div>
                <p className="text-sm font-semibold text-gray-900">{role.experience}</p>
              </div>
            )}

            {/* Pay */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: bandHex }} aria-hidden="true">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                <h4 className="text-[10px] font-bold uppercase tracking-wide text-gray-600">
                  Pay
                </h4>
              </div>
              <p className="text-sm font-semibold text-gray-900">{payText}</p>
            </div>
          </aside>
        </div>
      </div>
    </Modal>
  );
}
