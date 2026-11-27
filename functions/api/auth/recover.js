import { clientIp, json, readJson, siteUrl } from '../../../lib/http.js';
import { createAuth } from '../../../lib/supabase.js';
import { verifyTurnstile } from '../../../lib/turnstile.js';
import * as v from '../../../lib/validate.js';

// POST /api/auth/recover { email } — sempre responde igual (não revela contas)
export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await readJson(request);
  const email = v.email(body.email);
  await verifyTurnstile(env, body.turnstile, clientIp(request));
  await createAuth(env).recover(email, siteUrl(env, request) + '/nova-senha').catch(() => {});
  return json({ ok: true, message: 'Se o e-mail estiver cadastrado, você receberá o link de redefinição.' });
}
