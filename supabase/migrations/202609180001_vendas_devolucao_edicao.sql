begin;

alter table public.vendas
  add column devolvida_em timestamptz,
  add column retorno_local_id uuid references public.locais_estoque(id) on delete restrict,
  add column motivo_alteracao text,
  add column versao integer not null default 0;
alter table public.consignacao_vendas add column devolvida_em timestamptz;
alter table public.consignacao_movimentos drop constraint consignacao_movimentos_tipo_check;
alter table public.consignacao_movimentos add constraint consignacao_movimentos_tipo_check
  check(tipo in ('entrada','venda','retirada','ajuste','saldo_inicial','devolucao'));

create table public.vendas_alteracoes (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references public.vendas(id) on delete restrict,
  tipo text not null check(tipo in ('edicao','devolucao')),
  antes jsonb not null,
  depois jsonb not null,
  motivo text not null,
  criado_por uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.vendas_alteracoes enable row level security;
create policy vendas_alteracoes_leitura on public.vendas_alteracoes for select to authenticated using(public.usuario_ativo());
revoke all on public.vendas_alteracoes from anon, authenticated;
grant select on public.vendas_alteracoes to authenticated;

-- Only owner-executed RPCs may update sales. A caller-set configuration flag
-- cannot bypass the guard. Direct client updates and all deletes stay blocked.
create or replace function public.proteger_venda_consignacao() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' or current_user <> pg_catalog.pg_get_userbyid(
    (select relowner from pg_catalog.pg_class where oid = 'public.vendas'::regclass)
  ) then
    raise exception 'O histórico de vendas é permanente. Use as ações de edição ou devolução.';
  end if;
  return new;
end; $$;

create function public.sincronizar_alteracao_venda() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.consignacao_vendas
    set preco_unitario_centavos = round(new.preco_unitario * 100)::bigint,
        total_centavos = round(new.quantidade * new.preco_unitario * 100)::bigint,
        data = new.data, devolvida_em = new.devolvida_em
    where id = new.id;
  insert into public.vendas_alteracoes(venda_id,tipo,antes,depois,motivo,criado_por)
    values(new.id,case when new.devolvida_em is not null then 'devolucao' else 'edicao' end,
      to_jsonb(old),to_jsonb(new),new.motivo_alteracao,auth.uid());
  return null;
end; $$;
create trigger vendas_alteracao_audit after update on public.vendas
  for each row execute function public.sincronizar_alteracao_venda();

-- Also rejects stale payment selections, in the same payment transaction.
create function public.bloquear_repasse_devolvido() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.devolvida_em is not null and new.pagamento_id is not null then
    raise exception 'Venda devolvida não pode receber pagamento de repasse.';
  end if;
  return new;
end; $$;
create trigger consignacao_bloquear_repasse_devolvido before update on public.consignacao_vendas
  for each row execute function public.bloquear_repasse_devolvido();

create function public.devolver_venda(p_venda_id uuid, p_local_id uuid, p_motivo text, p_versao integer)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.vendas%rowtype; c public.consignacao_vendas%rowtype;
begin
  if not public.usuario_ativo() then raise exception 'Acesso não autorizado'; end if;
  if coalesce(length(btrim(p_motivo)),0) = 0 then raise exception 'Informe o motivo'; end if;
  -- Same lock as payments: a paid sale cannot be returned concurrently.
  select * into c from public.consignacao_vendas where id=p_venda_id for update;
  if not found then raise exception 'Venda não encontrada'; end if;
  select * into v from public.vendas where id=p_venda_id for update;
  if v.devolvida_em is not null then raise exception 'Venda já devolvida'; end if;
  if p_versao is distinct from v.versao then raise exception 'Venda alterada. Atualize a página e tente novamente.'; end if;
  if c.pagamento_id is not null then raise exception 'Repasse já pago. Regularize antes de devolver a venda.'; end if;
  perform 1 from public.locais_estoque where id=p_local_id and ativo for share;
  if not found then raise exception 'Selecione um local ativo'; end if;
  perform 1 from public.materiais where id=v.material_id for update;
  perform set_config('app.consignacao_tipo','devolucao',true);
  perform set_config('app.consignacao_nota','Devolução da venda ' || v.id || ': ' || btrim(p_motivo),true);
  insert into public.estoque_por_local(material_id,local_id,quantidade)
    values(v.material_id,p_local_id,v.quantidade)
    on conflict(material_id,local_id) do update
      set quantidade=public.estoque_por_local.quantidade+excluded.quantidade,updated_at=now();
  update public.vendas set devolvida_em=now(),retorno_local_id=p_local_id,
    motivo_alteracao=btrim(p_motivo),versao=versao+1 where id=v.id;
end; $$;

create function public.editar_venda(p_venda_id uuid, p_preco_unitario numeric, p_data date,
  p_vendedor_id uuid, p_motivo text, p_versao integer)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.vendas%rowtype; c public.consignacao_vendas%rowtype;
begin
  if not public.usuario_ativo() then raise exception 'Acesso não autorizado'; end if;
  if coalesce(length(btrim(p_motivo)),0) = 0 then raise exception 'Informe o motivo'; end if;
  if p_preco_unitario is null or p_preco_unitario < 0 or p_preco_unitario > 10000000
    or p_preco_unitario <> round(p_preco_unitario,2) or p_data is null or p_data > current_date then
    raise exception 'Preço ou data inválidos';
  end if;
  select * into c from public.consignacao_vendas where id=p_venda_id for update;
  if not found then raise exception 'Venda não encontrada'; end if;
  select * into v from public.vendas where id=p_venda_id for update;
  if v.devolvida_em is not null then raise exception 'Venda já devolvida'; end if;
  if p_versao is distinct from v.versao then raise exception 'Venda alterada. Atualize a página e tente novamente.'; end if;
  if c.pagamento_id is not null then raise exception 'Repasse já pago. Regularize antes de editar a venda.'; end if;
  if v.pedido_id is not null then raise exception 'Venda de pedido entregue não pode ser editada aqui.'; end if;
  if p_vendedor_id is not null and p_vendedor_id is distinct from v.vendedor_id then
    perform 1 from public.vendedores where id=p_vendedor_id and ativo for share;
    if not found then raise exception 'Selecione um vendedor ativo'; end if;
  end if;
  update public.vendas set preco_unitario=p_preco_unitario,data=p_data,vendedor_id=p_vendedor_id,
    motivo_alteracao=btrim(p_motivo),versao=versao+1 where id=v.id;
end; $$;

revoke all on function public.sincronizar_alteracao_venda(), public.bloquear_repasse_devolvido() from public,anon,authenticated;
revoke all on function public.devolver_venda(uuid,uuid,text,integer), public.editar_venda(uuid,numeric,date,uuid,text,integer) from public,anon;
grant execute on function public.devolver_venda(uuid,uuid,text,integer), public.editar_venda(uuid,numeric,date,uuid,text,integer) to authenticated;
commit;
