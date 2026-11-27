import {test} from 'node:test';import assert from 'node:assert/strict';import {gateway,csv} from '../gateway.mjs';
test('Gateway local: valores e métodos',()=>{assert.deepEqual(gateway.quote(10000,1000),{gross:10000,fee:500,commission:950,net:8550});assert.throws(()=>gateway.quote(-1,1000));assert.equal(gateway.supports('pix_demo'),true);assert.equal(gateway.supports('real'),false)});
test('CSV neutraliza fórmulas e escapa aspas',()=>{assert.ok(csv([{title:'=1+1'}]).includes("'=1+1"));assert.ok(csv([{title:'a"b'}]).includes('a""b'))});
