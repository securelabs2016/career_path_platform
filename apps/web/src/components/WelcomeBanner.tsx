'use client';

import { useEffect, useState } from 'react';
import DolphIQIcon, { DolphIQWordmark } from './DolphIQIcon';

const STORAGE_KEY = 'welcome-banner-dismissed-v1';

/**
 * Light first-visit welcome banner.
 *
 * Shows once per browser at the top of the industry page, above the About
 * panel. Disappears for returning visitors via a localStorage flag. No
 * full-screen overlay, no animation that delays first paint — just a
 * friendly stripe that introduces dolphIQ and how to start.
 */
export default function WelcomeBanner() {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  // Defer the setState until after mount to satisfy react-hooks/set-state-in-effect.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    const id = setTimeout(() => setVisible(true), 0);
    return () => clearTimeout(id);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setClosing(true);
    localStorage.setItem(STORAGE_KEY, '1');
    // Match the CSS transition duration before unmounting
    setTimeout(() => setVisible(false), 220);
  };

  return (
    <div
      role="status"
      aria-label="Welcome message"
      className={[
        'relative mb-4 rounded-2xl border border-blue-100 p-4 flex items-center gap-4',
        'bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50',
        'shadow-sm transition-all duration-200',
        closing ? 'opacity-0 -translate-y-1' : 'opacity-100',
      ].join(' ')}
    >
      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-white/70 flex items-center justify-center text-blue-600">
        <DolphIQIcon className="w-8 h-5" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900">
          Welcome to the Career Lattice
        </p>
        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
          Click any role on the map to start building a career path. Need a
          guide? <DolphIQWordmark /> is in the corner — just tap the dolphin to chat.
        </p>
      </div>

      <button
        onClick={dismiss}
        className="flex-shrink-0 w-7 h-7 rounded-full text-gray-400 hover:text-gray-700 hover:bg-white
                   flex items-center justify-center text-lg leading-none
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label="Dismiss welcome banner"
        title="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
