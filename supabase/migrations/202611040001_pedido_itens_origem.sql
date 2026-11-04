begin;

alter table public.pedido_itens
  add column local_estoque_id uuid references public.locais_estoque(id) on delete restrict,
  add column caixa text check (caixa in ('Rava', 'Rivoxel', 'Bonecos'));

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
  if p_pedido_id is null then
    insert into public.pedidos (cliente,local_estoque_id,vendedor_id,previsao_entrega,desconto,observacao,valor_total)
    values (trim(p_pedido->>'cliente'),nullif(p_pedido->>'local_estoque_id','')::uuid,nullif(p_pedido->>'vendedor_id','')::uuid,
      nullif(p_pedido->>'previsao_entrega','')::date,v_desconto,nullif(trim(p_pedido->>'observacao'),''),v_subtotal-v_desconto)
    returning id into v_id;
  else
    select status into v_status from public.pedidos where id=p_pedido_id for update;
    if not found then raise exception 'Pedido não encontrado'; end if;
    if v_status='entregue' then raise exception 'Pedidos entregues não podem ser editados'; end if;
    update public.pedidos set cliente=trim(p_pedido->>'cliente'),local_estoque_id=nullif(p_pedido->>'local_estoque_id','')::uuid,
      vendedor_id=nullif(p_pedido->>'vendedor_id','')::uuid,previsao_entrega=nullif(p_pedido->>'previsao_entrega','')::date,
      desconto=v_desconto,observacao=nullif(trim(p_pedido->>'observacao'),''),valor_total=v_subtotal-v_desconto where id=p_pedido_id;
    delete from public.pedido_itens where pedido_id=p_pedido_id;
    v_id := p_pedido_id;
  end if;
  insert into public.pedido_itens (pedido_id,material_id,subtitulo,quantidade,preco_unitario,local_estoque_id,caixa)
  select v_id,i.material_id,nullif(trim(i.subtitulo),''),i.quantidade,i.preco_unitario,i.local_estoque_id,nullif(i.caixa,'')
  from jsonb_to_recordset(p_itens) as i(material_id uuid,subtitulo text,quantidade numeric,preco_unitario numeric,local_estoque_id uuid,caixa text);
  return v_id;
end;
$$;

create or replace function public.alterar_status_pedido(p_pedido_id uuid, p_status public.status_pedido)
returns void language plpgsql set search_path = '' as $$
declare
  v_pedido public.pedidos%rowtype;
  v_principal uuid;
  v_item record;
  v_caixa_padrao text := nullif(current_setting('app.caixa_venda',true),'');
  v_nome text;
  v_local_nome text;
begin
  perform set_config('app.consignacao_tipo','venda',true);
  if not public.usuario_ativo() then raise exception 'Acesso não autorizado'; end if;
  if p_status is null then raise exception 'Informe um status válido'; end if;
  select * into v_pedido from public.pedidos where id=p_pedido_id for update;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if v_pedido.status='entregue' then raise exception 'O pedido já foi entregue e não pode mudar de status'; end if;
  if p_status<>'entregue' then update public.pedidos set status=p_status where id=p_pedido_id; return; end if;
  if not exists(select 1 from public.pedido_itens where pedido_id=p_pedido_id) then raise exception 'O pedido não possui itens'; end if;
  select id into v_principal from public.locais_estoque where tipo='principal' and ativo order by created_at limit 1;
  if exists(select 1 from public.pedido_itens i where i.pedido_id=p_pedido_id and coalesce(i.local_estoque_id,v_pedido.local_estoque_id,v_principal) is null) then raise exception 'Nenhum local principal está configurado'; end if;
  if exists(select 1 from public.pedido_itens i where i.pedido_id=p_pedido_id and coalesce(i.caixa,v_caixa_padrao) not in ('Rava','Rivoxel','Bonecos')) then raise exception 'Selecione o caixa da venda'; end if;
  for v_item in select i.material_id,coalesce(i.local_estoque_id,v_pedido.local_estoque_id,v_principal) local_id,sum(i.quantidade) quantidade
    from public.pedido_itens i where i.pedido_id=p_pedido_id group by i.material_id,coalesce(i.local_estoque_id,v_pedido.local_estoque_id,v_principal)
    order by i.material_id,local_id
  loop
    perform 1 from public.materiais where id=v_item.material_id for update;
    update public.estoque_por_local set quantidade=quantidade-v_item.quantidade,updated_at=now()
      where material_id=v_item.material_id and local_id=v_item.local_id and quantidade>=v_item.quantidade;
    if not found then
      select nome into v_nome from public.materiais where id=v_item.material_id;
      select nome into v_local_nome from public.locais_estoque where id=v_item.local_id;
      raise exception 'Estoque insuficiente para % no local %',v_nome,v_local_nome;
    end if;
  end loop;
  for v_item in select * from public.pedido_itens where pedido_id=p_pedido_id order by id loop
    perform set_config('app.caixa_venda',coalesce(v_item.caixa,v_caixa_padrao,''),true);
    insert into public.vendas(material_id,pedido_id,pedido_item_id,vendedor_id,local_estoque_id,quantidade,preco_unitario,data)
    values(v_item.material_id,p_pedido_id,v_item.id,v_pedido.vendedor_id,coalesce(v_item.local_estoque_id,v_pedido.local_estoque_id,v_principal),v_item.quantidade,v_item.preco_unitario,current_date);
  end loop;
  perform set_config('app.caixa_venda',coalesce(v_caixa_padrao,''),true);
  perform set_config('app.finalizando_pedido','true',true);
  update public.pedidos set status='entregue' where id=p_pedido_id;
end;
$$;
commit;
