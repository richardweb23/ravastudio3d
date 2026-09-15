begin;

-- Reserva todos os bloqueios antes do primeiro ALTER TABLE.
-- NOWAIT impede esperar por outra transação mantendo apenas parte dos bloqueios.
-- Cada tentativa usa uma subtransação: em caso de conflito, seus locks são liberados.
set local lock_timeout = '2s';
do $migration_locks$
declare tentativa integer;
begin
  for tentativa in 1..20 loop
    begin
      lock table public.materiais, public.locais_estoque, public.vendedores,
        public.estoque_por_local, public.vendas in access exclusive mode nowait;
      -- As novas chaves estrangeiras precisam deste bloqueio na tabela de usuários.
      lock table auth.users in share row exclusive mode nowait;
      exit;
    exception when lock_not_available then
      if tentativa = 20 then
        raise exception using errcode = '55P03',
          message = 'O banco está ocupado. Nenhuma alteração desta migração foi aplicada. Aguarde as operações em andamento e execute o arquivo completo novamente.';
      end if;
      perform pg_sleep(0.25);
    end;
  end loop;
end;
$migration_locks$;


alter table public.locais_estoque add column observacoes text;
alter table public.vendedores add column endereco text, add column observacoes text,
  add column local_estoque_id uuid unique references public.locais_estoque(id) on delete restrict;
alter table public.materiais add column imagem_url text;

create table public.consignacao_produtos (
  local_id uuid not null references public.locais_estoque(id) on delete restrict,
  material_id uuid not null references public.materiais(id) on delete restrict,
  preco_centavos bigint not null check (preco_centavos between 0 and 1000000000),
  repasse_centavos bigint not null check (repasse_centavos between 0 and 1000000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(local_id, material_id)
);
create trigger consignacao_produtos_updated before update on public.consignacao_produtos
for each row execute function public.set_updated_at();

create table public.consignacao_movimentos (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references public.locais_estoque(id) on delete restrict,
  material_id uuid not null references public.materiais(id) on delete restrict,
  tipo text not null check (tipo in ('entrada', 'venda', 'retirada', 'ajuste', 'saldo_inicial')),
  quantidade numeric(14,3) not null check (quantidade <> 0),
  saldo_apos numeric(14,3) not null check (saldo_apos >= 0),
  observacoes text,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index consignacao_movimentos_local on public.consignacao_movimentos(local_id, created_at desc);

create table public.consignacao_pagamentos (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references public.locais_estoque(id) on delete restrict,
  valor_centavos bigint not null check(valor_centavos > 0),
  data_pagamento date not null,
  observacoes text,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, local_id)
);
create table public.consignacao_vendas (
  id uuid primary key references public.vendas(id) on delete restrict,
  local_id uuid not null references public.locais_estoque(id) on delete restrict,
  material_id uuid not null references public.materiais(id) on delete restrict,
  quantidade numeric(14,3) not null check(quantidade > 0),
  preco_unitario_centavos bigint not null check(preco_unitario_centavos >= 0),
  total_centavos bigint not null check(total_centavos >= 0),
  repasse_unitario_centavos bigint not null check(repasse_unitario_centavos >= 0),
  repasse_total_centavos bigint not null check(repasse_total_centavos >= 0),
  data date not null,
  acordo_registrado boolean not null default true,
  pagamento_id uuid,
  created_at timestamptz not null default now(),
  foreign key(pagamento_id, local_id) references public.consignacao_pagamentos(id, local_id) on delete restrict
);
create index consignacao_vendas_local on public.consignacao_vendas(local_id, data desc);
create index consignacao_vendas_pendentes on public.consignacao_vendas(local_id) where pagamento_id is null;
create index consignacao_pagamentos_local on public.consignacao_pagamentos(local_id, data_pagamento desc);

-- O saldo anterior é um ponto de partida, não uma reconstrução de envios antigos.
insert into public.consignacao_movimentos(local_id, material_id, tipo, quantidade, saldo_apos, observacoes)
select local_id, material_id, 'saldo_inicial', quantidade, quantidade,
  'Saldo existente na implantação do histórico. Envios anteriores não foram reconstruídos.'
from public.estoque_por_local where quantidade > 0;
-- Nenhum acordo de repasse é presumido para vendas anteriores.
insert into public.consignacao_vendas(id, local_id, material_id, quantidade, preco_unitario_centavos,
  total_centavos, repasse_unitario_centavos, repasse_total_centavos, data, acordo_registrado, created_at)
select id, local_estoque_id, material_id, quantidade, round(preco_unitario * 100)::bigint,
  round(preco_unitario * quantidade * 100)::bigint, 0, 0, data, false, created_at
from public.vendas;

create function public.auditar_estoque_consignacao() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_delta numeric; v_tipo text; v_local uuid; v_material uuid; v_saldo numeric;
begin
  v_local := case when tg_op = 'DELETE' then old.local_id else new.local_id end;
  v_material := case when tg_op = 'DELETE' then old.material_id else new.material_id end;
  v_saldo := case when tg_op = 'DELETE' then 0 else new.quantidade end;
  v_delta := v_saldo - case when tg_op = 'INSERT' then 0 else old.quantidade end;
  if v_delta = 0 then return null; end if;
  v_tipo := nullif(current_setting('app.consignacao_tipo', true), '');
  if v_tipo = 'transferencia' then v_tipo := case when v_delta > 0 then 'entrada' else 'retirada' end; end if;
  if v_tipo is null then v_tipo := 'ajuste'; end if;
  insert into public.consignacao_movimentos(local_id, material_id, tipo, quantidade, saldo_apos, observacoes, criado_por)
  values(v_local, v_material, v_tipo, v_delta, v_saldo,
    coalesce(nullif(current_setting('app.consignacao_nota', true), ''), 'Movimentação registrada no sistema'), auth.uid());
  return null;
end; $$;
create trigger consignacao_estoque_audit after insert or update or delete on public.estoque_por_local
for each row execute function public.auditar_estoque_consignacao();

create function public.capturar_repasse_venda() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_repasse bigint; v_acordo boolean;
begin
  select repasse_centavos into v_repasse from public.consignacao_produtos
  where local_id = new.local_estoque_id and material_id = new.material_id;
  v_acordo := found;
  insert into public.consignacao_vendas(id, local_id, material_id, quantidade, preco_unitario_centavos,
    total_centavos, repasse_unitario_centavos, repasse_total_centavos, data, acordo_registrado, created_at)
  values(new.id, new.local_estoque_id, new.material_id, new.quantidade, round(new.preco_unitario * 100)::bigint,
    round(new.preco_unitario * new.quantidade * 100)::bigint, coalesce(v_repasse, 0),
    round(coalesce(v_repasse, 0) * new.quantidade)::bigint, new.data, v_acordo, new.created_at);
  return null;
end; $$;
create trigger consignacao_venda_snapshot after insert on public.vendas
for each row execute function public.capturar_repasse_venda();

create function public.proteger_venda_consignacao() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'O histórico de vendas é permanente. Não é permitido editar ou excluir uma venda registrada.';
end; $$;
create trigger consignacao_venda_imutavel before update or delete on public.vendas
for each row execute function public.proteger_venda_consignacao();


create function public.proteger_vinculo_consignacao() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.local_estoque_id is not null and (tg_op = 'DELETE' or new.local_estoque_id is distinct from old.local_estoque_id) then
    raise exception 'O vínculo de consignação deve ser preservado. Desative o vendedor para manter seu histórico.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end; $$;
create trigger consignacao_vendedor_vinculo before update or delete on public.vendedores
for each row execute function public.proteger_vinculo_consignacao();
revoke all on function public.proteger_vinculo_consignacao() from public, anon, authenticated;

create function public.vincular_local_vendedor(p_vendedor_id uuid, p_local_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_vendedor public.vendedores%rowtype; v_local uuid;
begin
  if not public.usuario_ativo() then raise exception 'Acesso não autorizado'; end if;
  select * into v_vendedor from public.vendedores where id = p_vendedor_id for update;
  if not found then raise exception 'Vendedor não encontrado'; end if;
  if not v_vendedor.ativo then raise exception 'Vendedor inativo'; end if;
  if v_vendedor.local_estoque_id is not null then raise exception 'Este vendedor já possui um local vinculado'; end if;
  if p_local_id is null then
    insert into public.locais_estoque(nome, tipo, responsavel, telefone, endereco)
    values('Consignação · ' || v_vendedor.nome || ' · ' || left(v_vendedor.id::text, 8), 'vendedor',
      v_vendedor.nome, v_vendedor.telefone, v_vendedor.endereco) returning id into v_local;
  else
    perform 1 from public.locais_estoque where id = p_local_id and ativo for update;
    if not found then raise exception 'Local não encontrado ou inativo'; end if;
    if exists(select 1 from public.vendedores where local_estoque_id = p_local_id) then raise exception 'Local já vinculado a outro vendedor'; end if;
    v_local := p_local_id;
  end if;
  update public.vendedores set local_estoque_id = v_local where id = p_vendedor_id;
  return v_local;
end; $$;

create function public.salvar_acordo_consignacao(p_local_id uuid, p_material_id uuid, p_preco_centavos bigint, p_repasse_centavos bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.usuario_ativo() then raise exception 'Acesso não autorizado'; end if;
  if p_preco_centavos is null or p_repasse_centavos is null or p_preco_centavos not between 0 and 1000000000 or p_repasse_centavos not between 0 and 1000000000 then raise exception 'Preço ou repasse inválido'; end if;
  perform 1 from public.locais_estoque where id = p_local_id and ativo
    and not exists(select 1 from public.vendedores where local_estoque_id=p_local_id and not ativo);
  if not found then raise exception 'Local não encontrado ou inativo'; end if;
  perform 1 from public.materiais where id = p_material_id for update;
  if not found then raise exception 'Produto não encontrado'; end if;
  insert into public.consignacao_produtos(local_id, material_id, preco_centavos, repasse_centavos)
  values(p_local_id, p_material_id, p_preco_centavos, p_repasse_centavos)
  on conflict(local_id, material_id) do update set preco_centavos = excluded.preco_centavos, repasse_centavos = excluded.repasse_centavos;
end; $$;

create function public.movimentar_consignacao(p_local_id uuid, p_material_id uuid, p_tipo text,
  p_quantidade numeric, p_outro_local_id uuid default null, p_observacoes text default null,
  p_preco_centavos bigint default null, p_repasse_centavos bigint default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_delta numeric;
begin
  if not public.usuario_ativo() then raise exception 'Acesso não autorizado'; end if;
  if p_tipo is null or p_tipo not in ('entrada', 'retirada', 'ajuste') then raise exception 'Tipo de movimentação inválido'; end if;
  if p_quantidade is null or p_quantidade = 0 or abs(p_quantidade) > 1000000 or p_quantidade <> trunc(p_quantidade) then raise exception 'Informe uma quantidade inteira válida'; end if;
  if p_tipo <> 'ajuste' and p_quantidade < 0 then raise exception 'Quantidade deve ser positiva'; end if;
  if p_tipo = 'ajuste' and nullif(btrim(p_observacoes), '') is null then raise exception 'Informe o motivo do ajuste'; end if;
  perform 1 from public.locais_estoque where id = p_local_id and ativo
    and not exists(select 1 from public.vendedores where local_estoque_id=p_local_id and not ativo);
  if not found then raise exception 'Local não encontrado ou inativo'; end if;
  perform 1 from public.materiais where id = p_material_id for update;
  if not found then raise exception 'Produto não encontrado'; end if;
  if p_preco_centavos is not null or p_repasse_centavos is not null then
    perform public.salvar_acordo_consignacao(p_local_id, p_material_id, p_preco_centavos, p_repasse_centavos);
  end if;
  if p_tipo = 'entrada' and not exists(select 1 from public.consignacao_produtos where local_id=p_local_id and material_id=p_material_id) then raise exception 'Configure o preço e o repasse deste produto'; end if;
  perform set_config('app.consignacao_nota', coalesce(nullif(btrim(p_observacoes), ''), case when p_tipo='entrada' then 'Envio para consignação' when p_tipo='retirada' then 'Devolução para RAVA' else 'Ajuste de estoque' end), true);
  if p_tipo in ('entrada', 'retirada') then
    if p_outro_local_id is null or p_outro_local_id = p_local_id then raise exception 'Selecione outro local de origem/destino'; end if;
    perform 1 from public.locais_estoque where id = p_outro_local_id and ativo;
    if not found then raise exception 'Local de origem/destino indisponível'; end if;
    if p_tipo = 'entrada' then perform public.transferir_estoque(p_material_id, p_outro_local_id, p_local_id, p_quantidade);
    else perform public.transferir_estoque(p_material_id, p_local_id, p_outro_local_id, p_quantidade); end if;
  else
    perform set_config('app.consignacao_tipo', 'ajuste', true);
    v_delta := p_quantidade;
    insert into public.estoque_por_local(material_id, local_id, quantidade)
      values(p_material_id, p_local_id, 0) on conflict do nothing;
    update public.estoque_por_local set quantidade=quantidade+v_delta, updated_at=now()
    where material_id=p_material_id and local_id=p_local_id and quantidade+v_delta>=0;
    if not found then raise exception 'Saldo insuficiente para o ajuste'; end if;
  end if;
end; $$;

create function public.vender_consignacao(p_local_id uuid, p_material_id uuid, p_quantidade numeric, p_preco_centavos bigint, p_data date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_vendedor uuid; v_id uuid;
begin
  if not public.usuario_ativo() then raise exception 'Acesso não autorizado'; end if;
  if p_quantidade is null or p_quantidade <= 0 or p_quantidade > 1000000 or p_quantidade <> trunc(p_quantidade) then raise exception 'Informe uma quantidade inteira positiva'; end if;
  if p_preco_centavos is null or p_preco_centavos not between 0 and 1000000000 then raise exception 'Preço inválido'; end if;
  if p_data is null or p_data > current_date then raise exception 'Data da venda inválida'; end if;
  perform 1 from public.locais_estoque where id = p_local_id and ativo
    and not exists(select 1 from public.vendedores where local_estoque_id=p_local_id and not ativo);
  if not found then raise exception 'Local não encontrado ou inativo'; end if;
  perform 1 from public.materiais where id=p_material_id for update;
  if not exists(select 1 from public.consignacao_produtos where local_id=p_local_id and material_id=p_material_id) then raise exception 'Configure o acordo deste produto antes de vender'; end if;
  select id into v_vendedor from public.vendedores where local_estoque_id=p_local_id;
  perform set_config('app.consignacao_nota', 'Venda em consignação', true);
  v_id := public.registrar_venda(p_material_id, p_local_id, v_vendedor, p_quantidade, p_preco_centavos::numeric/100, p_data);
  return v_id;
end; $$;

create function public.pagar_repasses_consignacao(p_local_id uuid, p_vendas_ids uuid[], p_data date, p_observacoes text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_total bigint; v_count integer; v_id uuid;
begin
  if not public.usuario_ativo() then raise exception 'Acesso não autorizado'; end if;
  if p_data is null or p_data > current_date then raise exception 'Data do pagamento inválida'; end if;
  if coalesce(cardinality(p_vendas_ids), 0) = 0 then raise exception 'Selecione as vendas que serão pagas'; end if;
  if cardinality(p_vendas_ids) <> (select count(distinct x) from unnest(p_vendas_ids) x) then raise exception 'Vendas repetidas'; end if;
  -- Ordem estável e trava por venda impedem pagamentos concorrentes duplicados.
  perform 1 from public.consignacao_vendas where id=any(p_vendas_ids) order by id for update;
  select count(*), sum(repasse_total_centavos) into v_count, v_total from public.consignacao_vendas
    where id=any(p_vendas_ids) and local_id=p_local_id and pagamento_id is null and repasse_total_centavos>0 and data<=p_data;
  if v_count <> cardinality(p_vendas_ids) then raise exception 'Seleção inválida: venda de outro local, já paga, sem repasse ou posterior ao pagamento'; end if;
  insert into public.consignacao_pagamentos(local_id, valor_centavos, data_pagamento, observacoes, criado_por)
    values(p_local_id, v_total, p_data, nullif(btrim(p_observacoes), ''), auth.uid()) returning id into v_id;
  update public.consignacao_vendas set pagamento_id=v_id where id=any(p_vendas_ids);
  return v_id;
end; $$;

create or replace function public.transferir_estoque(
  p_material_id uuid,
  p_origem_id uuid,
  p_destino_id uuid,
  p_quantidade numeric
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('app.consignacao_tipo', 'transferencia', true);
  if not public.usuario_ativo() then raise exception 'Acesso não autorizado'; end if;
  if p_origem_id = p_destino_id then raise exception 'Escolha locais diferentes'; end if;
  if coalesce(p_quantidade, 0) <= 0 then raise exception 'Informe uma quantidade válida'; end if;
  perform 1 from public.materiais where id = p_material_id for update;
  if not found then raise exception 'Produto não encontrado'; end if;
  update public.estoque_por_local
  set quantidade = quantidade - p_quantidade, updated_at = now()
  where material_id = p_material_id and local_id = p_origem_id
    and quantidade >= p_quantidade;
  if not found then raise exception 'Saldo insuficiente no local de origem'; end if;
  insert into public.estoque_por_local (material_id, local_id, quantidade)
  values (p_material_id, p_destino_id, p_quantidade)
  on conflict (material_id, local_id)
  do update set quantidade = public.estoque_por_local.quantidade + excluded.quantidade,
                updated_at = now();
end;
$$;

create or replace function public.registrar_entrada(
  p_material_id uuid,
  p_local_id uuid,
  p_fornecedor text,
  p_quantidade numeric,
  p_custo_unitario numeric,
  p_data date
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_total numeric;
  v_custo numeric;
  v_novo_custo numeric;
begin
  perform set_config('app.consignacao_tipo', 'entrada', true);
  if not public.usuario_ativo() then raise exception 'Acesso não autorizado'; end if;
  if coalesce(p_quantidade, 0) <= 0 or coalesce(p_custo_unitario, -1) < 0 then
    raise exception 'Quantidade ou custo inválido';
  end if;
  select quantidade_atual, custo_medio into v_total, v_custo
  from public.materiais where id = p_material_id for update;
  if not found then raise exception 'Produto não encontrado'; end if;
  v_novo_custo := case
    when v_total + p_quantidade = 0 then 0
    else ((v_total * v_custo) + (p_quantidade * p_custo_unitario)) / (v_total + p_quantidade)
  end;
  insert into public.estoque_por_local (material_id, local_id, quantidade)
  values (p_material_id, p_local_id, p_quantidade)
  on conflict (material_id, local_id)
  do update set quantidade = public.estoque_por_local.quantidade + excluded.quantidade,
                updated_at = now();
  update public.materiais set custo_medio = v_novo_custo where id = p_material_id;
  insert into public.compras (
    material_id, local_estoque_id, fornecedor, quantidade, custo_unitario, data
  ) values (
    p_material_id, p_local_id, nullif(trim(p_fornecedor), ''),
    p_quantidade, p_custo_unitario, coalesce(p_data, current_date)
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.registrar_venda(
  p_material_id uuid,
  p_local_id uuid,
  p_vendedor_id uuid,
  p_quantidade numeric,
  p_preco_unitario numeric,
  p_data date
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare v_id uuid;
begin
  perform set_config('app.consignacao_tipo', 'venda', true);
  if not public.usuario_ativo() then raise exception 'Acesso não autorizado'; end if;
  if coalesce(p_quantidade, 0) <= 0 or coalesce(p_preco_unitario, -1) < 0 then
    raise exception 'Quantidade ou preço inválido';
  end if;
  perform 1 from public.materiais where id = p_material_id for update;
  if not found then raise exception 'Produto não encontrado'; end if;
  update public.estoque_por_local
  set quantidade = quantidade - p_quantidade, updated_at = now()
  where material_id = p_material_id and local_id = p_local_id
    and quantidade >= p_quantidade;
  if not found then raise exception 'Estoque insuficiente no local selecionado'; end if;
  insert into public.vendas (
    material_id, local_estoque_id, vendedor_id, quantidade, preco_unitario, data
  ) values (
    p_material_id, p_local_id, p_vendedor_id, p_quantidade,
    p_preco_unitario, coalesce(p_data, current_date)
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.alterar_status_pedido(
  p_pedido_id uuid,
  p_status public.status_pedido
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_pedido public.pedidos%rowtype;
  v_local_id uuid;
  v_item record;
begin
  perform set_config('app.consignacao_tipo', 'venda', true);
  if not public.usuario_ativo() then raise exception 'Acesso não autorizado'; end if;
  if p_status is null then raise exception 'Informe um status válido'; end if;
  select * into v_pedido from public.pedidos where id = p_pedido_id for update;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if v_pedido.status = 'entregue' then
    raise exception 'O pedido já foi entregue e não pode mudar de status';
  end if;
  if p_status <> 'entregue' then
    update public.pedidos set status = p_status where id = p_pedido_id;
    return;
  end if;
  v_local_id := coalesce(
    v_pedido.local_estoque_id,
    (select id from public.locais_estoque where tipo = 'principal' and ativo order by created_at limit 1)
  );
  if v_local_id is null then raise exception 'Nenhum local principal está configurado'; end if;
  if not exists (select 1 from public.pedido_itens where pedido_id = p_pedido_id) then
    raise exception 'O pedido não possui itens';
  end if;
  for v_item in
    select material_id, sum(quantidade) as quantidade
    from public.pedido_itens where pedido_id = p_pedido_id
    group by material_id order by material_id
  loop
    perform 1 from public.materiais where id = v_item.material_id for update;
    update public.estoque_por_local
    set quantidade = quantidade - v_item.quantidade, updated_at = now()
    where material_id = v_item.material_id and local_id = v_local_id
      and quantidade >= v_item.quantidade;
    if not found then raise exception 'Estoque insuficiente para concluir o pedido'; end if;
  end loop;
  insert into public.vendas (
    material_id, pedido_id, pedido_item_id, vendedor_id, local_estoque_id,
    quantidade, preco_unitario, data
  )
  select material_id, p_pedido_id, id, v_pedido.vendedor_id, v_local_id,
         quantidade, preco_unitario, current_date
  from public.pedido_itens where pedido_id = p_pedido_id;
  perform set_config('app.finalizando_pedido', 'true', true);
  update public.pedidos set status = 'entregue' where id = p_pedido_id;
end;
$$;

alter table public.consignacao_produtos enable row level security;
create policy consignacao_produtos_leitura on public.consignacao_produtos for select to authenticated using(public.usuario_ativo());
revoke all on public.consignacao_produtos from anon, authenticated;
grant select on public.consignacao_produtos to authenticated;
alter table public.consignacao_movimentos enable row level security;
create policy consignacao_movimentos_leitura on public.consignacao_movimentos for select to authenticated using(public.usuario_ativo());
revoke all on public.consignacao_movimentos from anon, authenticated;
grant select on public.consignacao_movimentos to authenticated;
alter table public.consignacao_vendas enable row level security;
create policy consignacao_vendas_leitura on public.consignacao_vendas for select to authenticated using(public.usuario_ativo());
revoke all on public.consignacao_vendas from anon, authenticated;
grant select on public.consignacao_vendas to authenticated;
alter table public.consignacao_pagamentos enable row level security;
create policy consignacao_pagamentos_leitura on public.consignacao_pagamentos for select to authenticated using(public.usuario_ativo());
revoke all on public.consignacao_pagamentos from anon, authenticated;
grant select on public.consignacao_pagamentos to authenticated;
revoke all on function public.vincular_local_vendedor(uuid, uuid) from public, anon;
grant execute on function public.vincular_local_vendedor(uuid, uuid) to authenticated;
revoke all on function public.salvar_acordo_consignacao(uuid, uuid, bigint, bigint) from public, anon;
grant execute on function public.salvar_acordo_consignacao(uuid, uuid, bigint, bigint) to authenticated;
revoke all on function public.movimentar_consignacao(uuid, uuid, text, numeric, uuid, text, bigint, bigint) from public, anon;
grant execute on function public.movimentar_consignacao(uuid, uuid, text, numeric, uuid, text, bigint, bigint) to authenticated;
revoke all on function public.vender_consignacao(uuid, uuid, numeric, bigint, date) from public, anon;
grant execute on function public.vender_consignacao(uuid, uuid, numeric, bigint, date) to authenticated;
revoke all on function public.pagar_repasses_consignacao(uuid, uuid[], date, text) from public, anon;
grant execute on function public.pagar_repasses_consignacao(uuid, uuid[], date, text) to authenticated;
revoke all on function public.auditar_estoque_consignacao() from public, anon, authenticated;
revoke all on function public.capturar_repasse_venda() from public, anon, authenticated;
revoke all on function public.proteger_venda_consignacao() from public, anon, authenticated;

commit;
