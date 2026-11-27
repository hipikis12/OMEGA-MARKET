import { json } from '../../../lib/http.js';
import { createAuth } from '../../../lib/supabase.js';
import { clearCookies, parseCookies, queueCookies } from '../../../lib/auth.js';

// POST /api/auth/logout — encerra a sessão no Supabase e apaga os cookies
export async function onRequestPost(context) {
  const { request, env } = context;
  const at = parseCookies(request.headers.get('cookie')).om_at;
  if (at) await createAuth(env).signOut(at).catch(() => {});
  queueCookies(context, clearCookies(request));
  return json({ ok: true });
}
