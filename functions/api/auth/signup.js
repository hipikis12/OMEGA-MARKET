import { HttpError, clientIp, json, readJson, siteUrl } from '../../../lib/http.js';
import { createAuth } from '../../../lib/supabase.js';
import { queueCookies, sessionCookies } from '../../../lib/auth.js';
import { verifyTurnstile } from '../../../lib/turnstile.js';
import * as v from '../../../lib/validate.js';

// POST /api/auth/signup  { name, email, password, turnstile }
export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await readJson(request);
  const name = v.str(body.name, 'nome', { min: 2, max: 80 });
  const email = v.email(body.email);
  const password = v.password(body.password);
  await verifyTurnstile(env, body.turnstile, clientIp(request));

  const r = await createAuth(env).signUp(email, password, name, siteUrl(env, request) + '/conta-confirmada');
  if (!r.ok) {
    if (r.status === 422 || r.status === 400) throw new HttpError(400, 'Não foi possível criar a conta com esses dados.');
    if (r.status === 429) throw new HttpError(429, 'Muitas tentativas. Aguarde alguns minutos.');
    throw new HttpError(502, 'Serviço de contas indisponível');
  }
  if (r.data.access_token) {
    queueCookies(context, sessionCookies(request, r.data));
    return json({ ok: true, confirmed: true });
  }
  // Confirmação por e-mail ativa no Supabase (recomendado em produção)
  return json({ ok: true, confirmed: false, message: 'Enviamos um link de confirmação para o seu e-mail.' });
}
