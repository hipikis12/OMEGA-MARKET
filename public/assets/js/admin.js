// Painel administrativo (carregado sob demanda só para administradores).
import { api, uploadTo, esc, money, date, bytes } from './api.js';

const TABS = [['painel', 'Resumo'], ['produtos', 'Produtos'], ['pedidos', 'Pedidos'], ['cupons', 'Cupons'], ['loja', 'Ajustes']];

export async function renderAdmin(main, tab, ctx) {
  main.innerHTML = `<section class="wrap section admin"><div class="admin-head"><h1>Administração</h1>
    <nav class="tabs">${TABS.map(([k, l]) => `<a class="tab${k === tab ? ' on' : ''}" href="#/admin/${k}">${l}</a>`).join('')}</nav></div>
    <div id="admin-body"><p class="muted">Carregando…</p></div></section>`;
  const body = main.querySelector('#admin-body');
  const views = { painel: dashboard, produtos: products, pedidos: orders, cupons: coupons, loja: store };
  await (views[tab] || dashboard)(body, ctx);
}

async function dashboard(el, ctx) {
  const s = await api('admin/stats');
  el.innerHTML = `<div class="kpis">
    <div class="kpi"><span>Receita (30 dias)</span><b>${money(s.revenue_cents)}</b></div>
    <div class="kpi"><span>Pedidos pagos</span><b>${s.paid_orders}</b></div>
    <div class="kpi"><span>Pendentes</span><b>${s.pending_orders}</b></div>
    <div class="kpi"><span>Reembolsos</span><b>${s.refunded_orders}</b></div>
    <div class="kpi"><span>Produtos ativos</span><b>${s.products_published} / ${s.products_total}</b></div></div>
    ${ctx.state.config.payments ? '' : '<p class="notice">Pagamentos desativados: defina MP_ACCESS_TOKEN no Cloudflare Pages.</p>'}`;
}

// ---------------------------------------------------------------- produtos
async function products(el, ctx) {
  const { products: list } = await api('admin/products');
  el.innerHTML = `<div class="toolbar"><button class="btn" id="new">+ Novo produto</button><span class="muted">${list.length} produto(s)</span></div>
    <div class="table">${list.map((p) => `<div class="row">
      ${ctx.cover(p, 'cover-xs')}<span class="grow"><b>${esc(p.title)}</b><small class="muted">/${esc(p.slug)} · ${p.product_files.length} arquivo(s) · ${p.sales_count} venda(s)</small></span>
      <span class="status ${p.status === 'published' ? 'ok' : p.status === 'draft' ? 'warn' : 'muted'}">${{ published: 'Publicado', draft: 'Rascunho', archived: 'Arquivado' }[p.status]}</span>
      <b>${money(p.price_cents)}</b><button class="btn btn-ghost btn-sm" data-edit="${esc(p.id)}">Editar</button></div>`).join('') || '<p class="muted">Nenhum produto.</p>'}</div>
    <div id="editor"></div>`;
  el.querySelector('#new').onclick = () => editor(el, ctx, null);
  el.querySelectorAll('[data-edit]').forEach((b) => { b.onclick = () => editor(el, ctx, list.find((p) => p.id === b.dataset.edit)); });
}

function editor(el, ctx, p) {
  const box = el.querySelector('#editor');
  const cats = ctx.state.categories;
  const v = p || { title: '', slug: '', subtitle: '', description: '', category: cats[0] ? cats[0].slug : '', price_cents: 1990, compare_cents: null, delivery: 'download', status: 'draft', featured: false, features: [], product_files: [] };
  box.innerHTML = `<div class="panel editor"><h2 class="h3">${p ? 'Editar produto' : 'Novo produto'}</h2>
    <form id="pf" class="form-grid">
      <label class="span2">Título<input name="title" value="${esc(v.title)}" required minlength="3" maxlength="120"></label>
      <label>Endereço (slug)<input name="slug" value="${esc(v.slug)}" placeholder="gerado do título" pattern="[a-z0-9-]{3,80}"></label>
      <label>Categoria<select name="category"><option value="">—</option>${cats.map((c) => `<option value="${esc(c.slug)}"${c.slug === v.category ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <label class="span2">Subtítulo<input name="subtitle" value="${esc(v.subtitle)}" maxlength="200"></label>
      <label>Preço (R$)<input name="price" inputmode="decimal" value="${(v.price_cents / 100).toFixed(2).replace('.', ',')}" required></label>
      <label>Preço original (R$, opcional)<input name="compare" inputmode="decimal" value="${v.compare_cents ? (v.compare_cents / 100).toFixed(2).replace('.', ',') : ''}"></label>
      <label>Entrega<select name="delivery">${[['download', 'Download'], ['license', 'Chave de licença'], ['both', 'Download + licença']].map(([k, l]) => `<option value="${k}"${k === v.delivery ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <label>Status<select name="status">${[['draft', 'Rascunho'], ['published', 'Publicado'], ['archived', 'Arquivado']].map(([k, l]) => `<option value="${k}"${k === v.status ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="check"><input type="checkbox" name="featured"${v.featured ? ' checked' : ''}> Destaque na página inicial</label>
      <label class="span2">Itens inclusos (um por linha)<textarea name="features" rows="3">${esc((v.features || []).join('\n'))}</textarea></label>
      <label class="span2">Descrição<textarea name="description" rows="7" maxlength="20000">${esc(v.description)}</textarea></label>
      <div class="span2 actions"><button class="btn">Salvar</button>${p ? '<button type="button" class="btn btn-danger" id="del">Excluir/arquivar</button>' : ''}<button type="button" class="btn btn-ghost" id="close">Fechar</button></div>
    </form>
    ${p ? `<hr><h3>Capa</h3><div class="inline">${ctx.cover(p, 'cover-sm')}<input type="file" id="cover" accept="image/png,image/jpeg,image/webp,image/avif"></div>
      <h3>Arquivos entregues</h3><ul class="files">${p.product_files.map((f) => `<li><span>📦 ${esc(f.label)} <small class="muted">v${esc(f.version)} · ${bytes(f.size_bytes)}</small></span><span><a class="btn btn-ghost btn-sm" href="/api/download/${esc(f.id)}">Baixar</a> <button class="btn btn-danger btn-sm" data-delfile="${esc(f.id)}">Remover</button></span></li>`).join('') || '<li class="muted">Nenhum arquivo.</li>'}</ul>
      <form id="ff" class="inline wrap-inline"><input type="file" name="file" required><input name="label" placeholder="Nome exibido" maxlength="120"><input name="version" placeholder="Versão" value="1.0" maxlength="20"><button class="btn btn-sm">Enviar arquivo</button><progress id="prog" max="1" value="0" hidden></progress></form>
      ${v.delivery !== 'download' ? `<h3>Chaves de licença <small class="muted" id="lic-count"></small></h3><form id="lf" class="stack"><textarea name="codes" rows="4" placeholder="Uma chave por linha"></textarea><button class="btn btn-sm">Importar chaves</button></form>` : ''}` : '<p class="muted small">Salve o produto para enviar capa, arquivos e licenças.</p>'}
  </div>`;
  box.scrollIntoView({ behavior: 'smooth' });
  const reload = () => products(el, ctx);
  // "1.234,56" ou "1234,56" (vírgula decimal) e também "1234.56"
  const cents = (s) => { s = String(s).trim(); if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); const n = Math.round(Number(s) * 100); return Number.isFinite(n) ? n : NaN; };

  box.querySelector('#close').onclick = () => { box.innerHTML = ''; };
  box.querySelector('#pf').onsubmit = (e) => { e.preventDefault(); ctx.busy(e.submitter, async () => {
    const d = ctx.formData(e.target);
    const payload = {
      title: d.title, subtitle: d.subtitle, description: d.description, category: d.category || null,
      price_cents: cents(d.price), compare_cents: d.compare ? cents(d.compare) : null,
      delivery: d.delivery, status: d.status, featured: Boolean(d.featured),
      features: d.features.split('\n').map((x) => x.trim()).filter(Boolean),
      ...(d.slug ? { slug: d.slug } : {}),
    };
    if (p) await api('admin/products/' + p.id, { method: 'PATCH', body: payload });
    else await api('admin/products', { method: 'POST', body: payload });
    ctx.toast('Produto salvo'); await reload();
  }); };
  if (!p) return;

  box.querySelector('#del').onclick = (e) => { if (!confirm('Excluir este produto? Se já tiver vendas, ele será apenas arquivado.')) return; ctx.busy(e.target, async () => {
    const r = await api('admin/products/' + p.id, { method: 'DELETE' }); ctx.toast(r.archived ? 'Produto arquivado (possui vendas)' : 'Produto excluído'); await reload();
  }); };

  box.querySelector('#cover').onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) return ctx.toast('Imagem acima de 5 MB', 'error');
    try {
      const up = await api('admin/uploads', { method: 'POST', body: { product_id: p.id, filename: file.name, kind: 'image' } });
      await uploadTo(up.uploadUrl, file);
      await api('admin/products/' + p.id, { method: 'PATCH', body: { cover_url: up.publicUrl } });
      ctx.toast('Capa atualizada'); await reload();
    } catch (err) { ctx.toast(err.message, 'error'); }
  };

  box.querySelector('#ff').onsubmit = (e) => { e.preventDefault(); ctx.busy(e.submitter, async () => {
    const file = e.target.file.files[0];
    const d = ctx.formData(e.target);
    const prog = box.querySelector('#prog'); prog.hidden = false;
    const up = await api('admin/uploads', { method: 'POST', body: { product_id: p.id, filename: file.name, kind: 'file' } });
    await uploadTo(up.uploadUrl, file, (x) => { prog.value = x; });
    await api(`admin/products/${p.id}/files`, { method: 'POST', body: { path: up.path, label: d.label || file.name, size_bytes: file.size, version: d.version || '1.0' } });
    ctx.toast('Arquivo enviado'); await reload();
  }); };

  box.querySelectorAll('[data-delfile]').forEach((b) => { b.onclick = () => { if (!confirm('Remover este arquivo? Compradores perderão acesso a ele.')) return; ctx.busy(b, async () => {
    await api('admin/files/' + b.dataset.delfile, { method: 'DELETE' }); ctx.toast('Arquivo removido'); await reload();
  }); }; });

  const lf = box.querySelector('#lf');
  if (lf) {
    const count = () => api(`admin/products/${p.id}/licenses`).then((r) => { box.querySelector('#lic-count').textContent = `${r.available} disponíveis de ${r.total}`; }).catch(() => {});
    count();
    lf.onsubmit = (e) => { e.preventDefault(); ctx.busy(e.submitter, async () => {
      const codes = ctx.formData(e.target).codes.split('\n').map((x) => x.trim()).filter(Boolean);
      const r = await api(`admin/products/${p.id}/licenses`, { method: 'POST', body: { codes } });
      ctx.toast(`${r.added} chave(s) importada(s)`); e.target.reset(); count();
    }); };
  }
}

// ----------------------------------------------------------------- pedidos
async function orders(el, ctx, status = '') {
  const { orders: list } = await api('admin/orders' + (status ? '?status=' + status : ''));
  el.innerHTML = `<div class="toolbar"><select id="st"><option value="">Todos</option>${[['paid', 'Pagos'], ['pending', 'Pendentes'], ['rejected', 'Recusados'], ['cancelled', 'Cancelados'], ['refunded', 'Reembolsados'], ['charged_back', 'Contestados']].map(([s, l]) => `<option value="${s}"${s === status ? ' selected' : ''}>${l}</option>`).join('')}</select><span class="muted">${list.length} pedido(s)</span></div>
    <div class="table">${list.map((o) => `<div class="row"><span><b>#${esc(o.id.slice(0, 8).toUpperCase())}</b><small class="muted">${date(o.created_at)}</small></span>
      <span class="grow">${esc(o.order_items.map((i) => i.title).join(', '))}<small class="muted">${o.mp_payment_id ? 'MP ' + esc(o.mp_payment_id) + ' · ' + esc(o.mp_status || '') : 'sem pagamento'}${o.coupon_code ? ' · cupom ' + esc(o.coupon_code) : ''}</small></span>
      ${ctx.statusPill(o.status)}<b>${money(o.total_cents)}</b></div>`).join('') || '<p class="muted">Nenhum pedido.</p>'}</div>
    <p class="muted small">Reembolsos são feitos no Mercado Pago e atualizados aqui automaticamente.</p>`;
  el.querySelector('#st').onchange = (e) => orders(el, ctx, e.target.value);
}

// ------------------------------------------------------------------ cupons
async function coupons(el, ctx) {
  const { coupons: list } = await api('admin/coupons');
  el.innerHTML = `<form id="cf" class="panel inline wrap-inline"><input name="code" placeholder="CÓDIGO" required pattern="[A-Za-z0-9_-]{3,30}"><input name="percent" type="number" min="1" max="90" placeholder="% desconto" required><input name="days" type="number" min="1" max="730" value="30" placeholder="dias" required><input name="max_uses" type="number" min="1" value="100" placeholder="limite de usos" required><button class="btn btn-sm">Criar cupom</button></form>
    <div class="table">${list.map((c) => `<div class="row"><b>${esc(c.code)}</b><span class="grow">${c.percent}% · ${c.uses}/${c.max_uses} usos · até ${date(c.expires_at)}</span>
      <span class="status ${c.active && new Date(c.expires_at) > new Date() ? 'ok' : 'muted'}">${c.active ? 'Ativo' : 'Inativo'}</span><button class="btn btn-ghost btn-sm" data-toggle="${esc(c.code)}" data-active="${c.active ? '0' : '1'}">${c.active ? 'Desativar' : 'Ativar'}</button></div>`).join('') || '<p class="muted">Nenhum cupom.</p>'}</div>`;
  el.querySelector('#cf').onsubmit = (e) => { e.preventDefault(); ctx.busy(e.submitter, async () => {
    const d = ctx.formData(e.target);
    await api('admin/coupons', { method: 'POST', body: { code: d.code.toUpperCase(), percent: Number(d.percent), days: Number(d.days), max_uses: Number(d.max_uses) } });
    ctx.toast('Cupom criado'); await coupons(el, ctx);
  }); };
  el.querySelectorAll('[data-toggle]').forEach((b) => { b.onclick = () => ctx.busy(b, async () => {
    await api('admin/coupons/' + encodeURIComponent(b.dataset.toggle), { method: 'PATCH', body: { active: b.dataset.active === '1' } }); await coupons(el, ctx);
  }); });
}

// ---------------------------------------------------------------- loja
async function store(el, ctx) {
  const s = ctx.state.config.store;
  el.innerHTML = `<div class="panel"><h2 class="h3">Vitrine</h2><form id="sf" class="form-grid">
      <label>Nome da loja<input name="name" value="${esc(s.name)}" required maxlength="40"></label>
      <label>Slogan<input name="tagline" value="${esc(s.tagline)}" maxlength="80"></label>
      <label class="span2">Título do banner<input name="hero_title" value="${esc(s.hero_title)}" required maxlength="120"></label>
      <label class="span2">Texto do banner<textarea name="hero_text" rows="2" maxlength="300">${esc(s.hero_text)}</textarea></label>
      <label class="span2">Faixa de aviso (topo)<input name="announcement" value="${esc(s.announcement)}" maxlength="140"></label>
      <div class="span2 actions"><button class="btn">Salvar vitrine</button></div></form></div>
    <div class="panel"><h2 class="h3">Categorias</h2><div class="chips">${ctx.state.categories.map((c) => `<span class="chip">${esc(c.icon)} ${esc(c.name)} <button class="link" data-delcat="${esc(c.slug)}" aria-label="Remover ${esc(c.name)}">✕</button></span>`).join('')}</div>
      <form id="catf" class="inline"><input name="icon" placeholder="Ícone" maxlength="4" value="◆"><input name="name" placeholder="Nova categoria" required maxlength="40"><button class="btn btn-sm">Adicionar</button></form></div>`;
  el.querySelector('#sf').onsubmit = (e) => { e.preventDefault(); ctx.busy(e.submitter, async () => {
    await api('admin/settings', { method: 'PUT', body: ctx.formData(e.target) }); await ctx.reloadConfig(); ctx.toast('Vitrine atualizada');
  }); };
  el.querySelector('#catf').onsubmit = (e) => { e.preventDefault(); ctx.busy(e.submitter, async () => {
    await api('admin/categories', { method: 'POST', body: ctx.formData(e.target) }); await ctx.reloadConfig(); await store(el, ctx);
  }); };
  el.querySelectorAll('[data-delcat]').forEach((b) => { b.onclick = () => { if (!confirm('Remover categoria? Produtos ficarão sem categoria.')) return; ctx.busy(b, async () => {
    await api('admin/categories?slug=' + encodeURIComponent(b.dataset.delcat), { method: 'DELETE' }); await ctx.reloadConfig(); await store(el, ctx);
  }); }; });
}
