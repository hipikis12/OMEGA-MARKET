// Utilidades HTTP compartilhadas pelas Pages Functions (runtime Workers).

export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export function errorResponse(err) {
  if (err instanceof HttpError) return json({ error: err.message, code: err.code }, err.status);
  console.error('Erro interno:', err && err.stack ? err.stack : err);
  return json({ error: 'Erro interno. Tente novamente em instantes.' }, 500);
}

/** Lê JSON com limite de tamanho, rejeitando content-type diferente. */
export async function readJson(request, maxBytes = 16 * 1024) {
  const type = request.headers.get('content-type') || '';
  if (!type.toLowerCase().startsWith('application/json')) throw new HttpError(415, 'Envie application/json');
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > maxBytes) throw new HttpError(413, 'Requisição grande demais');
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, 'Requisição grande demais');
  try {
    const data = JSON.parse(text || '{}');
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data;
  } catch {
    throw new HttpError(400, 'JSON inválido');
  }
}

export function requireEnv(env, ...names) {
  const missing = names.filter((n) => !env[n]);
  if (missing.length) throw new HttpError(503, 'Serviço não configurado: ' + missing.join(', '), 'not_configured');
  return names.map((n) => env[n]);
}

export function clientIp(request) {
  return request.headers.get('cf-connecting-ip') || '0.0.0.0';
}

export function siteUrl(env, request) {
  const base = env.SITE_URL || new URL(request.url).origin;
  return base.replace(/\/+$/, '');
}
