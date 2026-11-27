// Validação dos dados de produto enviados pelo painel administrativo.
import { HttpError } from './http.js';
import * as v from './validate.js';

export function parseProduct(body, { partial = false } = {}) {
  const out = {};
  const has = (k) => body[k] !== undefined;
  const need = (k) => !partial || has(k);

  if (need('title')) out.title = v.str(body.title, 'título', { min: 3, max: 120 });
  if (has('slug') && body.slug) out.slug = v.slug(body.slug);
  else if (!partial) out.slug = v.slugify(out.title);
  if (need('subtitle')) out.subtitle = v.str(body.subtitle, 'subtítulo', { max: 200, optional: true });
  if (need('description')) out.description = v.str(body.description, 'descrição', { max: 20000, optional: true });
  if (has('category')) out.category = body.category ? v.str(body.category, 'categoria', { min: 2, max: 40 }) : null;
  if (need('price_cents')) out.price_cents = v.int(body.price_cents, 'preço', { min: 100, max: 10000000 });
  if (has('compare_cents')) out.compare_cents = v.int(body.compare_cents, 'preço original', { min: 101, max: 10000000, optional: true });
  if (has('cover_url')) out.cover_url = v.httpsUrl(body.cover_url, 'capa');
  if (has('delivery')) out.delivery = v.oneOf(body.delivery, 'entrega', ['download', 'license', 'both']);
  if (has('status')) out.status = v.oneOf(body.status, 'status', ['draft', 'published', 'archived']);
  if (has('featured')) out.featured = Boolean(body.featured);
  if (has('features')) {
    if (!Array.isArray(body.features) || body.features.length > 12) throw new HttpError(400, 'Até 12 destaques');
    out.features = body.features.map((f) => v.str(f, 'destaque', { min: 1, max: 80 })).filter(Boolean);
  }
  if (out.compare_cents != null && out.price_cents != null && out.compare_cents <= out.price_cents) {
    throw new HttpError(400, 'O preço original deve ser maior que o preço de venda');
  }
  if (!out.slug && !partial) throw new HttpError(400, 'Não foi possível gerar o endereço do produto');
  return out;
}
