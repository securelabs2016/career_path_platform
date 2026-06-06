-- Career Pathways Platform — Database Schema
-- Run this in your Supabase SQL editor when deploying after Phase 3.

-- Enable pgvector (needed for AI similarity search on roles)
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── Industries ───────────────────────────────────────────────────────────────
CREATE TABLE industries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,   -- e.g. 'additive-manufacturing'
  description TEXT,
  color       TEXT,                   -- hex color for UI
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ─── Canonical Roles ──────────────────────────────────────────────────────────
CREATE TABLE canonical_roles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_id       UUID NOT NULL REFERENCES industries(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  cluster           TEXT NOT NULL,    -- value-chain column name
  seniority         TEXT NOT NULL CHECK (seniority IN ('entry', 'mid', 'senior', 'lead')),
  salary_min        INTEGER,
  salary_max        INTEGER,
  degree_required   TEXT CHECK (degree_required IN ('hs', '2yr', '4yr', 'graduate', 'sometimes')),
  skills            TEXT[]   DEFAULT '{}',
  certifications    TEXT[]   DEFAULT '{}',
  description       TEXT,
  adjacent_role_ids UUID[]   DEFAULT '{}',
  open_jobs_count   INTEGER  DEFAULT 0,
  hiring_companies  TEXT[]   DEFAULT '{}',
  grid_col          INTEGER  DEFAULT 0,
  grid_row          INTEGER  DEFAULT 0,
  embedding         vector(1536),     -- for AI similarity matching in pipeline
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- Index for fast vector similarity search
CREATE INDEX ON canonical_roles USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ─── Pathways ─────────────────────────────────────────────────────────────────
CREATE TABLE pathways (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_id UUID NOT NULL REFERENCES industries(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  role_ids    UUID[] DEFAULT '{}',    -- ordered: first role → last role in path
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ─── Raw Jobs (from scrapers) ─────────────────────────────────────────────────
CREATE TABLE raw_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source          TEXT NOT NULL,      -- 'greenhouse' | 'lever' | 'playwright'
  company         TEXT NOT NULL,
  raw_title       TEXT NOT NULL,
  raw_description TEXT,
  url             TEXT NOT NULL UNIQUE,
  scraped_at      TIMESTAMPTZ DEFAULT now()
);

-- ─── Extracted Jobs (structured by Claude Haiku) ──────────────────────────────
CREATE TABLE extracted_jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_job_id       UUID NOT NULL REFERENCES raw_jobs(id) ON DELETE CASCADE,
  normalized_title TEXT,
  skills           TEXT[]  DEFAULT '{}',
  seniority        TEXT,
  location         TEXT,
  extracted_at     TIMESTAMPTZ DEFAULT now()
);

-- ─── Role Matches (from ontology matcher) ─────────────────────────────────────
CREATE TABLE role_matches (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extracted_job_id   UUID NOT NULL REFERENCES extracted_jobs(id) ON DELETE CASCADE,
  canonical_role_id  UUID NOT NULL REFERENCES canonical_roles(id) ON DELETE CASCADE,
  confidence         DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  status             TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at         TIMESTAMPTZ DEFAULT now()
);

-- ─── Review Decisions (human approvals/rejections) ────────────────────────────
CREATE TABLE review_decisions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id    UUID NOT NULL REFERENCES role_matches(id) ON DELETE CASCADE,
  decided_by  TEXT NOT NULL,          -- 'auto' or admin identifier
  decision    TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  decided_at  TIMESTAMPTZ DEFAULT now()
);

-- ─── Helper: increment open_jobs_count on a canonical role ────────────────────
-- Called by the pipeline after auto-approving a match.
CREATE OR REPLACE FUNCTION increment_job_count(role_id UUID)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE canonical_roles
  SET open_jobs_count = open_jobs_count + 1,
      updated_at      = now()
  WHERE id = role_id;
$$;

-- ─── Helper: match canonical roles by vector similarity ───────────────────────
-- Used when upgrading the matcher to use pgvector embeddings in production.
-- Requires the embedding column to be populated (run seed_embeddings.py first).
CREATE OR REPLACE FUNCTION match_canonical_roles(
  query_embedding vector(1536),
  match_threshold float,
  match_count     int,
  p_industry_id   uuid
)
RETURNS TABLE (id uuid, title text, similarity float)
LANGUAGE sql STABLE
AS $$
  SELECT id, title, 1 - (embedding <=> query_embedding) AS similarity
  FROM canonical_roles
  WHERE industry_id = p_industry_id
    AND embedding IS NOT NULL
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
