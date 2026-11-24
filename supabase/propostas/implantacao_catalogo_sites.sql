begin;

do $$
begin
  if to_regclass('public.site_categorias_principais') is not null
    or to_regclass('public.site_subcategorias') is not null
    or to_regclass('public.site_classificacao_produtos') is not null
    or to_regclass('public.site_classificacao_indicacoes') is not null then
    raise exception 'Estruturas de classificação do site já existem; revisar antes de prosseguir';
  end if;
  if to_regprocedure('public.catalogo_publico(text,uuid,text,integer,text)') is null
    or to_regprocedure('public.usuario_ativo()') is null
    or to_regprocedure('public.validar_indicacao_catalogo()') is null then
    raise exception 'Função esperada do catálogo não encontrada';
  end if;
  if md5(regexp_replace(pg_get_functiondef('public.validar_indicacao_catalogo()'::regprocedure), '\s+', '', 'g')) <> '2a30026c69613ded27f9ef3ad65e6b2f' then
    raise exception 'Validação legada das indicações mudou; revisar antes de prosseguir';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public'
    and table_name='catalogo_indicacoes' and column_name='categoria_id' and is_nullable='NO') then
    raise exception 'Restrição legada da categoria de indicação divergente';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid='public.catalogo_indicacoes'::regclass
    and tgname='validar_indicacao_catalogo' and not tgisinternal and tgenabled <> 'D'
    and tgfoid='public.validar_indicacao_catalogo()'::regprocedure) then
    raise exception 'Gatilho esperado de indicação ausente ou desativado';
  end if;
end; $$;
-- PROTÓTIPO PARA TESTES ISOLADOS: não é migration de produção nem de homologação.
-- Estas tabelas classificam somente o conteúdo publicado no catálogo do site.

create table public.site_categorias_principais (
  id text primary key check (id in ('rava', 'rivoxel')),
  nome text not null
);
insert into public.site_categorias_principais(id,nome) values ('rava','Rava'),('rivoxel','Rivoxel');

create table public.site_subcategorias (
  id uuid primary key default gen_random_uuid(),
  principal_id text not null references public.site_categorias_principais(id),
  nome text not null check (length(btrim(nome)) between 1 and 100),
  ativa boolean not null default true,
  unique (principal_id,id)
);

create table public.site_classificacao_produtos (
  produto_id uuid primary key references public.catalogo_produtos(material_id) on delete cascade,
  principal_id text not null references public.site_categorias_principais(id),
  subcategoria_id uuid,
  foreign key (principal_id,subcategoria_id) references public.site_subcategorias(principal_id,id)
);

create table public.site_classificacao_indicacoes (
  indicacao_id uuid primary key references public.catalogo_indicacoes(material_id) on delete cascade,
  principal_id text not null references public.site_categorias_principais(id),
  subcategoria_id uuid,
  foreign key (principal_id,subcategoria_id) references public.site_subcategorias(principal_id,id)
);

alter table public.site_categorias_principais enable row level security;
alter table public.site_subcategorias enable row level security;
alter table public.site_classificacao_produtos enable row level security;
alter table public.site_classificacao_indicacoes enable row level security;
revoke all on public.site_categorias_principais, public.site_subcategorias, public.site_classificacao_produtos, public.site_classificacao_indicacoes from public, anon, authenticated;
grant select on public.site_categorias_principais, public.site_subcategorias, public.site_classificacao_produtos, public.site_classificacao_indicacoes to authenticated;
create policy site_principais_leitura on public.site_categorias_principais for select to authenticated using (public.usuario_ativo());
create policy site_subcategorias_leitura on public.site_subcategorias for select to authenticated using (public.usuario_ativo());
create policy site_produtos_leitura on public.site_classificacao_produtos for select to authenticated using (public.usuario_ativo());
create policy site_indicacoes_leitura on public.site_classificacao_indicacoes for select to authenticated using (public.usuario_ativo());

create function public.site_classificar_produto(p_produto_id uuid, p_principal_id text, p_subcategoria_id uuid default null)
returns void language plpgsql security definer set search_path='' as $$
begin
  if public.usuario_ativo() is not true then raise exception 'Usuário não autorizado'; end if;
  if not exists(select 1 from public.site_categorias_principais where id=p_principal_id) then raise exception 'Categoria principal inválida'; end if;
  if p_subcategoria_id is not null and not exists(select 1 from public.site_subcategorias where id=p_subcategoria_id and principal_id=p_principal_id and ativa) then
    raise exception 'Selecione uma subcategoria ativa da categoria principal';
  end if;
  if not exists(select 1 from public.catalogo_produtos where material_id=p_produto_id) then raise exception 'Produto não encontrado no catálogo do site'; end if;
  insert into public.site_classificacao_produtos(produto_id,principal_id,subcategoria_id)
  values(p_produto_id,p_principal_id,p_subcategoria_id)
  on conflict(produto_id) do update set principal_id=excluded.principal_id,subcategoria_id=excluded.subcategoria_id;
end; $$;
revoke all on function public.site_classificar_produto(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.site_classificar_produto(uuid,text,uuid) to authenticated;

create function public.site_salvar_subcategoria(p_id uuid, p_principal_id text, p_nome text, p_ativa boolean default true)
returns uuid language plpgsql security definer set search_path='' as $$
declare resultado uuid;
begin
  if public.usuario_ativo() is not true then raise exception 'Usuário não autorizado'; end if;
  if not exists(select 1 from public.site_categorias_principais where id=p_principal_id) then raise exception 'Categoria principal inválida'; end if;
  if p_nome is null or length(btrim(p_nome)) not between 1 and 100 then raise exception 'Informe o nome da subcategoria'; end if;
  if p_id is null then
    insert into public.site_subcategorias(principal_id,nome,ativa) values(p_principal_id,btrim(p_nome),coalesce(p_ativa,true)) returning id into resultado;
  else
    update public.site_subcategorias set nome=btrim(p_nome),ativa=coalesce(p_ativa,true)
    where id=p_id and principal_id=p_principal_id returning id into resultado;
    if resultado is null then raise exception 'Subcategoria não encontrada nesta categoria principal'; end if;
  end if;
  return resultado;
end; $$;
revoke all on function public.site_salvar_subcategoria(uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.site_salvar_subcategoria(uuid,text,text,boolean) to authenticated;

create function public.site_classificar_indicacao(p_indicacao_id uuid, p_principal_id text, p_subcategoria_id uuid default null)
returns void language plpgsql security definer set search_path='' as $$
begin
  if public.usuario_ativo() is not true then raise exception 'Usuário não autorizado'; end if;
  if not exists(select 1 from public.site_categorias_principais where id=p_principal_id) then raise exception 'Categoria principal inválida'; end if;
  if p_subcategoria_id is not null and not exists(select 1 from public.site_subcategorias where id=p_subcategoria_id and principal_id=p_principal_id and ativa) then
    raise exception 'Selecione uma subcategoria ativa da categoria principal';
  end if;
  if not exists(select 1 from public.catalogo_indicacoes where material_id=p_indicacao_id) then raise exception 'Indicação não encontrada no catálogo do site'; end if;
  insert into public.site_classificacao_indicacoes(indicacao_id,principal_id,subcategoria_id)
  values(p_indicacao_id,p_principal_id,p_subcategoria_id)
  on conflict(indicacao_id) do update set principal_id=excluded.principal_id,subcategoria_id=excluded.subcategoria_id;
end; $$;
revoke all on function public.site_classificar_indicacao(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.site_classificar_indicacao(uuid,text,uuid) to authenticated;

create function public.site_configuracao_catalogo()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if public.usuario_ativo() is not true then raise exception 'Usuário não autorizado'; end if;
  return jsonb_build_object(
    'principais',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'nome',nome) order by nome),'[]'::jsonb) from public.site_categorias_principais),
    'subcategorias',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'principal_id',principal_id,'nome',nome,'ativa',ativa) order by nome,id),'[]'::jsonb) from public.site_subcategorias),
    'produtos',(select coalesce(jsonb_agg(jsonb_build_object('produto_id',produto_id,'principal_id',principal_id,'subcategoria_id',subcategoria_id)),'[]'::jsonb) from public.site_classificacao_produtos),
    'indicacoes',(select coalesce(jsonb_agg(jsonb_build_object('indicacao_id',indicacao_id,'principal_id',principal_id,'subcategoria_id',subcategoria_id)),'[]'::jsonb) from public.site_classificacao_indicacoes)
  );
end; $$;
revoke all on function public.site_configuracao_catalogo() from public,anon,authenticated;
grant execute on function public.site_configuracao_catalogo() to authenticated;

-- Nova consulta pública isolada. O contrato antigo permanece intacto.
create function public.site_catalogo_publico(p_principal_id text, p_busca text default '', p_subcategoria_id uuid default null, p_ordem text default 'novos', p_offset integer default 0, p_slug text default null)
returns jsonb language sql stable security definer set search_path='' as $$
 with selecionados as (
  select c.material_id,coalesce(nullif(c.titulo,''),m.nome) as nome,m.codigo,c.slug,c.descricao,c.resumo,
   c.preco_centavos,c.promocional_centavos,s.id as categoria_id,s.nome as categoria,
   coalesce(antiga.marketplace,false) as marketplace,c.link_marketplace,c.material,c.dimensoes,c.peso_gramas,c.cores,
   c.personalizavel,c.prazo,c.destaque,c.ordem,c.created_at,null::text as imagem_externa
  from public.catalogo_produtos c
  join public.materiais m on m.id=c.material_id
  join public.site_classificacao_produtos sc on sc.produto_id=c.material_id and sc.principal_id=p_principal_id
  left join public.site_subcategorias s on s.id=sc.subcategoria_id and s.principal_id=sc.principal_id and s.ativa
  left join public.catalogo_categorias antiga on antiga.id=c.categoria_id
  where c.status='publicado' and (sc.subcategoria_id is null or s.id is not null)
   and (p_subcategoria_id is null or s.id=p_subcategoria_id)
   and (p_slug is null or c.material_id=(select sl.material_id from public.catalogo_slugs sl where sl.slug=p_slug))
   and (coalesce(p_busca,'')='' or coalesce(nullif(c.titulo,''),m.nome) ilike '%'||left(p_busca,150)||'%')
  union all
  select c.material_id,c.titulo,null::bigint,c.slug,c.descricao,c.resumo,c.preco_centavos,c.promocional_centavos,
   s.id,s.nome,true,c.link_marketplace,c.material,c.dimensoes,c.peso_gramas,c.cores,c.personalizavel,c.prazo,
   c.destaque,c.ordem,c.created_at,c.imagem_externa
  from public.catalogo_indicacoes c
  join public.site_classificacao_indicacoes sc on sc.indicacao_id=c.material_id and sc.principal_id=p_principal_id
  left join public.site_subcategorias s on s.id=sc.subcategoria_id and s.principal_id=sc.principal_id and s.ativa
  where c.status='publicado' and (sc.subcategoria_id is null or s.id is not null)
   and (p_subcategoria_id is null or s.id=p_subcategoria_id)
   and (p_slug is null or c.slug=p_slug)
   and (coalesce(p_busca,'')='' or c.titulo ilike '%'||left(p_busca,150)||'%')
 ), pagina as (
  select * from selecionados order by
   case when p_ordem='preco_asc' then coalesce(promocional_centavos,preco_centavos) end asc,
   case when p_ordem='preco_desc' then coalesce(promocional_centavos,preco_centavos) end desc,
   case when p_ordem='novos' then created_at end desc,
   case when p_ordem<>'novos' then destaque end desc,
   case when p_ordem<>'novos' then ordem end,
   case when p_ordem<>'novos' then nome end,material_id
  limit 24 offset greatest(coalesce(p_offset,0),0)
 )
 select jsonb_build_object(
  'total',(select count(*) from selecionados),
  'produtos',coalesce((select jsonb_agg(jsonb_build_object(
   'id',material_id,'codigo',codigo,'nome',nome,'slug',slug,'descricao',descricao,'resumo',resumo,
   'preco_centavos',preco_centavos,'promocional_centavos',promocional_centavos,'categoria_id',categoria_id,'categoria',categoria,
   'marketplace',marketplace,'link_marketplace',case when marketplace then link_marketplace else null end,
   'material',material,'dimensoes',dimensoes,'peso_gramas',peso_gramas,'cores',cores,'personalizavel',personalizavel,
   'prazo',prazo,'destaque',destaque,'imagem_externa',imagem_externa,
   'imagens',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'caminho',i.caminho,'miniatura',i.miniatura,'alt',i.alt) order by i.ordem,i.id) from public.catalogo_imagens i where i.material_id=pagina.material_id and i.estado='pronta'),'[]'::jsonb)
  ) order by
   case when p_ordem='preco_asc' then coalesce(promocional_centavos,preco_centavos) end asc,
   case when p_ordem='preco_desc' then coalesce(promocional_centavos,preco_centavos) end desc,
   case when p_ordem='novos' then created_at end desc,
   case when p_ordem<>'novos' then destaque end desc,
   case when p_ordem<>'novos' then ordem end,
   case when p_ordem<>'novos' then nome end,material_id) from pagina),'[]'::jsonb),
  'categorias',coalesce((select jsonb_agg(jsonb_build_object('id',id,'nome',nome) order by nome,id) from public.site_subcategorias where principal_id=p_principal_id and ativa),'[]'::jsonb)
 );
$$;
revoke all on function public.site_catalogo_publico(text,text,uuid,text,integer,text) from public,anon,authenticated;
grant execute on function public.site_catalogo_publico(text,text,uuid,text,integer,text) to anon,authenticated;

-- PROPOSTA PARA TESTE ISOLADO: não executar em produção sem plano revisado.
-- Classifica apenas itens já publicados, sem alterar seus dados originais.

lock table public.catalogo_categorias, public.catalogo_produtos, public.catalogo_indicacoes in share mode;
lock table public.site_subcategorias, public.site_classificacao_produtos, public.site_classificacao_indicacoes in share row exclusive mode;

do $$
begin
 if not exists(select 1 from public.site_categorias_principais where id='rava') then
  raise exception 'Categoria principal Rava não encontrada';
 end if;
 if exists(select 1 from public.site_subcategorias) or exists(select 1 from public.site_classificacao_produtos) or exists(select 1 from public.site_classificacao_indicacoes) then
  raise exception 'A classificação nova já contém dados; revise antes de transferir';
 end if;
end; $$;

create temporary table mapa_subcategorias_rava (anterior_id uuid primary key, nova_id uuid not null) on commit drop;
insert into mapa_subcategorias_rava(anterior_id,nova_id)
 select id,gen_random_uuid() from public.catalogo_categorias;
insert into public.site_subcategorias(id,principal_id,nome,ativa)
 select mapa.nova_id,'rava',c.nome,c.ativa from mapa_subcategorias_rava mapa
 join public.catalogo_categorias c on c.id=mapa.anterior_id;

insert into public.site_classificacao_produtos(produto_id,principal_id,subcategoria_id)
 select p.material_id,'rava',mapa.nova_id from public.catalogo_produtos p
 left join mapa_subcategorias_rava mapa on mapa.anterior_id=p.categoria_id
 where p.status='publicado';
insert into public.site_classificacao_indicacoes(indicacao_id,principal_id,subcategoria_id)
 select i.material_id,'rava',mapa.nova_id from public.catalogo_indicacoes i
 left join mapa_subcategorias_rava mapa on mapa.anterior_id=i.categoria_id
 where i.status='publicado';

do $$
begin
 if (select count(*) from public.site_classificacao_produtos)<>(select count(*) from public.catalogo_produtos where status='publicado')
 or (select count(*) from public.site_classificacao_indicacoes)<>(select count(*) from public.catalogo_indicacoes where status='publicado')
 or exists(select 1 from public.site_classificacao_produtos where principal_id<>'rava')
 or exists(select 1 from public.site_classificacao_indicacoes where principal_id<>'rava') then
  raise exception 'Classificação inicial incompleta; nenhuma alteração foi aplicada';
 end if;
end; $$;

-- PROPOSTA PARA TESTE ISOLADO: modifica somente indicações do catálogo do site.

alter table public.catalogo_indicacoes alter column categoria_id drop not null;
create or replace function public.validar_indicacao_catalogo() returns trigger language plpgsql set search_path='' as $$
begin
 if new.categoria_id is not null and not exists(select 1 from public.catalogo_categorias where id=new.categoria_id and marketplace) then raise exception 'Selecione uma categoria Marketplace'; end if;
 if exists(select 1 from public.catalogo_slugs where slug=new.slug) then raise exception 'Este endereço já pertence a outro produto'; end if;
 if new.status='publicado' and new.categoria_id is not null and not exists(select 1 from public.catalogo_categorias where id=new.categoria_id and ativa)
   and not exists(select 1 from public.site_classificacao_indicacoes where indicacao_id=new.material_id) then
  raise exception 'Selecione uma categoria ativa';
 end if;
 if tg_op='UPDATE' then new.updated_at:=now(); new.versao:=old.versao+1; end if;
 return new;
end;$$;

commit;
