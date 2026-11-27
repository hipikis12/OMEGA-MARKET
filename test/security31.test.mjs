import {test} from 'node:test';import assert from 'node:assert/strict';import {loginGuard} from '../security31.mjs';
test('Limite de login e expiração',()=>{let t=0;const g=loginGuard({now:()=>t});for(let i=0;i<5;i++){g.check('a');g.fail('a')}assert.throws(()=>g.check('a'),{status:429});g.check('b');t=600001;g.check('a');g.fail('a');g.clear('a');g.check('a')});
