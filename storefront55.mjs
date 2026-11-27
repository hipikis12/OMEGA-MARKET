const images=new Set(['hero','ui','farm','book','generic']);
export function validateStorefront55(b){
 const bad=()=>{throw Object.assign(new Error('Configuração de vitrine inválida'),{status:400})};
 const txt=(s,n)=>{if(typeof s!=='string'||!s.trim()||s.trim().length>n)bad();return s.trim()};
 if(!b||!Array.isArray(b.banners)||b.banners.length<1||b.banners.length>3||!Array.isArray(b.highlights)||b.highlights.length>12||!['teal','blue','purple'].includes(b.theme))bad();
 const banners=b.banners.map(x=>{if(!x||!images.has(x.image))bad();return {title:txt(x.title,120),text:txt(x.text,300),image:x.image}});
 if(b.highlights.some(x=>!Number.isSafeInteger(x)||x<1)||new Set(b.highlights).size!==b.highlights.length)bad();
 return {banners,highlights:b.highlights,theme:b.theme};
}
