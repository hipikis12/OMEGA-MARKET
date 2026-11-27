import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
test('RC3: administrative read routes reject customers, partners and anonymous sessions',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'omega53-')); const base='http://127.0.0.1:19553';
 const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'19553',DB_PATH:join(dir,'store.db'),ADMIN_PASSWORD:'TestPassword1234',MP_TEST_ACCESS_TOKEN:''},stdio:'ignore'});
 async function call(path,data,cookie){return fetch(base+'/api/'+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});}
 async function login(path,email){const r=await call(path,{email,password:'TestPassword1234'});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
 try{let ready=false;for(let i=0;i<80;i++){try{if((await call('catalog')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}assert.ok(ready);
 const admin=await login('admin-login','admin@omega.local');
 for(const role of ['customer','partner']){const email=role+'@test.local';assert.equal((await call('register',{name:role,email,password:'TestPassword1234',role})).status,200)}
 const accounts=(await (await call('admin/accounts',undefined,admin)).json()).accounts;const partner=accounts.find(a=>a.role==='partner');assert.equal((await call('admin/account-status',{id:partner.id,status:'active',reason:'RC3 fixture'},admin)).status,200);
 const customer=await login('login','customer@test.local');const seller=await login('login','partner@test.local');
 for(const route of ['security49','security48','security36','audit43','admin/accounts','admin/audit','mp34/history','admin/sandbox']){for(const cookie of [undefined,customer,seller])assert.equal((await call(route,undefined,cookie)).status,403,route);assert.equal((await call(route,undefined,admin)).status,200,route)}
 for(const cookie of [undefined,customer])assert.equal((await call('marketing54',undefined,cookie)).status,403);for(const cookie of [admin,seller])assert.equal((await call('marketing54',undefined,cookie)).status,200);assert.equal((await call('marketing54?days=1',undefined,admin)).status,400);
 const cms={order:['collections','new','featured','popular'],collections:[]};for(const cookie of [undefined,customer,seller]){assert.equal((await call('admin/cms56',undefined,cookie)).status,403);assert.equal((await call('admin/cms56',cms,cookie)).status,403);assert.equal((await call('admin/cms56/restore',{id:1},cookie)).status,403)}
 assert.equal((await call('admin/cms56',cms,admin)).status,200);assert.deepEqual(await (await call('cms56')).json(),cms);const versions=await (await call('admin/cms56',undefined,admin)).json();assert.equal(versions.history.length,1);assert.equal((await call('admin/cms56/restore',{id:versions.history[0].id},admin)).status,200);
 for(const cookie of [undefined,customer,seller]){assert.equal((await call('admin/media57',undefined,cookie)).status,403);assert.equal((await call('admin/media57',{label:'x',data:'invalid'},cookie)).status,403)}
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNgYGAAAAAEAAH2FzhVAAAAAElFTkSuQmCC';
 const upload=await call('admin/media57',{label:'Logo',data:png},admin);assert.equal(upload.status,200);const {id}=await upload.json();const url=base+'/branding-media/'+id+'.png';assert.equal((await fetch(url)).status,404);assert.equal((await fetch(url,{headers:{Cookie:admin}})).status,200);assert.equal((await call('admin/media57/save',{logo:id,banner:null,mobile:null},admin)).status,200);assert.equal((await fetch(url)).status,200);assert.equal((await call('admin/media57/remove',{id},admin)).status,409);assert.equal((await call('admin/media57/save',{logo:null,banner:null,mobile:null},admin)).status,200);assert.equal((await call('admin/media57/remove',{id},admin)).status,200);assert.equal((await fetch(url)).status,404);
 assert.equal((await call('security35',undefined,customer)).status,200);assert.equal((await call('security35',undefined,seller)).status,200);
 }finally{if(child.exitCode===null&&child.signalCode===null){const done=once(child,'exit');child.kill();await done}rmSync(dir,{recursive:true,force:true})}
});
