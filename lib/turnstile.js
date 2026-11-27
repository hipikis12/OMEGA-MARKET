// Cloudflare Turnstile (anti-bot) — ativo quando TURNSTILE_SECRET_KEY existir.
import { HttpError } from './http.js';

export async function verifyTurnstile(env, token, ip, fetchImpl = fetch) {
  if (!env.TURNSTILE_SECRET_KEY) return true; // desativado em desenvolvimento
  if (typeof token !== 'string' || token.length < 10 || token.length > 4096) {
    throw new HttpError(400, 'Confirme que você não é um robô');
  }
  const body = new FormData();
  body.append('secret', env.TURNSTILE_SECRET_KEY);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);
  const res = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  const data = await res.json().catch(() => ({}));
  if (!data.success) throw new HttpError(400, 'Verificação anti-robô falhou. Recarregue a página.');
  return true;
}
