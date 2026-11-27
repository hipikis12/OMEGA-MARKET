import {createHash} from 'node:crypto';
export const sessionDigest=token=>createHash('sha256').update(token).digest('hex');
export function persistentGuard(db,{now=Date.now,limit=5,windowMs=600000,maxKeys=10000}={}){
 db.exec('CREATE TABLE IF NOT EXISTS login_guard35(key TEXT PRIMARY KEY,count INTEGER NOT NULL,until_ms INTEGER NOT NULL)');
 const get=db.prepare('SELECT * FROM login_guard35 WHERE key=?');
 const remove=db.prepare('DELETE FROM login_guard35 WHERE key=?');
 function check(key){db.prepare('DELETE FROM login_guard35 WHERE until_ms<=?').run(now());const v=get.get(key);if(v?.count>=limit||(!v&&db.prepare('SELECT count(*) AS n FROM login_guard35').get().n>=maxKeys))throw Object.assign(Error('Muitas tentativas. Tente novamente mais tarde.'),{status:429});}
 return {check,fail(key){check(key);db.prepare('INSERT INTO login_guard35 VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key,now()+windowMs)},clear(key){remove.run(key)}};
}
