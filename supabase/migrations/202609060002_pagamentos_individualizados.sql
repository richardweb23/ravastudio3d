-- Uma parcela pode ser quitada por mais de uma origem (sócios, caixa ou outro).
create table public.financeiro_pagamentos_parcela (
  id uuid primary key default gen_random_uuid(),
  parcela_id uuid not null references public.financeiro_parcelas(id) on delete cascade,
  valor_centavos bigint not null check (valor_centavos > 0),
  data_pagamento date not null default current_date,
  pago_por_tipo text not null check (pago_por_tipo in ('socio', 'caixa', 'outro')),
  socio_id uuid references public.financeiro_socios(id) on delete restrict,
  observacao text,
  created_at timestamptz not null default now(),
  check (
    (pago_por_tipo = 'socio' and socio_id is not null)
    or (pago_por_tipo <> 'socio' and socio_id is null)
  )
);

create index idx_financeiro_pagamentos_parcela on public.financeiro_pagamentos_parcela(parcela_id);
create index idx_financeiro_pagamentos_socio on public.financeiro_pagamentos_parcela(socio_id);
create index idx_financeiro_pagamentos_data on public.financeiro_pagamentos_parcela(data_pagamento);

-- Preserva as baixas feitas antes desta migration.
insert into public.financeiro_pagamentos_parcela (
  parcela_id, valor_centavos, data_pagamento, pago_por_tipo, socio_id, observacao
)
select
  id, valor_centavos, data_pagamento, pago_por_tipo, pago_por_socio_id, pago_por_observacao
from public.financeiro_parcelas
where pago and pago_por_tipo is not null;

create function public.sincronizar_status_pagamento_parcela()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parcela_id uuid := case when tg_op = 'DELETE' then old.parcela_id else new.parcela_id end;
  v_valor_parcela bigint;
  v_total_pago bigint;
  v_quantidade integer;
  v_tipo text;
  v_socio_id uuid;
  v_observacao text;
  v_data date;
begin
  select valor_centavos into v_valor_parcela
  from public.financeiro_parcelas where id = v_parcela_id;
  if not found then return null; end if;

  select
    coalesce(sum(valor_centavos), 0), count(*), max(pago_por_tipo),
    (array_agg(socio_id))[1], max(observacao), max(data_pagamento)
  into v_total_pago, v_quantidade, v_tipo, v_socio_id, v_observacao, v_data
  from public.financeiro_pagamentos_parcela
  where parcela_id = v_parcela_id;

  if v_total_pago > v_valor_parcela then
    raise exception 'Os pagamentos não podem ultrapassar o valor da parcela';
  end if;

  update public.financeiro_parcelas set
    pago = v_total_pago = v_valor_parcela,
    data_pagamento = case when v_total_pago = v_valor_parcela then v_data else null end,
    pago_por_tipo = case
      when v_total_pago <> v_valor_parcela then null
      when v_quantidade = 1 then v_tipo
      else 'outro'
    end,
    pago_por_socio_id = case
      when v_total_pago = v_valor_parcela and v_quantidade = 1 and v_tipo = 'socio' then v_socio_id
      else null
    end,
    pago_por_observacao = case
      when v_total_pago <> v_valor_parcela then null
      when v_quantidade = 1 then v_observacao
      else 'Pagamento dividido'
    end
  where id = v_parcela_id;
  return null;
end;
$$;

create trigger sincronizar_status_pagamento_parcela
after insert or update or delete on public.financeiro_pagamentos_parcela
for each row execute function public.sincronizar_status_pagamento_parcela();

create function public.salvar_pagamentos_parcela(
  p_parcela_id uuid,
  p_pagamentos jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_valor_parcela bigint;
  v_total bigint;
begin
  if not public.usuario_ativo() then raise exception 'Acesso não autorizado'; end if;
  if coalesce(jsonb_typeof(p_pagamentos), '') <> 'array'
     or coalesce(jsonb_array_length(p_pagamentos), 0) = 0 then
    raise exception 'Informe pelo menos um pagamento';
  end if;

  select valor_centavos into v_valor_parcela
  from public.financeiro_parcelas where id = p_parcela_id for update;
  if not found then raise exception 'Parcela não encontrada'; end if;

  select sum(valor_centavos) into v_total
  from jsonb_to_recordset(p_pagamentos) as pagamento(
    valor_centavos bigint, data_pagamento date, pago_por_tipo text,
    socio_id uuid, observacao text
  );
  if v_total <> v_valor_parcela then
    raise exception 'A soma dos pagamentos deve ser exatamente igual ao valor da parcela';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_pagamentos) as pagamento(
      valor_centavos bigint, data_pagamento date, pago_por_tipo text,
      socio_id uuid, observacao text
    ) where valor_centavos <= 0
       or data_pagamento is null
       or pago_por_tipo not in ('socio', 'caixa', 'outro')
       or (pago_por_tipo = 'socio' and socio_id is null)
       or (pago_por_tipo <> 'socio' and socio_id is not null)
  ) then raise exception 'Há pagamentos inválidos'; end if;

  delete from public.financeiro_pagamentos_parcela where parcela_id = p_parcela_id;
  insert into public.financeiro_pagamentos_parcela (
    parcela_id, valor_centavos, data_pagamento, pago_por_tipo, socio_id, observacao
  )
  select
    p_parcela_id, pagamento.valor_centavos, pagamento.data_pagamento,
    pagamento.pago_por_tipo, pagamento.socio_id,
    nullif(trim(pagamento.observacao), '')
  from jsonb_to_recordset(p_pagamentos) as pagamento(
    valor_centavos bigint, data_pagamento date, pago_por_tipo text,
    socio_id uuid, observacao text
  );
end;
$$;

create function public.excluir_pagamentos_parcela(p_parcela_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.usuario_ativo() then raise exception 'Acesso não autorizado'; end if;
  delete from public.financeiro_pagamentos_parcela where parcela_id = p_parcela_id;
end;
$$;

-- Mantém clientes antigos compatíveis sem voltar a gravar somente um pagador
-- diretamente na parcela.
create or replace function public.registrar_pagamento_parcela(
  p_parcela_id uuid,
  p_pago boolean,
  p_data_pagamento date default null,
  p_pago_por_tipo text default null,
  p_pago_por_socio_id uuid default null,
  p_observacao text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.usuario_ativo() then raise exception 'Acesso não autorizado'; end if;
  if p_pago then
    perform public.salvar_pagamentos_parcela(
      p_parcela_id,
      jsonb_build_array(jsonb_build_object(
        'valor_centavos', (select valor_centavos from public.financeiro_parcelas where id = p_parcela_id),
        'data_pagamento', coalesce(p_data_pagamento, current_date),
        'pago_por_tipo', p_pago_por_tipo,
        'socio_id', p_pago_por_socio_id,
        'observacao', p_observacao
      ))
    );
  else
    perform public.excluir_pagamentos_parcela(p_parcela_id);
  end if;
end;
$$;

alter table public.financeiro_pagamentos_parcela enable row level security;
create policy financeiro_pagamentos_parcela_staff
on public.financeiro_pagamentos_parcela for all to authenticated
using (public.usuario_ativo()) with check (public.usuario_ativo());

revoke all on public.financeiro_pagamentos_parcela from anon;
grant select on public.financeiro_pagamentos_parcela to authenticated;
revoke all on function public.salvar_pagamentos_parcela(uuid, jsonb) from public, anon;
revoke all on function public.excluir_pagamentos_parcela(uuid) from public, anon;
grant execute on function public.salvar_pagamentos_parcela(uuid, jsonb) to authenticated;
grant execute on function public.excluir_pagamentos_parcela(uuid) to authenticated;
grant execute on function public.registrar_pagamento_parcela(uuid, boolean, date, text, uuid, text) to authenticated;
