-- Preserve the existing ledger and references while changing the cash box name.
begin;
-- Migrations run as the database owner without an application user session.
-- Use the same transaction lock as financeiro_travar without its user check.
select pg_advisory_xact_lock(25092501);
alter table public.financeiro_caixas drop constraint financeiro_caixas_nome_check;
alter table public.financeiro_caixas add constraint financeiro_caixas_nome_check
  check (nome in ('Rivoxel', 'Rava', 'Bonecos', 'Materiais Bonecos', 'Materiais'));
insert into public.financeiro_caixas(nome) values ('Materiais');

update public.financeiro_movimentos set caixa = 'Materiais' where caixa = 'Materiais Bonecos';
update public.financeiro_pagamentos_parcela set caixa = 'Materiais' where caixa = 'Materiais Bonecos';
update public.pedido_pagamentos set caixa = 'Materiais' where caixa = 'Materiais Bonecos';
update public.consignacao_pagamentos set caixa = 'Materiais' where caixa = 'Materiais Bonecos';
-- Update only the generated transfer prefix, preserving the user's description.
update public.financeiro_movimentos
set descricao = regexp_replace(descricao, '^Transferência para Materiais Bonecos:', 'Transferência para Materiais:')
where tipo = 'transferencia_saida' and descricao like 'Transferência para Materiais Bonecos:%';
update public.financeiro_movimentos
set descricao = regexp_replace(descricao, '^Transferência de Materiais Bonecos:', 'Transferência de Materiais:')
where tipo = 'transferencia_entrada' and descricao like 'Transferência de Materiais Bonecos:%';

delete from public.financeiro_caixas where nome = 'Materiais Bonecos';
alter table public.financeiro_caixas drop constraint financeiro_caixas_nome_check;
alter table public.financeiro_caixas add constraint financeiro_caixas_nome_check
  check (nome in ('Rivoxel', 'Rava', 'Bonecos', 'Materiais'));

-- Keep zero as the default for the new box in older opening requests as well.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.financeiro_operar(text,jsonb,uuid)'::regprocedure) into definition;
  if position('case when r.nome=''Materiais Bonecos'' then 0 else null end' in definition) = 0 then
    raise exception 'A função de abertura esperada não foi encontrada';
  end if;
  execute replace(definition,
    'case when r.nome=''Materiais Bonecos'' then 0 else null end',
    'case when r.nome=''Materiais'' then coalesce((p_dados->''saldos''->>''Materiais Bonecos'')::bigint, 0) else null end');
end $$;
commit;
