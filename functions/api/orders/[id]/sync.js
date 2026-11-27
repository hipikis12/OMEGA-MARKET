import { json } from '../../../../lib/http.js';
import { syncOrder } from '../../../../lib/payments.js';
import { loadOwnOrder } from './index.js';

// POST /api/orders/:id/sync — consulta o Mercado Pago caso o webhook atrase
// (ex.: ao voltar do checkout). Só tem efeito em pedidos ainda pendentes.
export async function onRequestPost(context) {
  const order = await loadOwnOrder(context);
  if (order.status === 'pending' && context.env.MP_ACCESS_TOKEN) {
    await syncOrder(context.env, order.id);
    return json({ order: await loadOwnOrder(context) });
  }
  return json({ order });
}
