begin;
create table public.financeiro_caixas(nome text primary key check(nome in ('Rivoxel','Rava','Bonecos')));
insert into public.financeiro_caixas values ('Rivoxel'),('Rava'),('Bonecos');
create table public.financeiro_abertura(id boolean primary key default true check(id), data date not null, criado_por uuid references auth.users, created_at timestamptz not null default now());
create table public.financeiro_movimentos(
 id uuid primary key default gen_random_uuid(), caixa text not null references public.financeiro_caixas,
 data date not null, valor_centavos bigint not null check(valor_centavos<>0), tipo text not null,
 origem_id uuid, descricao text not null, estorno_de uuid unique references public.financeiro_movimentos,
 criado_por uuid references auth.users, created_at timestamptz not null default now()
);
create index financeiro_movimentos_caixa_data on public.financeiro_movimentos(caixa,data);
create index financeiro_movimentos_origem on public.financeiro_movimentos(tipo,origem_id);
create table public.financeiro_reembolsos(
 id uuid primary key default gen_random_uuid(), socio_id uuid not null references public.financeiro_socios,
 movimento_id uuid not null unique references public.financeiro_movimentos,
 valor_centavos bigint not null check(valor_centavos>0), data date not null, observacao text
);
create table public.financeiro_reembolso_itens(
 reembolso_id uuid not null references public.financeiro_reembolsos,
 pagamento_id uuid not null references public.financeiro_pagamentos_parcela on delete restrict,
 valor_centavos bigint not null check(valor_centavos>0), primary key(reembolso_id,pagamento_id)
);
create table public.financeiro_requisicoes(id uuid primary key, autor uuid not null, acao text not null, dados jsonb not null, resultado jsonb not null);
alter table public.financeiro_pagamentos_parcela add column caixa text references public.financeiro_caixas, add column estornado_em timestamptz;
alter table public.pedido_pagamentos add column caixa text references public.financeiro_caixas, add column estornado_em timestamptz;
alter table public.consignacao_pagamentos add column caixa text references public.financeiro_caixas, add column estornado_em timestamptz;
alter table public.vendas add column data_recebimento date;

create function public.financeiro_travar() returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.usuario_ativo() then raise exception 'Acesso não autorizado'; end if;
 perform pg_advisory_xact_lock(25092501);
end; $$;
create function public.financeiro_validar_saldos() returns void language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from (
  select sum(sum(valor_centavos)) over(partition by caixa order by data) as saldo
  from public.financeiro_movimentos group by caixa,data
 ) x where saldo<0) then raise exception 'Saldo insuficiente no caixa na data informada ou em movimento posterior'; end if;
end; $$;
create function public.financeiro_lancar(p_caixa text,p_data date,p_valor bigint,p_tipo text,p_origem uuid,p_descricao text,p_estorno uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_inicio date;
begin
 perform public.financeiro_travar();
 select data into v_inicio from public.financeiro_abertura;
 if v_inicio is null then raise exception 'Configure a abertura dos caixas no Financeiro'; end if;
 if p_data is null or p_data<v_inicio or p_data>current_date then raise exception 'Data deve estar entre a abertura e hoje'; end if;
 if nullif(btrim(p_descricao),'') is null then raise exception 'Informe a descrição'; end if;
 insert into public.financeiro_movimentos(caixa,data,valor_centavos,tipo,origem_id,descricao,estorno_de,criado_por)
 values(p_caixa,p_data,p_valor,p_tipo,p_origem,p_descricao,p_estorno,auth.uid()) returning id into v_id;
 perform public.financeiro_validar_saldos();
 return v_id;
end; $$;
create function public.financeiro_estornar_interno(p_id uuid,p_data date,p_motivo text) returns uuid
language plpgsql security definer set search_path='' as $$
declare m public.financeiro_movimentos; v_id uuid;
begin
 perform public.financeiro_travar();
 select * into m from public.financeiro_movimentos where id=p_id;
 if not found or m.tipo='abertura' or m.estorno_de is not null then raise exception 'Movimento não pode ser estornado'; end if;
 if p_data<m.data then raise exception 'Estorno anterior ao movimento'; end if;
 if exists(select 1 from public.financeiro_movimentos where estorno_de=m.id) then raise exception 'Movimento já estornado'; end if;
 if exists(select 1 from public.financeiro_movimentos d where d.tipo='devolucao_cliente' and d.origem_id=m.id and not exists(select 1 from public.financeiro_movimentos e where e.estorno_de=d.id)) then raise exception 'Estorne primeiro a devolução ao cliente'; end if;
 v_id:=public.financeiro_lancar(m.caixa,p_data,-m.valor_centavos,'estorno',m.origem_id,p_motivo,m.id);
 return v_id;
end; $$;
create function public.financeiro_proteger() returns trigger language plpgsql set search_path='' as $$
begin
 if current_user<>pg_catalog.pg_get_userbyid((select relowner from pg_catalog.pg_class where oid='public.financeiro_movimentos'::regclass)) then
 raise exception 'Use as operações financeiras para preservar o histórico'; end if;
 if tg_op='DELETE' then raise exception 'Histórico financeiro não pode ser excluído'; end if;
 return new;
end; $$;
-- Razão e comandos só são gravados pelas RPCs; nem operações internas apagam o histórico.
create trigger financeiro_movimentos_proteger before insert or update or delete on public.financeiro_movimentos for each row execute function public.financeiro_proteger();
create trigger financeiro_parcela_proteger before insert or update or delete on public.financeiro_pagamentos_parcela for each row execute function public.financeiro_proteger();
create trigger financeiro_pedido_proteger before insert or update or delete on public.pedido_pagamentos for each row execute function public.financeiro_proteger();

create function public.financeiro_saldos_socios() returns table(id uuid,nome text,adiantado_centavos bigint,reembolsado_centavos bigint,saldo_centavos bigint)
language sql stable security definer set search_path='' as $$
 select s.id,s.nome,coalesce(p.total,0)::bigint,coalesce(r.total,0)::bigint,(coalesce(p.total,0)-coalesce(r.total,0))::bigint
 from public.financeiro_socios s
 left join (select socio_id,sum(valor_centavos) total from public.financeiro_pagamentos_parcela where pago_por_tipo='socio' and estornado_em is null group by socio_id) p on p.socio_id=s.id
 left join (select r.socio_id,sum(r.valor_centavos) total from public.financeiro_reembolsos r where not exists(select 1 from public.financeiro_movimentos e where e.estorno_de=r.movimento_id) group by r.socio_id) r on r.socio_id=s.id
 where public.usuario_ativo();
$$;
create function public.financeiro_resumo(p_inicio date default null,p_fim date default null) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('abertura',(select data from public.financeiro_abertura),
 'caixas',(select jsonb_agg(to_jsonb(x)) from (select c.nome,coalesce(sum(m.valor_centavos),0)::bigint saldo_centavos from public.financeiro_caixas c left join public.financeiro_movimentos m on m.caixa=c.nome group by c.nome order by array_position(array['Rivoxel','Rava','Bonecos'], c.nome)) x),
 'socios',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.financeiro_saldos_socios() s),
 'entradas_centavos',(select coalesce(sum(valor_centavos),0) from public.financeiro_movimentos where valor_centavos>0 and tipo<>'abertura' and (p_inicio is null or data>=p_inicio) and (p_fim is null or data<=p_fim)),
 'saidas_centavos',(select coalesce(-sum(valor_centavos),0) from public.financeiro_movimentos where valor_centavos<0 and (p_inicio is null or data>=p_inicio) and (p_fim is null or data<=p_fim))) where public.usuario_ativo();
$$;
create function public.financeiro_origem(p_tipo text,p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
select case p_tipo
 when 'venda' then (select jsonb_build_object('titulo',material.nome,'data',v.data,'quantidade',v.quantidade,'valor_centavos',round(v.quantidade*v.preco_unitario*100),'devolvida',v.devolvida_em is not null) from public.vendas v join public.materiais material on material.id=v.material_id where v.id=p_id)
 when 'pedido' then (select jsonb_build_object('titulo',pedido.cliente,'pedido_id',pedido.id,'data',pp.data,'valor_centavos',round(pp.valor*100),'total_pedido_centavos',round(pedido.valor_total*100),'metodo',pp.metodo) from public.pedido_pagamentos pp join public.pedidos pedido on pedido.id=pp.pedido_id where pp.id=p_id)
 when 'despesa' then (select jsonb_build_object('titulo',despesa.nome,'parcela',parcela.numero,'data',pp.data_pagamento,'valor_centavos',pp.valor_centavos,'fornecedor',despesa.fornecedor) from public.financeiro_pagamentos_parcela pp join public.financeiro_parcelas parcela on parcela.id=pp.parcela_id join public.financeiro_despesas despesa on despesa.id=parcela.despesa_id where pp.id=p_id)
 when 'repasse' then (select jsonb_build_object('titulo',local.nome,'data',pagamento.data_pagamento,'valor_centavos',pagamento.valor_centavos) from public.consignacao_pagamentos pagamento join public.locais_estoque local on local.id=pagamento.local_id where pagamento.id=p_id)
 else null end where public.usuario_ativo();
$$;
revoke all on function public.financeiro_origem(text,uuid) from public,anon;
grant execute on function public.financeiro_origem(text,uuid) to authenticated;
create function public.financeiro_extrato(p_caixa text default null,p_inicio date default null,p_fim date default null,p_tipo text default null,p_offset integer default 0)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
 select m.*,public.financeiro_origem(m.tipo,m.origem_id) origem,exists(select 1 from public.financeiro_movimentos e where e.estorno_de=m.id) estornado,
  (select jsonb_build_object('socio',s.nome,'itens',coalesce((select jsonb_agg(jsonb_build_object('pagamento_id',i.pagamento_id,'valor_centavos',i.valor_centavos,'despesa',d.nome,'parcela',p.numero)) from public.financeiro_reembolso_itens i join public.financeiro_pagamentos_parcela pp on pp.id=i.pagamento_id join public.financeiro_parcelas p on p.id=pp.parcela_id join public.financeiro_despesas d on d.id=p.despesa_id where i.reembolso_id=r.id),'[]')) from public.financeiro_reembolsos r join public.financeiro_socios s on s.id=r.socio_id where r.movimento_id=m.id) reembolso
 from public.financeiro_movimentos m where public.usuario_ativo()
 and (p_caixa is null or m.caixa=p_caixa) and (p_inicio is null or m.data>=p_inicio) and (p_fim is null or m.data<=p_fim) and (p_tipo is null or m.tipo=p_tipo)
 order by m.data desc,m.created_at desc,m.id limit 100 offset greatest(p_offset,0)) x;
$$;

create function public.financeiro_operar(p_acao text,p_dados jsonb,p_requisicao uuid) returns jsonb
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
  if not public.usuario_administrador() then raise exception 'Abertura exige administrador'; end if;
  -- The opening balance represents all prior history and activation never
  -- modifies existing receipts, expenses, or transfers.
  insert into public.financeiro_abertura(data,criado_por) values(v_data,auth.uid());
  for r in select nome from public.financeiro_caixas loop
   v_parte:=(p_dados->'saldos'->>r.nome)::bigint;
   if v_parte is null or v_parte<0 then raise exception 'Informe os três saldos iniciais, sem valores negativos'; end if;
   if v_parte>0 then perform public.financeiro_lancar(r.nome,v_data,v_parte,'abertura',null,'Saldo no início do dia'); end if;
  end loop;
  perform public.financeiro_validar_saldos();
 elsif p_acao='entrada' then
  if v_valor is null or v_valor<=0 then raise exception 'Valor deve ser positivo'; end if;
  v_mov:=public.financeiro_lancar(v_caixa,v_data,v_valor,'entrada',v_id,v_desc);
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
  if m.tipo='despesa' then raise exception 'Desfaça a baixa em Contas a pagar para estornar todos os pagadores'; end if;
  v_mov:=public.financeiro_estornar_interno(m.id,v_data,v_desc);
  if m.tipo='venda' then
   update public.vendas set pago=false,data_recebimento=null,versao=versao+1,motivo_alteracao=v_desc where id=m.origem_id;
  elsif m.tipo='pedido' then update public.pedido_pagamentos set estornado_em=now() where id=m.origem_id;
  elsif m.tipo='repasse' then
   update public.consignacao_pagamentos set estornado_em=now() where id=m.origem_id;
   update public.consignacao_vendas set pagamento_id=null where pagamento_id=m.origem_id;
  end if;
 else raise exception 'Operação financeira inválida';
 end if;
 v_result:=jsonb_build_object('id',v_id,'movimento_id',v_mov);
 insert into public.financeiro_requisicoes values(p_requisicao,auth.uid(),p_acao,p_dados,v_result);
 return v_result;
end; $$;

create or replace function public.sincronizar_status_pagamento_parcela()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parcela_id uuid := case when tg_op = 'DELETE' then old.parcela_id else new.parcela_id end;
  v_valor_parcela bigint;
  v_total_pago bigint;
  v_quantidade integer;
  v_tipo text;
  v_socio_id uuid;
  v_observacao text;
  v_data date;
begin
  select valor_centavos into v_valor_parcela
  from public.financeiro_parcelas where id = v_parcela_id;
  if not found then return null; end if;

  select
    coalesce(sum(valor_centavos), 0), count(*), max(pago_por_tipo),
    (array_agg(socio_id))[1], max(observacao), max(data_pagamento)
  into v_total_pago, v_quantidade, v_tipo, v_socio_id, v_observacao, v_data
  from public.financeiro_pagamentos_parcela
  where parcela_id = v_parcela_id and estornado_em is null;

  if v_total_pago > v_valor_parcela then
    raise exception 'Os pagamentos não podem ultrapassar o valor da parcela';
  end if;

  update public.financeiro_parcelas set
    pago = v_total_pago = v_valor_parcela,
    data_pagamento = case when v_total_pago = v_valor_parcela then v_data else null end,
    pago_por_tipo = case
      when v_total_pago <> v_valor_parcela then null
      when v_quantidade = 1 then v_tipo
      else 'outro'
    end,
    pago_por_socio_id = case
      when v_total_pago = v_valor_parcela and v_quantidade = 1 and v_tipo = 'socio' then v_socio_id
      else null
    end,
    pago_por_observacao = case
      when v_total_pago <> v_valor_parcela then null
      when v_quantidade = 1 then v_observacao
      else 'Pagamento dividido'
    end
  where id = v_parcela_id;
  return null;
end;
$$;
create or replace function public.salvar_pagamentos_parcela(
  p_parcela_id uuid,
  p_pagamentos jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_valor_parcela bigint;
  v_total bigint;
begin
  perform public.financeiro_travar();
  if coalesce(jsonb_typeof(p_pagamentos), '') <> 'array'
     or coalesce(jsonb_array_length(p_pagamentos), 0) = 0 then
    raise exception 'Informe pelo menos um pagamento';
  end if;

  select valor_centavos into v_valor_parcela
  from public.financeiro_parcelas where id = p_parcela_id for update;
  if not found then raise exception 'Parcela não encontrada'; end if;

  select sum(valor_centavos) into v_total
  from jsonb_to_recordset(p_pagamentos) as pagamento(
    valor_centavos bigint, data_pagamento date, pago_por_tipo text,
    socio_id uuid, observacao text, caixa text
  );
  if v_total <> v_valor_parcela then
    raise exception 'A soma dos pagamentos deve ser exatamente igual ao valor da parcela';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_pagamentos) as pagamento(
      valor_centavos bigint, data_pagamento date, pago_por_tipo text,
      socio_id uuid, observacao text, caixa text
    ) where valor_centavos is null or valor_centavos <= 0
       or data_pagamento is null or data_pagamento>current_date or pago_por_tipo is null
       or pago_por_tipo not in ('socio', 'caixa', 'outro')
       or (pago_por_tipo = 'socio' and socio_id is null)
       or (pago_por_tipo <> 'socio' and socio_id is not null)
  ) then raise exception 'Há pagamentos inválidos'; end if;

  if exists(select 1 from public.financeiro_pagamentos_parcela where parcela_id=p_parcela_id and estornado_em is null) then raise exception 'Parcela já paga. Desfaça a baixa antes de corrigir'; end if;
  insert into public.financeiro_pagamentos_parcela (
    parcela_id, valor_centavos, data_pagamento, pago_por_tipo, socio_id, observacao, caixa
  )
  select
    p_parcela_id, pagamento.valor_centavos, pagamento.data_pagamento,
    pagamento.pago_por_tipo, pagamento.socio_id,
    nullif(trim(pagamento.observacao), ''), pagamento.caixa
  from jsonb_to_recordset(p_pagamentos) as pagamento(
    valor_centavos bigint, data_pagamento date, pago_por_tipo text,
    socio_id uuid, observacao text, caixa text
  );
end;
$$;
create or replace function public.excluir_pagamentos_parcela(p_parcela_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r record; m uuid;
begin
 perform public.financeiro_travar();
 perform 1 from public.financeiro_parcelas where id=p_parcela_id for update;
 if exists(select 1 from public.financeiro_reembolso_itens i join public.financeiro_reembolsos re on re.id=i.reembolso_id join public.financeiro_pagamentos_parcela p on p.id=i.pagamento_id
 where p.parcela_id=p_parcela_id and not exists(select 1 from public.financeiro_movimentos e where e.estorno_de=re.movimento_id)) then raise exception 'Pagamento já reembolsado. Estorne primeiro o reembolso'; end if;
 for r in select * from public.financeiro_pagamentos_parcela where parcela_id=p_parcela_id and estornado_em is null loop
  select id into m from public.financeiro_movimentos f where tipo='despesa' and origem_id=r.id and not exists(select 1 from public.financeiro_movimentos e where e.estorno_de=f.id);
  if m is not null then perform public.financeiro_estornar_interno(m,current_date,'Baixa de despesa desfeita');
  elsif r.pago_por_tipo='caixa' then raise exception 'Pagamento anterior à abertura não pode ser desfeito neste caixa'; end if;
 end loop;
 update public.financeiro_pagamentos_parcela set estornado_em=now() where parcela_id=p_parcela_id and estornado_em is null;
end; $$;

create function public.financeiro_despesa_movimento() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.pago_por_tipo='caixa' then
  if new.caixa is null then raise exception 'Selecione o caixa do pagamento'; end if;
  perform public.financeiro_lancar(new.caixa,new.data_pagamento,-new.valor_centavos,'despesa',new.id,'Pagamento de despesa');
 elsif new.caixa is not null then raise exception 'Caixa só deve ser informado quando a empresa paga'; end if;
 return null;
end; $$;
create trigger financeiro_despesa_movimento after insert on public.financeiro_pagamentos_parcela for each row execute function public.financeiro_despesa_movimento();

create function public.financeiro_venda_validar() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and old.pago and (old.caixa is distinct from new.caixa or old.preco_unitario is distinct from new.preco_unitario or old.quantidade is distinct from new.quantidade or old.data_recebimento is distinct from new.data_recebimento and new.pago) then
  raise exception 'Estorne o recebimento antes de alterar preço, quantidade, data de recebimento ou caixa';
 end if;
 if new.pago and new.pedido_id is null and new.data_recebimento is null then new.data_recebimento:=current_date; end if;
 if new.data_recebimento<new.data then raise exception 'Recebimento anterior à venda'; end if;
 return new;
end; $$;
create trigger financeiro_venda_validar before insert or update on public.vendas for each row execute function public.financeiro_venda_validar();
create function public.financeiro_venda_movimento() returns trigger language plpgsql security definer set search_path='' as $$
declare m uuid;
begin
 if new.pedido_id is not null then return null; end if;
 if new.pago and (tg_op='INSERT' or not old.pago) and new.quantidade*new.preco_unitario>0 then
  perform public.financeiro_lancar(new.caixa,new.data_recebimento,round(new.quantidade*new.preco_unitario*100)::bigint,'venda',new.id,'Recebimento de venda');
 elsif tg_op='UPDATE' and old.pago and not new.pago then
  select id into m from public.financeiro_movimentos f where tipo='venda' and origem_id=new.id and not exists(select 1 from public.financeiro_movimentos e where e.estorno_de=f.id);
  if m is not null then perform public.financeiro_estornar_interno(m,current_date,'Correção: venda marcada como pendente'); end if;
 end if;
 return null;
end; $$;
create trigger financeiro_venda_movimento after insert or update on public.vendas for each row execute function public.financeiro_venda_movimento();
create function public.alterar_pagamento_venda(p_venda_id uuid,p_pago boolean,p_versao integer,p_data_recebimento date) returns void
language plpgsql security definer set search_path='' as $$
declare v public.vendas;
begin
 perform public.financeiro_travar();
 perform 1 from public.consignacao_vendas where id=p_venda_id for update;
 select * into v from public.vendas where id=p_venda_id for update;
 if not found then raise exception 'Venda não encontrada'; end if;
 if v.pedido_id is not null then raise exception 'Registre o recebimento em Pedidos'; end if;
 if p_pago is null then raise exception 'Informe o status do pagamento'; end if;
 if v.versao is distinct from p_versao then raise exception 'Venda alterada. Atualize a página'; end if;
 if v.devolvida_em is not null then raise exception 'Venda já devolvida'; end if;
 if v.pago=p_pago then return; end if;
 if p_pago and (p_data_recebimento is null or p_data_recebimento<v.data or p_data_recebimento>current_date) then raise exception 'Data de recebimento inválida'; end if;
 if not p_pago and not exists(select 1 from public.financeiro_movimentos m where m.tipo='venda' and m.origem_id=v.id and not exists(select 1 from public.financeiro_movimentos e where e.estorno_de=m.id)) then raise exception 'Recebimento anterior à abertura. Preserve o histórico'; end if;
 update public.vendas set pago=p_pago,data_recebimento=case when p_pago then p_data_recebimento else null end,versao=versao+1,motivo_alteracao=case when p_pago then 'Recebimento confirmado' else 'Correção do recebimento' end where id=v.id;
end; $$;
create or replace function public.alterar_pagamento_venda(p_venda_id uuid,p_pago boolean,p_versao integer) returns void
language sql security definer set search_path='' as $$ select public.alterar_pagamento_venda(p_venda_id,p_pago,p_versao,current_date); $$;
create function public.registrar_venda(p_material_id uuid,p_local_id uuid,p_vendedor_id uuid,p_quantidade numeric,p_preco_unitario numeric,p_data date,p_caixa text,p_pago boolean,p_data_recebimento date) returns uuid
language plpgsql security definer set search_path='' as $$
declare v uuid;
begin
 perform public.financeiro_travar();
 v:=public.registrar_venda(p_material_id,p_local_id,p_vendedor_id,p_quantidade,p_preco_unitario,p_data,p_caixa);
 perform public.alterar_pagamento_venda(v,p_pago,0,p_data_recebimento);
 return v;
end; $$;

create function public.pagar_repasses_consignacao(p_local_id uuid,p_vendas_ids uuid[],p_data date,p_observacoes text,p_caixa text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v uuid;
begin
 perform public.financeiro_travar();
 perform set_config('app.repasse_caixa',p_caixa,true);
 v:=public.pagar_repasses_consignacao(p_local_id,p_vendas_ids,p_data,p_observacoes);
 perform set_config('app.repasse_caixa','',true);
 return v;
end; $$;
create function public.financeiro_repasse_movimento() returns trigger language plpgsql security definer set search_path='' as $$
begin
 new.caixa:=nullif(current_setting('app.repasse_caixa',true),'');
 if new.caixa is null then raise exception 'Selecione o caixa do repasse'; end if;
 perform public.financeiro_lancar(new.caixa,new.data_pagamento,-new.valor_centavos,'repasse',new.id,'Repasse de consignação');
 return new;
end; $$;
create trigger financeiro_repasse_movimento before insert on public.consignacao_pagamentos for each row execute function public.financeiro_repasse_movimento();

create function public.financeiro_preservar_pedido() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then
  if exists(select 1 from public.pedido_pagamentos where pedido_id=old.id) then raise exception 'Pedido com histórico de recebimentos não pode ser excluído'; end if;
  return old;
 end if;
 if new.valor_total*100 < coalesce((select sum(round(valor*100)) from public.pedido_pagamentos where pedido_id=new.id and estornado_em is null),0) then raise exception 'Total do pedido inferior aos recebimentos. Estorne antes de corrigir'; end if;
 return new;
end; $$;
create trigger financeiro_preservar_pedido before update or delete on public.pedidos for each row execute function public.financeiro_preservar_pedido();
create function public.financeiro_preservar_parcela() returns trigger language plpgsql set search_path='' as $$
begin
 if current_user<>pg_catalog.pg_get_userbyid((select relowner from pg_catalog.pg_class where oid='public.financeiro_movimentos'::regclass)) and
 ((tg_op='INSERT' and new.pago) or (tg_op='UPDATE' and (new.pago is distinct from old.pago or new.pago_por_tipo is distinct from old.pago_por_tipo or new.pago_por_socio_id is distinct from old.pago_por_socio_id))) then raise exception 'Use as operações de pagamento'; end if;
 if tg_op='UPDATE' and new.valor_centavos is distinct from old.valor_centavos and exists(select 1 from public.financeiro_pagamentos_parcela where parcela_id=old.id) then raise exception 'Parcela com histórico financeiro não pode ser alterada'; end if;
 return new;
end; $$;
create trigger financeiro_preservar_parcela before insert or update on public.financeiro_parcelas for each row execute function public.financeiro_preservar_parcela();
-- Leituras completas são agregadas no servidor; escrita fica restrita às RPCs.
do $$ declare t text; f record; begin
 foreach t in array array['financeiro_caixas','financeiro_abertura','financeiro_movimentos','financeiro_reembolsos','financeiro_reembolso_itens','financeiro_requisicoes'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  if t<>'financeiro_requisicoes' then
   execute format('grant select on public.%I to authenticated',t);
   execute format('create policy leitura on public.%I for select to authenticated using(public.usuario_ativo())',t);
  end if;
 end loop;
 for f in select p.oid::regprocedure assinatura from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'financeiro_%' or p.proname='alterar_pagamento_venda' or p.proname='registrar_venda' or p.proname='pagar_repasses_consignacao') loop
  execute format('revoke all on function %s from public,anon',f.assinatura);
 end loop;
end $$;
revoke all on function public.financeiro_travar(),public.financeiro_validar_saldos(),public.financeiro_lancar(text,date,bigint,text,uuid,text,uuid),public.financeiro_estornar_interno(uuid,date,text) from authenticated;
grant execute on function public.financeiro_operar(text,jsonb,uuid),public.financeiro_resumo(date,date),public.financeiro_extrato(text,date,date,text,integer),public.financeiro_saldos_socios() to authenticated;
grant execute on function public.alterar_pagamento_venda(uuid,boolean,integer,date),public.registrar_venda(uuid,uuid,uuid,numeric,numeric,date,text,boolean,date),public.pagar_repasses_consignacao(uuid,uuid[],date,text,text) to authenticated;

create or replace view public.pedidos_financeiro with (security_invoker=true) as
select p.id,p.valor_total,coalesce(sum(pp.valor),0) valor_pago,
 greatest(p.valor_total-coalesce(sum(pp.valor),0),0) saldo_pendente,
 case when coalesce(sum(pp.valor),0)>=p.valor_total then 'pago' when coalesce(sum(pp.valor),0)>0 then 'parcial' else 'pendente' end status_financeiro
from public.pedidos p left join public.pedido_pagamentos pp on pp.pedido_id=p.id and pp.estornado_em is null group by p.id,p.valor_total;

create function public.salvar_pagamentos_parcelas(p_itens jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare i jsonb;
begin
 perform public.financeiro_travar();
 if jsonb_typeof(p_itens) is distinct from 'array' or jsonb_array_length(p_itens)=0 then raise exception 'Informe as parcelas'; end if;
 for i in select value from jsonb_array_elements(p_itens) loop
  perform public.salvar_pagamentos_parcela((i->>'parcela_id')::uuid,i->'pagamentos');
 end loop;
end; $$;
revoke all on function public.salvar_pagamentos_parcelas(jsonb) from public,anon;
grant execute on function public.salvar_pagamentos_parcelas(jsonb) to authenticated;

create function public.registrar_venda(p_material_id uuid,p_local_id uuid,p_vendedor_id uuid,p_quantidade numeric,p_preco_unitario numeric,p_data date,p_caixa text,p_pago boolean,p_data_recebimento date,p_requisicao uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare v uuid; req public.financeiro_requisicoes; payload jsonb:=jsonb_build_array(p_material_id,p_local_id,p_vendedor_id,p_quantidade,p_preco_unitario,p_data,p_caixa,p_pago,p_data_recebimento);
begin
 perform public.financeiro_travar();
 if p_requisicao is null then raise exception 'Identificador obrigatório'; end if;
 select * into req from public.financeiro_requisicoes where id=p_requisicao;
 if found then
  if req.autor<>auth.uid() or req.acao<>'venda' or req.dados<>payload then raise exception 'Identificador reutilizado com dados diferentes'; end if;
  return (req.resultado->>'id')::uuid;
 end if;
 v:=public.registrar_venda(p_material_id,p_local_id,p_vendedor_id,p_quantidade,p_preco_unitario,p_data,p_caixa,p_pago,p_data_recebimento);
 insert into public.financeiro_requisicoes values(p_requisicao,auth.uid(),'venda',payload,jsonb_build_object('id',v));
 return v;
end; $$;
revoke all on function public.registrar_venda(uuid,uuid,uuid,numeric,numeric,date,text,boolean,date,uuid) from public,anon;
grant execute on function public.registrar_venda(uuid,uuid,uuid,numeric,numeric,date,text,boolean,date,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
