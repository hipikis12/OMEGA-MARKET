import { HttpError } from './http.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

export const isUuid = (v) => typeof v === 'string' && UUID.test(v);

export function uuid(v, field = 'id') {
  if (!isUuid(v)) throw new HttpError(400, `Campo ${field} inválido`);
  return v.toLowerCase();
}

export function uuidList(v, field = 'itens', max = 30) {
  if (!Array.isArray(v) || v.length === 0 || v.length > max) throw new HttpError(400, `Lista de ${field} inválida`);
  return [...new Set(v.map((x) => uuid(x, field)))];
}

export function str(v, field, { min = 0, max = 200, optional = false } = {}) {
  if (v === undefined || v === null || v === '') {
    if (optional) return '';
    if (min > 0) throw new HttpError(400, `Informe ${field}`);
  }
  if (v !== undefined && v !== null && typeof v !== 'string') throw new HttpError(400, `Campo ${field} inválido`);
  const s = String(v ?? '').trim();
  if (s.length < min || s.length > max) throw new HttpError(400, `${field}: entre ${min} e ${max} caracteres`);
  return s;
}

export function email(v) {
  const s = str(v, 'e-mail', { min: 5, max: 254 }).toLowerCase();
  if (!EMAIL.test(s)) throw new HttpError(400, 'E-mail inválido');
  return s;
}

export function password(v) {
  if (typeof v !== 'string' || v.length < 10 || v.length > 128) throw new HttpError(400, 'A senha deve ter de 10 a 128 caracteres');
  if (!/[a-zA-Z]/.test(v) || !/[0-9]/.test(v)) throw new HttpError(400, 'Use letras e números na senha');
  return v;
}

export function int(v, field, { min = 0, max = Number.MAX_SAFE_INTEGER, optional = false } = {}) {
  if ((v === undefined || v === null || v === '') && optional) return null;
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new HttpError(400, `Campo ${field} inválido`);
  return n;
}

export function slug(v, field = 'slug') {
  const s = str(v, field, { min: 3, max: 80 });
  if (!/^[a-z0-9-]+$/.test(s)) throw new HttpError(400, `${field}: use letras minúsculas, números e hífen`);
  return s;
}

export function oneOf(v, field, options) {
  if (!options.includes(v)) throw new HttpError(400, `Campo ${field} inválido`);
  return v;
}

export function httpsUrl(v, field, { optional = true } = {}) {
  if (!v && optional) return null;
  let u;
  try { u = new URL(String(v)); } catch { throw new HttpError(400, `${field}: URL inválida`); }
  if (u.protocol !== 'https:') throw new HttpError(400, `${field}: use https`);
  return u.toString();
}

export const slugify = (s) =>
  String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
