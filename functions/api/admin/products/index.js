import { json, readJson } from '../../../../lib/http.js';
import { createAdmin } from '../../../../lib/supabase.js';
import { requireAdmin } from '../../../../lib/auth.js';
import { parseProduct } from '../../../../lib/products.js';

// GET /api/admin/products — todos os produtos (inclusive rascunhos)
export async function onRequestGet(context) {
  await requireAdmin(context);
  const products = await createAdmin(context.env).select(
    'products?select=*,product_files(id,label,size_bytes,version,storage_path)&order=created_at.desc&limit=500',
  );
  return json({ products });
}

// POST /api/admin/products — cria (começa como rascunho se status não vier)
export async function onRequestPost(context) {
  const admin = await requireAdmin(context);
  const data = parseProduct(await readJson(context.request, 64 * 1024));
  const db = createAdmin(context.env);
  const [product] = await db.insert('products', data);
  await db.insert('audit_log', { actor: admin.id, action: 'product.create', target: product.id }).catch(() => {});
  return json({ product }, 201);
}
