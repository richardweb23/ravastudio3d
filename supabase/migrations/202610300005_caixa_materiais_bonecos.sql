alter table public.financeiro_caixas drop constraint financeiro_caixas_nome_check;
alter table public.financeiro_caixas add constraint financeiro_caixas_nome_check check (nome in ('Rivoxel','Rava','Bonecos','Materiais Bonecos'));
insert into public.financeiro_caixas(nome) values ('Materiais Bonecos');

alter table public.vendas add column custo_producao_venda numeric(14,4) check (custo_producao_venda >= 0);
-- Snapshot every new sale so subsequent reclassification never uses a newer product cost.
create function public.vendas_custo_snapshot() returns trigger language plpgsql set search_path = '' as $$
begin
 if tg_op = 'INSERT' then
   select custo_medio into new.custo_producao_venda from public.materiais where id = new.material_id;
 elsif new.custo_producao_venda is distinct from old.custo_producao_venda then
   raise exception 'O custo histórico da venda não pode ser alterado';
 end if;
 return new;
end; $$;
create trigger vendas_z_custo_snapshot before insert or update on public.vendas for each row execute function public.vendas_custo_snapshot();

create or replace function public.financeiro_operar(p_acao text,p_dados jsonb,p_requisicao uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_id uuid:=gen_random_uuid(); v_mov uuid; v_data date:=(p_dados->>'data')::date; v_valor bigint:=(p_dados->>'valor_centavos')::bigint;
 v_caixa text:=p_dados->>'caixa'; v_socio uuid:=(p_dados->>'socio_id')::uuid; v_desc text:=nullif(btrim(p_dados->>'descricao'),'');
 v_restante bigint; v_parte bigint; v_total numeric; v_inicio date; r record; m public.financeiro_movimentos; req public.financeiro_requisicoes; v_result jsonb;
begin
 perform public.financeiro_travar();
 if p_requisicao is null then raise exception 'Identificador da operação obrigatório'; end if;
 select * into req from public.financeiro_requisicoes where id=p_requisicao;
 if found then
  if req.autor<>auth.uid() or req.acao<>p_acao or req.dados<>p_dados then raise exception 'Identificador reutilizado com dados diferentes'; end if;
  return req.resultado;
 end if;
 if v_data is null or v_data>current_date then raise exception 'Informe uma data até hoje'; end if;
 if p_acao='abertura' then
  if exists(select 1 from public.financeiro_abertura) then raise exception 'Abertura já registrada'; end if;
  -- The opening balance represents all prior history and activation never
  -- modifies existing receipts, expenses, or transfers.
  insert into public.financeiro_abertura(data,criado_por) values(v_data,auth.uid());
  for r in select nome from public.financeiro_caixas loop
   v_parte:=coalesce((p_dados->'saldos'->>r.nome)::bigint, case when r.nome='Materiais Bonecos' then 0 else null end);
   if v_parte is null or v_parte<0 then raise exception 'Informe os três saldos iniciais, sem valores negativos'; end if;
   if v_parte>0 then perform public.financeiro_lancar(r.nome,v_data,v_parte,'abertura',null,'Saldo no início do dia'); end if;
  end loop;
  perform public.financeiro_validar_saldos();
 elsif p_acao='entrada' then
  if v_valor is null or v_valor<=0 then raise exception 'Valor deve ser positivo'; end if;
  v_mov:=public.financeiro_lancar(v_caixa,v_data,v_valor,'entrada',v_id,v_desc);
 elsif p_acao='saida' then
  if v_valor is null or v_valor<=0 then raise exception 'Valor deve ser positivo'; end if;
  v_mov:=public.financeiro_lancar(v_caixa,v_data,-v_valor,'saida',v_id,v_desc);
 elsif p_acao='transferencia' then
  if v_valor is null or v_valor<=0 then raise exception 'Valor deve ser positivo'; end if;
  if v_caixa is null or nullif(p_dados->>'caixa_destino','') is null or v_caixa=p_dados->>'caixa_destino' then raise exception 'Selecione caixas de origem e destino diferentes'; end if;
  v_mov:=public.financeiro_lancar(v_caixa,v_data,-v_valor,'transferencia_saida',v_id,'Transferência para '||(p_dados->>'caixa_destino')||': '||v_desc);
  perform public.financeiro_lancar(p_dados->>'caixa_destino',v_data,v_valor,'transferencia_entrada',v_id,'Transferência de '||v_caixa||': '||v_desc);
 elsif p_acao='reembolso' then
  if v_valor is null or v_valor<=0 then raise exception 'Valor deve ser positivo'; end if;
  if not exists(select 1 from public.financeiro_socios where id=v_socio and ativo) then raise exception 'Selecione um sócio ativo'; end if;
  select saldo_centavos into v_total from public.financeiro_saldos_socios() where id=v_socio;
  if v_valor>v_total then raise exception 'Valor acima do crédito do sócio'; end if;
  v_mov:=public.financeiro_lancar(v_caixa,v_data,-v_valor,'reembolso',v_id,coalesce(v_desc,'Reembolso ao sócio'));
  insert into public.financeiro_reembolsos(id,socio_id,movimento_id,valor_centavos,data,observacao) values(v_id,v_socio,v_mov,v_valor,v_data,v_desc);
  v_restante:=v_valor;
  for r in select p.id,p.valor_centavos-coalesce((select sum(i.valor_centavos) from public.financeiro_reembolso_itens i join public.financeiro_reembolsos re on re.id=i.reembolso_id where i.pagamento_id=p.id and not exists(select 1 from public.financeiro_movimentos e where e.estorno_de=re.movimento_id)),0) disponivel
   from public.financeiro_pagamentos_parcela p where p.socio_id=v_socio and p.pago_por_tipo='socio' and p.estornado_em is null and p.data_pagamento<=v_data order by p.data_pagamento,p.created_at,p.id loop
   v_parte:=least(v_restante,r.disponivel);
   if v_parte>0 then insert into public.financeiro_reembolso_itens values(v_id,r.id,v_parte); v_restante:=v_restante-v_parte; end if;
   exit when v_restante=0;
  end loop;
  if v_restante>0 then raise exception 'Crédito insuficiente na data do reembolso'; end if;
 elsif p_acao='receber_pedido' then
  if v_valor is null or v_valor<=0 then raise exception 'Valor deve ser positivo'; end if;
  select valor_total into v_total from public.pedidos where id=(p_dados->>'pedido_id')::uuid for update;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if v_valor+coalesce((select sum(round(valor*100)) from public.pedido_pagamentos where pedido_id=(p_dados->>'pedido_id')::uuid and estornado_em is null),0)>round(v_total*100) then raise exception 'Recebimento acima do saldo do pedido'; end if;
  insert into public.pedido_pagamentos(id,pedido_id,valor,data,metodo,observacao,caixa) values(v_id,(p_dados->>'pedido_id')::uuid,v_valor::numeric/100,v_data,(p_dados->>'metodo')::public.metodo_pagamento,v_desc,v_caixa);
  v_mov:=public.financeiro_lancar(v_caixa,v_data,v_valor,'pedido',v_id,coalesce(v_desc,'Recebimento de pedido'));
 elsif p_acao='devolucao_cliente' then
  select * into m from public.financeiro_movimentos where id=(p_dados->>'movimento_id')::uuid;
  if not found or m.tipo not in ('venda','pedido') or exists(select 1 from public.financeiro_movimentos where estorno_de=m.id) then raise exception 'Selecione um recebimento ativo'; end if;
  if v_data<m.data then raise exception 'Devolução anterior ao recebimento'; end if;
  select coalesce(-sum(d.valor_centavos),0) into v_total from public.financeiro_movimentos d where d.tipo='devolucao_cliente' and d.origem_id=m.id and not exists(select 1 from public.financeiro_movimentos e where e.estorno_de=d.id);
  if v_valor is null or v_valor<=0 or v_valor+v_total>m.valor_centavos then raise exception 'Devolução acima do recebido'; end if;
  v_mov:=public.financeiro_lancar(m.caixa,v_data,-v_valor,'devolucao_cliente',m.id,v_desc);
 elsif p_acao='estorno' then
  select * into m from public.financeiro_movimentos where id=(p_dados->>'movimento_id')::uuid;
  if not found then raise exception 'Movimento não encontrado'; end if;
  if m.tipo in ('transferencia_saida','transferencia_entrada') then
   if (select count(*) from public.financeiro_movimentos where origem_id=m.origem_id and tipo in ('transferencia_saida','transferencia_entrada')) <> 2 then raise exception 'Transferência incompleta'; end if;
   if exists(select 1 from public.financeiro_movimentos x join public.financeiro_movimentos e on e.estorno_de=x.id where x.origem_id=m.origem_id and x.tipo in ('transferencia_saida','transferencia_entrada')) then raise exception 'Transferência já estornada'; end if;
   for r in select id from public.financeiro_movimentos where origem_id=m.origem_id and tipo in ('transferencia_saida','transferencia_entrada') order by valor_centavos loop
    v_mov:=public.financeiro_estornar_interno(r.id,v_data,v_desc);
   end loop;
  else
  if m.tipo='despesa' then raise exception 'Desfaça a baixa em Contas a pagar para estornar todos os pagadores'; end if;
  v_mov:=public.financeiro_estornar_interno(m.id,v_data,v_desc);
  if m.tipo='venda' then
   update public.vendas set pago=false,data_recebimento=null,versao=versao+1,motivo_alteracao=v_desc where id=m.origem_id;
  elsif m.tipo='pedido' then update public.pedido_pagamentos set estornado_em=now() where id=m.origem_id;
  elsif m.tipo='repasse' then
   update public.consignacao_pagamentos set estornado_em=now() where id=m.origem_id;
   update public.consignacao_vendas set pagamento_id=null where pagamento_id=m.origem_id;
  end if;
  end if;
 else raise exception 'Operação financeira inválida';
 end if;
 v_result:=jsonb_build_object('id',v_id,'movimento_id',v_mov);
 insert into public.financeiro_requisicoes values(p_requisicao,auth.uid(),p_acao,p_dados,v_result);
 return v_result;
end; $$;
