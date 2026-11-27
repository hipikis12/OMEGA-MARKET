// Utilitários de teste: executa middleware + handler como o Cloudflare Pages
// e substitui o fetch global por respostas simuladas por rota.
import { onRequest as middleware } from '../functions/api/_middleware.js';

export const ENV = {
  SITE_URL: 'https://loja.example.com',
  SUPABASE_URL: 'https://proj.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
  MP_ACCESS_TOKEN: 'TEST-123',
  MP_WEBHOOK_SECRET: 'segredo-webhook',
};

/** routes: [[method, regex, (url, init) => {status, body}]] */
export function mockFetch(routes) {
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    const method = (init.method || 'GET').toUpperCase();
    calls.push({ url, method, init, body: init.body && typeof init.body === 'string' ? JSON.parse(init.body) : init.body });
    for (const [m, re, fn] of routes) {
      if (m === method && re.test(url)) {
        const r = await fn(url, init);
        return new Response(r.body === undefined ? '' : JSON.stringify(r.body), { status: r.status || 200, headers: { 'content-type': 'application/json' } });
      }
    }
    throw new Error('fetch inesperado: ' + method + ' ' + url);
  };
  return calls;
}

export async function run(handler, { method = 'GET', path = '/api/x', body, headers = {}, params = {}, env = ENV, rawBody } = {}) {
  const request = new Request('https://loja.example.com' + path, {
    method,
    headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), origin: 'https://loja.example.com', ...headers },
    body: rawBody !== undefined ? rawBody : body !== undefined ? JSON.stringify(body) : undefined,
  });
  const context = { request, env, params, data: {} };
  context.next = () => handler(context);
  const res = await middleware(context);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* não-JSON */ }
  return { status: res.status, headers: res.headers, json };
}
