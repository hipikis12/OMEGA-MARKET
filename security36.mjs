export function reconcile(rows){
 const issues=[];let approved=0, gross=0;
 for(const r of rows){const reasons=[];
 if(r.gross==null) reasons.push('Sem registro financeiro (possível pedido legado)');
 else {if(![r.price,r.gross,r.fee,r.commission,r.seller_net].every(n=>Number.isSafeInteger(n)&&n>=0)) reasons.push('Valores inválidos');
 if(r.gross!==r.price) reasons.push('Valor bruto divergente');
 if(r.gross!==r.fee+r.commission+r.seller_net) reasons.push('Divisão financeira divergente');}
 if(r.status==='demo_approved'){approved++; if(!reasons.length)gross+=r.gross;}
 if(reasons.length)issues.push({id:r.id,status:r.status,reasons});
 }return {orders:rows.length,approved,gross,issues};
}
export function integrity(db){const checks=db.prepare('PRAGMA integrity_check').all();const foreign=db.prepare('PRAGMA foreign_key_check').all();return {ok:checks.length===1&&Object.values(checks[0])[0]==='ok'&&!foreign.length,foreignIssues:foreign.length};}
