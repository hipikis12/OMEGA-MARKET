import { HttpError, json } from '../../../../lib/http.js';
import { createAdmin, eq } from '../../../../lib/supabase.js';
import { requireAdmin } from '../../../../lib/auth.js';
import { uuid } from '../../../../lib/validate.js';

// DELETE /api/admin/files/:id
export async function onRequestDelete(context) {
  const admin = await requireAdmin(context);
  const id = uuid(context.params.id);
  const db = createAdmin(context.env);
  const file = await db.selectOne(`product_files?select=id,product_id,storage_path&${eq('id', id)}`);
  if (!file) throw new HttpError(404, 'Arquivo não encontrado');
  await db.removeObject('product-files', file.storage_path).catch(() => {});
  await db.remove('product_files', eq('id', id));
  await db.insert('audit_log', { actor: admin.id, action: 'file.delete', target: file.product_id, detail: { file: id } }).catch(() => {});
  return json({ deleted: true });
}
