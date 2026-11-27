import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {reconcile,integrity} from '../security36.mjs';
test('reconciliation flags missing and inconsistent records',()=>{const row={id:1,status:'demo_approved',price:100,gross:100,fee:5,commission:10,seller_net:85};const r=reconcile([row,{...row,id:2,gross:99},{id:3,price:100,status:'pending'}]);assert.equal(r.gross,100);assert.equal(r.issues.length,2);});
test('database integrity',()=>{const db=new DatabaseSync(':memory:');assert.equal(integrity(db).ok,true);db.close()});
