// Conciliação: sempre consulta o pagamento na API do Mercado Pago e só então
// aplica no banco. Nunca confia em dados vindos do navegador ou do webhook.
import { mpClient, toCents } from './mercadopago.js';
import { createAdmin } from './supabase.js';
import { isUuid } from './validate.js';

const RELEVANT = new Set(['approved', 'pending', 'in_process', 'authorized', 'rejected', 'cancelled', 'refunded', 'charged_back']);

export async function applyPaymentFromApi(env, payment, { fetchImpl = fetch, expectOrder } = {}) {
  const ref = payment && payment.external_reference;
  if (!isUuid(ref)) return { ignored: 'external_reference ausente' };
  if (expectOrder && ref !== expectOrder) return { ignored: 'pedido divergente' };
  if (payment.currency_id !== 'BRL') return { ignored: 'moeda divergente' };
  if (!RELEVANT.has(payment.status)) return { ignored: 'status ' + payment.status };

  const db = createAdmin(env, fetchImpl);
  const raw = {
    id: payment.id, status: payment.status, status_detail: payment.status_detail,
    payment_method_id: payment.payment_method_id, payment_type_id: payment.payment_type_id,
    live_mode: payment.live_mode, date_approved: payment.date_approved,
  };
  const order = await db.rpc('apply_payment', {
    p_order: ref,
    p_payment_id: String(payment.id),
    p_status: payment.status,
    p_amount_cents: toCents(payment.transaction_amount),
    p_raw: raw,
  });
  return { order };
}

export async function syncPaymentById(env, paymentId, opts = {}) {
  const payment = await mpClient(env, opts.fetchImpl).getPayment(paymentId);
  return applyPaymentFromApi(env, payment, opts);
}

/** Fallback quando o webhook atrasa: procura pagamentos pelo external_reference. */
export async function syncOrder(env, orderId, opts = {}) {
  const found = await mpClient(env, opts.fetchImpl).searchPayments(orderId);
  const results = found && Array.isArray(found.results) ? found.results : [];
  // aplica do mais antigo para o mais novo para respeitar a ordem dos estados
  let last = null;
  for (const p of results.slice().reverse()) {
    const r = await applyPaymentFromApi(env, p, { ...opts, expectOrder: orderId });
    if (r.order) last = r.order;
  }
  return last;
}
