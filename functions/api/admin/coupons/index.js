import { HttpError, json, readJson } from '../../../../lib/http.js';
import { createAdmin } from '../../../../lib/supabase.js';
import { requireAdmin } from '../../../../lib/auth.js';
import * as v from '../../../../lib/validate.js';

export async function onRequestGet(context) {
  await requireAdmin(context);
  return json({ coupons: await createAdmin(context.env).select('coupons?select=*&order=expires_at.desc') });
}

// POST /api/admin/coupons { code, percent, days, max_uses }
export async function onRequestPost(context) {
  await requireAdmin(context);
  const body = await readJson(context.request);
  const code = v.str(body.code, 'código', { min: 3, max: 30 }).toUpperCase();
  if (!/^[A-Z0-9_-]+$/.test(code)) throw new HttpError(400, 'Código inválido');
  const days = v.int(body.days, 'validade', { min: 1, max: 730 });
  const [coupon] = await createAdmin(context.env).insert('coupons', {
    code,
    percent: v.int(body.percent, 'desconto', { min: 1, max: 90 }),
    max_uses: v.int(body.max_uses, 'limite', { min: 1, max: 1000000 }),
    expires_at: new Date(Date.now() + days * 86400000).toISOString(),
  });
  return json({ coupon }, 201);
}
