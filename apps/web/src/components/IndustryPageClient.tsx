'use client';

import { useState, Suspense } from 'react';
import type { IndustryData } from '@/lib/types';
import CareerMap from './CareerMap';
import GetStartedWizard from './GetStartedWizard';
import AgentChat from './AgentChat';

interface Props {
  data: IndustryData;
}

function MapSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-100 animate-pulse" style={{ height: 520 }}>
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading career map…</p>
      </div>
    </div>
  );
}

export default function IndustryPageClient({ data }: Props) {
  const [recommendedIds, setRecommendedIds] = useState<string[]>([]);
  const [wizardVisible,  setWizardVisible]  = useState(true);

  return (
    <>
      {/* Get Started wizard — overlay, first visit only */}
      {wizardVisible && (
        <GetStartedWizard
          data={data}
          onComplete={ids => { setRecommendedIds(ids); setWizardVisible(false); }}
          onSkip={() => setWizardVisible(false)}
        />
      )}

      {/* Career map — needs Suspense because it uses useSearchParams */}
      <Suspense fallback={<MapSkeleton />}>
        <CareerMap data={data} recommendedIds={recommendedIds} />
      </Suspense>

      {/* AI advisor — floating chat button (fixed position, always visible when page is open) */}
      <AgentChat data={data} />
    </>
  );
}
