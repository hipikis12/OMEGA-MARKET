import {lstat,mkdir,cp,rm,readFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {verifyInventory,inventory} from './backup48.mjs';
export async function restoreToNew(source,destination){
 source=resolve(source);destination=resolve(destination);
 if(!(await lstat(source)).isDirectory())throw Error('Origem inválida');
 if(destination===source||destination.startsWith(source+ (process.platform==='win32'?'\\':'/')))throw Error('Destino dentro da origem');
 if(!(await lstat(join(source,'manifest48.json'))).isFile())throw Error('Manifesto inválido');
 if(!await verifyInventory(source))throw Error('Inventário divergente');
 // Reserve destination exclusively; never replace an existing database.
 await mkdir(destination,{mode:0o700});
 try{for(const name of ['store.db','images','private']){const p=join(source,name);let s;try{s=await lstat(p)}catch(e){if(e.code==='ENOENT'&&name!=='store.db')continue;throw e;}if(name==='store.db'?!s.isFile():!s.isDirectory())throw Error('Estrutura inválida');await cp(p,join(destination,name),{recursive:true,force:false,errorOnExist:true});}
 const expected=JSON.parse(await readFile(join(source,'manifest48.json'),'utf8')).files.filter(f=>f.path==='store.db'||f.path.startsWith('images/')||f.path.startsWith('private/'));
 if(JSON.stringify(await inventory(destination))!==JSON.stringify(expected))throw Error('Cópia recuperada divergente');
 const db=new DatabaseSync(join(destination,'store.db'),{readOnly:true});try{if(!db.prepare('PRAGMA integrity_check').all().every(r=>r.integrity_check==='ok')||db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Banco inconsistente');}finally{db.close();}
 return destination;
 }catch(e){await rm(destination,{recursive:true,force:true});throw e;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const [source,dest]=process.argv.slice(2);if(!source||!dest)throw Error('Uso: node restore49.mjs BACKUP DESTINO_NOVO');console.log('Cópia de recuperação validada:',await restoreToNew(source,dest));}
