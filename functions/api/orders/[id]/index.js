import { HttpError, json } from '../../../../lib/http.js';
import { createAdmin, eq } from '../../../../lib/supabase.js';
import { requireUser } from '../../../../lib/auth.js';
import { isUuid } from '../../../../lib/validate.js';
import { ORDER_FIELDS } from '../index.js';

export async function loadOwnOrder(context) {
  const user = await requireUser(context);
  const id = String(context.params.id || '');
  if (!isUuid(id)) throw new HttpError(404, 'Pedido não encontrado');
  const order = await createAdmin(context.env).selectOne(
    `orders?select=${ORDER_FIELDS}&${eq('id', id)}&${eq('user_id', user.id)}`,
  );
  if (!order) throw new HttpError(404, 'Pedido não encontrado');
  return order;
}

// GET /api/orders/:id
export async function onRequestGet(context) {
  return json({ order: await loadOwnOrder(context) });
}
