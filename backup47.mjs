import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const magic=Buffer.from('OMEGA47\n');
function keyOf(key){if(!/^[a-f0-9]{64}$/i.test(key||''))throw Error('OMEGA_BACKUP_KEY deve ter 64 caracteres hexadecimais');return Buffer.from(key,'hex')}
export function seal(data,key){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',keyOf(key),iv);c.setAAD(magic);const encrypted=Buffer.concat([c.update(data),c.final()]);return Buffer.concat([magic,iv,c.getAuthTag(),encrypted])}
export function unseal(data,key){if(data.length<36||!data.subarray(0,8).equals(magic))throw Error('Formato inválido');const d=createDecipheriv('aes-256-gcm',keyOf(key),data.subarray(8,20));d.setAAD(magic);d.setAuthTag(data.subarray(20,36));return Buffer.concat([d.update(data.subarray(36)),d.final()])}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const [action,source,dest]=process.argv.slice(2);if(!['encrypt','decrypt'].includes(action)||!source||!dest)throw Error('Uso: node backup47.mjs encrypt|decrypt origem destino');const data=await readFile(source);const result=(action==='encrypt'?seal:unseal)(data,process.env.OMEGA_BACKUP_KEY);await writeFile(dest,result,{flag:'wx',mode:0o600});console.log('Arquivo concluído:',dest)}
