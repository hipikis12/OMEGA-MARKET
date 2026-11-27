-- OMEGA MARKET 6.0 — schema inicial para Supabase (PostgreSQL 15+)
-- Execute no SQL Editor do Supabase ou com `supabase db push`.
-- Modelo de segurança:
--   * O navegador NUNCA fala direto com o banco: toda escrita passa pelas
--     Cloudflare Pages Functions usando a chave secreta (service_role).
--   * Mesmo assim, RLS fica ATIVO em todas as tabelas, com leitura pública
--     apenas do que é público (catálogo) e leitura do próprio dono para
--     pedidos. Se a chave publishable/anon vazar, ela não escreve nada.
--   * Funções que mexem em dinheiro (create_order / apply_payment) rodam
--     como SECURITY DEFINER e só podem ser executadas pelo service_role.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- perfis
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null default '' check (char_length(name) <= 80),
  role        text not null default 'customer' check (role in ('customer','admin')),
  status      text not null default 'active'   check (status in ('active','suspended')),
  created_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, name)
  values (new.id, coalesce(left(new.raw_user_meta_data->>'name', 80), ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------- catálogo
create table public.categories (
  slug        text primary key check (slug ~ '^[a-z0-9-]{2,40}$'),
  name        text not null check (char_length(name) between 2 and 40),
  icon        text not null default '◆',
  position    int  not null default 0
);

create table public.products (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  title           text not null check (char_length(title) between 3 and 120),
  subtitle        text not null default '' check (char_length(subtitle) <= 200),
  description     text not null default '' check (char_length(description) <= 20000),
  category        text references public.categories(slug) on update cascade on delete set null,
  price_cents     int  not null check (price_cents between 100 and 10000000),
  compare_cents   int  check (compare_cents is null or compare_cents > price_cents),
  cover_url       text check (cover_url is null or cover_url ~ '^https://'),
  delivery        text not null default 'download' check (delivery in ('download','license','both')),
  features        text[] not null default '{}',
  status          text not null default 'draft' check (status in ('draft','published','archived')),
  featured        boolean not null default false,
  sales_count     int  not null default 0,
  rating_avg      numeric(3,2) not null default 0,
  rating_count    int  not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index products_status_idx   on public.products(status, featured desc, created_at desc);
create index products_category_idx on public.products(category) where status = 'published';

-- Arquivos entregues após o pagamento (bucket PRIVADO "product-files")
create table public.product_files (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete cascade,
  label         text not null check (char_length(label) between 1 and 120),
  storage_path  text not null unique,
  size_bytes    bigint not null default 0,
  version       text not null default '1.0',
  created_at    timestamptz not null default now()
);
create index product_files_product_idx on public.product_files(product_id);

-- Chaves de licença em estoque, atribuídas atomicamente no pagamento
create table public.license_keys (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  code        text not null unique,
  order_item  uuid unique,
  assigned_at timestamptz
);
create index license_keys_free_idx on public.license_keys(product_id) where order_item is null;

create table public.coupons (
  code        text primary key check (code ~ '^[A-Z0-9_-]{3,30}$'),
  percent     int  not null check (percent between 1 and 90),
  expires_at  timestamptz not null,
  max_uses    int  not null check (max_uses > 0),
  uses        int  not null default 0,
  active      boolean not null default true
);

-- --------------------------------------------------------------- pedidos
create table public.orders (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete restrict,
  status            text not null default 'pending'
                    check (status in ('pending','paid','rejected','cancelled','refunded','charged_back')),
  subtotal_cents    int not null,
  discount_cents    int not null default 0,
  total_cents       int not null check (total_cents > 0),
  coupon_code       text references public.coupons(code),
  idempotency_key   text not null,
  mp_preference_id  text,
  mp_init_point     text,
  mp_payment_id     text unique,
  mp_status         text,
  paid_at           timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index orders_user_idx on public.orders(user_id, created_at desc);

create table public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  product_id   uuid not null references public.products(id) on delete restrict,
  title        text not null,      -- snapshot do título no momento da compra
  price_cents  int  not null,      -- snapshot do preço cobrado
  unique (order_id, product_id)
);
alter table public.license_keys
  add constraint license_keys_item_fk foreign key (order_item) references public.order_items(id) on delete set null;

-- Registro idempotente de notificações do Mercado Pago
create table public.payment_events (
  id           bigint generated always as identity primary key,
  order_id     uuid references public.orders(id) on delete set null,
  payment_id   text not null,
  status       text not null,
  amount_cents int,
  raw          jsonb,
  created_at   timestamptz not null default now(),
  unique (payment_id, status)
);

create table public.reviews (
  product_id  uuid not null references public.products(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  author      text not null default 'Cliente',
  rating      int  not null check (rating between 1 and 5),
  comment     text not null default '' check (char_length(comment) <= 1000),
  created_at  timestamptz not null default now(),
  primary key (product_id, user_id)
);

create table public.download_log (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  file_id     uuid not null references public.product_files(id) on delete cascade,
  ip          text,
  created_at  timestamptz not null default now()
);
create index download_log_user_idx on public.download_log(user_id, created_at desc);

create table public.settings (
  key    text primary key,
  value  jsonb not null
);

create table public.audit_log (
  id          bigint generated always as identity primary key,
  actor       uuid,
  action      text not null,
  target      text,
  detail      jsonb,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------- gatilhos
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();
create trigger orders_touch   before update on public.orders   for each row execute function public.touch_updated_at();

create or replace function public.refresh_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid := coalesce(new.product_id, old.product_id);
begin
  update products set
    rating_avg   = coalesce((select round(avg(rating)::numeric, 2) from reviews where product_id = pid), 0),
    rating_count = (select count(*) from reviews where product_id = pid)
  where id = pid;
  return null;
end $$;
create trigger reviews_rating after insert or update or delete on public.reviews
  for each row execute function public.refresh_rating();

-- ------------------------------------------------------- regras de negócio
-- Cria um pedido com preços calculados NO BANCO (nunca confia no navegador).
-- Repetir a mesma idempotency_key devolve o mesmo pedido.
create or replace function public.create_order(p_user uuid, p_product_ids uuid[], p_coupon text, p_key text)
returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  existing  orders;
  o         orders;
  v_sub     int;
  v_count   int;
  v_pct     int := 0;
  v_coupon  text := nullif(upper(trim(coalesce(p_coupon, ''))), '');
begin
  if p_key is null or char_length(p_key) not between 16 and 80 then
    raise exception 'idempotency_key inválida' using errcode = '22023';
  end if;

  select * into existing from orders where user_id = p_user and idempotency_key = p_key;
  if found then return existing; end if;

  if coalesce(array_length(p_product_ids, 1), 0) not between 1 and 30 then
    raise exception 'Carrinho vazio ou grande demais' using errcode = '22023';
  end if;

  select count(*), coalesce(sum(price_cents), 0) into v_count, v_sub
  from products where id = any(p_product_ids) and status = 'published';
  if v_count <> (select count(distinct x) from unnest(p_product_ids) x) then
    raise exception 'Algum produto não está disponível' using errcode = '22023';
  end if;

  if exists (select 1 from order_items i join orders o2 on o2.id = i.order_id
             where o2.user_id = p_user and o2.status = 'paid' and i.product_id = any(p_product_ids)) then
    raise exception 'Você já possui um dos produtos do carrinho' using errcode = '22023';
  end if;

  if v_coupon is not null then
    update coupons set uses = uses + 1
    where code = v_coupon and active and expires_at > now() and uses < max_uses
    returning percent into v_pct;
    if not found then
      raise exception 'Cupom inválido, expirado ou esgotado' using errcode = '22023';
    end if;
  end if;

  insert into orders(user_id, subtotal_cents, discount_cents, total_cents, coupon_code, idempotency_key)
  values (p_user, v_sub, (v_sub * v_pct) / 100, v_sub - (v_sub * v_pct) / 100, v_coupon, p_key)
  returning * into o;

  insert into order_items(order_id, product_id, title, price_cents)
  select o.id, p.id, p.title, p.price_cents from products p where p.id = any(p_product_ids);

  return o;
end $$;

-- Aplica um pagamento JÁ CONFIRMADO na API do Mercado Pago (não confia no
-- corpo do webhook). Idempotente; atribui licenças no momento da aprovação.
create or replace function public.apply_payment(p_order uuid, p_payment_id text, p_status text, p_amount_cents int, p_raw jsonb)
returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  o        orders;
  v_new    text;
  it       record;
begin
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'Pedido inexistente' using errcode = 'P0002'; end if;

  insert into payment_events(order_id, payment_id, status, amount_cents, raw)
  values (p_order, p_payment_id, p_status, p_amount_cents, p_raw)
  on conflict (payment_id, status) do nothing;

  v_new := case p_status
    when 'approved'     then 'paid'
    when 'refunded'     then 'refunded'
    when 'charged_back' then 'charged_back'
    when 'rejected'     then 'rejected'
    when 'cancelled'    then 'cancelled'
    else null end;   -- pending / in_process / authorized: só registra

  if p_status = 'approved' and p_amount_cents <> o.total_cents then
    insert into audit_log(action, target, detail)
    values ('payment.amount_mismatch', p_order::text, jsonb_build_object('payment', p_payment_id, 'amount', p_amount_cents, 'expected', o.total_cents));
    return o;
  end if;

  -- um pedido pago só sai de "paid" por estorno/chargeback
  if v_new is null
     or (o.status = 'paid' and v_new not in ('refunded','charged_back'))
     or (o.status in ('refunded','charged_back'))
     or (o.status = v_new) then
    update orders set mp_status = p_status where id = p_order returning * into o;
    return o;
  end if;

  update orders set
    status        = v_new,
    mp_status     = p_status,
    mp_payment_id = coalesce(mp_payment_id, p_payment_id),
    paid_at       = case when v_new = 'paid' then now() else paid_at end
  where id = p_order returning * into o;

  if v_new = 'paid' then
    for it in select i.id, i.product_id from order_items i where i.order_id = p_order loop
      update products set sales_count = sales_count + 1 where id = it.product_id;
      update license_keys set order_item = it.id, assigned_at = now()
      where id = (select id from license_keys where product_id = it.product_id and order_item is null
                  order by id limit 1 for update skip locked)
        and exists (select 1 from products where id = it.product_id and delivery in ('license','both'));
    end loop;
  elsif v_new in ('refunded','charged_back') then
    update products p set sales_count = greatest(sales_count - 1, 0)
    from order_items i where i.order_id = p_order and i.product_id = p.id;
  end if;

  insert into audit_log(action, target, detail)
  values ('order.' || v_new, p_order::text, jsonb_build_object('payment', p_payment_id));
  return o;
end $$;

-- Usuário tem direito ao produto? (pedido pago)
create or replace function public.owns_product(p_user uuid, p_product uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from order_items i join orders o on o.id = i.order_id
                 where o.user_id = p_user and o.status = 'paid' and i.product_id = p_product);
$$;

revoke all on function public.create_order(uuid, uuid[], text, text)            from public, anon, authenticated;
revoke all on function public.apply_payment(uuid, text, text, int, jsonb)        from public, anon, authenticated;
revoke all on function public.owns_product(uuid, uuid)                           from public, anon, authenticated;
grant execute on function public.create_order(uuid, uuid[], text, text)          to service_role;
grant execute on function public.apply_payment(uuid, text, text, int, jsonb)     to service_role;
grant execute on function public.owns_product(uuid, uuid)                        to service_role;

-- ------------------------------------------------------------------ RLS
alter table public.profiles       enable row level security;
alter table public.categories     enable row level security;
alter table public.products       enable row level security;
alter table public.product_files  enable row level security;
alter table public.license_keys   enable row level security;
alter table public.coupons        enable row level security;
alter table public.orders         enable row level security;
alter table public.order_items    enable row level security;
alter table public.payment_events enable row level security;
alter table public.reviews        enable row level security;
alter table public.download_log   enable row level security;
alter table public.settings       enable row level security;
alter table public.audit_log      enable row level security;

create policy "catálogo público"     on public.categories for select using (true);
create policy "produtos publicados"  on public.products   for select using (status = 'published');
create policy "avaliações públicas"  on public.reviews    for select using (true);
create policy "configurações públicas" on public.settings for select using (key like 'public.%');
create policy "meu perfil"           on public.profiles   for select using (auth.uid() = id);
create policy "meus pedidos"         on public.orders     for select using (auth.uid() = user_id);
create policy "itens dos meus pedidos" on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
-- Demais tabelas: sem política = nenhum acesso para anon/authenticated.

-- -------------------------------------------------------------- storage
insert into storage.buckets (id, name, public, file_size_limit)
values ('product-files',  'product-files',  false, 524288000),  -- 500 MB, privado
       ('product-images', 'product-images', true,  5242880)     -- 5 MB, público
on conflict (id) do nothing;
-- Nenhuma policy em storage.objects para product-files: só o service_role
-- gera URLs assinadas de upload/download.

insert into public.settings(key, value) values
  ('public.store', jsonb_build_object(
     'name', 'OMEGA MARKET',
     'tagline', 'O universo digital ao seu alcance',
     'hero_title', 'Produtos digitais prontos para acelerar seus projetos',
     'hero_text', 'Templates, e-books, cursos, softwares e licenças com entrega imediata após a confirmação do pagamento.',
     'announcement', 'Pagamento seguro via Mercado Pago · Pix, cartão e boleto'))
on conflict (key) do nothing;
