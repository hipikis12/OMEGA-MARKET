import { json } from '../../../lib/http.js';
import { createAdmin } from '../../../lib/supabase.js';
import { requireAdmin } from '../../../lib/auth.js';

// GET /api/admin/stats — resumo dos últimos 30 dias
export async function onRequestGet(context) {
  await requireAdmin(context);
  const db = createAdmin(context.env);
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const [orders, products] = await Promise.all([
    db.select(`orders?select=status,total_cents,created_at&created_at=gte.${since}&limit=5000`),
    db.select('products?select=status&limit=5000'),
  ]);
  const paid = orders.filter((o) => o.status === 'paid');
  return json({
    revenue_cents: paid.reduce((s, o) => s + o.total_cents, 0),
    paid_orders: paid.length,
    pending_orders: orders.filter((o) => o.status === 'pending').length,
    refunded_orders: orders.filter((o) => ['refunded', 'charged_back'].includes(o.status)).length,
    products_published: products.filter((p) => p.status === 'published').length,
    products_total: products.length,
  });
}
