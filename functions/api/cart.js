import { json, readJson } from '../../lib/http.js';
import { createAdmin, eq, inList } from '../../lib/supabase.js';
import * as v from '../../lib/validate.js';

// POST /api/cart { ids, coupon } — prévia do carrinho com preços do servidor.
// Não grava nada: o valor final é recalculado no banco em create_order.
export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const ids = Array.isArray(body.ids) && body.ids.length ? v.uuidList(body.ids, 'produtos') : [];
  if (!ids.length) return json({ items: [], subtotal_cents: 0, discount_cents: 0, total_cents: 0 });
  const db = createAdmin(env);
  const items = await db.select(`products?select=id,slug,title,price_cents,compare_cents,cover_url,category&status=eq.published&${inList('id', ids)}`);
  const subtotal = items.reduce((s, p) => s + p.price_cents, 0);
  let percent = 0;
  let couponError = null;
  const code = typeof body.coupon === 'string' ? body.coupon.trim().toUpperCase().slice(0, 30) : '';
  if (code) {
    const c = /^[A-Z0-9_-]{3,30}$/.test(code)
      ? await db.selectOne(`coupons?select=percent,expires_at,max_uses,uses,active&${eq('code', code)}`)
      : null;
    if (c && c.active && new Date(c.expires_at) > new Date() && c.uses < c.max_uses) percent = c.percent;
    else couponError = 'Cupom inválido, expirado ou esgotado';
  }
  const discount = Math.floor((subtotal * percent) / 100);
  return json({
    items,
    missing: ids.filter((id) => !items.some((p) => p.id === id)),
    coupon: percent ? { code, percent } : null,
    coupon_error: couponError,
    subtotal_cents: subtotal,
    discount_cents: discount,
    total_cents: subtotal - discount,
  });
}
