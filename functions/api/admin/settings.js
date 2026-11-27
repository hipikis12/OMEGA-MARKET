import { json, readJson } from '../../../lib/http.js';
import { createAdmin } from '../../../lib/supabase.js';
import { requireAdmin } from '../../../lib/auth.js';
import * as v from '../../../lib/validate.js';

// PUT /api/admin/settings — textos da vitrine
export async function onRequestPut(context) {
  const admin = await requireAdmin(context);
  const b = await readJson(context.request);
  const value = {
    name: v.str(b.name, 'nome da loja', { min: 2, max: 40 }),
    tagline: v.str(b.tagline, 'slogan', { max: 80, optional: true }),
    hero_title: v.str(b.hero_title, 'título do banner', { min: 5, max: 120 }),
    hero_text: v.str(b.hero_text, 'texto do banner', { max: 300, optional: true }),
    announcement: v.str(b.announcement, 'aviso', { max: 140, optional: true }),
  };
  const db = createAdmin(context.env);
  await db.insert('settings', { key: 'public.store', value }, { upsert: true });
  await db.insert('audit_log', { actor: admin.id, action: 'settings.update', target: 'public.store' }).catch(() => {});
  return json({ store: value });
}
