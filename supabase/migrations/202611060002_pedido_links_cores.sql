begin;

alter table public.pedidos add column links_cores text[] not null default '{}';

create function public.pedido_links_cores_ajustar()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.links is distinct from old.links and new.links_cores is not distinct from old.links_cores
     and coalesce(current_setting('app.pedido_cores_explicitas', true), '') <> 'true' then
    -- Older clients only send URLs; retain colors for each matching occurrence.
    select coalesce(array_agg(coalesce(old.links_cores[matched.position], '') order by fresh.position), '{}')
    into new.links_cores
    from (
      select value, position, row_number() over (partition by value order by position) occurrence
      from unnest(new.links) with ordinality as n(value, position)
    ) fresh
    left join (
      select value, position, row_number() over (partition by value order by position) occurrence
      from unnest(old.links) with ordinality as o(value, position)
    ) matched on matched.value = fresh.value and matched.occurrence = fresh.occurrence;
  end if;
  if cardinality(new.links_cores) = 0 and cardinality(new.links) > 0 then
    new.links_cores := array_fill(''::text, array[cardinality(new.links)]);
  end if;
  if cardinality(new.links_cores) <> cardinality(new.links)
     or exists (select 1 from unnest(new.links_cores) c where c is null or length(c) > 100) then
    raise exception 'Informe uma cor válida para cada link';
  end if;
  return new;
end;
$$;

create trigger pedido_links_cores_ajustar
before insert or update of links, links_cores on public.pedidos
for each row execute function public.pedido_links_cores_ajustar();

create or replace function public.salvar_pedido(p_pedido_id uuid, p_pedido jsonb, p_itens jsonb)
returns uuid language plpgsql set search_path = '' as $$
declare
  v_id uuid;
  v_status public.status_pedido;
  v_subtotal numeric;
  v_desconto numeric := coalesce((p_pedido ->> 'desconto')::numeric, 0);
begin
  if not public.usuario_ativo() then raise exception 'Acesso não autorizado'; end if;
  if nullif(trim(p_pedido ->> 'cliente'), '') is null then raise exception 'Informe o cliente'; end if;
  if coalesce(jsonb_typeof(p_itens), '') <> 'array' or coalesce(jsonb_array_length(p_itens), 0) = 0 then raise exception 'Adicione pelo menos um produto'; end if;
  if exists (select 1 from jsonb_to_recordset(p_itens) as i(material_id uuid, quantidade numeric, preco_unitario numeric, local_estoque_id uuid, caixa text)
    where i.material_id is null or i.quantidade is null or i.quantidade <= 0 or i.preco_unitario is null or i.preco_unitario < 0
       or (i.caixa is not null and i.caixa not in ('Rava','Rivoxel','Bonecos'))
       or (i.local_estoque_id is not null and not exists(select 1 from public.locais_estoque l where l.id=i.local_estoque_id and l.ativo))) then
    raise exception 'Há itens inválidos ou com estoque inativo no pedido';
  end if;
  select sum(i.quantidade * i.preco_unitario) into v_subtotal from jsonb_to_recordset(p_itens) as i(quantidade numeric, preco_unitario numeric);
  if v_desconto < 0 or v_desconto > v_subtotal then raise exception 'O desconto deve ficar entre zero e o subtotal'; end if;
  if p_pedido ? 'links' and jsonb_typeof(p_pedido->'links') <> 'array' then
    raise exception 'Links inválidos';
  end if;
  if p_pedido ? 'links_cores' and jsonb_typeof(p_pedido->'links_cores') <> 'array' then
    raise exception 'Cores inválidas';
  end if;
  perform set_config('app.pedido_cores_explicitas', case when p_pedido ? 'links_cores' then 'true' else 'false' end, true);
  if p_pedido_id is null then
    insert into public.pedidos (cliente,local_estoque_id,vendedor_id,previsao_entrega,desconto,observacao,valor_total,links,links_cores)
    values (trim(p_pedido->>'cliente'),nullif(p_pedido->>'local_estoque_id','')::uuid,nullif(p_pedido->>'vendedor_id','')::uuid,
      nullif(p_pedido->>'previsao_entrega','')::date,v_desconto,nullif(trim(p_pedido->>'observacao'),''),v_subtotal-v_desconto,
      array(select jsonb_array_elements_text(coalesce(p_pedido->'links','[]'::jsonb))),
      array(select jsonb_array_elements_text(coalesce(p_pedido->'links_cores','[]'::jsonb))))
    returning id into v_id;
  else
    select status into v_status from public.pedidos where id=p_pedido_id for update;
    if not found then raise exception 'Pedido não encontrado'; end if;
    if v_status='entregue' then raise exception 'Pedidos entregues não podem ser editados'; end if;
    update public.pedidos set cliente=trim(p_pedido->>'cliente'),local_estoque_id=nullif(p_pedido->>'local_estoque_id','')::uuid,
      vendedor_id=nullif(p_pedido->>'vendedor_id','')::uuid,previsao_entrega=nullif(p_pedido->>'previsao_entrega','')::date,
      desconto=v_desconto,observacao=nullif(trim(p_pedido->>'observacao'),''),valor_total=v_subtotal-v_desconto,
      links=case when p_pedido ? 'links' then array(select jsonb_array_elements_text(p_pedido->'links')) else links end,
      links_cores=case when p_pedido ? 'links_cores' then array(select jsonb_array_elements_text(p_pedido->'links_cores')) else links_cores end where id=p_pedido_id;
    delete from public.pedido_itens where pedido_id=p_pedido_id;
    v_id := p_pedido_id;
  end if;
  insert into public.pedido_itens (pedido_id,material_id,subtitulo,quantidade,preco_unitario,local_estoque_id,caixa)
  select v_id,i.material_id,nullif(trim(i.subtitulo),''),i.quantidade,i.preco_unitario,i.local_estoque_id,nullif(i.caixa,'')
  from jsonb_to_recordset(p_itens) as i(material_id uuid,subtitulo text,quantidade numeric,preco_unitario numeric,local_estoque_id uuid,caixa text);
  return v_id;
end;
$$;

commit;

