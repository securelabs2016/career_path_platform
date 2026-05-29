import { isAdminAuthed } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { checkRateLimit, getClientIp, LIMITS } from '@/lib/rate-limit';

export async function GET(request: Request) {
  if (!(await isAdminAuthed())) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = checkRateLimit(`admin:${getClientIp(request)}`, LIMITS.admin);
  if (!rl.allowed) {
    return Response.json({ error: 'Too many requests, slow down' }, { status: 429 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return Response.json(
      { error: 'Database not connected. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') ?? 'pending';
  const page   = parseInt(searchParams.get('page') ?? '1');
  const limit  = 20;

  const { data, error, count } = await supabase
    .from('role_matches')
    .select(`
      id,
      confidence,
      status,
      created_at,
      extracted_jobs (
        normalized_title,
        skills,
        seniority,
        location,
        raw_jobs ( company, raw_title, url, source )
      ),
      canonical_roles (
        id,
        title,
        cluster,
        seniority,
        salary_min,
        salary_max
      )
    `, { count: 'exact' })
    .eq('status', status)
    .order('confidence', { ascending: false })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (error) {
    console.error('[admin/matches]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ matches: data, total: count, page, limit });
}
