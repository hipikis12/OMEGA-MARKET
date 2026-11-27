import { json } from '../../../lib/http.js';
import { createAdmin, eq } from '../../../lib/supabase.js';
import { requireAdmin } from '../../../lib/auth.js';

const STATUSES = ['pending', 'paid', 'rejected', 'cancelled', 'refunded', 'charged_back'];

// GET /api/admin/orders?status=
export async function onRequestGet(context) {
  await requireAdmin(context);
  const status = new URL(context.request.url).searchParams.get('status');
  const filter = STATUSES.includes(status) ? '&' + eq('status', status) : '';
  const orders = await createAdmin(context.env).select(
    `orders?select=id,user_id,status,total_cents,discount_cents,coupon_code,mp_payment_id,mp_status,paid_at,created_at,order_items(title,price_cents)${filter}&order=created_at.desc&limit=200`,
  );
  return json({ orders });
}
