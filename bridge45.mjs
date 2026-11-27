import {randomBytes} from 'node:crypto';
import {client40,reference40,preference40,payment40,csrf40,checkCsrf40} from './mp40.mjs';
// Fixed local transport: never contacts external services or releases commercial files.
export function bridge45(db){
 const key=randomBytes(32),one=(s,...a)=>db.prepare(s).get(...a),all=(s,...a)=>db.prepare(s).all(...a),run=(s,...a)=>db.prepare(s).run(...a);
 const fail=(message,status=400)=>{throw Object.assign(Error(message),{status})};
 db.exec(`CREATE TABLE IF NOT EXISTS bridge45(id INTEGER PRIMARY KEY, checkout_ref TEXT UNIQUE NOT NULL REFERENCES checkout44(ref), ref TEXT UNIQUE NOT NULL, gross INTEGER NOT NULL, preference TEXT, state TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, updated INTEGER NOT NULL);`);
 // Interrupted local fixtures are safe to retry after a restart.
 run("UPDATE bridge45 SET state='retryable',last_error='Teste interrompido',updated=? WHERE state='creating'",Date.now());
 return async function(req,path,u,b={}){
 if(u?.role!=='admin'||u.status!=='active')fail('Acesso administrativo necessário',403);
 const sid=(req.headers.cookie||'').match(/(?:^|;\s*)sid=([a-f0-9]+)/)?.[1];if(!sid)fail('Sessão necessária',403);
 if(req.method==='GET'&&path==='/api/bridge45')return {csrf:csrf40(sid,key),mode:'offline_fixture',external:false,rows:all('SELECT * FROM bridge45 ORDER BY id DESC LIMIT 100'),checkouts:all("SELECT ref,gross FROM checkout44 WHERE state='pending' ORDER BY rowid DESC LIMIT 100")};
 if(req.method!=='POST'||!checkCsrf40(sid,key,req.headers['x-omega-csrf']))fail('Token de segurança inválido',403);
 if(path==='/api/bridge45/prepare'){
 const order=one('SELECT * FROM checkout44 WHERE ref=?',String(b.ref||''));if(!order||order.state!=='pending')fail('Pedido de teste pendente necessário',409);
 if(!['success','unavailable','invalid_response'].includes(b.scenario))fail('Cenário inválido');
 let row=one('SELECT * FROM bridge45 WHERE checkout_ref=?',order.ref);
 if(row?.state==='ready'||row?.state==='approved'||row?.state==='refunded')return {...row,duplicate:true};
 if(row?.state==='creating')fail('Operação em andamento',409);
 const ref=row?.ref||reference40(),pref=preference40(JSON.parse(order.items),ref);if(pref.gross!==order.gross)fail('Total divergente',409);
 if(!row)run("INSERT INTO bridge45(checkout_ref,ref,gross,state,updated) VALUES(?,?,?,'new',?)",order.ref,ref,order.gross,Date.now());
 run("UPDATE bridge45 SET state='creating',attempts=attempts+1,last_error=NULL,updated=? WHERE ref=?",Date.now(),ref);
 const local=async()=>{if(b.scenario==='unavailable')throw Error('fixture');return {ok:true,json:async()=>b.scenario==='invalid_response'?{}:{id:'fixture-'+ref,sandbox_init_point:'https://sandbox.mercadopago.com.br/checkout/fixture'}}};
 try{const result=await client40({enabled:true,token:'TEST-localfixture0000'},local).create(pref.body);run("UPDATE bridge45 SET state='ready',preference=?,updated=? WHERE ref=?",result.id,Date.now(),ref)}catch(e){run("UPDATE bridge45 SET state='retryable',last_error=?,updated=? WHERE ref=?",e.status?e.message:'Falha local',Date.now(),ref)}
 return one('SELECT * FROM bridge45 WHERE ref=?',ref);
 }
 if(path==='/api/bridge45/confirm'){
 const row=one('SELECT * FROM bridge45 WHERE ref=?',String(b.ref||''));if(!row||!['ready','approved','refunded'].includes(row.state))fail('Preferência de teste necessária',409);
 if(!['approved','refunded','wrong_amount'].includes(b.scenario))fail('Cenário inválido');
 const status=b.scenario==='wrong_amount'?'approved':b.scenario;
 const p={id:'1',live_mode:false,external_reference:row.ref,currency_id:'BRL',transaction_amount:(row.gross+(b.scenario==='wrong_amount'?1:0))/100,status};
 payment40(p,row,'1');
 if(row.state===status)return {state:row.state,duplicate:true,release:false};
 if(!((row.state==='ready'&&status==='approved')||(row.state==='approved'&&status==='refunded')))fail('Transição inválida',409);
 run('UPDATE bridge45 SET state=?,updated=? WHERE ref=?',status,Date.now(),row.ref);return {state:status,release:false};
 }
 fail('Rota inexistente',404);
 };
}
