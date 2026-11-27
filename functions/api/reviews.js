import { HttpError, json, readJson } from '../../lib/http.js';
import { createAdmin } from '../../lib/supabase.js';
import { requireUser } from '../../lib/auth.js';
import * as v from '../../lib/validate.js';

// POST /api/reviews { product_id, rating, comment } — só quem comprou avalia
export async function onRequestPost(context) {
  const user = await requireUser(context);
  const body = await readJson(context.request);
  const productId = v.uuid(body.product_id, 'produto');
  const rating = v.int(body.rating, 'nota', { min: 1, max: 5 });
  const comment = v.str(body.comment, 'comentário', { max: 1000, optional: true });
  const db = createAdmin(context.env);
  if (!(await db.rpc('owns_product', { p_user: user.id, p_product: productId }))) {
    throw new HttpError(403, 'Apenas compradores podem avaliar este produto');
  }
  const author = (user.name || 'Cliente').split(' ')[0].slice(0, 30) || 'Cliente';
  await db.insert('reviews', { product_id: productId, user_id: user.id, author, rating, comment }, { upsert: true });
  return json({ ok: true });
}
