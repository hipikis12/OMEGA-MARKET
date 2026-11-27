// Sessão por cookies HttpOnly com tokens do Supabase Auth.
// O navegador nunca vê os tokens (proteção contra roubo via XSS).
import { HttpError } from './http.js';
import { createAdmin, createAuth, eq } from './supabase.js';

const AT = 'om_at';
const RT = 'om_rt';
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

export function parseCookies(header) {
  const out = {};
  for (const part of (header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function cookie(name, value, maxAge, secure = true) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

const isSecure = (request) => new URL(request.url).protocol === 'https:';

export function sessionCookies(request, session) {
  const s = isSecure(request);
  return [
    cookie(AT, session.access_token, Math.max(60, Number(session.expires_in) || 3600), s),
    cookie(RT, session.refresh_token, REFRESH_MAX_AGE, s),
  ];
}

export function clearCookies(request) {
  const s = isSecure(request);
  return [cookie(AT, '', 0, s), cookie(RT, '', 0, s)];
}

/** Anexa cookies que o middleware deve devolver na resposta. */
export function queueCookies(context, list) {
  context.data.setCookies = [...(context.data.setCookies || []), ...list];
}

/**
 * Retorna { id, email, name, role, status, accessToken } ou null.
 * Renova a sessão automaticamente com o refresh token quando necessário.
 */
export async function getSession(context) {
  if (context.data.session !== undefined) return context.data.session;
  const { request, env } = context;
  const cookies = parseCookies(request.headers.get('cookie'));
  let session = null;
  if (cookies[AT] || cookies[RT]) {
    const admin = createAdmin(env);
    let token = cookies[AT];
    let user = token ? await admin.getUser(token) : null;
    if (!user && cookies[RT]) {
      const r = await createAuth(env).refresh(cookies[RT]);
      if (r.ok && r.data.access_token) {
        token = r.data.access_token;
        user = r.data.user || (await admin.getUser(token));
        queueCookies(context, sessionCookies(request, r.data));
      } else {
        queueCookies(context, clearCookies(request));
      }
    }
    if (user && user.id) {
      const profile = await admin.selectOne(`profiles?select=name,role,status&${eq('id', user.id)}`);
      if (profile && profile.status === 'active') {
        session = { id: user.id, email: user.email, name: profile.name, role: profile.role, accessToken: token };
      }
    }
  }
  context.data.session = session;
  return session;
}

export async function requireUser(context) {
  const s = await getSession(context);
  if (!s) throw new HttpError(401, 'Entre na sua conta para continuar', 'auth_required');
  return s;
}

export async function requireAdmin(context) {
  const s = await requireUser(context);
  if (s.role !== 'admin') throw new HttpError(403, 'Acesso restrito à administração');
  return s;
}

export const publicUser = (s) => (s ? { id: s.id, email: s.email, name: s.name, role: s.role } : null);
