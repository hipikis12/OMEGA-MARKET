import { HttpError, json, readJson } from '../../../lib/http.js';
import { createAdmin } from '../../../lib/supabase.js';
import { requireAdmin } from '../../../lib/auth.js';
import * as v from '../../../lib/validate.js';

const IMAGE_EXT = /\.(png|jpe?g|webp|avif)$/i;

// POST /api/admin/uploads { product_id, filename, kind: 'file' | 'image' }
// Devolve uma URL assinada para o navegador enviar o arquivo direto ao
// Supabase Storage (sem passar pelo limite de tamanho do Worker).
export async function onRequestPost(context) {
  await requireAdmin(context);
  const body = await readJson(context.request);
  const productId = v.uuid(body.product_id, 'produto');
  const kind = v.oneOf(body.kind, 'tipo', ['file', 'image']);
  const original = v.str(body.filename, 'arquivo', { min: 1, max: 150 });
  const clean = original.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+/, '').slice(-100) || 'arquivo';
  if (kind === 'image' && !IMAGE_EXT.test(clean)) throw new HttpError(400, 'Use PNG, JPG, WEBP ou AVIF');
  const bucket = kind === 'image' ? 'product-images' : 'product-files';
  const path = `${productId}/${crypto.randomUUID()}-${clean}`;
  const db = createAdmin(context.env);
  const uploadUrl = await db.signedUpload(bucket, path);
  return json({ uploadUrl, path, publicUrl: kind === 'image' ? db.publicUrl(bucket, path) : null });
}
