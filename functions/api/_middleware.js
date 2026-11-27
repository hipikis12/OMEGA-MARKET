// Middleware de todas as rotas /api/*: proteção CSRF por origem, tratamento
// de erros, cookies de sessão e cabeçalhos de segurança.
import { errorResponse, json } from '../../lib/http.js';

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function sameOrigin(request, env) {
  const origin = request.headers.get('origin');
  const allowed = new Set([new URL(request.url).origin]);
  if (env.SITE_URL) allowed.add(new URL(env.SITE_URL).origin);
  if (origin) return allowed.has(origin);
  // Navegadores modernos sempre mandam Origin em POST; sem ele, exige Sec-Fetch-Site.
  return request.headers.get('sec-fetch-site') === 'same-origin';
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  context.data = context.data || {};

  let response;
  try {
    if (UNSAFE.has(request.method) && !url.pathname.startsWith('/api/webhooks/') && !sameOrigin(request, env)) {
      response = json({ error: 'Origem não permitida' }, 403);
    } else {
      response = await context.next();
    }
  } catch (err) {
    response = errorResponse(err);
  }

  // Respostas podem ser imutáveis (ex.: Response.redirect); clonamos os headers.
  const headers = new Headers(response.headers);
  for (const c of context.data.setCookies || []) headers.append('set-cookie', c);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  headers.set('x-frame-options', 'DENY');
  headers.set('cross-origin-resource-policy', 'same-origin');
  if (!headers.has('cache-control')) headers.set('cache-control', 'no-store');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
