begin;
alter table public.financeiro_despesas add column cancelada_em timestamptz, add column cancelada_por uuid references auth.users, add column motivo_cancelamento text;

create function public.financeiro_proteger_compra_cancelada() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' then
  if new.cancelada_em is not null or new.cancelada_por is not null or new.motivo_cancelamento is not null then raise exception 'Use o cancelamento de compra'; end if;
  return new;
 end if;
 if tg_op='DELETE' then
  if old.cancelada_em is not null then raise exception 'Compra cancelada deve ser preservada'; end if;
  return old;
 end if;
 if old.cancelada_em is not null then raise exception 'Compra cancelada não pode ser alterada'; end if;
 if (new.cancelada_em, new.cancelada_por, new.motivo_cancelamento) is distinct from (old.cancelada_em, old.cancelada_por, old.motivo_cancelamento)
    and current_user <> pg_catalog.pg_get_userbyid((select relowner from pg_catalog.pg_class where oid='public.financeiro_movimentos'::regclass)) then
  raise exception 'Use o cancelamento de compra';
 end if;
 return new;
end; $$;
create trigger financeiro_compra_cancelada_proteger before insert or update or delete on public.financeiro_despesas for each row execute function public.financeiro_proteger_compra_cancelada();

create function public.financeiro_bloquear_pagamento_cancelado() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform public.financeiro_travar();
 if exists(select 1 from public.financeiro_parcelas p join public.financeiro_despesas d on d.id=p.despesa_id where p.id=new.parcela_id and d.cancelada_em is not null) then
  raise exception 'Compra cancelada não pode receber pagamentos';
 end if;
 return new;
end; $$;
create trigger financeiro_pagamento_compra_cancelada before insert on public.financeiro_pagamentos_parcela for each row execute function public.financeiro_bloquear_pagamento_cancelado();

create function public.financeiro_proteger_parcela_cancelada() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.financeiro_despesas where id=case when tg_op='INSERT' then new.despesa_id else old.despesa_id end and cancelada_em is not null) then raise exception 'Parcela de compra cancelada deve ser preservada'; end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
create trigger financeiro_parcela_cancelada_proteger before insert or update or delete on public.financeiro_parcelas for each row execute function public.financeiro_proteger_parcela_cancelada();

create function public.cancelar_despesa_financeira(p_despesa_id uuid,p_motivo text) returns void language plpgsql security definer set search_path='' as $$
declare r record; d public.financeiro_despesas;
begin
 perform public.financeiro_travar();
 if nullif(btrim(p_motivo),'') is null then raise exception 'Informe o motivo do cancelamento'; end if;
 select * into d from public.financeiro_despesas where id=p_despesa_id for update;
 if not found then raise exception 'Compra não encontrada'; end if;
 if d.cancelada_em is not null then raise exception 'Compra já cancelada'; end if;
 for r in select id from public.financeiro_parcelas where despesa_id=d.id order by numero loop
  perform public.excluir_pagamentos_parcela(r.id);
 end loop;
 update public.financeiro_despesas set cancelada_em=now(),cancelada_por=auth.uid(),motivo_cancelamento=btrim(p_motivo) where id=d.id;
end; $$;
revoke all on function public.cancelar_despesa_financeira(uuid,text) from public,anon;
grant execute on function public.cancelar_despesa_financeira(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
