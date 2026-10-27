alter table public.pedidos add column prioridade integer check (prioridade > 0);

-- A mudança de etapa coloca o pedido depois dos que já foram priorizados.
create function public.resetar_prioridade_pedido() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status is distinct from old.status then new.prioridade := null; end if;
  return new;
end;
$$;
create trigger pedidos_resetar_prioridade before update of status on public.pedidos
for each row execute function public.resetar_prioridade_pedido();

create function public.ordenar_pedidos(p_status public.status_pedido, p_ids uuid[])
returns void language plpgsql security invoker set search_path = public as $$
begin
  if p_status = 'entregue' or coalesce(cardinality(p_ids), 0) = 0 then
    raise exception 'Informe os pedidos de uma etapa em andamento.';
  end if;
  perform id from public.pedidos where status = p_status order by id for update;
  if cardinality(p_ids) <> (select count(distinct id) from unnest(p_ids) as ids(id))
    or cardinality(p_ids) <> (select count(*) from public.pedidos where status = p_status)
    or exists (select 1 from unnest(p_ids) as ids(id)
      where not exists (select 1 from public.pedidos p where p.id = ids.id and p.status = p_status)) then
    raise exception 'O quadro mudou. Atualize a página e tente novamente.';
  end if;
  update public.pedidos p set prioridade = ids.position::integer
  from unnest(p_ids) with ordinality as ids(id, position) where p.id = ids.id;
end;
$$;
revoke all on function public.ordenar_pedidos(public.status_pedido, uuid[]) from public, anon;
grant execute on function public.ordenar_pedidos(public.status_pedido, uuid[]) to authenticated;
