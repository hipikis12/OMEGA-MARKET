import { HttpError, json, readJson } from '../../../lib/http.js';
import { createAuth } from '../../../lib/supabase.js';
import { clearCookies, queueCookies } from '../../../lib/auth.js';
import * as v from '../../../lib/validate.js';

// POST /api/auth/reset { access_token, password } — conclui a redefinição
// usando o token de recuperação que o Supabase coloca no link do e-mail.
export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await readJson(request);
  const token = v.str(body.access_token, 'token', { min: 20, max: 4096 });
  const password = v.password(body.password);
  const r = await createAuth(env).updatePassword(token, password);
  if (!r.ok) throw new HttpError(400, 'Link expirado ou inválido. Peça um novo e-mail de redefinição.');
  await createAuth(env).signOut(token).catch(() => {});
  queueCookies(context, clearCookies(request));
  return json({ ok: true, message: 'Senha alterada. Entre com a nova senha.' });
}
