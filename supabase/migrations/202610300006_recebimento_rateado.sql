create or replace function public.financeiro_operar(p_acao text,p_dados jsonb,p_requisicao uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_id uuid:=gen_random_uuid(); v_mov uuid; v_data date:=(p_dados->>'data')::date; v_valor bigint:=(p_dados->>'valor_centavos')::bigint;
 v_caixa text:=p_dados->>'caixa'; v_socio uuid:=(p_dados->>'socio_id')::uuid; v_desc text:=nullif(btrim(p_dados->>'descricao'),'');
 v_rateio jsonb; v_caixa_primario text; v_restante bigint; v_parte bigint; v_total numeric; v_inicio date; r record; m public.financeiro_movimentos; req public.financeiro_requisicoes; v_result jsonb;
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
  v_rateio := coalesce(p_dados->'rateio',jsonb_build_array(jsonb_build_object('caixa',v_caixa,'valor_centavos',v_valor)));
  if jsonb_typeof(v_rateio) <> 'array' or jsonb_array_length(v_rateio) not between 1 and 2 then raise exception 'Informe um ou dois destinos'; end if;
  if exists(select 1 from jsonb_array_elements(v_rateio) x where nullif(x->>'caixa','') is null or not exists(select 1 from public.financeiro_caixas c where c.nome=x->>'caixa') or (x->>'valor_centavos')::bigint is null or (x->>'valor_centavos')::bigint <= 0) then raise exception 'Informe caixas válidos e valores positivos'; end if;
  if (select sum((x->>'valor_centavos')::bigint) from jsonb_array_elements(v_rateio) x) <> v_valor then raise exception 'A soma dos destinos deve ser igual ao valor recebido'; end if;
  select x->>'caixa' into v_caixa_primario from jsonb_array_elements(v_rateio) x limit 1;
  insert into public.pedido_pagamentos(id,pedido_id,valor,data,metodo,observacao,caixa) values(v_id,(p_dados->>'pedido_id')::uuid,v_valor::numeric/100,v_data,(p_dados->>'metodo')::public.metodo_pagamento,v_desc,v_caixa_primario);
  for r in select x->>'caixa' caixa, sum((x->>'valor_centavos')::bigint)::bigint valor from jsonb_array_elements(v_rateio) x group by x->>'caixa' loop
   v_mov:=public.financeiro_lancar(r.caixa,v_data,r.valor,'pedido',v_id,coalesce(v_desc,'Recebimento de pedido'));
  end loop;
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
  if m.tipo='pedido' then
   if exists(select 1 from public.financeiro_movimentos x join public.financeiro_movimentos e on e.estorno_de=x.id where x.tipo='pedido' and x.origem_id=m.origem_id) then raise exception 'Recebimento já estornado'; end if;
   for r in select id from public.financeiro_movimentos where tipo='pedido' and origem_id=m.origem_id order by id loop
    v_mov:=public.financeiro_estornar_interno(r.id,v_data,v_desc);
   end loop;
   update public.pedido_pagamentos set estornado_em=now() where id=m.origem_id;
  elsif m.tipo in ('transferencia_saida','transferencia_entrada') then
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


create or replace function public.financeiro_origem(p_tipo text,p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
select case p_tipo
 when 'venda' then (select jsonb_build_object('titulo',material.nome,'data',v.data,'quantidade',v.quantidade,'valor_centavos',round(v.quantidade*v.preco_unitario*100),'devolvida',v.devolvida_em is not null) from public.vendas v join public.materiais material on material.id=v.material_id where v.id=p_id)
 when 'pedido' then (select jsonb_build_object('titulo',pedido.cliente,'pedido_id',pedido.id,'data',pp.data,'valor_centavos',round(pp.valor*100),'total_pedido_centavos',round(pedido.valor_total*100),'metodo',pp.metodo,'rateio',(select jsonb_agg(jsonb_build_object('caixa',m.caixa,'valor_centavos',m.valor_centavos) order by m.caixa) from public.financeiro_movimentos m where m.tipo='pedido' and m.origem_id=pp.id)) from public.pedido_pagamentos pp join public.pedidos pedido on pedido.id=pp.pedido_id where pp.id=p_id)
 when 'despesa' then (select jsonb_build_object('titulo',despesa.nome,'parcela',parcela.numero,'data',pp.data_pagamento,'valor_centavos',pp.valor_centavos,'fornecedor',despesa.fornecedor) from public.financeiro_pagamentos_parcela pp join public.financeiro_parcelas parcela on parcela.id=pp.parcela_id join public.financeiro_despesas despesa on despesa.id=parcela.despesa_id where pp.id=p_id)
 when 'repasse' then (select jsonb_build_object('titulo',local.nome,'data',pagamento.data_pagamento,'valor_centavos',pagamento.valor_centavos) from public.consignacao_pagamentos pagamento join public.locais_estoque local on local.id=pagamento.local_id where pagamento.id=p_id)
 else null end where public.usuario_ativo();
$$;
