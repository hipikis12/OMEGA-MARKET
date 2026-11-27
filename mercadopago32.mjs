import {randomUUID} from 'node:crypto';
// Laboratório offline. Não contém transporte HTTP ou credenciais.
export function preferencePreview(order){
 if(!Number.isSafeInteger(order.id)||order.id<=0||!Number.isSafeInteger(order.price)||order.price<=0||typeof order.title!=='string'||!order.title.trim()) throw new Error('Pedido inválido');
 return {items:[{id:String(order.product),title:order.title.slice(0,120),quantity:1,currency_id:'BRL',unit_price:order.price/100}],external_reference:'omega-demo-'+order.id};
}
export function simulatePreference(order){return {id:'DEMO-'+randomUUID(),mode:'offline',external:false,preference:preferencePreview(order)};}
export function validateFixture(order,payment){
 if(!payment||payment.external_reference!=='omega-demo-'+order.id||payment.currency_id!=='BRL'||typeof payment.transaction_amount!=='number'||!Number.isFinite(payment.transaction_amount)||Math.abs(payment.transaction_amount*100-order.price)>0.000001)return {valid:false,reason:'Dados inconsistentes'};
 if(!['approved','pending','rejected','cancelled','refunded'].includes(payment.status))return {valid:false,reason:'Estado desconhecido'};
 return {valid:true,status:payment.status,release:false,mode:'offline'};
}
