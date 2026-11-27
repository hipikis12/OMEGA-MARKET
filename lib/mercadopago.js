// Integração Mercado Pago — Checkout Pro (preferências) + Webhooks.
// Docs: https://www.mercadopago.com.br/developers/pt/docs/checkout-pro
import { HttpError, requireEnv } from './http.js';

const API = 'https://api.mercadopago.com';
const enc = new TextEncoder();

export const toCents = (amount) => Math.round(Number(amount) * 100);
export const fromCents = (cents) => Math.round(cents) / 100;

export function mpClient(env, fetchImpl = fetch) {
  const [token] = requireEnv(env, 'MP_ACCESS_TOKEN');
  async function call(path, { method = 'GET', body, idempotencyKey } = {}) {
    const headers = { authorization: `Bearer ${token}` };
    if (body) headers['content-type'] = 'application/json';
    if (idempotencyKey) headers['x-idempotency-key'] = idempotencyKey;
    const res = await fetchImpl(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      console.error('Mercado Pago', res.status, path.split('?')[0], data && (data.message || data.error));
      throw new HttpError(502, 'Não foi possível falar com o Mercado Pago. Tente novamente.');
    }
    return data;
  }
  return {
    createPreference: (pref, idempotencyKey) => call('/checkout/preferences', { method: 'POST', body: pref, idempotencyKey }),
    getPayment: (id) => call(`/v1/payments/${encodeURIComponent(id)}`),
    searchPayments: (externalReference) =>
      call(`/v1/payments/search?sort=date_created&criteria=desc&limit=10&external_reference=${encodeURIComponent(externalReference)}`),
  };
}

/** Monta a preferência do Checkout Pro a partir de um pedido já calculado no banco. */
export function buildPreference({ order, items, payerEmail, site, statementDescriptor = 'OMEGAMARKET' }) {
  const discount = order.discount_cents || 0;
  // O MP soma os itens; com cupom, enviamos um único item com o total final
  // para que o valor cobrado seja exatamente o total do pedido.
  const mpItems = discount > 0
    ? [{
        id: order.id,
        title: `Pedido OMEGA MARKET (${items.length} ${items.length === 1 ? 'item' : 'itens'})`,
        description: items.map((i) => i.title).join(', ').slice(0, 250),
        quantity: 1,
        currency_id: 'BRL',
        unit_price: fromCents(order.total_cents),
        category_id: 'digital_goods',
      }]
    : items.map((i) => ({
        id: i.product_id,
        title: i.title.slice(0, 250),
        quantity: 1,
        currency_id: 'BRL',
        unit_price: fromCents(i.price_cents),
        category_id: 'digital_goods',
      }));
  return {
    items: mpItems,
    payer: { email: payerEmail },
    external_reference: order.id,
    back_urls: {
      success: `${site}/#/pedido/${order.id}`,
      pending: `${site}/#/pedido/${order.id}`,
      failure: `${site}/#/pedido/${order.id}`,
    },
    auto_return: 'approved',
    notification_url: `${site}/api/webhooks/mercadopago?source_news=webhooks`,
    statement_descriptor: statementDescriptor.slice(0, 22),
    binary_mode: false,
    expires: true,
    expiration_date_to: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
    metadata: { order_id: order.id },
  };
}

function parseSignature(header) {
  const out = {};
  for (const part of String(header || '').split(',')) {
    const [k, v] = part.split('=').map((s) => s && s.trim());
    if (k && v) out[k] = v;
  }
  return out;
}

function safeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Valida o cabeçalho x-signature do webhook.
 * manifest = "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
 * Não há janela de tempo: reenvios legítimos podem chegar tarde, e o
 * webhook é seguro contra repetição porque SEMPRE reconsulta o pagamento
 * na API e a aplicação no banco é idempotente.
 */
export async function verifyWebhookSignature({ secret, signatureHeader, requestId, dataId }) {
  if (!secret) return false;
  const { ts, v1 } = parseSignature(signatureHeader);
  if (!ts || !v1) return false;
  let id = dataId ? String(dataId) : '';
  if (/^[a-z0-9]+$/i.test(id)) id = id.toLowerCase();
  let manifest = '';
  if (id) manifest += `id:${id};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;
  const expected = await hmacHex(secret, manifest);
  return safeEqualHex(expected, v1.toLowerCase());
}
