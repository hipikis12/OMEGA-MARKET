// Cliente mínimo do Supabase via REST (PostgREST, Auth e Storage), sem
// dependências npm — roda em Cloudflare Workers/Pages e no Node 22.
import { HttpError, requireEnv } from './http.js';

const looksLikeJwt = (k) => typeof k === 'string' && k.startsWith('eyJ');

/** Cabeçalhos para a chave secreta (service_role ou sb_secret_...). */
function adminHeaders(key, extra = {}) {
  const h = { apikey: key, ...extra };
  if (looksLikeJwt(key)) h.authorization = `Bearer ${key}`;
  return h;
}

export function createAdmin(env, fetchImpl = fetch) {
  const [url, key] = requireEnv(env, 'SUPABASE_URL', 'SUPABASE_SECRET_KEY');
  const base = url.replace(/\/+$/, '');

  async function call(path, { method = 'GET', body, headers = {}, raw = false } = {}) {
    const res = await fetchImpl(base + path, {
      method,
      headers: adminHeaders(key, body !== undefined ? { 'content-type': 'application/json', ...headers } : headers),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (raw) return res;
    const text = await res.text();
    const data = text ? safeJson(text) : null;
    if (!res.ok) {
      const msg = (data && (data.message || data.error_description || data.msg || data.error)) || `Supabase ${res.status}`;
      // Erros de regra de negócio levantados nas funções SQL (errcode 22023)
      if (data && data.code === '22023') throw new HttpError(400, msg, 'business_rule');
      if (data && data.code === '23505') throw new HttpError(409, 'Registro duplicado', 'duplicate');
      console.error('Supabase error', res.status, path.split('?')[0], msg);
      throw new HttpError(res.status >= 500 ? 502 : 400, res.status >= 500 ? 'Banco de dados indisponível' : msg);
    }
    return data;
  }

  return {
    base,
    /** GET /rest/v1/<query> */
    select: (query) => call(`/rest/v1/${query}`),
    selectOne: async (query) => {
      const rows = await call(`/rest/v1/${query}`);
      return Array.isArray(rows) ? rows[0] || null : rows;
    },
    insert: (table, rows, { upsert = false } = {}) =>
      call(`/rest/v1/${table}`, {
        method: 'POST',
        body: rows,
        headers: { prefer: `return=representation${upsert ? ',resolution=merge-duplicates' : ''}` },
      }),
    update: (table, filter, patch) =>
      call(`/rest/v1/${table}?${filter}`, { method: 'PATCH', body: patch, headers: { prefer: 'return=representation' } }),
    remove: (table, filter) => call(`/rest/v1/${table}?${filter}`, { method: 'DELETE', headers: { prefer: 'return=representation' } }),
    rpc: (fn, args) => call(`/rest/v1/rpc/${fn}`, { method: 'POST', body: args }),

    /** URL temporária de download para objeto privado. */
    async signedDownload(bucket, path, expiresIn = 120, downloadName) {
      const data = await call(`/storage/v1/object/sign/${bucket}/${encodePath(path)}`, { method: 'POST', body: { expiresIn } });
      const signed = data.signedURL || data.signedUrl;
      const u = new URL(base + '/storage/v1' + signed);
      if (downloadName) u.searchParams.set('download', downloadName);
      return u.toString();
    },
    /** URL temporária para o navegador do admin enviar um arquivo direto ao Storage. */
    async signedUpload(bucket, path) {
      const data = await call(`/storage/v1/object/upload/sign/${bucket}/${encodePath(path)}`, { method: 'POST', body: {} });
      return base + '/storage/v1' + data.url;
    },
    publicUrl: (bucket, path) => `${base}/storage/v1/object/public/${bucket}/${encodePath(path)}`,
    removeObject: (bucket, path) => call(`/storage/v1/object/${bucket}`, { method: 'DELETE', body: { prefixes: [path] } }),

    /** Valida um access token de usuário consultando o Supabase Auth. */
    async getUser(accessToken) {
      const res = await fetchImpl(base + '/auth/v1/user', { headers: { apikey: key, authorization: `Bearer ${accessToken}` } });
      if (!res.ok) return null;
      return res.json();
    },
  };
}

/** Cliente de autenticação (chave publishable/anon) — signup, login, refresh. */
export function createAuth(env, fetchImpl = fetch) {
  const [url, key] = requireEnv(env, 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY');
  const base = url.replace(/\/+$/, '');
  async function call(path, body, token, method = 'POST') {
    const headers = { apikey: key, 'content-type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetchImpl(base + '/auth/v1' + path, { method, headers, body: JSON.stringify(body || {}) });
    const text = await res.text();
    const data = text ? safeJson(text) : {};
    return { ok: res.ok, status: res.status, data: data || {} };
  }
  return {
    signUp: (email, password, name, redirectTo) =>
      call(`/signup${redirectTo ? '?redirect_to=' + encodeURIComponent(redirectTo) : ''}`, { email, password, data: { name } }),
    signIn: (email, password) => call('/token?grant_type=password', { email, password }),
    refresh: (refresh_token) => call('/token?grant_type=refresh_token', { refresh_token }),
    signOut: (token) => call('/logout', {}, token),
    updatePassword: (token, password) => call('/user', { password }, token, 'PUT'),
    recover: (email, redirectTo) => call(`/recover${redirectTo ? '?redirect_to=' + encodeURIComponent(redirectTo) : ''}`, { email }),
  };
}

function safeJson(t) { try { return JSON.parse(t); } catch { return { message: t.slice(0, 200) }; } }
const encodePath = (p) => p.split('/').map(encodeURIComponent).join('/');

/** Monta filtro PostgREST seguro para igualdade. */
export const eq = (col, v) => `${col}=eq.${encodeURIComponent(v)}`;
export const inList = (col, arr) => `${col}=in.(${arr.map((v) => encodeURIComponent(v)).join(',')})`;
