import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validatePassword,sha256File} from '../security37.mjs';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('Validação de alteração de senha',()=>{assert.throws(()=>validatePassword('old','short'));assert.throws(()=>validatePassword('SamePassword123','SamePassword123'));assert.doesNotThrow(()=>validatePassword('OldPassword123','NewPassword123'));});
test('SHA-256 de arquivo',async()=>{let d=await mkdtemp(join(tmpdir(),'omega37-'));try{let p=join(d,'test');await writeFile(p,'abc');assert.equal(await sha256File(p),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');}finally{await rm(d,{recursive:true,force:true})}});
