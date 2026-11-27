import {DatabaseSync,backup} from 'node:sqlite';
import {mkdir, mkdtemp, cp, writeFile, rm, stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {sha256File} from './security37.mjs';
// Execute com o servidor parado: banco e arquivos devem representar o mesmo instante.
const source=resolve('data'), base=resolve('backups');
await stat(join(source,'store.db'));await mkdir(base,{recursive:true,mode:0o700});
const dest=await mkdtemp(join(base,'omega-'));let db;
try{db=new DatabaseSync(join(source,'store.db'),{readOnly:true});await backup(db,join(dest,'store.db'));db.close();db=null;const check=new DatabaseSync(join(dest,'store.db'),{readOnly:true});try{if(check.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Banco inválido');}finally{check.close()}
for(const name of ['images','private']){try{await stat(join(source,name))}catch(e){if(e.code==='ENOENT')continue;throw e}await cp(join(source,name),join(dest,name),{recursive:true,errorOnExist:true,force:false});}
await writeFile(join(dest,'manifest.json'),JSON.stringify({created:new Date().toISOString(),databaseSha256:await sha256File(join(dest,'store.db'))},null,2),{mode:0o600});console.log('Backup concluído:',dest);
}catch(e){db?.close();await rm(dest,{recursive:true,force:true});throw e}
