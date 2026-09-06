create extension if not exists pgcrypto;

create type public.perfil_usuario as enum ('administrador', 'operador');
create type public.tipo_local as enum ('principal', 'vendedor', 'estabelecimento', 'rua', 'outro');
create type public.status_pedido as enum ('recebido', 'em_producao', 'pronto', 'entregue');
create type public.metodo_pagamento as enum ('pix', 'dinheiro', 'cartao', 'transferencia', 'outro');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  perfil public.perfil_usuario not null default 'operador',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.materiais (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  unidade text not null default 'un',
  quantidade_atual numeric(14,3) not null default 0 check (quantidade_atual >= 0),
  custo_medio numeric(14,4) not null default 0 check (custo_medio >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vendedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.locais_estoque (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  tipo public.tipo_local not null default 'outro',
  responsavel text,
  endereco text,
  telefone text,
  email text,
  url text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.estoque_por_local (
  material_id uuid not null references public.materiais(id) on delete restrict,
  local_id uuid not null references public.locais_estoque(id) on delete restrict,
  quantidade numeric(14,3) not null default 0 check (quantidade >= 0),
  updated_at timestamptz not null default now(),
  primary key (material_id, local_id)
);

create table public.compras (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materiais(id) on delete restrict,
  local_estoque_id uuid not null references public.locais_estoque(id) on delete restrict,
  fornecedor text,
  quantidade numeric(14,3) not null check (quantidade > 0),
  custo_unitario numeric(14,4) not null check (custo_unitario >= 0),
  data date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  cliente text not null,
  local_estoque_id uuid references public.locais_estoque(id) on delete restrict,
  vendedor_id uuid references public.vendedores(id) on delete restrict,
  data_pedido date not null default current_date,
  previsao_entrega date,
  status public.status_pedido not null default 'recebido',
  desconto numeric(14,2) not null default 0 check (desconto >= 0),
  observacao text,
  valor_total numeric(14,2) not null default 0 check (valor_total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pedido_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  material_id uuid not null references public.materiais(id) on delete restrict,
  subtitulo text,
  quantidade numeric(14,3) not null check (quantidade > 0),
  preco_unitario numeric(14,2) not null check (preco_unitario >= 0),
  concluido boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.pedido_pagamentos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  valor numeric(14,2) not null check (valor > 0),
  data date not null default current_date,
  metodo public.metodo_pagamento not null default 'pix',
  observacao text,
  created_at timestamptz not null default now()
);

create table public.vendas (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materiais(id) on delete restrict,
  pedido_id uuid references public.pedidos(id) on delete restrict,
  pedido_item_id uuid unique references public.pedido_itens(id) on delete restrict,
  vendedor_id uuid references public.vendedores(id) on delete restrict,
  local_estoque_id uuid not null references public.locais_estoque(id) on delete restrict,
  quantidade numeric(14,3) not null check (quantidade > 0),
  preco_unitario numeric(14,2) not null check (preco_unitario >= 0),
  data date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.calculos_precificacao (
  id uuid primary key default gen_random_uuid(),
  material_id uuid references public.materiais(id) on delete set null,
  nome_projeto text not null,
  cliente text,
  descricao text,
  configuracao jsonb not null default '{}'::jsonb,
  resultado jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_compras_material on public.compras(material_id);
create index idx_compras_local on public.compras(local_estoque_id);
create index idx_compras_data on public.compras(data desc);
create index idx_vendas_material on public.vendas(material_id);
create index idx_vendas_local on public.vendas(local_estoque_id);
create index idx_vendas_vendedor on public.vendas(vendedor_id);
create index idx_vendas_data on public.vendas(data desc);
create index idx_pedidos_status on public.pedidos(status);
create index idx_pedidos_previsao on public.pedidos(previsao_entrega);
create index idx_pedido_itens_pedido on public.pedido_itens(pedido_id);
create index idx_pedido_pagamentos_pedido on public.pedido_pagamentos(pedido_id);
create index idx_calculos_updated on public.calculos_precificacao(updated_at desc);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger materiais_updated_at before update on public.materiais
for each row execute function public.set_updated_at();
create trigger vendedores_updated_at before update on public.vendedores
for each row execute function public.set_updated_at();
create trigger locais_updated_at before update on public.locais_estoque
for each row execute function public.set_updated_at();
create trigger calculos_updated_at before update on public.calculos_precificacao
for each row execute function public.set_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nome)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create function public.usuario_ativo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and ativo
  );
$$;

create function public.usuario_administrador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and ativo and perfil = 'administrador'
  );
$$;

create function public.sincronizar_total_material()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_material_id uuid;
begin
  v_material_id := case when tg_op = 'DELETE' then old.material_id else new.material_id end;
  update public.materiais
  set quantidade_atual = coalesce((
    select sum(quantidade)
    from public.estoque_por_local
    where material_id = v_material_id
  ), 0)
  where id = v_material_id;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger sincronizar_total_material
after insert or update or delete on public.estoque_por_local
for each row execute function public.sincronizar_total_material();

create function public.proteger_status_pedido()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'entregue' and new.status <> old.status then
    raise exception 'Pedidos entregues não podem voltar de status';
  end if;
  if new.status = 'entregue' and old.status <> 'entregue'
     and coalesce(current_setting('app.finalizando_pedido', true), '') <> 'true' then
    raise exception 'Use a operação de entrega para finalizar o pedido';
  end if;
  return new;
end;
$$;

create trigger proteger_status_pedido
before update of status on public.pedidos
for each row execute function public.proteger_status_pedido();

create function public.salvar_material(
  p_material_id uuid,
  p_nome text,
  p_custo_medio numeric,
  p_quantidade numeric,
  p_local_id uuid
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_total numeric;
  v_delta numeric;
  v_local_quantidade numeric;
begin
  if not public.usuario_ativo() then raise exception 'Acesso não autorizado'; end if;
  if nullif(trim(p_nome), '') is null then raise exception 'Informe o nome do produto'; end if;
  if coalesce(p_custo_medio, 0) < 0 or coalesce(p_quantidade, 0) < 0 then
    raise exception 'Custo e quantidade não podem ser negativos';
  end if;

  if p_material_id is null then
    if p_local_id is null then raise exception 'Informe o local do estoque'; end if;
    insert into public.materiais (nome, unidade, custo_medio)
    values (trim(p_nome), 'un', coalesce(p_custo_medio, 0))
    returning id into v_id;
    insert into public.estoque_por_local (material_id, local_id, quantidade)
    values (v_id, p_local_id, coalesce(p_quantidade, 0));
    return v_id;
  end if;

  select quantidade_atual into v_total
  from public.materiais where id = p_material_id for update;
  if not found then raise exception 'Produto não encontrado'; end if;
  v_delta := coalesce(p_quantidade, 0) - v_total;
  if v_delta <> 0 and p_local_id is null then
    raise exception 'Informe o local que receberá o ajuste';
  end if;
  if v_delta <> 0 then
    select quantidade into v_local_quantidade
    from public.estoque_por_local
    where material_id = p_material_id and local_id = p_local_id
    for update;
    v_local_quantidade := coalesce(v_local_quantidade, 0);
    if v_local_quantidade + v_delta < 0 then
      raise exception 'Saldo insuficiente no local selecionado';
    end if;
  end if;
  update public.materiais
  set nome = trim(p_nome), custo_medio = coalesce(p_custo_medio, 0)
  where id = p_material_id;
  if v_delta <> 0 then
    insert into public.estoque_por_local (material_id, local_id, quantidade)
    values (p_material_id, p_local_id, v_local_quantidade + v_delta)
    on conflict (material_id, local_id)
    do update set quantidade = excluded.quantidade, updated_at = now();
  end if;
  return p_material_id;
end;
$$;

create function public.transferir_estoque(
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

create function public.registrar_entrada(
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

create function public.registrar_venda(
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

create function public.salvar_pedido(
  p_pedido_id uuid,
  p_pedido jsonb,
  p_itens jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_status public.status_pedido;
  v_subtotal numeric;
  v_desconto numeric := coalesce((p_pedido ->> 'desconto')::numeric, 0);
begin
  if not public.usuario_ativo() then raise exception 'Acesso não autorizado'; end if;
  if nullif(trim(p_pedido ->> 'cliente'), '') is null then raise exception 'Informe o cliente'; end if;
  if coalesce(jsonb_typeof(p_itens), '') <> 'array'
     or coalesce(jsonb_array_length(p_itens), 0) = 0 then
    raise exception 'Adicione pelo menos um produto';
  end if;
  select sum(quantidade * preco_unitario) into v_subtotal
  from jsonb_to_recordset(p_itens) as item(
    material_id uuid, subtitulo text, quantidade numeric, preco_unitario numeric
  );
  if exists (
    select 1 from jsonb_to_recordset(p_itens) as item(
      material_id uuid, subtitulo text, quantidade numeric, preco_unitario numeric
    ) where material_id is null or quantidade <= 0 or preco_unitario < 0
  ) then raise exception 'Há itens inválidos no pedido'; end if;
  if v_desconto < 0 or v_desconto > v_subtotal then
    raise exception 'O desconto deve ficar entre zero e o subtotal';
  end if;

  if p_pedido_id is null then
    insert into public.pedidos (
      cliente, local_estoque_id, vendedor_id, previsao_entrega,
      desconto, observacao, valor_total
    ) values (
      trim(p_pedido ->> 'cliente'),
      nullif(p_pedido ->> 'local_estoque_id', '')::uuid,
      nullif(p_pedido ->> 'vendedor_id', '')::uuid,
      nullif(p_pedido ->> 'previsao_entrega', '')::date,
      v_desconto, nullif(trim(p_pedido ->> 'observacao'), ''),
      v_subtotal - v_desconto
    ) returning id into v_id;
  else
    select status into v_status from public.pedidos where id = p_pedido_id for update;
    if not found then raise exception 'Pedido não encontrado'; end if;
    if v_status = 'entregue' then raise exception 'Pedidos entregues não podem ser editados'; end if;
    update public.pedidos set
      cliente = trim(p_pedido ->> 'cliente'),
      local_estoque_id = nullif(p_pedido ->> 'local_estoque_id', '')::uuid,
      vendedor_id = nullif(p_pedido ->> 'vendedor_id', '')::uuid,
      previsao_entrega = nullif(p_pedido ->> 'previsao_entrega', '')::date,
      desconto = v_desconto,
      observacao = nullif(trim(p_pedido ->> 'observacao'), ''),
      valor_total = v_subtotal - v_desconto
    where id = p_pedido_id;
    delete from public.pedido_itens where pedido_id = p_pedido_id;
    v_id := p_pedido_id;
  end if;
  insert into public.pedido_itens (
    pedido_id, material_id, subtitulo, quantidade, preco_unitario
  )
  select v_id, item.material_id, nullif(trim(item.subtitulo), ''),
         item.quantidade, item.preco_unitario
  from jsonb_to_recordset(p_itens) as item(
    material_id uuid, subtitulo text, quantidade numeric, preco_unitario numeric
  );
  return v_id;
end;
$$;

create function public.alterar_status_pedido(
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

insert into public.locais_estoque (nome, tipo, responsavel)
values ('Estoque principal', 'principal', 'RAVA Studio 3D')
on conflict (nome) do nothing;

create view public.pedidos_financeiro
with (security_invoker = true)
as
select
  p.id,
  p.valor_total,
  coalesce(sum(pp.valor), 0) as valor_pago,
  greatest(p.valor_total - coalesce(sum(pp.valor), 0), 0) as saldo_pendente,
  case
    when coalesce(sum(pp.valor), 0) >= p.valor_total then 'pago'
    when coalesce(sum(pp.valor), 0) > 0 then 'parcial'
    else 'pendente'
  end as status_financeiro
from public.pedidos p
left join public.pedido_pagamentos pp on pp.pedido_id = p.id
group by p.id, p.valor_total;

alter table public.profiles enable row level security;
alter table public.materiais enable row level security;
alter table public.vendedores enable row level security;
alter table public.locais_estoque enable row level security;
alter table public.estoque_por_local enable row level security;
alter table public.compras enable row level security;
alter table public.pedidos enable row level security;
alter table public.pedido_itens enable row level security;
alter table public.pedido_pagamentos enable row level security;
alter table public.vendas enable row level security;
alter table public.calculos_precificacao enable row level security;

create policy profiles_select on public.profiles for select to authenticated
using (id = auth.uid() or public.usuario_administrador());
create policy materiais_staff on public.materiais for all to authenticated
using (public.usuario_ativo()) with check (public.usuario_ativo());
create policy vendedores_staff on public.vendedores for all to authenticated
using (public.usuario_ativo()) with check (public.usuario_ativo());
create policy locais_staff on public.locais_estoque for all to authenticated
using (public.usuario_ativo()) with check (public.usuario_ativo());
create policy estoque_staff on public.estoque_por_local for all to authenticated
using (public.usuario_ativo()) with check (public.usuario_ativo());
create policy compras_staff on public.compras for all to authenticated
using (public.usuario_ativo()) with check (public.usuario_ativo());
create policy pedidos_staff on public.pedidos for all to authenticated
using (public.usuario_ativo()) with check (public.usuario_ativo());
create policy pedido_itens_staff on public.pedido_itens for all to authenticated
using (public.usuario_ativo()) with check (public.usuario_ativo());
create policy pagamentos_staff on public.pedido_pagamentos for all to authenticated
using (public.usuario_ativo()) with check (public.usuario_ativo());
create policy vendas_staff on public.vendas for all to authenticated
using (public.usuario_ativo()) with check (public.usuario_ativo());
create policy calculos_staff on public.calculos_precificacao for all to authenticated
using (public.usuario_ativo()) with check (public.usuario_ativo());

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on
  public.materiais, public.vendedores, public.locais_estoque,
  public.estoque_por_local, public.compras, public.pedidos,
  public.pedido_itens, public.pedido_pagamentos, public.vendas,
  public.calculos_precificacao
to authenticated;
grant select on public.profiles to authenticated;
grant select on public.pedidos_financeiro to authenticated;

revoke all on function public.usuario_ativo() from public, anon;
revoke all on function public.usuario_administrador() from public, anon;
revoke all on function public.salvar_material(uuid, text, numeric, numeric, uuid) from public, anon;
revoke all on function public.transferir_estoque(uuid, uuid, uuid, numeric) from public, anon;
revoke all on function public.registrar_entrada(uuid, uuid, text, numeric, numeric, date) from public, anon;
revoke all on function public.registrar_venda(uuid, uuid, uuid, numeric, numeric, date) from public, anon;
revoke all on function public.salvar_pedido(uuid, jsonb, jsonb) from public, anon;
revoke all on function public.alterar_status_pedido(uuid, public.status_pedido) from public, anon;

grant execute on function public.usuario_ativo() to authenticated;
grant execute on function public.usuario_administrador() to authenticated;
grant execute on function public.salvar_material(uuid, text, numeric, numeric, uuid) to authenticated;
grant execute on function public.transferir_estoque(uuid, uuid, uuid, numeric) to authenticated;
grant execute on function public.registrar_entrada(uuid, uuid, text, numeric, numeric, date) to authenticated;
grant execute on function public.registrar_venda(uuid, uuid, uuid, numeric, numeric, date) to authenticated;
grant execute on function public.salvar_pedido(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.alterar_status_pedido(uuid, public.status_pedido) to authenticated;


