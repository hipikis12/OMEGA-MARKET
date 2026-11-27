import { HttpError, json, readJson, siteUrl } from '../../lib/http.js';
import { createAdmin, eq } from '../../lib/supabase.js';
import { requireUser } from '../../lib/auth.js';
import { buildPreference, mpClient } from '../../lib/mercadopago.js';
import * as v from '../../lib/validate.js';

// POST /api/checkout { ids, coupon, key }
// 1) cria o pedido no banco (preço calculado lá, idempotente pela key)
// 2) cria a preferência do Checkout Pro e devolve a URL de pagamento
export async function onRequestPost(context) {
  const { request, env } = context;
  const user = await requireUser(context);
  const body = await readJson(request);
  const ids = v.uuidList(body.ids, 'produtos');
  const key = v.uuid(body.key, 'key');
  const coupon = typeof body.coupon === 'string' ? body.coupon.slice(0, 30) : '';
  const mp = mpClient(env); // falha cedo se o Mercado Pago não estiver configurado

  const db = createAdmin(env);
  const order = await db.rpc('create_order', { p_user: user.id, p_product_ids: ids, p_coupon: coupon, p_key: key });
  if (order.status !== 'pending') throw new HttpError(409, 'Este pedido já foi processado', 'order_closed');
  if (order.mp_init_point) return json({ order_id: order.id, url: order.mp_init_point });

  const items = await db.select(`order_items?select=product_id,title,price_cents&${eq('order_id', order.id)}`);
  const pref = buildPreference({
    order,
    items,
    payerEmail: user.email,
    site: siteUrl(env, request),
    statementDescriptor: env.MP_STATEMENT_DESCRIPTOR || 'OMEGAMARKET',
  });
  const created = await mp.createPreference(pref, order.id);
  const url = mp.isSandbox ? created.sandbox_init_point || created.init_point : created.init_point;
  if (!url || !/^https:\/\/([a-z0-9-]+\.)*mercadopago\.com(\.br)?\//.test(url)) {
    throw new HttpError(502, 'Resposta inesperada do Mercado Pago');
  }
  await db.update('orders', eq('id', order.id), { mp_preference_id: created.id, mp_init_point: url });
  return json({ order_id: order.id, url });
}
