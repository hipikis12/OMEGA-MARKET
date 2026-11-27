import { json } from '../../lib/http.js';
import { createAdmin, eq, inList } from '../../lib/supabase.js';
import { requireUser } from '../../lib/auth.js';

// GET /api/library — produtos pagos, arquivos e licenças do usuário
export async function onRequestGet(context) {
  const user = await requireUser(context);
  const db = createAdmin(context.env);
  const orders = await db.select(
    `orders?select=id,paid_at,order_items(id,product_id,title)&${eq('user_id', user.id)}&status=eq.paid&order=paid_at.desc`,
  );
  const items = orders.flatMap((o) => o.order_items.map((i) => ({ ...i, order_id: o.id, paid_at: o.paid_at })));
  if (!items.length) return json({ items: [] });
  const productIds = [...new Set(items.map((i) => i.product_id))];
  const [products, files, licenses, reviews] = await Promise.all([
    db.select(`products?select=id,slug,cover_url,delivery,category&${inList('id', productIds)}`),
    db.select(`product_files?select=id,product_id,label,size_bytes,version&${inList('product_id', productIds)}&order=created_at.asc`),
    db.select(`license_keys?select=code,order_item&${inList('order_item', items.map((i) => i.id))}`),
    db.select(`reviews?select=product_id,rating&${eq('user_id', user.id)}`),
  ]);
  const seen = new Set();
  const out = [];
  for (const it of items) {
    if (seen.has(it.product_id)) continue;
    seen.add(it.product_id);
    const p = products.find((x) => x.id === it.product_id) || {};
    out.push({
      product_id: it.product_id,
      title: it.title,
      slug: p.slug,
      cover_url: p.cover_url,
      category: p.category,
      paid_at: it.paid_at,
      order_id: it.order_id,
      files: files.filter((f) => f.product_id === it.product_id).map(({ product_id, ...f }) => f),
      license: (licenses.find((l) => l.order_item === it.id) || {}).code || null,
      my_rating: (reviews.find((r) => r.product_id === it.product_id) || {}).rating || null,
    });
  }
  return json({ items: out });
}
