# Career Pathways Platform

A multi-industry career pathways map with AI advisor and live job ingestion pipeline.

**v1 industries:** Additive Manufacturing · Semiconductors  
**Post-prototype:** Space

## Structure

```
career-platform/
├── apps/
│   ├── web/          # Next.js website (TypeScript + Tailwind)
│   └── pipeline/     # Python data ingestion pipeline
├── packages/
│   └── shared/       # Shared TypeScript types
├── schema.sql        # Database schema (run in Supabase after Phase 3 deploy)
└── .env.example      # Copy to .env.local and fill in your keys
```

## Local Development

```bash
cd apps/web
npm install
npm run dev
# → http://localhost:3000
```

## Environment Variables

Copy `apps/web/.env.example` to `apps/web/.env.local` and fill in your values.

## Deploy

Deploy to Vercel after Phase 3 is complete and visually solid.
