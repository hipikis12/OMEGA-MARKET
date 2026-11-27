// Read-only diagnostics. Never contact payment providers or release products.
import {integrity} from './security36.mjs';
export function audit43(db,u,now=Date.now()){
 if(u?.role!=='admin'||u.status!=='active')throw Object.assign(Error('Acesso administrativo necessário'),{status:403});
 const all=(sql,...args)=>db.prepare(sql).all(...args);
 const groups=all('SELECT seller,mode,state,count(*) AS total,sum(gross) AS gross,sum(fee) AS commission FROM mp_beta40 GROUP BY seller,mode,state ORDER BY seller,mode,state');
 const grants=all("SELECT u.id AS seller,u.name,u.status,g.expires FROM users u LEFT JOIN oauth_grants41 g ON g.seller=u.id WHERE u.role='partner' ORDER BY u.id").map(g=>({...g,authorization:g.status!=='active'?'inactive':g.expires==null?'missing':g.expires<=now?'expired':g.expires<=now+86400000?'expiring':'valid'}));
 const alerts=all("SELECT ref,seller,state FROM mp_beta40 WHERE gross<=0 OR fee<0 OR fee>gross OR state IN ('creating','needs_review') OR (mode='test_api' AND state='approved' AND (payment_id IS NULL OR preference IS NULL)) ORDER BY ref LIMIT 100");
 const eventCounts=all('SELECT state,count(*) AS total FROM mp_events40 GROUP BY state');
 return {groups,grants,alerts,eventCounts,integrity:integrity(db),realCharges:false,externalVerified:false,deliveryIntegrated:false,generatedAt:now};
}
