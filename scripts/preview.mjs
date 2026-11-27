// Pré-visualização do visual SEM backend: serve /public e responde /api com
// dados fictícios. Uso: `npm run preview` e abra http://127.0.0.1:8790
// (Para o fluxo real use `npx wrangler pages dev` com o .dev.vars.)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = new URL('../public/', import.meta.url).pathname;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const cats = [['templates', 'Templates & UI', '▦'], ['ebooks', 'E-books', '▤'], ['cursos', 'Cursos', '▶'], ['software', 'Software & Licenças', '⌘'], ['audio', 'Áudio & Música', '♪']].map(([slug, name, icon]) => ({ slug, name, icon }));
const mk = (i, slug, title, subtitle, category, price, compare, featured, rating, count, sales) => ({
  id: `00000000-0000-4000-8000-00000000000${i}`, slug, title, subtitle, category, price_cents: price, compare_cents: compare, cover_url: null,
  delivery: category === 'software' ? 'license' : 'download', features: ['Acesso vitalício', 'Atualizações gratuitas', 'Suporte por e-mail'],
  featured, sales_count: sales, rating_avg: rating, rating_count: count, created_at: new Date(Date.now() - i * 864e5).toISOString(),
  description: 'Descrição completa do produto.\nInclui arquivos-fonte e guia de uso.',
});
const products = [
  mk(1, 'kit-ui-aurora', 'Kit UI Aurora', '120 componentes para dashboards modernos', 'templates', 9790, 14900, true, 4.8, 37, 212),
  mk(2, 'ebook-marketing-digital', 'Guia de Marketing Digital 2027', 'Do zero às primeiras vendas online', 'ebooks', 3990, null, true, 4.6, 18, 140),
  mk(3, 'curso-flutter-pro', 'Curso Flutter Pro', 'Apps Android e iOS do zero ao deploy', 'cursos', 19700, 29700, true, 4.9, 52, 330),
  mk(4, 'omega-backup-pro', 'Omega Backup Pro', 'Licença vitalícia para 1 computador', 'software', 7990, null, true, 4.4, 9, 61),
  mk(5, 'pack-lofi-beats', 'Pack Lo-Fi Beats', '50 trilhas livres de royalties', 'audio', 4990, 6990, false, 0, 0, 0),
  mk(6, 'planner-notion', 'Planner Notion Produtivo', 'Sistema completo de metas e hábitos', 'templates', 2490, 3990, false, 4.7, 24, 98),
];
const send = (res, status, data) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) {
    const p = url.pathname.slice(5);
    if (p === 'config') return send(res, 200, { configured: true, payments: true, sandbox: true, turnstileSiteKey: null, user: null, categories: cats, store: { name: 'OMEGA MARKET', tagline: 'O universo digital ao seu alcance', hero_title: 'Produtos digitais prontos para acelerar seus projetos', hero_text: 'Templates, e-books, cursos, softwares e licenças com entrega imediata após a confirmação do pagamento.', announcement: 'Pagamento seguro via Mercado Pago · Pix, cartão e boleto' } });
    if (p === 'products') {
      let list = [...products];
      if (url.searchParams.get('featured') === '1') list = list.filter((x) => x.featured);
      if (url.searchParams.get('category')) list = list.filter((x) => x.category === url.searchParams.get('category'));
      return send(res, 200, { products: list.slice(0, Number(url.searchParams.get('limit')) || 60) });
    }
    if (p.startsWith('products/')) {
      const prod = products.find((x) => x.slug === p.split('/')[1]);
      return prod ? send(res, 200, { product: { ...prod, files: [{ label: 'Pacote completo (.zip)', size_bytes: 48e6, version: '2.1' }] }, reviews: [{ author: 'Marina', rating: 5, comment: 'Excelente, economizou semanas de trabalho!', created_at: new Date().toISOString() }], owned: false }) : send(res, 404, { error: 'Produto não encontrado' });
    }
    if (p === 'cart') {
      let body = ''; for await (const c of req) body += c;
      const { ids = [] } = JSON.parse(body || '{}');
      const items = products.filter((x) => ids.includes(x.id));
      const sub = items.reduce((s, x) => s + x.price_cents, 0);
      return send(res, 200, { items, missing: [], subtotal_cents: sub, discount_cents: 0, total_cents: sub, coupon: null });
    }
    return send(res, 401, { error: 'Entre na sua conta para continuar' });
  }
  const file = normalize(join(root, url.pathname === '/' ? 'index.html' : url.pathname));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  try { const data = await readFile(file); res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' }); res.end(data); }
  catch { const data = await readFile(join(root, 'index.html')); res.writeHead(200, { 'content-type': types['.html'] }); res.end(data); }
}).listen(8790, '127.0.0.1', () => console.log('Pré-visualização: http://127.0.0.1:8790'));
