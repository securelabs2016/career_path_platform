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

  // If approved: increment open_jobs_count on the canonical role
  if (decision === 'approved') {
    const { data: match } = await supabase
      .from('role_matches')
      .select('canonical_role_id')
      .eq('id', matchId)
      .single();

    if (match?.canonical_role_id) {
      await supabase.rpc('increment_job_count', {
        role_id: match.canonical_role_id,
      });
    }
  }

  return Response.json({ ok: true });
}
