import { isAdminAuthed } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { checkRateLimit, getClientIp, LIMITS } from '@/lib/rate-limit';

export async function POST(request: Request) {
  if (!(await isAdminAuthed())) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = checkRateLimit(`admin:${getClientIp(request)}`, LIMITS.admin);
  if (!rl.allowed) {
    return Response.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { matchId, decision } = await request.json().catch(() => ({}));

  if (!matchId || !['approved', 'rejected'].includes(decision)) {
    return Response.json({ error: 'Invalid matchId or decision' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return Response.json(
      { error: 'Database not connected' },
      { status: 503 },
    );
  }

  // Update match status
  const { error: matchErr } = await supabase
    .from('role_matches')
    .update({ status: decision })
    .eq('id', matchId);

  if (matchErr) {
    return Response.json({ error: matchErr.message }, { status: 500 });
  }

  // Record the human decision
  await supabase.from('review_decisions').insert({
    match_id:   matchId,
    decided_by: 'admin',
    decision,
  });

  // If approved: increment open_jobs_count + append source company to hiring_companies.
  // Doc Step 5 (Section 3) calls for both — count and company list — on the canonical role.
  // Phase 3 — only increment the cached US count when the job is in the US;
  // worldwide totals are computed live from role_matches at API time.
  if (decision === 'approved') {
    const { data: match } = await supabase
      .from('role_matches')
      .select('canonical_role_id, extracted_jobs(country,raw_jobs(company))')
      .eq('id', matchId)
      .single();

    const roleId  = match?.canonical_role_id;
    // The embedded select gives us match.extracted_jobs.{country,raw_jobs.company}.
    // Supabase typings narrow embedded relations to objects/arrays — cast loosely
    // here since the shape is well-known from the schema FKs.
    const ej = ((match as unknown) as {
      extracted_jobs?: { country?: string; raw_jobs?: { company?: string } } | null;
    })?.extracted_jobs;
    const country = (ej?.country || '').toUpperCase();
    const company = (ej?.raw_jobs?.company || '').trim();

    if (roleId && country === 'US') {
      await supabase.rpc('increment_job_count', { role_id: roleId });

      if (company) {
        // Append company to hiring_companies array, deduped.
        const { data: roleRow } = await supabase
          .from('canonical_roles')
          .select('hiring_companies')
          .eq('id', roleId)
          .single();
        const current: string[] = roleRow?.hiring_companies || [];
        if (!current.includes(company)) {
          await supabase
            .from('canonical_roles')
            .update({ hiring_companies: [...current, company] })
            .eq('id', roleId);
        }
      }
    }
  }

  return Response.json({ ok: true });
}
