const sections=['featured','new','popular','collections'];
export const defaultCMS=()=>({order:[...sections],collections:[]});
export function validateCMS(b){
 const bad=()=>{throw Object.assign(new Error('Configuração CMS inválida'),{status:400})};
 if(!b||!Array.isArray(b.order)||b.order.length!==4||new Set(b.order).size!==4||b.order.some(s=>!sections.includes(s))||!Array.isArray(b.collections)||b.collections.length>6)bad();
 const collections=b.collections.map(c=>{if(!c||typeof c.title!=='string'||!c.title.trim()||c.title.trim().length>80||!Array.isArray(c.ids)||!c.ids.length||c.ids.length>12||new Set(c.ids).size!==c.ids.length||c.ids.some(id=>!Number.isSafeInteger(id)||id<1))bad();return {title:c.title.trim(),ids:c.ids}});
 return {order:b.order,collections};
}
export function cms56(db){
 db.exec('CREATE TABLE IF NOT EXISTS cms56_history(id INTEGER PRIMARY KEY, config TEXT NOT NULL, created TEXT DEFAULT CURRENT_TIMESTAMP)');
 const current=()=>{const r=db.prepare('SELECT config FROM cms56_history ORDER BY id DESC LIMIT 1').get();return r?JSON.parse(r.config):defaultCMS()};
 const history=()=>db.prepare('SELECT id,created FROM cms56_history ORDER BY id DESC LIMIT 20').all();
 function save(b){const cfg=validateCMS(b);for(const c of cfg.collections)for(const id of c.ids)if(!db.prepare("SELECT p.id FROM products p JOIN users u ON p.seller=u.id WHERE p.id=? AND p.status='published' AND u.status='active'").get(id))throw Object.assign(new Error('Produto indisponível'),{status:400});db.prepare('INSERT INTO cms56_history(config) VALUES(?)').run(JSON.stringify(cfg));return cfg}
 function restore(id){if(!Number.isSafeInteger(id)||id<1)throw Object.assign(new Error('Versão inválida'),{status:400});const r=db.prepare('SELECT config FROM cms56_history WHERE id=?').get(id);if(!r)throw Object.assign(new Error('Versão não encontrada'),{status:404});return save(JSON.parse(r.config))}
 return {current,history,save,restore};
}
