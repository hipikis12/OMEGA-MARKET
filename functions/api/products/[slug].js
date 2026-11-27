import { HttpError, json } from '../../../lib/http.js';
import { createAdmin, eq } from '../../../lib/supabase.js';
import { getSession } from '../../../lib/auth.js';
import { PUBLIC_FIELDS } from './index.js';

// GET /api/products/:slug — detalhes, avaliações e se o usuário já possui
export async function onRequestGet(context) {
  const { env, params } = context;
  const slug = String(params.slug || '');
  if (!/^[a-z0-9-]{3,80}$/.test(slug)) throw new HttpError(404, 'Produto não encontrado');
  const db = createAdmin(env);
  const product = await db.selectOne(`products?select=${PUBLIC_FIELDS},description&status=eq.published&${eq('slug', slug)}`);
  if (!product) throw new HttpError(404, 'Produto não encontrado');
  const [reviews, files, session] = await Promise.all([
    db.select(`reviews?select=author,rating,comment,created_at&${eq('product_id', product.id)}&order=created_at.desc&limit=20`),
    db.select(`product_files?select=label,size_bytes,version&${eq('product_id', product.id)}&order=created_at.asc`),
    getSession(context),
  ]);
  const owned = session ? await db.rpc('owns_product', { p_user: session.id, p_product: product.id }) : false;
  return json({ product: { ...product, files }, reviews, owned: Boolean(owned) });
}
