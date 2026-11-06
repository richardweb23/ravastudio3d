begin;

create function public.pedido_links_validos(links text[])
returns boolean language sql immutable set search_path = '' as $$
  select cardinality(links) <= 20 and not exists (
    select 1 from unnest(links) as item
    where item is null or length(item) > 2048
      or item !~* '^https?://[^/[:space:]@]+([/?#][^[:space:]]*)?$'
  );
$$;

alter table public.pedidos add column links text[] not null default '{}'
  check (public.pedido_links_validos(links));

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
  if p_pedido_id is null then
    insert into public.pedidos (cliente,local_estoque_id,vendedor_id,previsao_entrega,desconto,observacao,valor_total,links)
    values (trim(p_pedido->>'cliente'),nullif(p_pedido->>'local_estoque_id','')::uuid,nullif(p_pedido->>'vendedor_id','')::uuid,
      nullif(p_pedido->>'previsao_entrega','')::date,v_desconto,nullif(trim(p_pedido->>'observacao'),''),v_subtotal-v_desconto,
      array(select jsonb_array_elements_text(coalesce(p_pedido->'links','[]'::jsonb))))
    returning id into v_id;
  else
    select status into v_status from public.pedidos where id=p_pedido_id for update;
    if not found then raise exception 'Pedido não encontrado'; end if;
    if v_status='entregue' then raise exception 'Pedidos entregues não podem ser editados'; end if;
    update public.pedidos set cliente=trim(p_pedido->>'cliente'),local_estoque_id=nullif(p_pedido->>'local_estoque_id','')::uuid,
      vendedor_id=nullif(p_pedido->>'vendedor_id','')::uuid,previsao_entrega=nullif(p_pedido->>'previsao_entrega','')::date,
      desconto=v_desconto,observacao=nullif(trim(p_pedido->>'observacao'),''),valor_total=v_subtotal-v_desconto,
      links=case when p_pedido ? 'links' then array(select jsonb_array_elements_text(p_pedido->'links')) else links end where id=p_pedido_id;
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
