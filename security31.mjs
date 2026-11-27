// Limitador local, sem credenciais ou chamadas externas.
export function loginGuard({now=Date.now,limit=5,windowMs=600000,maxKeys=10000}={}){
 const attempts=new Map();
 function check(key){const t=now();for(const [k,v] of attempts)if(v.until<=t)attempts.delete(k);const v=attempts.get(key);if(v?.count>=limit||(!v&&attempts.size>=maxKeys))throw Object.assign(new Error('Muitas tentativas. Tente novamente mais tarde.'),{status:429});}
 return {check,fail(key){check(key);const v=attempts.get(key);if(v)v.count++;else attempts.set(key,{count:1,until:now()+windowMs});},clear(key){attempts.delete(key)}};
}
