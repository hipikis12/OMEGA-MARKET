import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPreference, hmacHex, verifyWebhookSignature, toCents } from '../lib/mercadopago.js';

test('assinatura do webhook: aceita válida e rejeita adulterada', async () => {
  const secret = 'abc';
  const ts = '1704908010';
  const v1 = await hmacHex(secret, `id:123456;request-id:req-1;ts:${ts};`);
  const ok = await verifyWebhookSignature({ secret, signatureHeader: `ts=${ts},v1=${v1}`, requestId: 'req-1', dataId: '123456' });
  assert.equal(ok, true);
  assert.equal(await verifyWebhookSignature({ secret, signatureHeader: `ts=${ts},v1=${v1}`, requestId: 'req-1', dataId: '999' }), false);
  assert.equal(await verifyWebhookSignature({ secret: 'outro', signatureHeader: `ts=${ts},v1=${v1}`, requestId: 'req-1', dataId: '123456' }), false);
  assert.equal(await verifyWebhookSignature({ secret, signatureHeader: '', requestId: 'req-1', dataId: '123456' }), false);
  assert.equal(await verifyWebhookSignature({ secret: '', signatureHeader: `ts=${ts},v1=${v1}`, requestId: 'req-1', dataId: '123456' }), false);
});

test('assinatura: data.id alfanumérico é normalizado para minúsculas', async () => {
  const v1 = await hmacHex('s', 'id:abc123;request-id:r;ts:1;');
  assert.equal(await verifyWebhookSignature({ secret: 's', signatureHeader: `ts=1,v1=${v1}`, requestId: 'r', dataId: 'ABC123' }), true);
});

test('preferência: soma dos itens é igual ao total do pedido', () => {
  const items = [{ product_id: 'p1', title: 'A', price_cents: 9790 }, { product_id: 'p2', title: 'B', price_cents: 7990 }];
  const sum = (pref) => pref.items.reduce((s, i) => s + toCents(i.unit_price) * i.quantity, 0);
  const plain = buildPreference({ order: { id: 'o1', total_cents: 17780, discount_cents: 0 }, items, payerEmail: 'a@x.com', site: 'https://s' });
  assert.equal(sum(plain), 17780);
  assert.equal(plain.external_reference, 'o1');
  assert.equal(plain.notification_url, 'https://s/api/webhooks/mercadopago?source_news=webhooks');
  assert.equal(plain.back_urls.success, 'https://s/#/pedido/o1');
  const disc = buildPreference({ order: { id: 'o2', total_cents: 16002, discount_cents: 1778 }, items, payerEmail: 'a@x.com', site: 'https://s' });
  assert.equal(disc.items.length, 1);
  assert.equal(sum(disc), 16002);
});

test('toCents evita erro de ponto flutuante', () => {
  assert.equal(toCents(160.02), 16002);
  assert.equal(toCents(0.1 + 0.2), 30);
});
