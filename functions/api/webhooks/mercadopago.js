import { json } from '../../../lib/http.js';
import { verifyWebhookSignature } from '../../../lib/mercadopago.js';
import { syncPaymentById } from '../../../lib/payments.js';

// POST /api/webhooks/mercadopago — configure esta URL no painel do Mercado Pago
// (Suas integrações > Webhooks), evento "Pagamentos", e copie a assinatura
// secreta para MP_WEBHOOK_SECRET.
export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const text = (await request.text()).slice(0, 20000);
  let body = {};
  try { body = JSON.parse(text || '{}'); } catch { /* corpo inválido */ }

  const type = body.type || url.searchParams.get('type') || url.searchParams.get('topic');
  const dataId = url.searchParams.get('data.id') || (body.data && body.data.id) || url.searchParams.get('id');

  const valid = await verifyWebhookSignature({
    secret: env.MP_WEBHOOK_SECRET,
    signatureHeader: request.headers.get('x-signature'),
    requestId: request.headers.get('x-request-id'),
    dataId: url.searchParams.get('data.id') || (body.data && body.data.id),
  });
  if (!valid) return json({ error: 'assinatura inválida' }, 401);

  if (type !== 'payment' || !/^[0-9]{1,30}$/.test(String(dataId || ''))) return json({ ok: true, ignored: true });

  // Sempre reconsulta o pagamento na API: o corpo do webhook não é confiável.
  const result = await syncPaymentById(env, String(dataId));
  return json({ ok: true, status: result.order ? result.order.status : 'ignored' });
}
