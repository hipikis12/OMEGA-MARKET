import {randomUUID,randomBytes} from 'node:crypto';
import {signFixture,verifyFixture} from './security33.mjs';
import {validateFixture} from './mercadopago32.mjs';
// Exclusivamente local: nenhum evento modifica pedidos ou libera arquivos.
export function validateEvent(event,signature,key,seen,now=Date.now()){
 if(!event||typeof event!=='object'||!/^DEMO-[a-f0-9-]{36}$/.test(event.id)||!Number.isSafeInteger(event.timestamp))return 'invalid';
 if(!verifyFixture(event,signature,key))return 'signature_invalid';
 if(Math.abs(now-event.timestamp)>300000)return 'expired';
 if(seen.has(event.id))return 'duplicate';
 const result=validateFixture({id:1,price:4990},event.payment);
 if(!result.valid)return 'inconsistent';
 seen.add(event.id);return 'validated';
}
export function runScenario(scenario){
 const key=randomBytes(32),seen=new Set(),now=Date.now();
 const event={id:'DEMO-'+randomUUID(),timestamp:now,payment:{external_reference:'omega-demo-1',currency_id:'BRL',transaction_amount:49.90,status:'approved'}};
 if(scenario==='expired')event.timestamp-=600000;
 if(scenario==='amount')event.payment.transaction_amount=1;
 if(scenario==='reference')event.payment.external_reference='wrong';
 if(scenario==='currency')event.payment.currency_id='USD';
 if(scenario==='status')event.payment.status='unknown';
 const signature=signFixture(event,key);
 if(scenario==='tampered')event.payment.status='rejected';
 if(scenario==='duplicate')validateEvent(event,signature,key,seen,now);
 return {scenario,result:validateEvent(event,signature,key,seen,now),mode:'offline',release:false};
}
