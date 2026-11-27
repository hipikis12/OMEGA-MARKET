import { json } from '../../../lib/http.js';
import { createAdmin, eq } from '../../../lib/supabase.js';
import { requireUser } from '../../../lib/auth.js';

export const ORDER_FIELDS =
  'id,status,subtotal_cents,discount_cents,total_cents,coupon_code,mp_status,mp_init_point,paid_at,created_at,order_items(product_id,title,price_cents)';

// GET /api/orders — pedidos do usuário logado
export async function onRequestGet(context) {
  const user = await requireUser(context);
  const orders = await createAdmin(context.env).select(
    `orders?select=${ORDER_FIELDS}&${eq('user_id', user.id)}&order=created_at.desc&limit=50`,
  );
  return json({ orders });
}
