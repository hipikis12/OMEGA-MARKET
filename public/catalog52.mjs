export const normalize52 = value => String(value ?? '').normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('pt-BR').trim();
export function filter52(products, query='', category='') {
 const words=normalize52(query).split(/\s+/).filter(Boolean);
 return products.filter(p=>(!category||p.category===category)&&words.every(w=>normalize52([p.title,p.category,p.sellerName,p.description].join(' ')).includes(w)));
}
export function suggest52(products,query,category='') {
 if(normalize52(query).length<2)return [];
 return filter52(products,query,category).sort((a,b)=>Number(normalize52(b.title).startsWith(normalize52(query)))-Number(normalize52(a.title).startsWith(normalize52(query)))||a.id-b.id).slice(0,6);
}
