import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
test('RC2 migrates legacy schema and preserves existing catalog and account',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'omega52-'));const path=join(dir,'store.db');let child;
 try{const db=new DatabaseSync(path);db.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT UNIQUE,name TEXT,hash TEXT,role TEXT,status TEXT); CREATE TABLE sessions(token TEXT PRIMARY KEY,uid INTEGER REFERENCES users(id),expires INTEGER); CREATE TABLE products(id INTEGER PRIMARY KEY,seller INTEGER REFERENCES users(id),title TEXT,description TEXT,category TEXT,price INTEGER,status TEXT); CREATE TABLE orders(id INTEGER PRIMARY KEY,buyer INTEGER REFERENCES users(id),product INTEGER REFERENCES products(id),seller INTEGER,price INTEGER,status TEXT,created TEXT DEFAULT CURRENT_TIMESTAMP); INSERT INTO users VALUES(1,'admin@omega.local','Legacy admin','fixture','admin','active'); INSERT INTO products VALUES(55,1,'Produto legado','Teste','Assets',1234,'published');`);db.close();
 child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'19552',DB_PATH:path,PAYMENT_MODE:'local_only',MP_TEST_ACCESS_TOKEN:''},stdio:'ignore'});
 const base='http://127.0.0.1:19552';let response;for(let i=0;i<80;i++){try{response=await fetch(base+'/api/catalog');if(response.ok)break}catch{}await new Promise(r=>setTimeout(r,100))}assert.ok(response?.ok);assert.match(JSON.stringify(await response.json()),/Produto legado/);assert.equal((await fetch(base+'/api/security49')).status,403);assert.equal((await fetch(base+'/api/admin-login',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://example.invalid'},body:'{}'})).status,403);
 const done=new Promise(r=>child.once('exit',r));child.kill();await done;const migrated=new DatabaseSync(path);try{assert.equal(migrated.prepare('SELECT price FROM products WHERE id=55').get().price,1234);assert.equal(migrated.prepare('SELECT name FROM users WHERE id=1').get().name,'Legacy admin');assert.equal(migrated.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.equal(migrated.prepare('PRAGMA foreign_key_check').all().length,0)}finally{migrated.close()}
 }finally{if(child&&child.exitCode===null&&child.signalCode===null){const done=new Promise(r=>child.once('exit',r));child.kill();await done}rmSync(dir,{recursive:true,force:true})}
});
