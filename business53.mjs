export function business53(db,user,days=30){
 if(!['admin','partner'].includes(user?.role)||user.status!=='active')throw Error('Acesso negado');
 if(![7,30,90].includes(days))throw Error('Período inválido');
 const scope=user.role==='partner'?' AND seller=?':'', args=user.role==='partner'?[user.id]:[];
 const all=(sql,...params)=>db.prepare(sql).all(...params);
 const since=`date('now','-${days-1} days')`;
 const orders=all(`SELECT status,count(*) total,coalesce(sum(price),0) cents FROM orders WHERE date(created)>=${since}${scope} GROUP BY status`,...args);
 const daily=all(`SELECT date(created) day,count(*) total,coalesce(sum(price),0) cents FROM orders WHERE status='demo_approved' AND date(created)>=${since}${scope} GROUP BY date(created) ORDER BY day`,...args);
 const products=all(`SELECT id,title,category,status,price FROM products WHERE 1=1${scope} ORDER BY id DESC`,...args);
 return {days,orders,daily,products,mode:'demo',approved:orders.find(x=>x.status==='demo_approved')?.total||0,gross:orders.find(x=>x.status==='demo_approved')?.cents||0};
}
