import { json } from '../../../lib/http.js';
import { createAdmin, eq } from '../../../lib/supabase.js';

export const PUBLIC_FIELDS =
  'id,slug,title,subtitle,category,price_cents,compare_cents,cover_url,delivery,features,featured,sales_count,rating_avg,rating_count,created_at';

const SORTS = {
  destaque: 'featured.desc,sales_count.desc,created_at.desc',
  novos: 'created_at.desc',
  menor: 'price_cents.asc',
  maior: 'price_cents.desc',
  vendidos: 'sales_count.desc',
  avaliados: 'rating_avg.desc,rating_count.desc',
};

// GET /api/products?q=&category=&sort=&featured=1&limit=
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').replace(/[^\p{L}\p{N} -]/gu, ' ').trim().slice(0, 60);
  const category = (url.searchParams.get('category') || '').slice(0, 40);
  const sort = SORTS[url.searchParams.get('sort')] || SORTS.destaque;
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 60, 1), 100);

  const parts = [`select=${PUBLIC_FIELDS}`, 'status=eq.published', `order=${sort}`, `limit=${limit}`];
  if (/^[a-z0-9-]{2,40}$/.test(category)) parts.push(eq('category', category));
  if (url.searchParams.get('featured') === '1') parts.push('featured=is.true');
  if (q) {
    const term = encodeURIComponent(`*${q.replace(/\s+/g, '*')}*`);
    parts.push(`or=(title.ilike.${term},subtitle.ilike.${term},description.ilike.${term})`);
  }
  const products = await createAdmin(env).select('products?' + parts.join('&'));
  return json({ products }, 200, { 'cache-control': 'public, max-age=30' });
}
