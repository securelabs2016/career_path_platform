'use client';

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl
                 bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors no-print
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      aria-label="Save as PDF or print this career plan"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
      </svg>
      Save PDF
    </button>
  );
}
