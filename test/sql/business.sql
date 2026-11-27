-- Testes das regras de negócio do banco. Rode num Postgres local com stubs
-- do Supabase: stubs → migração → seed → grants → este arquivo (ver CI).
\set QUIET on
do $$
declare
  u uuid; o orders; o2 orders; pid_ui uuid; pid_lic uuid; total int; lic text; ok boolean;
begin
  insert into auth.users(email, raw_user_meta_data) values ('a@x.com', '{"name":"Ana"}') returning id into u;
  assert (select name from profiles where id = u) = 'Ana', 'perfil criado pelo gatilho';
  select id into pid_ui  from products where slug = 'kit-ui-aurora';
  select id into pid_lic from products where slug = 'omega-backup-pro';

  -- pedido com cupom de 10%: 9790 + 7990 = 17780 → desconto 1778 → 16002
  o := create_order(u, array[pid_ui, pid_lic], 'bemvindo10', 'chave-idempotencia-0001');
  assert o.subtotal_cents = 17780 and o.discount_cents = 1778 and o.total_cents = 16002, 'cálculo com cupom';
  assert (select uses from coupons where code = 'BEMVINDO10') = 1, 'uso do cupom';
  -- idempotência: mesma chave devolve o mesmo pedido e não consome cupom de novo
  o2 := create_order(u, array[pid_ui], null, 'chave-idempotencia-0001');
  assert o2.id = o.id and (select uses from coupons where code = 'BEMVINDO10') = 1, 'idempotência';

  -- valor divergente não libera
  o2 := apply_payment(o.id, '111', 'approved', 100, '{}');
  assert o2.status = 'pending', 'valor divergente não aprova';
  assert exists (select 1 from audit_log where action = 'payment.amount_mismatch'), 'auditoria de divergência';

  -- aprovação correta libera, atribui licença e conta venda
  o2 := apply_payment(o.id, '222', 'approved', 16002, '{}');
  assert o2.status = 'paid' and o2.paid_at is not null, 'pagamento aprovado';
  assert owns_product(u, pid_ui) and owns_product(u, pid_lic), 'posse dos produtos';
  select code into lic from license_keys k join order_items i on i.id = k.order_item where i.order_id = o.id;
  assert lic like 'OMEGA-%', 'licença atribuída';
  assert (select count(*) from license_keys k join order_items i on i.id = k.order_item where i.order_id = o.id) = 1, 'licença só p/ produto com licença';
  assert (select sales_count from products where id = pid_ui) = 1, 'contador de vendas';

  -- webhook repetido é idempotente; "pending" atrasado não rebaixa pedido pago
  o2 := apply_payment(o.id, '222', 'approved', 16002, '{}');
  o2 := apply_payment(o.id, '222', 'pending', 16002, '{}');
  assert o2.status = 'paid' and (select sales_count from products where id = pid_ui) = 1, 'repetição idempotente';

  -- não pode comprar de novo o que já tem
  begin
    perform create_order(u, array[pid_ui], null, 'chave-idempotencia-0002');
    raise exception 'deveria falhar';
  exception when sqlstate '22023' then null; end;

  -- estorno revoga acesso
  o2 := apply_payment(o.id, '222', 'refunded', 16002, '{}');
  assert o2.status = 'refunded' and not owns_product(u, pid_ui), 'estorno revoga acesso';
  assert (select sales_count from products where id = pid_ui) = 0, 'estorno desconta venda';
  -- estorno é final
  o2 := apply_payment(o.id, '333', 'approved', 16002, '{}');
  assert o2.status = 'refunded', 'pedido estornado não volta a pago';

  -- recusado → aprovado depois (nova tentativa no mesmo checkout)
  o := create_order(u, array[pid_ui], '', 'chave-idempotencia-0003');
  o2 := apply_payment(o.id, '444', 'rejected', 9790, '{}');
  assert o2.status = 'rejected', 'recusado';
  o2 := apply_payment(o.id, '445', 'approved', 9790, '{}');
  assert o2.status = 'paid', 'aprovado após recusa';

  -- produto em rascunho não pode ser comprado; cupom inválido falha
  update products set status = 'draft' where slug = 'pack-lofi-beats';
  begin
    perform create_order(u, array[(select id from products where slug = 'pack-lofi-beats')], null, 'chave-idempotencia-0004');
    raise exception 'deveria falhar';
  exception when sqlstate '22023' then null; end;
  begin
    perform create_order(u, array[(select id from products where slug = 'curso-flutter-pro')], 'NAOEXISTE', 'chave-idempotencia-0005');
    raise exception 'deveria falhar';
  exception when sqlstate '22023' then null; end;

  -- avaliações atualizam a média
  insert into reviews(product_id, user_id, rating) values (pid_ui, u, 4);
  assert (select rating_avg from products where id = pid_ui) = 4.00 and (select rating_count from products where id = pid_ui) = 1, 'média de avaliações';
  raise notice 'business.sql: todos os testes passaram';
end $$;

-- RLS: usuário anônimo só enxerga o catálogo publicado
set role anon;
do $$ begin
  assert (select count(*) from products where status <> 'published') = 0, 'anon não vê rascunhos';
  assert (select count(*) from orders) = 0, 'anon não vê pedidos';
  assert (select count(*) from license_keys) = 0, 'anon não vê licenças';
  assert (select count(*) from coupons) = 0, 'anon não vê cupons';
  raise notice 'RLS: ok';
end $$;
reset role;
