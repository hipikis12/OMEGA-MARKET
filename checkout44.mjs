import {randomBytes,randomUUID} from 'node:crypto';
import {csrf40,checkCsrf40} from './mp40.mjs';
// Isolated checkout rehearsal: no provider calls, commercial orders or file access.
export function checkout44(db){
 const secret=randomBytes(32),one=(s,...a)=>db.prepare(s).get(...a),all=(s,...a)=>db.prepare(s).all(...a),run=(s,...a)=>db.prepare(s).run(...a);
 db.exec(`CREATE TABLE IF NOT EXISTS checkout44(ref TEXT PRIMARY KEY, buyer INTEGER NOT NULL, seller INTEGER NOT NULL, items TEXT NOT NULL, gross INTEGER NOT NULL CHECK(gross>0), state TEXT NOT NULL, request_key TEXT NOT NULL, UNIQUE(buyer,request_key)); CREATE TABLE IF NOT EXISTS checkout_events44(ref TEXT NOT NULL REFERENCES checkout44(ref), state TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY(ref,state));`);
 const fail=(message,status=400)=>{throw Object.assign(Error(message),{status})};
 return function handle(req,path,u,b={}){
 if(!u||u.status!=='active')fail('Conta ativa necessária',403);
 const sid=(req.headers.cookie||'').match(/(?:^|;\s*)sid=([a-f0-9]+)/)?.[1];if(!sid)fail('Sessão necessária',403);
 if(req.method==='GET'&&path==='/api/checkout44')return {csrf:csrf40(sid,secret),rows:all('SELECT ref,buyer,seller,items,gross,state FROM checkout44 WHERE buyer=? OR ?=\'admin\' ORDER BY rowid DESC LIMIT 50',u.id,u.role),products:all("SELECT p.id,p.title,p.seller,p.price FROM products p JOIN users u ON u.id=p.seller WHERE p.status='published' AND u.status='active' AND p.price>0 ORDER BY p.id LIMIT 200"),isolated:true};
 if(req.method!=='POST'||!checkCsrf40(sid,secret,req.headers['x-omega-csrf']))fail('Token de segurança inválido',403);
 if(path==='/api/checkout44/create'){
 if(!Array.isArray(b.ids)||!b.ids.length||b.ids.length>25||!b.ids.every(Number.isSafeInteger)||new Set(b.ids).size!==b.ids.length||typeof b.key!=='string'||! /^[a-f0-9-]{36}$/.test(b.key))fail('Seleção inválida');
 const ids=b.ids.slice().sort((a,b)=>a-b),prior=one('SELECT * FROM checkout44 WHERE buyer=? AND request_key=?',u.id,b.key);
 if(prior){if(JSON.stringify(JSON.parse(prior.items).map(p=>p.id))!==JSON.stringify(ids))fail('Identificador já utilizado',409);return {ref:prior.ref,state:prior.state,duplicate:true};}
 const items=ids.map(id=>one("SELECT p.id,p.title,p.seller,p.price FROM products p JOIN users u ON u.id=p.seller WHERE p.id=? AND p.status='published' AND u.status='active'",id));if(items.some(p=>!p)||new Set(items.map(p=>p.seller)).size!==1)fail('Selecione produtos publicados de um único vendedor');
 for(const p of items){const offer=one('SELECT price FROM promotions26 WHERE product=? AND until_ms>?',p.id,Date.now());if(offer)p.price=offer.price;if(!Number.isSafeInteger(p.price)||p.price<=0)fail('Preço inválido');}
 const gross=items.reduce((s,p)=>s+p.price,0);if(!Number.isSafeInteger(gross))fail('Total inválido');const ref='rehearsal44-'+randomUUID();run('INSERT INTO checkout44 VALUES(?,?,?,?,?,?,?)',ref,u.id,items[0].seller,JSON.stringify(items),gross,'pending',b.key);return {ref,state:'pending',gross};}
 if(path==='/api/checkout44/event'){
 if(u.role!=='admin')fail('Acesso administrativo necessário',403);const row=one('SELECT * FROM checkout44 WHERE ref=?',String(b.ref));if(!row)fail('Teste inexistente',404);
 if(!['approved','rejected','refunded','wrong_amount'].includes(b.state))fail('Cenário inválido');if(b.state==='wrong_amount')fail('Valor fictício divergente; entrega bloqueada',409);
 db.exec('BEGIN IMMEDIATE');try{if(one('SELECT state FROM checkout_events44 WHERE ref=? AND state=?',row.ref,b.state)){db.exec('COMMIT');return {state:row.state,duplicate:true,entitled:row.state==='approved'};}if(!({pending:['approved','rejected'],approved:['refunded']}[row.state]||[]).includes(b.state))fail('Transição inválida',409);run('UPDATE checkout44 SET state=? WHERE ref=?',b.state,row.ref);run('INSERT INTO checkout_events44 VALUES(?,?,?)',row.ref,b.state,Date.now());db.exec('COMMIT');return {state:b.state,entitled:b.state==='approved'};}catch(e){db.exec('ROLLBACK');throw e;}}
 fail('Rota inexistente',404);
 };
}
