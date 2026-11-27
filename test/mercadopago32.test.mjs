import {test} from 'node:test';
import assert from 'node:assert/strict';
import {preferencePreview,simulatePreference,validateFixture} from '../mercadopago32.mjs';
const order={id:1,product:2,title:'Teste',price:4990};
test('Preferência offline em BRL e sem URL externa',()=>{const r=simulatePreference(order);assert.equal(r.preference.items[0].unit_price,49.9);assert.equal(r.external,false);assert.equal(r.init_point,undefined);assert.throws(()=>preferencePreview({...order,price:-1}));});
test('Validação de referência, moeda, valor e estado sem entrega',()=>{const p={external_reference:'omega-demo-1',currency_id:'BRL',transaction_amount:49.9,status:'approved'};assert.equal(validateFixture(order,p).release,false);assert.equal(validateFixture(order,p).valid,true);for(const patch of [{transaction_amount:1},{currency_id:'USD'},{external_reference:'other'},{status:'unknown'}])assert.equal(validateFixture(order,{...p,...patch}).valid,false);});
