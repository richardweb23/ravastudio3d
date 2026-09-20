begin;
alter table public.vendas add column caixa text not null default 'Rivoxel'
  check(caixa in ('Rivoxel','Rava','Bonecos'));

create function public.aplicar_caixa_venda() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.caixa := coalesce(nullif(current_setting('app.caixa_venda',true),''),new.caixa);
  return new;
end; $$;
create trigger vendas_caixa before insert on public.vendas
  for each row execute function public.aplicar_caixa_venda();
revoke all on function public.aplicar_caixa_venda() from public,anon,authenticated;

create function public.registrar_venda(p_material_id uuid,p_local_id uuid,p_vendedor_id uuid,p_quantidade numeric,p_preco_unitario numeric,p_data date,p_caixa text) returns uuid
language plpgsql set search_path = '' as $$
declare previous_caixa text := current_setting('app.caixa_venda',true); result_id uuid;
begin
  if p_caixa is null or p_caixa not in ('Rivoxel','Rava','Bonecos') then raise exception 'Selecione a caixa da venda'; end if;
  perform set_config('app.caixa_venda',p_caixa,true);
  result_id := public.registrar_venda(p_material_id,p_local_id,p_vendedor_id,p_quantidade,p_preco_unitario,p_data);
  perform set_config('app.caixa_venda',coalesce(previous_caixa,''),true);
  return result_id;
end; $$;
revoke all on function public.registrar_venda(uuid,uuid,uuid,numeric,numeric,date,text) from public,anon;
grant execute on function public.registrar_venda(uuid,uuid,uuid,numeric,numeric,date,text) to authenticated;

create function public.vender_consignacao(p_local_id uuid,p_material_id uuid,p_quantidade numeric,p_preco_centavos bigint,p_data date,p_caixa text) returns uuid
language plpgsql set search_path = '' as $$
declare previous_caixa text := current_setting('app.caixa_venda',true); result_id uuid;
begin
  if p_caixa is null or p_caixa not in ('Rivoxel','Rava','Bonecos') then raise exception 'Selecione a caixa da venda'; end if;
  perform set_config('app.caixa_venda',p_caixa,true);
  result_id := public.vender_consignacao(p_local_id,p_material_id,p_quantidade,p_preco_centavos,p_data);
  perform set_config('app.caixa_venda',coalesce(previous_caixa,''),true);
  return result_id;
end; $$;
revoke all on function public.vender_consignacao(uuid,uuid,numeric,bigint,date,text) from public,anon;
grant execute on function public.vender_consignacao(uuid,uuid,numeric,bigint,date,text) to authenticated;

create function public.alterar_status_pedido(p_pedido_id uuid,p_status public.status_pedido,p_caixa text) returns void
language plpgsql set search_path = '' as $$
declare previous_caixa text := current_setting('app.caixa_venda',true); 
begin
  if p_caixa is null or p_caixa not in ('Rivoxel','Rava','Bonecos') then raise exception 'Selecione a caixa da venda'; end if;
  perform set_config('app.caixa_venda',p_caixa,true);
  perform public.alterar_status_pedido(p_pedido_id,p_status);
  perform set_config('app.caixa_venda',coalesce(previous_caixa,''),true);
  
end; $$;
revoke all on function public.alterar_status_pedido(uuid,public.status_pedido,text) from public,anon;
grant execute on function public.alterar_status_pedido(uuid,public.status_pedido,text) to authenticated;
create function public.editar_venda(p_venda_id uuid, p_preco_unitario numeric, p_data date,
  p_vendedor_id uuid, p_motivo text, p_versao integer, p_caixa text)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.vendas%rowtype; c public.consignacao_vendas%rowtype;
begin
  if p_caixa is null or p_caixa not in ('Rivoxel','Rava','Bonecos') then raise exception 'Selecione a caixa da venda'; end if;
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
  update public.vendas set caixa=p_caixa,preco_unitario=p_preco_unitario,data=p_data,vendedor_id=p_vendedor_id,
    motivo_alteracao=btrim(p_motivo),versao=versao+1 where id=v.id;
end; $$;

revoke all on function public.editar_venda(uuid,numeric,date,uuid,text,integer,text) from public,anon;
grant execute on function public.editar_venda(uuid,numeric,date,uuid,text,integer,text) to authenticated;

create function public.alterar_caixa_venda(p_venda_id uuid,p_caixa text,p_versao integer)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.vendas%rowtype;
begin
  if not public.usuario_ativo() then raise exception 'Acesso não autorizado'; end if;
  if p_caixa is null or p_caixa not in ('Rivoxel','Rava','Bonecos') then raise exception 'Selecione a caixa da venda'; end if;
  perform 1 from public.consignacao_vendas where id=p_venda_id for update;
  select * into v from public.vendas where id=p_venda_id for update;
  if not found then raise exception 'Venda não encontrada'; end if;
  if p_versao is distinct from v.versao then raise exception 'Venda alterada. Atualize a página.'; end if;
  if v.caixa = p_caixa then return; end if;
  update public.vendas set caixa=p_caixa,versao=versao+1,motivo_alteracao='Alteração de caixa' where id=v.id;
end; $$;
revoke all on function public.alterar_caixa_venda(uuid,text,integer) from public,anon;
grant execute on function public.alterar_caixa_venda(uuid,text,integer) to authenticated;
create or replace function public.sincronizar_alteracao_venda() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.consignacao_vendas
    set preco_unitario_centavos = round(new.preco_unitario * 100)::bigint,
        total_centavos = round(new.quantidade * new.preco_unitario * 100)::bigint,
        data = new.data, devolvida_em = new.devolvida_em
    where id = new.id;
  insert into public.vendas_alteracoes(venda_id,tipo,antes,depois,motivo,criado_por)
    values(new.id,case when old.devolvida_em is null and new.devolvida_em is not null then 'devolucao' else 'edicao' end,
      to_jsonb(old),to_jsonb(new),new.motivo_alteracao,auth.uid());
  return null;
end; $$;

commit;
