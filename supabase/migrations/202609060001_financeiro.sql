-- Módulo Financeiro da RAVA Studio 3D.
-- Valores monetários são armazenados em centavos e participações em pontos-base.

create table public.financeiro_socios (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  percentual_bp integer not null check (percentual_bp between 0 and 10000),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.financeiro_categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.financeiro_cartoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  banco text,
  ultimos_quatro char(4) check (ultimos_quatro is null or ultimos_quatro ~ '^\d{4}$'),
  dia_fechamento smallint check (dia_fechamento between 1 and 31),
  dia_vencimento smallint not null check (dia_vencimento between 1 and 31),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.financeiro_despesas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria_id uuid references public.financeiro_categorias(id) on delete set null,
  descricao text,
  numero_compra text,
  data_compra date not null default current_date,
  fornecedor text,
  valor_total_centavos bigint not null check (valor_total_centavos > 0),
  forma_pagamento text not null check (
    forma_pagamento in ('pix', 'dinheiro', 'debito', 'credito', 'boleto', 'transferencia', 'outro')
  ),
  cartao_id uuid references public.financeiro_cartoes(id) on delete restrict,
  quantidade_parcelas integer not null default 1 check (quantidade_parcelas between 1 and 240),
  primeiro_vencimento date not null,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (forma_pagamento = 'credito' and cartao_id is not null)
    or (forma_pagamento <> 'credito' and cartao_id is null)
  )
);

create table public.financeiro_parcelas (
  id uuid primary key default gen_random_uuid(),
  despesa_id uuid not null references public.financeiro_despesas(id) on delete cascade,
  numero integer not null check (numero > 0),
  total_parcelas integer not null check (total_parcelas > 0),
  valor_centavos bigint not null check (valor_centavos > 0),
  vencimento date not null,
  pago boolean not null default false,
  data_pagamento date,
  pago_por_tipo text check (pago_por_tipo in ('socio', 'caixa', 'outro')),
  pago_por_socio_id uuid references public.financeiro_socios(id) on delete restrict,
  pago_por_observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (despesa_id, numero),
  check (
    (pago = false and data_pagamento is null and pago_por_tipo is null and pago_por_socio_id is null)
    or
    (pago = true and data_pagamento is not null and pago_por_tipo is not null)
  ),
  check (
    (pago_por_tipo = 'socio' and pago_por_socio_id is not null)
    or (pago_por_tipo is distinct from 'socio' and pago_por_socio_id is null)
  )
);

create index idx_financeiro_despesas_data on public.financeiro_despesas(data_compra desc);
create index idx_financeiro_despesas_categoria on public.financeiro_despesas(categoria_id);
create index idx_financeiro_parcelas_vencimento on public.financeiro_parcelas(vencimento);
create index idx_financeiro_parcelas_pago on public.financeiro_parcelas(pago);
create index idx_financeiro_parcelas_socio on public.financeiro_parcelas(pago_por_socio_id);

create trigger financeiro_socios_updated_at before update on public.financeiro_socios
for each row execute function public.set_updated_at();
create trigger financeiro_categorias_updated_at before update on public.financeiro_categorias
for each row execute function public.set_updated_at();
create trigger financeiro_cartoes_updated_at before update on public.financeiro_cartoes
for each row execute function public.set_updated_at();
create trigger financeiro_despesas_updated_at before update on public.financeiro_despesas
for each row execute function public.set_updated_at();
create trigger financeiro_parcelas_updated_at before update on public.financeiro_parcelas
for each row execute function public.set_updated_at();

create function public.validar_participacao_socios()
returns trigger
language plpgsql
set search_path = ''
as $$
declare v_total integer;
begin
  if pg_trigger_depth() > 1 then return null; end if;
  select coalesce(sum(percentual_bp), 0) into v_total
  from public.financeiro_socios where ativo;
  if v_total <> 10000 then
    raise exception 'A soma da participação dos sócios ativos deve ser 100%%';
  end if;
  return null;
end;
$$;

create constraint trigger validar_participacao_socios
after insert or update or delete on public.financeiro_socios
deferrable initially deferred
for each row execute function public.validar_participacao_socios();

create function public.salvar_despesa_financeira(
  p_despesa_id uuid,
  p_despesa jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_total bigint := coalesce((p_despesa ->> 'valor_total_centavos')::bigint, 0);
  v_quantidade integer := coalesce((p_despesa ->> 'quantidade_parcelas')::integer, 1);
  v_primeiro_vencimento date := (p_despesa ->> 'primeiro_vencimento')::date;
  v_base bigint;
  v_resto bigint;
  v_indice integer;
begin
  if not public.usuario_ativo() then raise exception 'Acesso não autorizado'; end if;
  if nullif(trim(p_despesa ->> 'nome'), '') is null then raise exception 'Informe o nome da compra'; end if;
  if v_total <= 0 then raise exception 'Informe um valor total válido'; end if;
  if v_quantidade < 1 or v_quantidade > 240 then raise exception 'Quantidade de parcelas inválida'; end if;
  if v_primeiro_vencimento is null then raise exception 'Informe o primeiro vencimento'; end if;
  if p_despesa ->> 'forma_pagamento' = 'credito'
     and nullif(p_despesa ->> 'cartao_id', '') is null then
    raise exception 'Informe o cartão utilizado';
  end if;

  if p_despesa_id is null then
    insert into public.financeiro_despesas (
      nome, categoria_id, descricao, numero_compra, data_compra, fornecedor,
      valor_total_centavos, forma_pagamento, cartao_id, quantidade_parcelas,
      primeiro_vencimento, observacoes
    ) values (
      trim(p_despesa ->> 'nome'), nullif(p_despesa ->> 'categoria_id', '')::uuid,
      nullif(trim(p_despesa ->> 'descricao'), ''), nullif(trim(p_despesa ->> 'numero_compra'), ''),
      coalesce(nullif(p_despesa ->> 'data_compra', '')::date, current_date),
      nullif(trim(p_despesa ->> 'fornecedor'), ''), v_total,
      p_despesa ->> 'forma_pagamento', nullif(p_despesa ->> 'cartao_id', '')::uuid,
      v_quantidade, v_primeiro_vencimento, nullif(trim(p_despesa ->> 'observacoes'), '')
    ) returning id into v_id;
  else
    if exists (
      select 1 from public.financeiro_parcelas
      where despesa_id = p_despesa_id and pago
    ) then
      raise exception 'Não é possível alterar uma compra que já possui parcelas pagas';
    end if;
    update public.financeiro_despesas set
      nome = trim(p_despesa ->> 'nome'),
      categoria_id = nullif(p_despesa ->> 'categoria_id', '')::uuid,
      descricao = nullif(trim(p_despesa ->> 'descricao'), ''),
      numero_compra = nullif(trim(p_despesa ->> 'numero_compra'), ''),
      data_compra = coalesce(nullif(p_despesa ->> 'data_compra', '')::date, current_date),
      fornecedor = nullif(trim(p_despesa ->> 'fornecedor'), ''),
      valor_total_centavos = v_total,
      forma_pagamento = p_despesa ->> 'forma_pagamento',
      cartao_id = nullif(p_despesa ->> 'cartao_id', '')::uuid,
      quantidade_parcelas = v_quantidade,
      primeiro_vencimento = v_primeiro_vencimento,
      observacoes = nullif(trim(p_despesa ->> 'observacoes'), '')
    where id = p_despesa_id;
    if not found then raise exception 'Compra não encontrada'; end if;
    delete from public.financeiro_parcelas where despesa_id = p_despesa_id;
    v_id := p_despesa_id;
  end if;

  v_base := v_total / v_quantidade;
  v_resto := v_total % v_quantidade;
  for v_indice in 0..v_quantidade - 1 loop
    insert into public.financeiro_parcelas (
      despesa_id, numero, total_parcelas, valor_centavos, vencimento
    ) values (
      v_id, v_indice + 1, v_quantidade,
      v_base + case when v_indice < v_resto then 1 else 0 end,
      (v_primeiro_vencimento + make_interval(months => v_indice))::date
    );
  end loop;
  return v_id;
end;
$$;

create function public.registrar_pagamento_parcela(
  p_parcela_id uuid,
  p_pago boolean,
  p_data_pagamento date default null,
  p_pago_por_tipo text default null,
  p_pago_por_socio_id uuid default null,
  p_observacao text default null
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not public.usuario_ativo() then raise exception 'Acesso não autorizado'; end if;
  if p_pago then
    if p_pago_por_tipo is null or p_pago_por_tipo not in ('socio', 'caixa', 'outro') then
      raise exception 'Informe quem realizou o pagamento';
    end if;
    if p_pago_por_tipo = 'socio' and p_pago_por_socio_id is null then
      raise exception 'Informe o sócio que realizou o pagamento';
    end if;
    update public.financeiro_parcelas set
      pago = true,
      data_pagamento = coalesce(p_data_pagamento, current_date),
      pago_por_tipo = p_pago_por_tipo,
      pago_por_socio_id = case when p_pago_por_tipo = 'socio' then p_pago_por_socio_id else null end,
      pago_por_observacao = nullif(trim(p_observacao), '')
    where id = p_parcela_id;
  else
    update public.financeiro_parcelas set
      pago = false, data_pagamento = null, pago_por_tipo = null,
      pago_por_socio_id = null, pago_por_observacao = null
    where id = p_parcela_id;
  end if;
  if not found then raise exception 'Parcela não encontrada'; end if;
end;
$$;

create view public.financeiro_despesas_resumo
with (security_invoker = true)
as
select
  d.*,
  coalesce(sum(p.valor_centavos) filter (where p.pago), 0)::bigint as total_pago_centavos,
  coalesce(sum(p.valor_centavos) filter (where not p.pago), 0)::bigint as total_pendente_centavos,
  coalesce(sum(p.valor_centavos) filter (where not p.pago and p.vencimento < current_date), 0)::bigint as total_vencido_centavos,
  case
    when bool_and(p.pago) then 'paga'
    when bool_or(p.pago) then 'parcialmente_paga'
    when bool_or(not p.pago and p.vencimento < current_date) then 'vencida'
    else 'pendente'
  end as status
from public.financeiro_despesas d
join public.financeiro_parcelas p on p.despesa_id = d.id
group by d.id;

alter table public.financeiro_socios enable row level security;
alter table public.financeiro_categorias enable row level security;
alter table public.financeiro_cartoes enable row level security;
alter table public.financeiro_despesas enable row level security;
alter table public.financeiro_parcelas enable row level security;

create policy financeiro_socios_staff on public.financeiro_socios for all to authenticated
using (public.usuario_ativo()) with check (public.usuario_ativo());
create policy financeiro_categorias_staff on public.financeiro_categorias for all to authenticated
using (public.usuario_ativo()) with check (public.usuario_ativo());
create policy financeiro_cartoes_staff on public.financeiro_cartoes for all to authenticated
using (public.usuario_ativo()) with check (public.usuario_ativo());
create policy financeiro_despesas_staff on public.financeiro_despesas for all to authenticated
using (public.usuario_ativo()) with check (public.usuario_ativo());
create policy financeiro_parcelas_staff on public.financeiro_parcelas for all to authenticated
using (public.usuario_ativo()) with check (public.usuario_ativo());

revoke all on public.financeiro_socios, public.financeiro_categorias,
  public.financeiro_cartoes, public.financeiro_despesas, public.financeiro_parcelas
from anon;
grant select, insert, update, delete on public.financeiro_socios,
  public.financeiro_categorias, public.financeiro_cartoes,
  public.financeiro_despesas, public.financeiro_parcelas to authenticated;
grant select on public.financeiro_despesas_resumo to authenticated;

revoke all on function public.salvar_despesa_financeira(uuid, jsonb) from public, anon;
revoke all on function public.registrar_pagamento_parcela(uuid, boolean, date, text, uuid, text) from public, anon;
grant execute on function public.salvar_despesa_financeira(uuid, jsonb) to authenticated;
grant execute on function public.registrar_pagamento_parcela(uuid, boolean, date, text, uuid, text) to authenticated;

-- Seeds ficam por último: o trigger de participação é diferido até o fim da
-- transação e não pode haver ALTER TABLE enquanto seus eventos estão pendentes.
insert into public.financeiro_socios (nome, percentual_bp)
values ('Richard', 5000), ('Xandy', 5000)
on conflict (nome) do nothing;

insert into public.financeiro_categorias (nome)
select nome from unnest(array[
  'Impressoras', 'Filamentos', 'Materiais', 'Ferramentas', 'Equipamentos',
  'Móveis', 'Embalagens', 'Manutenção', 'Marketing', 'Software', 'Serviços', 'Outros'
]) as nome
on conflict (nome) do nothing;
