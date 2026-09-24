begin;
-- Não presumir recebimento de vendas antigas ou geradas por outros fluxos.
alter table public.vendas add column pago boolean not null default false;

create function public.alterar_pagamento_venda(p_venda_id uuid,p_pago boolean,p_versao integer)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.vendas%rowtype;
begin
  if not public.usuario_ativo() then raise exception 'Acesso não autorizado'; end if;
  if p_pago is null then raise exception 'Informe o status do pagamento'; end if;
  perform 1 from public.consignacao_vendas where id=p_venda_id for update;
  select * into v from public.vendas where id=p_venda_id for update;
  if not found then raise exception 'Venda não encontrada'; end if;
  if p_versao is distinct from v.versao then raise exception 'Venda alterada. Atualize a página.'; end if;
  if v.devolvida_em is not null then raise exception 'Venda já devolvida'; end if;
  if v.pago = p_pago then return; end if;
  update public.vendas set pago=p_pago,versao=versao+1,
    motivo_alteracao=case when p_pago then 'Recebimento confirmado' else 'Recebimento marcado como pendente' end where id=v.id;
end; $$;
revoke all on function public.alterar_pagamento_venda(uuid,boolean,integer) from public,anon;
grant execute on function public.alterar_pagamento_venda(uuid,boolean,integer) to authenticated;

create function public.registrar_venda(p_material_id uuid,p_local_id uuid,p_vendedor_id uuid,p_quantidade numeric,p_preco_unitario numeric,p_data date,p_caixa text,p_pago boolean) returns uuid
language plpgsql set search_path = '' as $$
declare result_id uuid;
begin
  if p_pago is null then raise exception 'Informe o status do pagamento'; end if;
  result_id := public.registrar_venda(p_material_id,p_local_id,p_vendedor_id,p_quantidade,p_preco_unitario,p_data,p_caixa);
  perform public.alterar_pagamento_venda(result_id,p_pago,0);
  return result_id;
end; $$;
revoke all on function public.registrar_venda(uuid,uuid,uuid,numeric,numeric,date,text,boolean) from public,anon;
grant execute on function public.registrar_venda(uuid,uuid,uuid,numeric,numeric,date,text,boolean) to authenticated;
commit;
