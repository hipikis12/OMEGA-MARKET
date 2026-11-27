import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
export async function sha256File(path){const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex')}
export function validatePassword(current,next){if(typeof current!=='string'||current.length<1||current.length>128||typeof next!=='string'||next.length<12||next.length>128||next.trim()!==next||current===next)throw Object.assign(new Error('Informe a senha atual e uma nova senha diferente de 12 a 128 caracteres, sem espaços nas extremidades.'),{status:400});}
