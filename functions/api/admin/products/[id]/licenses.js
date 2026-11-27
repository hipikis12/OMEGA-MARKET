import { HttpError, json, readJson } from '../../../../../lib/http.js';
import { createAdmin, eq } from '../../../../../lib/supabase.js';
import { requireAdmin } from '../../../../../lib/auth.js';
import { uuid } from '../../../../../lib/validate.js';

// GET /api/admin/products/:id/licenses — estoque de chaves
export async function onRequestGet(context) {
  await requireAdmin(context);
  const id = uuid(context.params.id);
  const rows = await createAdmin(context.env).select(`license_keys?select=order_item&${eq('product_id', id)}&limit=10000`);
  return json({ total: rows.length, available: rows.filter((r) => !r.order_item).length });
}

// POST /api/admin/products/:id/licenses { codes: ["AAA-BBB", ...] } — uma por linha
export async function onRequestPost(context) {
  const admin = await requireAdmin(context);
  const id = uuid(context.params.id);
  const body = await readJson(context.request, 256 * 1024);
  const codes = [...new Set((Array.isArray(body.codes) ? body.codes : []).map((c) => String(c).trim()).filter(Boolean))];
  if (!codes.length || codes.length > 2000) throw new HttpError(400, 'Envie de 1 a 2000 chaves');
  if (codes.some((c) => c.length > 200)) throw new HttpError(400, 'Chave grande demais');
  const db = createAdmin(context.env);
  const rows = await db.insert('license_keys', codes.map((code) => ({ product_id: id, code })));
  await db.insert('audit_log', { actor: admin.id, action: 'license.import', target: id, detail: { count: rows.length } }).catch(() => {});
  return json({ added: rows.length });
}
