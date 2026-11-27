import { HttpError, json, readJson } from '../../../../../lib/http.js';
import { createAdmin, eq } from '../../../../../lib/supabase.js';
import { requireAdmin } from '../../../../../lib/auth.js';
import * as v from '../../../../../lib/validate.js';

// POST /api/admin/products/:id/files { path, label, size_bytes, version }
// Registra um arquivo já enviado ao bucket privado via /api/admin/uploads.
export async function onRequestPost(context) {
  const admin = await requireAdmin(context);
  const id = v.uuid(context.params.id);
  const body = await readJson(context.request);
  const path = v.str(body.path, 'caminho', { min: 40, max: 300 });
  if (!path.startsWith(`${id}/`) || path.includes('..')) throw new HttpError(400, 'Caminho de arquivo inválido');
  const db = createAdmin(context.env);
  const [file] = await db.insert('product_files', {
    product_id: id,
    storage_path: path,
    label: v.str(body.label, 'nome', { min: 1, max: 120 }),
    size_bytes: v.int(body.size_bytes, 'tamanho', { min: 0, max: 5 * 1024 ** 3 }),
    version: v.str(body.version || '1.0', 'versão', { min: 1, max: 20 }),
  });
  await db.insert('audit_log', { actor: admin.id, action: 'file.add', target: id, detail: { file: file.id } }).catch(() => {});
  return json({ file }, 201);
}
