import { ImageResponse } from 'next/og';
import type { IndustryData } from '@/lib/types';

import amData    from '@/data/additive-manufacturing.json';
import semiData  from '@/data/semiconductors.json';
import spaceData from '@/data/space.json';

export const runtime = 'edge';
export const size    = { width: 1200, height: 630 };
export const contentType = 'image/png';

const INDUSTRY_MAP: Record<string, IndustryData> = {
  'additive-manufacturing': amData    as IndustryData,
  'semiconductors':         semiData  as IndustryData,
  'space':                  spaceData as IndustryData,
};

export default async function OGImage({
  params,
}: {
  params: Promise<{ industry: string }>;
}) {
  const { industry: slug } = await params;
  const data = INDUSTRY_MAP[slug];

  const name        = data?.industry.name        ?? 'Career Pathways';
  const description = data?.industry.description ?? '';
  const color       = data?.industry.color       ?? '#2563eb';
  const roleCount   = data?.roles.length         ?? 0;
  const pathwayCount= data?.pathways.length      ?? 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%',
          display: 'flex', flexDirection: 'column',
          backgroundColor: '#0f172a',
          padding: '64px',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Color accent bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 8,
          backgroundColor: color,
        }} />

        {/* Platform label */}
        <div style={{
          fontSize: 20, fontWeight: 700, color: '#94a3b8',
          letterSpacing: '0.1em', textTransform: 'uppercase',
          marginBottom: 32,
        }}>
          Career Pathways Platform
        </div>

        {/* Industry name */}
        <div style={{
          fontSize: 72, fontWeight: 900, color: '#f8fafc',
          lineHeight: 1.05, maxWidth: 800, marginBottom: 24,
        }}>
          {name}
        </div>

        {/* Description */}
        <div style={{
          fontSize: 24, color: '#94a3b8', maxWidth: 900,
          lineHeight: 1.5, marginBottom: 'auto',
        }}>
          {description.slice(0, 160)}{description.length > 160 ? '…' : ''}
        </div>

        {/* Stats row */}
        <div style={{
          display: 'flex', gap: 40, marginTop: 48,
        }}>
          {[
            { label: 'Roles mapped',      value: String(roleCount) },
            { label: 'Career pathways',   value: String(pathwayCount) },
            { label: 'AI-powered advisor',value: '✓' },
            { label: 'Live job data',     value: '✓' },
          ].map(stat => (
            <div key={stat.label} style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: color }}>
                {stat.value}
              </span>
              <span style={{ fontSize: 16, color: '#64748b', marginTop: 4 }}>
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
