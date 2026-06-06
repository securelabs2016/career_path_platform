import Link from 'next/link';
import DolphIQIcon, { DolphIQWordmark } from '@/components/DolphIQIcon';

const INDUSTRIES = [
  {
    slug: 'additive-manufacturing',
    name: 'Additive Manufacturing',
    description: '3D printing, metal fabrication, and advanced materials — one of the fastest-growing sectors in U.S. defense, aerospace, and medical manufacturing.',
    roleCount: '36 roles',
    color: 'bg-blue-600',
    hoverColor: 'hover:bg-blue-700',
  },
  {
    slug: 'semiconductors',
    name: 'Semiconductors',
    description: 'Chip design, fabrication, and packaging — the backbone of every electronic device, supercharged by the CHIPS Act.',
    roleCount: '~45 roles',
    color: 'bg-violet-600',
    hoverColor: 'hover:bg-violet-700',
  },
  {
    slug: 'space',
    name: 'Space Industry',
    description: 'Spacecraft design, propulsion, launch operations, mission control, and the commercial space economy.',
    roleCount: '38 roles',
    color: 'bg-indigo-600',
    hoverColor: 'hover:bg-indigo-700',
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <span className="text-sm font-semibold text-blue-600 tracking-wide uppercase">
            Career Pathways Platform
          </span>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-12 text-center">
        <h1 className="text-4xl font-bold text-gray-900 leading-tight mb-4">
          Find your path in the industries that matter
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-6">
          Explore every role in Additive Manufacturing, Semiconductors, and the Space Industry — see what skills you need,
          what you can earn, and what jobs are open right now.
        </p>
        <div className="inline-flex items-center gap-2 text-sm text-gray-500 bg-blue-50 px-4 py-2 rounded-full">
          <DolphIQIcon className="w-6 h-4 text-blue-600" />
          <span>
            <span className="font-semibold text-gray-700"><DolphIQWordmark /></span>
            <span className="mx-1.5 text-gray-400">·</span>
            <span>your AI guide on every page</span>
          </span>
        </div>
      </section>

      {/* Industry cards */}
      <section className="max-w-5xl mx-auto px-6 pb-20 w-full">
        <p className="text-sm font-medium text-gray-500 mb-6 text-center">
          Choose an industry to explore
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {INDUSTRIES.map((industry) => (
            <Link
              key={industry.slug}
              href={`/${industry.slug}`}
              className="group bg-white border border-gray-200 rounded-2xl p-8 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
            >
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-white text-xs font-semibold mb-4 ${industry.color}`}>
                {industry.roleCount}
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                {industry.name}
              </h2>
              <p className="text-gray-600 leading-relaxed mb-6">
                {industry.description}
              </p>
              <span className="text-sm font-semibold text-blue-600 group-hover:underline">
                Explore career map →
              </span>
            </Link>
          ))}
        </div>

        {/* Meet dolphIQ — small introduction */}
        <div className="mt-12 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 p-8 flex flex-col md:flex-row items-center gap-6">
          <DolphIQIcon className="w-24 h-16 text-blue-600 flex-shrink-0" />
          <div className="flex-1 text-center md:text-left">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-600 mb-1">
              Meet <DolphIQWordmark />
            </p>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Intelligent navigation for your career
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed max-w-2xl">
              Named after one of the most intelligent species on Earth — the doctor of the sea —
              <span className="font-semibold"> <DolphIQWordmark /></span> is your AI guide on every industry map.
              Ask about roles, salaries, education paths, or skills you&apos;d need to switch lanes.
              Look for the floating dolphin on any industry page.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white mt-auto">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs text-gray-400">
            Salary data: BLS OEWS. Job counts update weekly via the live ingestion pipeline.
          </p>
          <p className="text-xs text-gray-400">
            Career Pathways Platform · {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </main>
  );
}
