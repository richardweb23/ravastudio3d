-- PROPOSTA PARA TESTE ISOLADO: não executar em produção sem plano revisado.
-- Classifica apenas itens já publicados, sem alterar seus dados originais.
begin;
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
commit;
