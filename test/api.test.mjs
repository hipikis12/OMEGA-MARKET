import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ENV, mockFetch, run } from './helpers.mjs';
import { hmacHex } from '../lib/mercadopago.js';
import * as webhook from '../functions/api/webhooks/mercadopago.js';
import * as checkout from '../functions/api/checkout.js';
import * as download from '../functions/api/download/[id].js';
import * as adminProducts from '../functions/api/admin/products/index.js';
import * as config from '../functions/api/config.js';

const USER = '11111111-1111-4111-8111-111111111111';
const ORDER = '22222222-2222-4222-8222-222222222222';
const PROD = '33333333-3333-4333-8333-333333333333';
const FILE = '44444444-4444-4444-8444-444444444444';
const SESSION = { cookie: 'om_at=token-valido' };

const authRoutes = (role = 'customer') => [
  ['GET', /\/auth\/v1\/user$/, () => ({ body: { id: USER, email: 'ana@x.com' } })],
  ['GET', /\/rest\/v1\/profiles\?/, () => ({ body: [{ name: 'Ana', role, status: 'active' }] })],
];

test('todas as rotas importam sem erro', async () => {
  const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
  for (const f of walk('functions')) await import('../' + f);
});

test('middleware bloqueia POST de outra origem (CSRF)', async () => {
  const r = await run(checkout.onRequestPost, { method: 'POST', body: {}, headers: { origin: 'https://evil.example' } });
  assert.equal(r.status, 403);
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
});

test('checkout exige login', async () => {
  mockFetch([]);
  const r = await run(checkout.onRequestPost, { method: 'POST', body: { ids: [PROD], key: ORDER } });
  assert.equal(r.status, 401);
});

test('checkout cria pedido no banco e preferência no Mercado Pago', async () => {
  const calls = mockFetch([
    ...authRoutes(),
    ['POST', /\/rest\/v1\/rpc\/create_order$/, () => ({ body: { id: ORDER, status: 'pending', total_cents: 9790, discount_cents: 0, mp_init_point: null } })],
    ['GET', /\/rest\/v1\/order_items\?/, () => ({ body: [{ product_id: PROD, title: 'Kit UI', price_cents: 9790 }] })],
    ['POST', /api\.mercadopago\.com\/checkout\/preferences$/, () => ({ body: { id: 'pref-1', init_point: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-1', sandbox_init_point: 'https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-1' } })],
    ['PATCH', /\/rest\/v1\/orders\?id=eq\./, () => ({ body: [{}] })],
  ]);
  const r = await run(checkout.onRequestPost, { method: 'POST', body: { ids: [PROD], coupon: '', key: ORDER }, headers: SESSION });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.match(r.json.url, /^https:\/\/sandbox\.mercadopago\.com\.br\//);
  const rpc = calls.find((c) => c.url.endsWith('/rpc/create_order'));
  assert.deepEqual(rpc.body, { p_user: USER, p_product_ids: [PROD], p_coupon: '', p_key: ORDER });
  const pref = calls.find((c) => c.url.includes('/checkout/preferences'));
  assert.equal(pref.init.headers['x-idempotency-key'], ORDER);
  assert.equal(pref.body.items[0].unit_price, 97.9);
  assert.equal(pref.body.payer.email, 'ana@x.com');
});

test('webhook: assinatura inválida é rejeitada sem consultar nada', async () => {
  const calls = mockFetch([]);
  const r = await run(webhook.onRequestPost, { method: 'POST', path: '/api/webhooks/mercadopago?data.id=987&type=payment', body: { type: 'payment', data: { id: '987' } }, headers: { 'x-signature': 'ts=1,v1=deadbeef', 'x-request-id': 'r1', origin: '' } });
  assert.equal(r.status, 401);
  assert.equal(calls.length, 0);
});

test('webhook: válido reconsulta o pagamento na API e aplica no banco', async () => {
  const calls = mockFetch([
    ['GET', /api\.mercadopago\.com\/v1\/payments\/987$/, () => ({ body: { id: 987, status: 'approved', currency_id: 'BRL', transaction_amount: 97.9, external_reference: ORDER, live_mode: false } })],
    ['POST', /\/rest\/v1\/rpc\/apply_payment$/, () => ({ body: { id: ORDER, status: 'paid' } })],
  ]);
  const v1 = await hmacHex(ENV.MP_WEBHOOK_SECRET, 'id:987;request-id:r1;ts:1700000000;');
  const r = await run(webhook.onRequestPost, {
    method: 'POST', path: '/api/webhooks/mercadopago?data.id=987&type=payment',
    body: { type: 'payment', data: { id: '987' } },
    headers: { 'x-signature': `ts=1700000000,v1=${v1}`, 'x-request-id': 'r1', origin: 'https://api.mercadopago.com' },
  });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.status, 'paid');
  const rpc = calls.find((c) => c.url.endsWith('/rpc/apply_payment'));
  assert.equal(rpc.body.p_order, ORDER);
  assert.equal(rpc.body.p_amount_cents, 9790);
  assert.equal(rpc.body.p_status, 'approved');
});

test('webhook: moeda divergente é ignorada', async () => {
  const calls = mockFetch([
    ['GET', /\/v1\/payments\/5$/, () => ({ body: { id: 5, status: 'approved', currency_id: 'USD', transaction_amount: 1, external_reference: ORDER } })],
  ]);
  const v1 = await hmacHex(ENV.MP_WEBHOOK_SECRET, 'id:5;request-id:r;ts:1;');
  const r = await run(webhook.onRequestPost, { method: 'POST', path: '/api/webhooks/mercadopago?data.id=5&type=payment', body: { type: 'payment' }, headers: { 'x-signature': `ts=1,v1=${v1}`, 'x-request-id': 'r' } });
  assert.equal(r.status, 200);
  assert.equal(r.json.status, 'ignored');
  assert.ok(!calls.some((c) => c.url.includes('apply_payment')));
});

test('download: sem compra → 403; com compra → redirect para URL assinada', async () => {
  let owns = false;
  mockFetch([
    ...authRoutes(),
    ['GET', /\/rest\/v1\/product_files\?/, () => ({ body: [{ id: FILE, product_id: PROD, label: 'Kit', storage_path: `${PROD}/abc-kit.zip` }] })],
    ['POST', /\/rpc\/owns_product$/, () => ({ body: owns })],
    ['POST', /\/storage\/v1\/object\/sign\/product-files\//, () => ({ body: { signedURL: `/object/sign/product-files/${PROD}/abc-kit.zip?token=t` } })],
    ['POST', /\/rest\/v1\/download_log$/, () => ({ status: 201, body: [{}] })],
  ]);
  let r = await run(download.onRequestGet, { params: { id: FILE }, headers: SESSION });
  assert.equal(r.status, 403);
  owns = true;
  r = await run(download.onRequestGet, { params: { id: FILE }, headers: SESSION });
  assert.equal(r.status, 302);
  assert.match(r.headers.get('location'), /^https:\/\/proj\.supabase\.co\/storage\/v1\/object\/sign\/product-files\/.+token=t/);
});

test('admin: cliente comum recebe 403', async () => {
  mockFetch(authRoutes('customer'));
  const r = await run(adminProducts.onRequestGet, { headers: SESSION });
  assert.equal(r.status, 403);
});

test('sessão expirada é renovada pelo refresh token e cookies são reenviados', async () => {
  mockFetch([
    ['GET', /\/auth\/v1\/user$/, (u, init) => (init.headers.authorization === 'Bearer novo' ? { body: { id: USER, email: 'a@x.com' } } : { status: 401, body: {} })],
    ['POST', /\/auth\/v1\/token\?grant_type=refresh_token$/, () => ({ body: { access_token: 'novo', refresh_token: 'rt2', expires_in: 3600, user: { id: USER, email: 'a@x.com' } } })],
    ['GET', /\/rest\/v1\/profiles\?/, () => ({ body: [{ name: 'Ana', role: 'customer', status: 'active' }] })],
    ['GET', /\/rest\/v1\/settings\?/, () => ({ body: [] })],
    ['GET', /\/rest\/v1\/categories\?/, () => ({ body: [] })],
  ]);
  const r = await run(config.onRequestGet, { headers: { cookie: 'om_at=velho; om_rt=rt1' } });
  assert.equal(r.status, 200);
  assert.equal(r.json.user.id, USER);
  const cookies = r.headers.getSetCookie();
  assert.ok(cookies.some((c) => c.startsWith('om_at=novo') && c.includes('HttpOnly') && c.includes('Secure') && c.includes('SameSite=Lax')));
});

test('config sem Supabase configurado não quebra', async () => {
  mockFetch([]);
  const r = await run(config.onRequestGet, { env: {} });
  assert.equal(r.status, 200);
  assert.equal(r.json.configured, false);
});
