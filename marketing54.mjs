export function marketing54(db,user,days=30,now=Date.now()){
 if(!['admin','partner'].includes(user?.role)||user.status!=='active')throw Error('Acesso negado');
 if(![7,30,90].includes(days))throw Error('Período inválido');
 const admin=user.role==='admin', scope=admin?'':' AND o.seller=?', args=admin?[]:[user.id];
 const where=`WHERE o.status='demo_approved' AND o.created>=date('now',?) AND o.created<=datetime('now')${scope}`;
 const dateArg=`-${days-1} days`;
 const all=(sql,...p)=>db.prepare(sql).all(...p);
 const products=all(`SELECT p.id,p.title,count(*) total,sum(o.price) cents FROM orders o JOIN products p ON p.id=o.product ${where} GROUP BY p.id,p.title ORDER BY total DESC,cents DESC,p.id LIMIT 10`,dateArg,...args);
 const categories=all(`SELECT p.category,count(*) total,sum(o.price) cents FROM orders o JOIN products p ON p.id=o.product ${where} GROUP BY p.category ORDER BY total DESC,p.category`,dateArg,...args);
 const sellers=admin?all(`SELECT u.id,u.name,count(*) total,sum(o.price) cents FROM orders o JOIN users u ON u.id=o.seller ${where} GROUP BY u.id,u.name ORDER BY total DESC,cents DESC,u.id LIMIT 10`,dateArg):[];
 const offers=all(`SELECT p.id,p.title,p.status,p.price,a.price offerPrice,a.until_ms FROM promotions26 a JOIN products p ON p.id=a.product WHERE 1=1${admin?'':' AND p.seller=?'} ORDER BY a.until_ms,p.id`,...args).map(x=>({...x,state:x.until_ms<=now?'expired':x.status!=='published'||x.offerPrice>=x.price?'inactive':'active'}));
 const coupons=admin?all('SELECT code,percent,until_ms,max_uses,uses FROM coupons26 ORDER BY until_ms,code').map(x=>({...x,state:x.until_ms<=now?'expired':x.uses>=x.max_uses?'exhausted':'active'})):[];
 return {mode:'demo',days,products,categories,sellers,offers,coupons,admin};
}
