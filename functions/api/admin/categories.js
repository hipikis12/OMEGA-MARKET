import { HttpError, json, readJson } from '../../../lib/http.js';
import { createAdmin, eq } from '../../../lib/supabase.js';
import { requireAdmin } from '../../../lib/auth.js';
import * as v from '../../../lib/validate.js';

// POST /api/admin/categories { name, icon, position }
export async function onRequestPost(context) {
  await requireAdmin(context);
  const b = await readJson(context.request);
  const name = v.str(b.name, 'nome', { min: 2, max: 40 });
  const [category] = await createAdmin(context.env).insert('categories', {
    slug: v.slugify(name).slice(0, 40),
    name,
    icon: v.str(b.icon || '◆', 'ícone', { min: 1, max: 4 }),
    position: v.int(b.position ?? 0, 'posição', { min: 0, max: 999 }),
  }, { upsert: true });
  return json({ category }, 201);
}

// DELETE /api/admin/categories?slug=
export async function onRequestDelete(context) {
  await requireAdmin(context);
  const slug = new URL(context.request.url).searchParams.get('slug') || '';
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) throw new HttpError(400, 'Categoria inválida');
  await createAdmin(context.env).remove('categories', eq('slug', slug));
  return json({ deleted: true });
}
