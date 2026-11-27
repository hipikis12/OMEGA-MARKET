import { json } from '../../lib/http.js';
import { createAdmin } from '../../lib/supabase.js';
import { getSession, publicUser } from '../../lib/auth.js';

const DEFAULT_STORE = {
  name: 'OMEGA MARKET',
  tagline: 'O universo digital ao seu alcance',
  hero_title: 'Produtos digitais prontos para acelerar seus projetos',
  hero_text: 'Entrega imediata após a confirmação do pagamento.',
  announcement: '',
};

// GET /api/config — dados públicos da loja + usuário atual
export async function onRequestGet(context) {
  const { env } = context;
  const configured = Boolean(env.SUPABASE_URL && env.SUPABASE_SECRET_KEY);
  if (!configured) {
    return json({ configured: false, store: DEFAULT_STORE, categories: [], user: null, turnstileSiteKey: null, payments: false });
  }
  const db = createAdmin(env);
  const [settings, categories, session] = await Promise.all([
    db.selectOne(`settings?select=value&key=eq.public.store`),
    db.select('categories?select=slug,name,icon&order=position.asc,name.asc'),
    getSession(context),
  ]);
  return json({
    configured: true,
    store: { ...DEFAULT_STORE, ...(settings ? settings.value : {}) },
    categories,
    user: publicUser(session),
    turnstileSiteKey: env.TURNSTILE_SITE_KEY || null,
    payments: Boolean(env.MP_ACCESS_TOKEN),
  });
}
