// Read-only administrative monitoring; never returns credentials or request bodies.
export function monitor48(db,filter='all'){
 const filters={all:'1=1',accounts:"action LIKE 'mfa%' OR action LIKE '%password%' OR action LIKE '%session%'",finance:"action LIKE '%payment%' OR action LIKE '%mp%' OR action LIKE '%checkout%'",admin:"action LIKE '%account%' OR action LIKE '%partner%'"};
 if(!Object.hasOwn(filters,filter))throw Object.assign(Error('Filtro inválido'),{status:400});
 const condition=filters[filter];
 return {events:db.prepare(`SELECT id,actor,action,target,created FROM audit15 WHERE ${condition} ORDER BY id DESC LIMIT 100`).all(),total:db.prepare('SELECT count(*) n FROM audit15').get().n,checks:{secureCookie:process.env.COOKIE_SECURE==='1',mfaKeyConfigured:/^[a-f0-9]{64}$/i.test(process.env.OMEGA_MFA_KEY||''),externalHomologated:false}};
}
