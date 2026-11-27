import { HttpError, json, readJson } from '../../../../../lib/http.js';
import { createAdmin, eq } from '../../../../../lib/supabase.js';
import { requireAdmin } from '../../../../../lib/auth.js';
import { parseProduct } from '../../../../../lib/products.js';
import { uuid } from '../../../../../lib/validate.js';

// PATCH /api/admin/products/:id
export async function onRequestPatch(context) {
  const admin = await requireAdmin(context);
  const id = uuid(context.params.id);
  const patch = parseProduct(await readJson(context.request, 64 * 1024), { partial: true });
  if (!Object.keys(patch).length) throw new HttpError(400, 'Nada para alterar');
  const db = createAdmin(context.env);
  const [product] = await db.update('products', eq('id', id), patch);
  if (!product) throw new HttpError(404, 'Produto não encontrado');
  await db.insert('audit_log', { actor: admin.id, action: 'product.update', target: id, detail: { fields: Object.keys(patch) } }).catch(() => {});
  return json({ product });
}

// DELETE /api/admin/products/:id — arquiva se já tiver vendas, senão exclui
export async function onRequestDelete(context) {
  const admin = await requireAdmin(context);
  const id = uuid(context.params.id);
  const db = createAdmin(context.env);
  const sold = await db.selectOne(`order_items?select=id&${eq('product_id', id)}&limit=1`);
  if (sold) {
    await db.update('products', eq('id', id), { status: 'archived' });
    return json({ archived: true });
  }
  const files = await db.select(`product_files?select=storage_path&${eq('product_id', id)}`);
  for (const f of files) await db.removeObject('product-files', f.storage_path).catch(() => {});
  await db.remove('products', eq('id', id));
  await db.insert('audit_log', { actor: admin.id, action: 'product.delete', target: id }).catch(() => {});
  return json({ deleted: true });
}
