import { HttpError, clientIp, json, readJson } from '../../../lib/http.js';
import { createAdmin, createAuth, eq } from '../../../lib/supabase.js';
import { clearCookies, queueCookies, sessionCookies } from '../../../lib/auth.js';
import { verifyTurnstile } from '../../../lib/turnstile.js';
import * as v from '../../../lib/validate.js';

// POST /api/auth/login  { email, password, turnstile }
export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await readJson(request);
  const email = v.email(body.email);
  if (typeof body.password !== 'string' || !body.password || body.password.length > 128) throw new HttpError(400, 'Informe a senha');
  await verifyTurnstile(env, body.turnstile, clientIp(request));

  const r = await createAuth(env).signIn(email, body.password);
  if (!r.ok || !r.data.access_token) {
    if (r.status === 429) throw new HttpError(429, 'Muitas tentativas. Aguarde alguns minutos.');
    const msg = String(r.data.error_description || r.data.msg || '');
    if (/confirm/i.test(msg)) throw new HttpError(403, 'Confirme seu e-mail antes de entrar.');
    throw new HttpError(401, 'E-mail ou senha incorretos');
  }
  const profile = await createAdmin(env).selectOne(`profiles?select=name,role,status&${eq('id', r.data.user.id)}`);
  if (!profile || profile.status !== 'active') {
    queueCookies(context, clearCookies(request));
    throw new HttpError(403, 'Conta suspensa. Fale com o suporte.');
  }
  queueCookies(context, sessionCookies(request, r.data));
  return json({ ok: true, user: { id: r.data.user.id, email: r.data.user.email, name: profile.name, role: profile.role } });
}
