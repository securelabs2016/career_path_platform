import Link from 'next/link';

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

      {/* Hero — minimal, matches the reference site's restraint */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-12 text-center">
        <h1 className="text-4xl font-bold text-gray-900 leading-tight mb-4">
          Find your path in the industries that matter
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Explore every role in Additive Manufacturing, Semiconductors, and the Space Industry — see what skills you
          need, what you can earn, and where each role can take you.
        </p>
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

      </section>

      {/* Minimal footer — matches the reference site */}
      <footer className="border-t border-gray-100 bg-white mt-auto">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-center gap-3 text-xs text-gray-500">
          <a href="#" className="hover:text-gray-800 transition-colors">Privacy Policy</a>
          <span aria-hidden="true">|</span>
          <a href="#" className="hover:text-gray-800 transition-colors">Terms of Service</a>
        </div>
      </footer>
    </main>
  );
}
