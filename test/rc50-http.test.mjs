import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
test('RC3: readiness admin-only, restart preserves catalog and indexes',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'omega50-'));const path=join(dir,'store.db');let child;const base='http://127.0.0.1:19550';
 async function start(){child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'19550',DB_PATH:path,ADMIN_PASSWORD:'TestPassword1234',MP_TEST_ACCESS_TOKEN:''},stdio:'ignore'});for(let i=0;i<80;i++){try{const r=await fetch(base+'/api/catalog');if(r.ok)return}catch{}await new Promise(r=>setTimeout(r,100))}throw Error('server did not start')}
 async function stop(){if(child&&child.exitCode===null&&child.signalCode===null){const done=new Promise(r=>child.once('exit',r));child.kill();await done}}
 try{await start();const before=await (await fetch(base+'/api/catalog')).json();assert.equal((await fetch(base+'/api/security49')).status,403);const login=await fetch(base+'/api/admin-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'admin@omega.local',password:'TestPassword1234'})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];const r=await fetch(base+'/api/security49',{headers:{Cookie:cookie}});assert.equal(r.status,200);assert.equal((await r.json()).productionReady,false);assert.match(await (await fetch(base)).text(),/5\.8\.0 RC/);const module=await fetch(base+'/catalog52.mjs');assert.equal(module.status,200);assert.match(module.headers.get('content-type'),/javascript/);await stop();await start();assert.deepEqual(await (await fetch(base+'/api/catalog')).json(),before);const db=new DatabaseSync(path);try{assert.equal(db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='index' AND name LIKE 'rc50_%'").get().n,5)}finally{db.close()}}finally{await stop();rmSync(dir,{recursive:true,force:true})}
});
