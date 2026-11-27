import { api, esc, money, date, bytes } from './api.js';

const $ = (sel, root = document) => root.querySelector(sel);
const main = $('#main');
const state = { config: null, user: null, categories: [] };

// ------------------------------------------------------------------ carrinho
const CART_KEY = 'omega-cart-v6';
const cart = {
  read() { try { const v = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); return Array.isArray(v) ? v.filter((x) => x && typeof x.id === 'string') : []; } catch { return []; } },
  write(items) { try { localStorage.setItem(CART_KEY, JSON.stringify(items.slice(0, 30))); } catch { /* modo privado */ } renderNav(); },
  has(id) { return this.read().some((x) => x.id === id); },
  add(p) {
    if (this.has(p.id)) return toast('Este produto já está no carrinho', 'info');
    this.write([...this.read(), { id: p.id, slug: p.slug, title: p.title, price_cents: p.price_cents, cover_url: p.cover_url, category: p.category }]);
    toast('Adicionado ao carrinho');
  },
  remove(id) { this.write(this.read().filter((x) => x.id !== id)); },
  clear() { this.write([]); },
};

// ---------------------------------------------------------------- utilidades
export function toast(message, type = 'success') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.textContent = message;
  $('#toasts').append(el);
  setTimeout(() => el.classList.add('out'), 4200);
  setTimeout(() => el.remove(), 4700);
}

const hue = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return 'hue-' + (h % 6); };
const catInfo = (slug) => state.categories.find((c) => c.slug === slug) || { name: 'Digital', icon: '◆' };

function cover(p, cls = '') {
  if (p.cover_url) return `<img class="cover ${cls}" src="${esc(p.cover_url)}" alt="" loading="lazy">`;
  const c = catInfo(p.category);
  return `<div class="cover cover-ph ${hue(p.slug || p.title)} ${cls}" aria-hidden="true"><span>${esc(c.icon)}</span><small>${esc(p.title)}</small></div>`;
}

const stars = (avg, count) =>
  count ? `<span class="stars" aria-label="Nota ${Number(avg).toFixed(1)} de 5">${'★'.repeat(Math.round(avg))}${'☆'.repeat(5 - Math.round(avg))} <small>(${count})</small></span>` : '<span class="stars muted"><small>Novo</small></span>';

function price(p) {
  const off = p.compare_cents ? Math.round((1 - p.price_cents / p.compare_cents) * 100) : 0;
  return `<div class="price">${p.compare_cents ? `<s>${money(p.compare_cents)}</s>` : ''}<strong>${money(p.price_cents)}</strong>${off > 0 ? `<span class="badge-off">-${off}%</span>` : ''}</div>`;
}

function card(p) {
  return `<article class="card">
    <a class="card-media" href="#/produto/${esc(p.slug)}">${cover(p)}${p.featured ? '<span class="tag tag-hot">Destaque</span>' : ''}</a>
    <div class="card-body">
      <span class="eyebrow">${esc(catInfo(p.category).name)}</span>
      <h3><a href="#/produto/${esc(p.slug)}">${esc(p.title)}</a></h3>
      <p class="muted small clamp">${esc(p.subtitle)}</p>
      <div class="card-foot">${price(p)}${stars(p.rating_avg, p.rating_count)}</div>
      <button class="btn btn-block" data-add="${esc(p.id)}">${cart.has(p.id) ? 'No carrinho ✓' : 'Adicionar'}</button>
    </div>
  </article>`;
}

function bindAddButtons(products) {
  main.querySelectorAll('[data-add]').forEach((b) => {
    b.onclick = () => {
      const p = products.find((x) => x.id === b.dataset.add);
      if (p) { cart.add(p); b.textContent = 'No carrinho ✓'; }
    };
  });
}

const skeleton = (n = 8) => `<div class="grid">${'<div class="card skeleton"><div class="cover"></div><div class="card-body"><i></i><i></i><i></i></div></div>'.repeat(n)}</div>`;
const emptyState = (title, text, action = '') => `<div class="empty"><div class="empty-icon" aria-hidden="true">Ω</div><h2>${esc(title)}</h2><p class="muted">${esc(text)}</p>${action}</div>`;

async function busy(button, fn) {
  button = button || document.createElement('button');
  if (button.disabled) return;
  const label = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<span class="spinner" aria-hidden="true"></span> Processando…';
  try { return await fn(); } catch (e) { toast(e.message, 'error'); } finally { button.disabled = false; button.innerHTML = label; }
}

function formData(form) { return Object.fromEntries(new FormData(form).entries()); }

// ---------------------------------------------------------------- Turnstile
let turnstileLoading = null;
async function mountTurnstile(container) {
  const key = state.config && state.config.turnstileSiteKey;
  if (!key || !container) return () => undefined;
  if (!turnstileLoading) {
    turnstileLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true; s.onload = resolve; s.onerror = reject;
      document.head.append(s);
    });
  }
  let token;
  try {
    await turnstileLoading;
    const id = window.turnstile.render(container, { sitekey: key, theme: 'dark', language: 'pt-br', callback: (t) => { token = t; } });
    return () => { const t = token; token = undefined; try { window.turnstile.reset(id); } catch { /* ignore */ } return t; };
  } catch {
    container.textContent = 'Não foi possível carregar a verificação anti-robô.';
    return () => undefined;
  }
}

// ---------------------------------------------------------------- navegação
function renderNav() {
  const count = cart.read().length;
  const u = state.user;
  $('#nav').innerHTML = `
    <a href="#/produtos">Produtos</a>
    <a class="cart-link" href="#/carrinho" aria-label="Carrinho com ${count} itens">🛒<span class="cart-count${count ? '' : ' zero'}">${count}</span></a>
    ${u ? `<details class="account"><summary>${esc((u.name || u.email).split(' ')[0])} ▾</summary><div class="menu">
          <a href="#/biblioteca">Biblioteca</a><a href="#/pedidos">Pedidos</a>${u.role === 'admin' ? '<a href="#/admin">Administração</a>' : ''}<button id="logout" class="link">Sair</button></div></details>`
        : '<a class="btn btn-sm" href="#/entrar">Entrar</a>'}`;
  const out = $('#logout');
  if (out) out.onclick = async () => { await api('auth/logout', { method: 'POST' }).catch(() => {}); state.user = null; renderNav(); location.hash = '#/'; toast('Você saiu da conta', 'info'); };
}

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  return { parts: path.split('/').filter(Boolean).map(decodeURIComponent), params: new URLSearchParams(query) };
}

const routes = {
  '': home, produtos: catalog, produto: product, carrinho: cartView, entrar: login, cadastro: signup,
  recuperar: recover, pedidos: orders, pedido: order, biblioteca: library, admin: adminView,
};

async function route() {
  // Caminhos especiais usados nos links de e-mail do Supabase
  if (location.pathname === '/nova-senha') return newPassword();
  if (location.pathname === '/conta-confirmada') {
    history.replaceState(null, '', '/#/entrar');
    toast('E-mail confirmado! Agora é só entrar.');
  }
  const { parts, params } = parseHash();
  const view = routes[parts[0] || ''] || notFound;
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#/' + (parts[0] || '')));
  window.scrollTo({ top: 0 });
  try { await view(parts.slice(1), params); } catch (e) {
    if (e.status === 401) { location.hash = '#/entrar?volta=' + encodeURIComponent(location.hash); return; }
    main.innerHTML = emptyState('Algo deu errado', e.message, '<a class="btn" href="#/">Voltar à loja</a>');
  }
  main.focus({ preventScroll: true });
}

function setTitle(t) { document.title = (t ? t + ' · ' : '') + (state.config ? state.config.store.name : 'OMEGA MARKET'); }

// ------------------------------------------------------------------- páginas
async function home() {
  const s = state.config.store;
  setTitle('');
  main.innerHTML = `
    <section class="hero">
      <div class="wrap hero-inner">
        <div class="hero-copy">
          <span class="eyebrow glow">${esc(s.tagline)}</span>
          <h1>${esc(s.hero_title)}</h1>
          <p class="lead">${esc(s.hero_text)}</p>
          <div class="hero-cta"><a class="btn btn-lg" href="#/produtos">Explorar produtos</a><a class="btn btn-lg btn-ghost" href="#/produtos?sort=vendidos">Mais vendidos</a></div>
          <ul class="trust">
            <li><b>⚡</b> Entrega imediata</li><li><b>🔒</b> Pagamento seguro</li><li><b>⬇</b> Download protegido</li><li><b>♾</b> Acesso vitalício</li>
          </ul>
        </div>
        <div class="hero-art" aria-hidden="true"><div class="orb"></div><div class="float f1">PDF</div><div class="float f2">.FIG</div><div class="float f3">KEY</div><div class="float f4">MP4</div></div>
      </div>
    </section>
    <section class="wrap section">
      <div class="section-head"><h2>Categorias</h2></div>
      <div class="cats">${state.categories.map((c) => `<a class="cat ${hue(c.slug)}" href="#/produtos?cat=${esc(c.slug)}"><span>${esc(c.icon)}</span>${esc(c.name)}</a>`).join('') || '<p class="muted">Nenhuma categoria cadastrada.</p>'}</div>
    </section>
    <section class="wrap section"><div class="section-head"><h2>Em destaque</h2><a href="#/produtos">Ver tudo →</a></div><div id="featured">${skeleton(4)}</div></section>
    <section class="wrap section"><div class="section-head"><h2>Novidades</h2><a href="#/produtos?sort=novos">Ver tudo →</a></div><div id="latest">${skeleton(4)}</div></section>
    <section class="wrap section steps">
      <div class="step"><b>1</b><h3>Escolha</h3><p class="muted">Navegue pelo catálogo e adicione ao carrinho.</p></div>
      <div class="step"><b>2</b><h3>Pague com Mercado Pago</h3><p class="muted">Pix, cartão em até 12x ou boleto, em ambiente seguro.</p></div>
      <div class="step"><b>3</b><h3>Receba na hora</h3><p class="muted">Downloads e licenças liberados na sua biblioteca.</p></div>
    </section>`;
  const [feat, latest] = await Promise.all([api('products?featured=1&limit=4'), api('products?sort=novos&limit=8')]);
  const all = [...feat.products, ...latest.products];
  if (!feat.products.length) $('#featured').closest('section').remove();
  else $('#featured').innerHTML = feat.products.length ? `<div class="grid">${feat.products.map(card).join('')}</div>` : '';
  $('#latest').innerHTML = latest.products.length ? `<div class="grid">${latest.products.map(card).join('')}</div>` : emptyState('Novidades em breve', 'Estamos preparando os primeiros produtos.');
  bindAddButtons(all);
}

async function catalog(_, params) {
  const cat = params.get('cat') || '';
  const q = params.get('q') || '';
  const sort = params.get('sort') || 'destaque';
  setTitle(q ? `Busca: ${q}` : cat ? catInfo(cat).name : 'Produtos');
  $('#search-input').value = q;
  const link = (over) => { const p = new URLSearchParams({ ...(cat && { cat }), ...(q && { q }), ...(sort !== 'destaque' && { sort }), ...over }); for (const [k, v] of [...p]) if (!v) p.delete(k); return '#/produtos' + (p.toString() ? '?' + p : ''); };
  main.innerHTML = `<section class="wrap section">
    <div class="catalog-head"><div><h1>${q ? `Resultados para “${esc(q)}”` : cat ? esc(catInfo(cat).name) : 'Todos os produtos'}</h1><p class="muted" id="count">Carregando…</p></div>
      <label class="sort">Ordenar <select id="sort">${[['destaque', 'Relevância'], ['vendidos', 'Mais vendidos'], ['avaliados', 'Melhor avaliados'], ['novos', 'Lançamentos'], ['menor', 'Menor preço'], ['maior', 'Maior preço']].map(([v, l]) => `<option value="${v}"${v === sort ? ' selected' : ''}>${l}</option>`).join('')}</select></label></div>
    <div class="chips"><a class="chip${cat ? '' : ' on'}" href="${link({ cat: '' })}">Todos</a>${state.categories.map((c) => `<a class="chip${c.slug === cat ? ' on' : ''}" href="${link({ cat: c.slug })}">${esc(c.icon)} ${esc(c.name)}</a>`).join('')}</div>
    <div id="results">${skeleton()}</div></section>`;
  $('#sort').onchange = (e) => { location.hash = link({ sort: e.target.value === 'destaque' ? '' : e.target.value }); };
  const qs = new URLSearchParams({ sort, ...(cat && { category: cat }), ...(q && { q }) });
  const { products } = await api('products?' + qs);
  $('#count').textContent = products.length + (products.length === 1 ? ' produto' : ' produtos');
  $('#results').innerHTML = products.length ? `<div class="grid">${products.map(card).join('')}</div>` : emptyState('Nada encontrado', 'Tente outra busca ou categoria.', '<a class="btn" href="#/produtos">Ver todos</a>');
  bindAddButtons(products);
}

async function product([slug]) {
  main.innerHTML = `<section class="wrap section">${skeleton(1)}</section>`;
  const { product: p, reviews, owned } = await api('products/' + encodeURIComponent(slug || ''));
  setTitle(p.title);
  const delivery = { download: 'Download imediato', license: 'Chave de licença', both: 'Download + chave de licença' }[p.delivery];
  main.innerHTML = `<section class="wrap section product">
    <nav class="crumbs"><a href="#/">Início</a> / <a href="#/produtos?cat=${esc(p.category || '')}">${esc(catInfo(p.category).name)}</a> / <span>${esc(p.title)}</span></nav>
    <div class="product-grid">
      <div class="product-media">${cover(p, 'cover-lg')}</div>
      <div class="product-info">
        <span class="eyebrow">${esc(catInfo(p.category).name)}</span>
        <h1>${esc(p.title)}</h1>
        <p class="lead">${esc(p.subtitle)}</p>
        <div class="meta">${stars(p.rating_avg, p.rating_count)}<span class="muted small">${p.sales_count} ${p.sales_count === 1 ? 'venda' : 'vendas'}</span></div>
        <div class="buybox">
          ${price(p)}
          ${owned ? '<a class="btn btn-lg btn-block" href="#/biblioteca">Você já possui · abrir biblioteca</a>'
            : `<button class="btn btn-lg btn-block" id="buy">Comprar agora</button><button class="btn btn-ghost btn-block" id="add">${cart.has(p.id) ? 'No carrinho ✓' : 'Adicionar ao carrinho'}</button>`}
          <ul class="checks"><li>${esc(delivery)}</li><li>Pix, cartão ou boleto via Mercado Pago</li><li>Acesso pela sua biblioteca, quando quiser</li></ul>
        </div>
        ${p.features && p.features.length ? `<h2 class="h3">O que está incluso</h2><ul class="features">${p.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
        ${p.files && p.files.length ? `<h2 class="h3">Arquivos</h2><ul class="files">${p.files.map((f) => `<li><span>📦 ${esc(f.label)}</span><span class="muted small">v${esc(f.version)} · ${bytes(f.size_bytes)}</span></li>`).join('')}</ul>` : ''}
      </div>
    </div>
    <div class="product-desc"><h2>Descrição</h2><div class="prose">${esc(p.description || 'Sem descrição.').replace(/\n/g, '<br>')}</div></div>
    <div class="product-reviews"><h2>Avaliações ${p.rating_count ? `<small class="muted">${Number(p.rating_avg).toFixed(1)} de 5</small>` : ''}</h2>
      ${reviews.length ? reviews.map((r) => `<div class="review"><div>${stars(r.rating, 1).replace(/<small>.*<\/small>/, '')} <b>${esc(r.author)}</b> <span class="muted small">${date(r.created_at)}</span></div><p>${esc(r.comment)}</p></div>`).join('') : '<p class="muted">Ainda sem avaliações. Compradores podem avaliar pela biblioteca.</p>'}
    </div></section>`;
  const add = $('#add');
  if (add) add.onclick = () => { cart.add(p); add.textContent = 'No carrinho ✓'; };
  const buy = $('#buy');
  if (buy) buy.onclick = () => { if (!cart.has(p.id)) cart.add(p); location.hash = '#/carrinho'; };
}

let checkoutKey = null;
async function cartView() {
  setTitle('Carrinho');
  const items = cart.read();
  if (!items.length) { main.innerHTML = `<section class="wrap section">${emptyState('Seu carrinho está vazio', 'Explore o catálogo e encontre algo incrível.', '<a class="btn" href="#/produtos">Ver produtos</a>')}</section>`; return; }
  main.innerHTML = `<section class="wrap section"><h1>Carrinho</h1><div class="cart-grid"><div id="cart-items">${skeleton(1)}</div>
    <aside class="summary" id="summary"></aside></div></section>`;
  let coupon = sessionStorage.getItem('omega-coupon') || '';
  async function refresh() {
    const q = await api('cart', { method: 'POST', body: { ids: cart.read().map((x) => x.id), coupon } });
    if (q.missing && q.missing.length) { cart.write(cart.read().filter((x) => !q.missing.includes(x.id))); toast('Removemos itens que não estão mais disponíveis', 'info'); }
    if (!q.items.length) return cartView();
    if (q.coupon_error) { toast(q.coupon_error, 'error'); coupon = ''; sessionStorage.removeItem('omega-coupon'); }
    $('#cart-items').innerHTML = q.items.map((p) => `<div class="cart-item">${cover(p, 'cover-sm')}<div><a href="#/produto/${esc(p.slug)}"><b>${esc(p.title)}</b></a><span class="muted small">${esc(catInfo(p.category).name)}</span></div><b>${money(p.price_cents)}</b><button class="icon-btn" data-remove="${esc(p.id)}" aria-label="Remover ${esc(p.title)}">✕</button></div>`).join('');
    $('#summary').innerHTML = `<h2 class="h3">Resumo</h2>
      <form id="coupon-form" class="inline"><input name="coupon" placeholder="Cupom de desconto" value="${esc(q.coupon ? q.coupon.code : '')}" maxlength="30" aria-label="Cupom"><button class="btn btn-ghost btn-sm">Aplicar</button></form>
      <dl><dt>Subtotal</dt><dd>${money(q.subtotal_cents)}</dd>${q.discount_cents ? `<dt>Desconto ${esc(q.coupon.code)} (${q.coupon.percent}%)</dt><dd class="ok">− ${money(q.discount_cents)}</dd>` : ''}<dt class="total">Total</dt><dd class="total">${money(q.total_cents)}</dd></dl>
      ${state.config.payments ? `<button class="btn btn-lg btn-block" id="pay">${state.user ? 'Pagar com Mercado Pago' : 'Entrar e pagar'}</button>` : '<p class="notice">Pagamentos ainda não configurados nesta loja.</p>'}
      <p class="muted small center">🔒 Você será levado ao ambiente seguro do Mercado Pago.</p>`;
    main.querySelectorAll('[data-remove]').forEach((b) => { b.onclick = () => { cart.remove(b.dataset.remove); checkoutKey = null; refresh(); }; });
    $('#coupon-form').onsubmit = (e) => { e.preventDefault(); coupon = formData(e.target).coupon.trim(); sessionStorage.setItem('omega-coupon', coupon); checkoutKey = null; refresh(); };
    const pay = $('#pay');
    if (pay) pay.onclick = () => busy(pay, async () => {
      if (!state.user) { location.hash = '#/entrar?volta=' + encodeURIComponent('#/carrinho'); return; }
      checkoutKey = checkoutKey || crypto.randomUUID();
      const r = await api('checkout', { method: 'POST', body: { ids: q.items.map((p) => p.id), coupon, key: checkoutKey } });
      sessionStorage.setItem('omega-last-order', r.order_id);
      location.href = r.url;
    });
  }
  await refresh();
}

function authShell(title, inner, foot) {
  return `<section class="wrap section auth"><div class="auth-card"><div class="brand-mark big" aria-hidden="true">Ω</div><h1>${title}</h1>${inner}<div class="auth-foot">${foot}</div></div></section>`;
}

async function login(_, params) {
  setTitle('Entrar');
  const back = params.get('volta');
  main.innerHTML = authShell('Entrar na sua conta', `<form id="f" class="stack">
      <label>E-mail<input name="email" type="email" autocomplete="email" required></label>
      <label>Senha<input name="password" type="password" autocomplete="current-password" required></label>
      <div id="ts"></div><button class="btn btn-lg btn-block">Entrar</button></form>`,
    `<a href="#/recuperar">Esqueci minha senha</a><span>Novo por aqui? <a href="#/cadastro${back ? '?volta=' + encodeURIComponent(back) : ''}">Criar conta</a></span>`);
  const token = await mountTurnstile($('#ts'));
  $('#f').onsubmit = (e) => { e.preventDefault(); busy(e.submitter, async () => {
    const r = await api('auth/login', { method: 'POST', body: { ...formData(e.target), turnstile: token() } });
    state.user = r.user; renderNav(); toast('Bem-vindo(a) de volta!');
    location.hash = back && back.startsWith('#/') ? back : '#/biblioteca';
  }); };
}

async function signup(_, params) {
  setTitle('Criar conta');
  const back = params.get('volta');
  main.innerHTML = authShell('Criar conta', `<form id="f" class="stack">
      <label>Nome<input name="name" autocomplete="name" minlength="2" maxlength="80" required></label>
      <label>E-mail<input name="email" type="email" autocomplete="email" required></label>
      <label>Senha <small class="muted">(mín. 10 caracteres, letras e números)</small><input name="password" type="password" autocomplete="new-password" minlength="10" required></label>
      <div id="ts"></div><button class="btn btn-lg btn-block">Criar conta</button></form>`,
    `<span>Já tem conta? <a href="#/entrar">Entrar</a></span>`);
  const token = await mountTurnstile($('#ts'));
  $('#f').onsubmit = (e) => { e.preventDefault(); busy(e.submitter, async () => {
    const r = await api('auth/signup', { method: 'POST', body: { ...formData(e.target), turnstile: token() } });
    if (r.confirmed) { const me = await api('auth/me'); state.user = me.user; renderNav(); toast('Conta criada!'); location.hash = back && back.startsWith('#/') ? back : '#/'; }
    else main.innerHTML = authShell('Confirme seu e-mail', `<p class="lead">${esc(r.message)}</p>`, '<a href="#/entrar">Ir para o login</a>');
  }); };
}

async function recover() {
  setTitle('Recuperar senha');
  main.innerHTML = authShell('Recuperar senha', `<form id="f" class="stack"><label>E-mail<input name="email" type="email" autocomplete="email" required></label><div id="ts"></div><button class="btn btn-lg btn-block">Enviar link</button></form>`, '<a href="#/entrar">Voltar</a>');
  const token = await mountTurnstile($('#ts'));
  $('#f').onsubmit = (e) => { e.preventDefault(); busy(e.submitter, async () => {
    const r = await api('auth/recover', { method: 'POST', body: { ...formData(e.target), turnstile: token() } });
    main.innerHTML = authShell('Verifique seu e-mail', `<p class="lead">${esc(r.message)}</p>`, '<a href="#/entrar">Voltar ao login</a>');
  }); };
}

function newPassword() {
  const frag = new URLSearchParams(location.hash.replace(/^#/, ''));
  const accessToken = frag.get('access_token');
  history.replaceState(null, '', '/#/');
  setTitle('Nova senha');
  if (!accessToken) { main.innerHTML = authShell('Link inválido', '<p class="lead">Peça um novo link de redefinição.</p>', '<a href="#/recuperar">Recuperar senha</a>'); return; }
  main.innerHTML = authShell('Definir nova senha', `<form id="f" class="stack"><label>Nova senha<input name="password" type="password" autocomplete="new-password" minlength="10" required></label><button class="btn btn-lg btn-block">Salvar</button></form>`, '');
  $('#f').onsubmit = (e) => { e.preventDefault(); busy(e.submitter, async () => {
    const r = await api('auth/reset', { method: 'POST', body: { access_token: accessToken, password: formData(e.target).password } });
    toast(r.message); location.hash = '#/entrar';
  }); };
}

const STATUS = {
  pending: ['Aguardando pagamento', 'warn'], paid: ['Pago', 'ok'], rejected: ['Recusado', 'bad'], cancelled: ['Cancelado', 'bad'],
  refunded: ['Reembolsado', 'muted'], charged_back: ['Contestado', 'bad'],
};
const statusPill = (s) => `<span class="status ${STATUS[s] ? STATUS[s][1] : ''}">${esc(STATUS[s] ? STATUS[s][0] : s)}</span>`;

async function orders() {
  setTitle('Meus pedidos');
  if (!state.user) throw Object.assign(new Error('Entre'), { status: 401 });
  main.innerHTML = `<section class="wrap section"><h1>Meus pedidos</h1><div id="list">${skeleton(2)}</div></section>`;
  const { orders: list } = await api('orders');
  $('#list').innerHTML = list.length ? `<div class="table">${list.map((o) => `<a class="row" href="#/pedido/${esc(o.id)}"><span><b>#${esc(o.id.slice(0, 8).toUpperCase())}</b><small class="muted">${date(o.created_at)}</small></span><span class="grow">${esc(o.order_items.map((i) => i.title).join(', '))}</span>${statusPill(o.status)}<b>${money(o.total_cents)}</b></a>`).join('')}</div>`
    : emptyState('Nenhum pedido ainda', 'Suas compras aparecerão aqui.', '<a class="btn" href="#/produtos">Ver produtos</a>');
}

let pollTimer = null;
async function order([id]) {
  setTitle('Pedido');
  if (!state.user) throw Object.assign(new Error('Entre'), { status: 401 });
  clearTimeout(pollTimer);
  main.innerHTML = `<section class="wrap section">${skeleton(1)}</section>`;
  let attempts = 0;
  const draw = (o) => {
    const [label] = STATUS[o.status] || [o.status];
    main.innerHTML = `<section class="wrap section narrow"><div class="order-hero ${o.status}">
      <div class="order-icon" aria-hidden="true">${o.status === 'paid' ? '✓' : o.status === 'pending' ? '⏳' : '!'}</div>
      <h1>${o.status === 'paid' ? 'Pagamento confirmado!' : esc(label)}</h1>
      <p class="lead">${o.status === 'paid' ? 'Seus produtos já estão na biblioteca.' : o.status === 'pending' ? 'Assim que o Mercado Pago confirmar, liberamos seus produtos automaticamente. Pix costuma levar segundos; boleto, até 3 dias úteis.' : 'O pagamento não foi concluído. Você pode tentar novamente.'}</p>
      <div class="hero-cta">${o.status === 'paid' ? '<a class="btn btn-lg" href="#/biblioteca">Abrir biblioteca</a>' : ''}
        ${o.status === 'pending' && o.mp_init_point ? `<a class="btn btn-lg" href="${esc(o.mp_init_point)}">Continuar pagamento</a>` : ''}
        ${['rejected', 'cancelled'].includes(o.status) ? '<a class="btn btn-lg" href="#/carrinho">Tentar novamente</a>' : ''}</div></div>
      <div class="panel"><h2 class="h3">Pedido #${esc(o.id.slice(0, 8).toUpperCase())} ${statusPill(o.status)}</h2>
      ${o.order_items.map((i) => `<div class="line"><span>${esc(i.title)}</span><b>${money(i.price_cents)}</b></div>`).join('')}
      ${o.discount_cents ? `<div class="line"><span>Desconto ${esc(o.coupon_code || '')}</span><b class="ok">− ${money(o.discount_cents)}</b></div>` : ''}
      <div class="line total"><span>Total</span><b>${money(o.total_cents)}</b></div><p class="muted small">Criado em ${date(o.created_at)}${o.paid_at ? ' · pago em ' + date(o.paid_at) : ''}</p></div></section>`;
  };
  async function tick() {
    if (parseHash().parts[1] !== id) return;
    const { order: o } = await api(`orders/${encodeURIComponent(id)}/sync`, { method: 'POST' });
    draw(o);
    if (o.status === 'paid') {
      const bought = new Set(o.order_items.map((i) => i.product_id));
      cart.write(cart.read().filter((x) => !bought.has(x.id)));
      sessionStorage.removeItem('omega-coupon'); checkoutKey = null;
    }
    if (o.status === 'pending' && attempts++ < 20) pollTimer = setTimeout(() => tick().catch(() => {}), attempts < 6 ? 4000 : 10000);
  }
  await tick();
}

async function library() {
  setTitle('Biblioteca');
  if (!state.user) throw Object.assign(new Error('Entre'), { status: 401 });
  main.innerHTML = `<section class="wrap section"><h1>Minha biblioteca</h1><div id="lib">${skeleton(3)}</div></section>`;
  const { items } = await api('library');
  if (!items.length) { $('#lib').innerHTML = emptyState('Sua biblioteca está vazia', 'Os produtos comprados aparecem aqui assim que o pagamento é confirmado.', '<a class="btn" href="#/produtos">Explorar produtos</a>'); return; }
  $('#lib').innerHTML = `<div class="library">${items.map((it) => `<article class="lib-item">
      ${cover({ ...it, title: it.title }, 'cover-sm')}
      <div class="lib-body"><h3>${esc(it.title)}</h3><p class="muted small">Comprado em ${date(it.paid_at)}</p>
        ${it.files.length ? `<div class="downloads">${it.files.map((f) => `<a class="btn btn-sm" href="/api/download/${esc(f.id)}" rel="noopener">⬇ ${esc(f.label)} <small>v${esc(f.version)} · ${bytes(f.size_bytes)}</small></a>`).join('')}</div>` : ''}
        ${it.license ? `<div class="license"><code>${esc(it.license)}</code><button class="btn btn-ghost btn-sm" data-copy="${esc(it.license)}">Copiar</button></div>` : ''}
        ${!it.files.length && !it.license ? '<p class="notice small">O vendedor ainda está preparando a entrega deste item.</p>' : ''}
        <form class="rate" data-product="${esc(it.product_id)}"><span class="small muted">${it.my_rating ? 'Sua nota:' : 'Avalie:'}</span>${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="star${it.my_rating >= n ? ' on' : ''}" data-n="${n}" aria-label="${n} estrela${n > 1 ? 's' : ''}">★</button>`).join('')}
          <input name="comment" placeholder="Comentário (opcional)" maxlength="1000"><button class="btn btn-ghost btn-sm">Enviar</button></form>
      </div></article>`).join('')}</div>`;
  main.querySelectorAll('[data-copy]').forEach((b) => { b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.copy); toast('Chave copiada'); } catch { toast('Copie manualmente', 'info'); } }; });
  main.querySelectorAll('form.rate').forEach((f) => {
    let rating = f.querySelectorAll('.star.on').length;
    f.querySelectorAll('.star').forEach((s) => { s.onclick = () => { rating = Number(s.dataset.n); f.querySelectorAll('.star').forEach((x) => x.classList.toggle('on', Number(x.dataset.n) <= rating)); }; });
    f.onsubmit = (e) => { e.preventDefault(); if (!rating) return toast('Escolha de 1 a 5 estrelas', 'info'); busy(e.submitter, async () => {
      await api('reviews', { method: 'POST', body: { product_id: f.dataset.product, rating, comment: formData(f).comment } }); toast('Obrigado pela avaliação!');
    }); };
  });
}

async function adminView(parts) {
  if (!state.user) throw Object.assign(new Error('Entre'), { status: 401 });
  if (state.user.role !== 'admin') { main.innerHTML = emptyState('Acesso restrito', 'Esta área é exclusiva da administração.'); return; }
  setTitle('Administração');
  const { renderAdmin } = await import('./admin.js');
  await renderAdmin(main, parts[0] || 'painel', { state, toast, busy, formData, cover, statusPill, reloadConfig: loadConfig });
}

function notFound() { setTitle('Página não encontrada'); main.innerHTML = `<section class="wrap section">${emptyState('Página não encontrada', 'O endereço pode ter mudado.', '<a class="btn" href="#/">Voltar à loja</a>')}</section>`; }

// ---------------------------------------------------------------- inicializa
async function loadConfig() {
  state.config = await api('config');
  state.user = state.config.user;
  state.categories = state.config.categories || [];
  const s = state.config.store;
  $('#brand-name').textContent = s.name;
  $('#footer-tagline').textContent = s.tagline;
  const ann = $('#announcement');
  ann.hidden = !s.announcement;
  ann.textContent = s.announcement || '';
  renderNav();
}

$('#search-form').onsubmit = (e) => { e.preventDefault(); const q = $('#search-input').value.trim(); location.hash = '#/produtos' + (q ? '?q=' + encodeURIComponent(q) : ''); };
window.addEventListener('hashchange', route);
document.addEventListener('click', (e) => { const d = document.querySelector('details.account[open]'); if (d && !d.contains(e.target)) d.removeAttribute('open'); });

(async () => {
  try { await loadConfig(); } catch (e) {
    main.innerHTML = `<section class="wrap section">${emptyState('Loja indisponível', e.message)}</section>`; return;
  }
  if (!state.config.configured) {
    main.innerHTML = `<section class="wrap section">${emptyState('Loja em manutenção', 'Voltamos em instantes.')}</section>`; return;
  }
  route();
})();
