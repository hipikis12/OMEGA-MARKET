// Bounded, per-IP fixed window. Never trusts forwarded IP headers.
export function apiGuard({limit=300,windowMs=60000,maxKeys=10000,now=Date.now}={}){
 const buckets=new Map();let nextSweep=0;
 return ip=>{const t=now();if(t>=nextSweep){for(const [k,v] of buckets)if(v.until<=t)buckets.delete(k);nextSweep=t+windowMs;}let b=buckets.get(ip);if(!b||b.until<=t){if(!b&&buckets.size>=maxKeys)return {ok:false,retry:Math.ceil(windowMs/1000)};b={count:0,until:t+windowMs};buckets.set(ip,b);}if(b.count>=limit)return {ok:false,retry:Math.max(1,Math.ceil((b.until-t)/1000))};b.count++;return {ok:true};};
}
export function diagnostics49(db,env=process.env){return {checks:[{name:'Integridade SQLite',ok:db.prepare('PRAGMA quick_check').all().every(r=>r.quick_check==='ok')},{name:'Chaves estrangeiras',ok:db.prepare('PRAGMA foreign_key_check').all().length===0},{name:'Cookie Secure configurado',ok:env.COOKIE_SECURE==='1'},{name:'Chave 2FA configurada',ok:/^[a-f0-9]{64}$/i.test(env.OMEGA_MFA_KEY||'')},{name:'Limitação local da API',ok:true},{name:'Homologação externa Mercado Pago',ok:false},{name:'Restauração em produção validada',ok:false}],productionReady:false};}
