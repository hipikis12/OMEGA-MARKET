import test from 'node:test';
import assert from 'node:assert/strict';
import * as v from '../lib/validate.js';
import { parseProduct } from '../lib/products.js';

test('validações básicas', () => {
  assert.equal(v.email(' Ana@Exemplo.com '), 'ana@exemplo.com');
  assert.throws(() => v.email('sem-arroba'));
  assert.throws(() => v.password('curta1'));
  assert.throws(() => v.password('semnumeroaqui'));
  assert.equal(v.password('senhaforte123'), 'senhaforte123');
  assert.throws(() => v.uuid('1 or 1=1'));
  assert.deepEqual(v.uuidList(['8f14e45f-ceea-467f-a8d5-2b5e6a1d2c3b', '8F14E45F-CEEA-467F-A8D5-2B5E6A1D2C3B']), ['8f14e45f-ceea-467f-a8d5-2b5e6a1d2c3b']);
  assert.equal(v.slugify('Curso Flutter — Básico!'), 'curso-flutter-basico');
  assert.throws(() => v.httpsUrl('javascript:alert(1)', 'capa'));
  assert.throws(() => v.httpsUrl('http://x.com/a.png', 'capa'));
});

test('produto: gera slug, valida preços', () => {
  const p = parseProduct({ title: 'Kit Ícones Pro', price_cents: 1990 });
  assert.equal(p.slug, 'kit-icones-pro');
  assert.throws(() => parseProduct({ title: 'Kit', price_cents: 50 }));
  assert.throws(() => parseProduct({ title: 'Kit Pro', price_cents: 1990, compare_cents: 1500 }));
  assert.deepEqual(parseProduct({ status: 'published' }, { partial: true }), { status: 'published' });
  assert.throws(() => parseProduct({ status: 'hack' }, { partial: true }));
});
