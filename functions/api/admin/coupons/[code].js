import { HttpError, json, readJson } from '../../../../lib/http.js';
import { createAdmin, eq } from '../../../../lib/supabase.js';
import { requireAdmin } from '../../../../lib/auth.js';

// PATCH /api/admin/coupons/:code { active }
export async function onRequestPatch(context) {
  await requireAdmin(context);
  const code = String(context.params.code || '').toUpperCase();
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) throw new HttpError(404, 'Cupom não encontrado');
  const body = await readJson(context.request);
  const [coupon] = await createAdmin(context.env).update('coupons', eq('code', code), { active: Boolean(body.active) });
  if (!coupon) throw new HttpError(404, 'Cupom não encontrado');
  return json({ coupon });
}
