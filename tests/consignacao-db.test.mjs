import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('consignacao: migracao e fluxo transacional em PostgreSQL isolado', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  const user = '00000000-0000-4000-8000-000000000001';
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA public, auth TO authenticated, anon;
  `);
  const migrations = readdirSync('supabase/migrations').filter(file => file.endsWith('.sql')).sort();
  let legacyProduct, legacySale;
  for (const file of migrations) {
    let sql = readFileSync('supabase/migrations/' + file, 'utf8');
    // gen_random_uuid é nativo neste PostgreSQL; a extensão não é necessária no teste.
    sql = sql.replace('create extension if not exists pgcrypto;', '');
    await db.exec(sql);
    if (file === '202609050001_initial_schema.sql') {
      await db.query('insert into auth.users(id,email) values($1,$2)', [user, 'teste@example.invalid']);
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
      const origin = (await db.query("select id from public.locais_estoque where tipo='principal' limit 1")).rows[0].id;
      legacyProduct = (await db.query("select public.salvar_material(null,'Produto anterior',2,4,$1) as id",[origin])).rows[0].id;
      legacySale = (await db.query('select public.registrar_venda($1,$2,null,1,10,current_date) as id',[legacyProduct,origin])).rows[0].id;
    }
  }
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec('SET ROLE authenticated');
  const one = async (sql, args = []) => (await db.query(sql,args)).rows[0];
  const source = (await one("select id from public.locais_estoque where tipo='principal' limit 1")).id;
  const local = (await one("insert into public.locais_estoque(nome,tipo) values('Academia RAVA Fitness','estabelecimento') returning id")).id;
  const other = (await one("insert into public.locais_estoque(nome,tipo) values('Local B','estabelecimento') returning id")).id;
  const product = (await one("select public.salvar_material(null,'Chaveiro Botafogo',2,30,$1) as id",[source])).id;
  const stock = async id => Number((await one('select quantidade from public.estoque_por_local where material_id=$1 and local_id=$2',[product,id]))?.quantidade || 0);
  const move = (type, quantity, from = source) => db.query('select public.movimentar_consignacao($1,$2,$3,$4,$5,$6,1500,300)',[local,product,type,quantity,from,'Teste de consignação']);
  let sale, payment;
  await t.test('migração preserva saldo e vendas anteriores sem presumir repasses', async () => {
    const legacy = await one('select * from public.consignacao_vendas where id=$1',[legacySale]);
    assert.equal(Number(legacy.total_centavos),1000);
    assert.equal(legacy.acordo_registrado,false);
    assert.equal(Number(legacy.repasse_total_centavos),0);
    const movement=await one("select * from public.consignacao_movimentos where material_id=$1 and tipo='saldo_inicial'",[legacyProduct]);
    assert.equal(Number(movement.quantidade),3);
  });
  await t.test('envia 5 unidades sem criar estoque duplicado e registra cada envio', async () => {
    await move('entrada',5);
    assert.equal(await stock(local),5); assert.equal(await stock(source),25);
    assert.equal(Number((await one('select quantidade_atual from public.materiais where id=$1',[product])).quantidade_atual),30);
    assert.equal(Number((await one("select count(*) as n from public.consignacao_movimentos where local_id=$1 and tipo='entrada'",[local])).n),1);
  });
  await t.test('venda de 2 gera R$30 vendido, R$6 pendente e saldo 3', async () => {
    sale=(await one('select public.vender_consignacao($1,$2,2,1500,current_date) as id',[local,product])).id;
    const row=await one('select * from public.consignacao_vendas where id=$1',[sale]);
    assert.equal(await stock(local),3); assert.equal(Number(row.total_centavos),3000); assert.equal(Number(row.repasse_total_centavos),600); assert.equal(row.pagamento_id,null);
  });
  await t.test('bloqueia venda e retirada acima do saldo sem alteração parcial', async () => {
    await assert.rejects(db.query('select public.vender_consignacao($1,$2,4,1500,current_date)',[local,product]), /insuficiente/i);
    await assert.rejects(move('retirada',4), /insuficiente/i);
    assert.equal(await stock(local),3);
  });
  await t.test('pagamento vincula a venda, preserva valor e bloqueia pagamento duplicado', async () => {
    payment=(await one('select public.pagar_repasses_consignacao($1,$2,current_date,$3) as id',[local,[sale],'Pix confirmado'])).id;
    assert.equal((await one('select pagamento_id from public.consignacao_vendas where id=$1',[sale])).pagamento_id,payment);
    assert.equal(Number((await one('select valor_centavos from public.consignacao_pagamentos where id=$1',[payment])).valor_centavos),600);
    await assert.rejects(db.query('select public.pagar_repasses_consignacao($1,$2,current_date,null)',[local,[sale]]), /inválida/i);
    assert.equal(Number((await one('select count(*) as n from public.consignacao_pagamentos')).n),1);
  });
  await t.test('novo envio e devolução preservam venda, pagamento e estoque total', async () => {
    await move('entrada',10); assert.equal(await stock(local),13);
    await move('retirada',2); assert.equal(await stock(local),11);
    assert.equal(Number((await one('select count(*) as n from public.consignacao_vendas where local_id=$1',[local])).n),1);
    assert.equal(Number((await one('select quantidade_atual from public.materiais where id=$1',[product])).quantidade_atual),28);
  });
  await t.test('acordos diferentes por local e alteração não modificam vendas antigas', async () => {
    await db.query('select public.salvar_acordo_consignacao($1,$2,2000,900)',[local,product]);
    assert.equal(Number((await one('select repasse_unitario_centavos from public.consignacao_vendas where id=$1',[sale])).repasse_unitario_centavos),300);
    await db.query("select public.movimentar_consignacao($1,$2,'entrada',2,$3,null,1500,400)",[other,product,source]);
    const id=(await one('select public.vender_consignacao($1,$2,1,1500,current_date) as id',[other,product])).id;
    assert.equal(Number((await one('select repasse_total_centavos from public.consignacao_vendas where id=$1',[id])).repasse_total_centavos),400);
    await assert.rejects(db.query('select public.pagar_repasses_consignacao($1,$2,current_date,null)',[local,[id]]), /inválida/i);
  });
  await t.test('venda pela tela existente também captura o acordo atual e a movimentação', async () => {
    const id=(await one('select public.registrar_venda($1,$2,null,1,15,current_date) as id',[product,local])).id;
    assert.equal(Number((await one('select repasse_total_centavos from public.consignacao_vendas where id=$1',[id])).repasse_total_centavos),900);
    assert.equal(Number((await one("select count(*) as n from public.consignacao_movimentos where local_id=$1 and tipo='venda'",[local])).n),2);
  });
  await t.test('ajuste exige motivo e não gera venda ou repasse', async () => {
    await assert.rejects(db.query("select public.movimentar_consignacao($1,$2,'ajuste',-1,null,null)",[local,product]), /motivo/i);
    await db.query("select public.movimentar_consignacao($1,$2,'ajuste',-1,null,'Contagem física')",[local,product]);
    assert.equal(await stock(local),9);
  });
  await t.test('histórico protegido contra edição e exclusão direta', async () => {
    await assert.rejects(db.query('delete from public.vendas where id=$1',[sale]), /permanente/i);
    await assert.rejects(db.query('update public.consignacao_vendas set pagamento_id=null where id=$1',[sale]), /permission denied/i);
    await assert.rejects(db.query('delete from public.consignacao_movimentos'), /permission denied/i);
    await assert.rejects(db.query('delete from public.consignacao_pagamentos'), /permission denied/i);
  });
  await t.test('vendedor pode vincular local existente e não pode sobrescrever vínculo', async () => {
    const seller=(await one("insert into public.vendedores(nome) values('Richard') returning id")).id;
    const linked=(await one('select public.vincular_local_vendedor($1,$2) as id',[seller,local])).id;
    assert.equal(linked,local);
    await assert.rejects(db.query('select public.vincular_local_vendedor($1,$2)',[seller,other]), /já possui/i);
  });
  await t.test('entrega de pedido integra venda, estoque e repasse sem duplicar entrega', async () => {
    const order=(await one("insert into public.pedidos(cliente,local_estoque_id) values('Cliente de teste',$1) returning id",[other])).id;
    await db.query('insert into public.pedido_itens(pedido_id,material_id,quantidade,preco_unitario) values($1,$2,1,15)',[order,product]);
    await db.query("select public.alterar_status_pedido($1,'entregue')",[order]);
    assert.equal(await stock(other),0);
    const saleId=(await one('select id from public.vendas where pedido_id=$1',[order])).id;
    assert.equal(Number((await one('select repasse_total_centavos from public.consignacao_vendas where id=$1',[saleId])).repasse_total_centavos),400);
    await assert.rejects(db.query("select public.alterar_status_pedido($1,'entregue')",[order]), /já foi entregue/i);
  });
  await t.test('pagamento em lote rejeita duplicatas e datas incompatíveis', async () => {
    const unpaid=(await db.query('select id from public.consignacao_vendas where local_id=$1 and pagamento_id is null',[local])).rows.map(row=>row.id);
    await assert.rejects(db.query('select public.pagar_repasses_consignacao($1,$2,current_date,null)',[local,[unpaid[0],unpaid[0]]]), /repetidas/i);
    await assert.rejects(db.query("select public.pagar_repasses_consignacao($1,$2,current_date-1,null)",[local,unpaid]), /inválida/i);
    await db.query('select public.pagar_repasses_consignacao($1,$2,current_date,null)',[local,unpaid]);
    assert.equal(Number((await one('select count(*) as n from public.consignacao_vendas where local_id=$1 and pagamento_id is null',[local])).n),0);
  });
  await t.test('vínculo permanente e vendedor inativo preservam histórico', async () => {
    const seller=(await one('select id from public.vendedores where local_estoque_id=$1',[local])).id;
    await assert.rejects(db.query('update public.vendedores set local_estoque_id=$1 where id=$2',[other,seller]), /preservado/i);
    await db.query('update public.vendedores set ativo=false where id=$1',[seller]);
    await assert.rejects(db.query('select public.vender_consignacao($1,$2,1,1500,current_date)',[local,product]), /inativo/i);
    assert.equal((await one('select pagamento_id from public.consignacao_vendas where id=$1',[sale])).pagamento_id,payment);
  });
  await t.test('edição mantém estoque e acordo histórico, sincroniza total e audita vendedor e data', async () => {
    await db.query('select public.salvar_acordo_consignacao($1,$2,1000,100)',[source,product]);
    const id=(await one('select public.registrar_venda($1,$2,null,2,10,current_date) as id',[product,source])).id;
    await db.query('select public.salvar_acordo_consignacao($1,$2,2000,900)',[source,product]);
    const seller=(await one("insert into public.vendedores(nome) values('Vendedor edição') returning id")).id;
    const before=await stock(source);
    await db.query("select public.editar_venda($1,12,current_date-1,$2,'Correção',0)",[id,seller]);
    const row=await one('select * from public.vendas where id=$1',[id]);
    assert.equal(Number(row.preco_unitario),12);
    assert.equal(row.vendedor_id,seller);
    assert.equal(row.versao,1);
    const snapshot=await one('select * from public.consignacao_vendas where id=$1',[id]);
    assert.equal(Number(snapshot.total_centavos),2400);
    assert.equal(Number(snapshot.repasse_unitario_centavos),100);
    assert.equal(Number(snapshot.repasse_total_centavos),200);
    assert.deepEqual(snapshot.data,row.data);
    assert.equal(await stock(source),before);
    const audit=await one('select * from public.vendas_alteracoes where venda_id=$1',[id]);
    assert.equal(audit.tipo,'edicao');
    assert.equal(Number(audit.antes.preco_unitario),10);
    assert.equal(Number(audit.depois.preco_unitario),12);
    await assert.rejects(db.query("select public.editar_venda($1,13,current_date,null,'Obsoleta',0)",[id]), /alterada/i);
    await assert.rejects(db.query("select public.editar_venda($1,-1,current_date,null,'Inválida',1)",[id]), /inválidos/i);
    await assert.rejects(db.query('update public.vendas set preco_unitario=1 where id=$1',[id]), /permanente/i);
    await assert.rejects(db.query('delete from public.vendas_alteracoes where venda_id=$1',[id]), /permission denied/i);
  });
  await t.test('devolução integral entra no destino escolhido uma única vez e impede pagamento posterior', async () => {
    const id=(await one('select public.registrar_venda($1,$2,null,1,15,current_date) as id',[product,local])).id;
    const origin=await stock(local), target=await stock(other);
    await db.query("select public.devolver_venda($1,$2,'Cliente devolveu',0)",[id,other]);
    assert.equal(await stock(local),origin);
    assert.equal(await stock(other),target+1);
    const returned=await one('select * from public.vendas where id=$1',[id]);
    assert.ok(returned.devolvida_em);
    assert.equal(returned.retorno_local_id,other);
    assert.ok((await one('select devolvida_em from public.consignacao_vendas where id=$1',[id])).devolvida_em);
    const movement=await one("select * from public.consignacao_movimentos where local_id=$1 and tipo='devolucao'",[other]);
    assert.equal(Number(movement.quantidade),1);
    assert.ok(movement.observacoes.includes(id));
    assert.equal((await one('select tipo from public.vendas_alteracoes where venda_id=$1',[id])).tipo,'devolucao');
    await assert.rejects(db.query("select public.devolver_venda($1,$2,'Duplicada',1)",[id,other]), /já devolvida/i);
    await assert.rejects(db.query("select public.editar_venda($1,10,current_date,null,'Edição',1)",[id]), /já devolvida/i);
    assert.equal(await stock(other),target+1);
    const payments=Number((await one('select count(*) as n from public.consignacao_pagamentos')).n);
    await assert.rejects(db.query('select public.pagar_repasses_consignacao($1,$2,current_date,null)',[local,[id]]), /devolvida/i);
    assert.equal(Number((await one('select count(*) as n from public.consignacao_pagamentos')).n),payments);
  });
  await t.test('destino inválido e repasse pago bloqueiam operações sem alterar estoque ou histórico', async () => {
    const id=(await one('select public.registrar_venda($1,$2,null,1,15,current_date) as id',[product,source])).id;
    const inactive=(await one("insert into public.locais_estoque(nome,tipo,ativo) values('Inativo','outro',false) returning id")).id;
    const before=await stock(source);
    await assert.rejects(db.query("select public.devolver_venda($1,$2,'Teste',0)",[id,inactive]), /local ativo/i);
    await assert.rejects(db.query("select public.devolver_venda($1,$2,'',0)",[id,source]), /motivo/i);
    assert.equal(await stock(source),before);
    assert.equal((await one('select devolvida_em from public.vendas where id=$1',[id])).devolvida_em,null);
    await assert.rejects(db.query("select public.devolver_venda($1,$2,'Teste',0)",[sale,source]), /já pago/i);
    await assert.rejects(db.query("select public.editar_venda($1,15,current_date,null,'Teste',0)",[sale]), /já pago/i);
    const orderSale=(await one('select id from public.vendas where pedido_id is not null limit 1')).id;
    await assert.rejects(db.query("select public.editar_venda($1,15,current_date,null,'Teste',0)",[orderSale]), /pedido entregue/i);
    await db.query("select public.devolver_venda($1,$2,'Pedido devolvido',0)",[orderSale,source]);
    assert.equal(await stock(source),before+1);
  });
  await t.test('usuário inativo não lê histórico e não executa pagamento', async () => {
    await db.exec('RESET ROLE'); await db.query('update public.profiles set ativo=false where id=$1',[user]); await db.exec('SET ROLE authenticated');
    assert.equal((await db.query('select * from public.consignacao_vendas')).rows.length,0);
    await assert.rejects(db.query("select public.devolver_venda($1,$2,'Teste',0)",[sale,source]), /autorizado/i);
    await assert.rejects(db.query("select public.editar_venda($1,15,current_date,null,'Teste',0)",[sale]), /autorizado/i);
    await assert.rejects(db.query('select public.pagar_repasses_consignacao($1,$2,current_date,null)',[local,[sale]]), /autorizado/i);
  });
});
