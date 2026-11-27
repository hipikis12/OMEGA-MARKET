import { HttpError, clientIp } from '../../../lib/http.js';
import { createAdmin, eq } from '../../../lib/supabase.js';
import { requireUser } from '../../../lib/auth.js';
import { isUuid } from '../../../lib/validate.js';

// GET /api/download/:fileId — confere a compra e redireciona para uma URL
// assinada do Storage válida por 2 minutos. O arquivo nunca fica público.
export async function onRequestGet(context) {
  const user = await requireUser(context);
  const id = String(context.params.id || '');
  if (!isUuid(id)) throw new HttpError(404, 'Arquivo não encontrado');
  const db = createAdmin(context.env);
  const file = await db.selectOne(`product_files?select=id,product_id,label,storage_path&${eq('id', id)}`);
  if (!file) throw new HttpError(404, 'Arquivo não encontrado');
  const owns = user.role === 'admin' || (await db.rpc('owns_product', { p_user: user.id, p_product: file.product_id }));
  if (!owns) throw new HttpError(403, 'Este arquivo é liberado após a confirmação do pagamento');

  const name = file.storage_path.split('/').pop().replace(/^[0-9a-f-]{36}-/, '');
  const signed = await db.signedDownload('product-files', file.storage_path, 120, name);
  await db.insert('download_log', { user_id: user.id, file_id: file.id, ip: clientIp(context.request) }).catch(() => {});
  return new Response(null, { status: 302, headers: { location: signed, 'cache-control': 'no-store' } });
}
