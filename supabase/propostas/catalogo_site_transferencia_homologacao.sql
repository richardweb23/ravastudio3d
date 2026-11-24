-- PROTÓTIPO PARA HOMOLOGAÇÃO, não executar em produção. Conserva os registros antigos.
-- Depende de catalogo_site_categorias.sql e do modelo anterior de homologação.
begin;

-- Evita que edições concorrentes produzam uma cópia inconsistente.
lock table public.catalogo_categorias, public.catalogo_produtos, public.catalogo_indicacoes,
 public.marca_categorias_catalogo, public.marca_materiais, public.marca_indicacoes_catalogo, public.marcas in share mode;
lock table public.site_subcategorias, public.site_classificacao_produtos, public.site_classificacao_indicacoes in share row exclusive mode;

do $$
begin
 if exists(select 1 from public.site_subcategorias) or exists(select 1 from public.site_classificacao_produtos) or exists(select 1 from public.site_classificacao_indicacoes) then
  raise exception 'A classificação nova já contém dados; revise antes de transferir';
 end if;
 if exists(select 1 from public.catalogo_categorias where pai_id is not null) then
  raise exception 'Há categorias em mais de um nível; defina como preservá-las antes da transferência';
 end if;
 if exists(select 1 from public.catalogo_categorias c left join public.marca_categorias_catalogo mc on mc.categoria_id=c.id left join public.marcas m on m.id=mc.marca_id where m.slug is null or m.slug not in ('rava','rivoxel')) then
  raise exception 'Há categoria sem vínculo de site reconhecido';
 end if;
 if exists(select 1 from public.catalogo_produtos p left join public.marca_materiais mm on mm.material_id=p.material_id left join public.marcas m on m.id=mm.marca_id where p.status='publicado' and (m.slug is null or m.slug not in ('rava','rivoxel'))) then
  raise exception 'Há produto do catálogo sem vínculo de site reconhecido';
 end if;
 if exists(select 1 from public.catalogo_indicacoes i left join public.marca_indicacoes_catalogo mi on mi.material_id=i.material_id left join public.marcas m on m.id=mi.marca_id where i.status='publicado' and (m.slug is null or m.slug not in ('rava','rivoxel'))) then
  raise exception 'Há indicação sem vínculo de site reconhecido';
 end if;
 if exists(select 1 from public.catalogo_produtos p join public.marca_materiais mm on mm.material_id=p.material_id left join public.marca_categorias_catalogo mc on mc.categoria_id=p.categoria_id where p.status='publicado' and p.categoria_id is not null and mc.marca_id is distinct from mm.marca_id)
 or exists(select 1 from public.catalogo_indicacoes i join public.marca_indicacoes_catalogo mi on mi.material_id=i.material_id left join public.marca_categorias_catalogo mc on mc.categoria_id=i.categoria_id where i.status='publicado' and mc.marca_id is distinct from mi.marca_id) then
  raise exception 'Há itens com categoria e vínculo de site divergentes';
 end if;
end; $$;

create temporary table mapa_subcategorias_site (anterior_id uuid primary key, nova_id uuid not null, principal_id text not null) on commit drop;
insert into mapa_subcategorias_site(anterior_id,nova_id,principal_id)
 select c.id,gen_random_uuid(),m.slug from public.catalogo_categorias c
 join public.marca_categorias_catalogo mc on mc.categoria_id=c.id
 join public.marcas m on m.id=mc.marca_id;

insert into public.site_subcategorias(id,principal_id,nome,ativa)
 select mapa.nova_id,mapa.principal_id,c.nome,c.ativa from mapa_subcategorias_site mapa
 join public.catalogo_categorias c on c.id=mapa.anterior_id;

insert into public.site_classificacao_produtos(produto_id,principal_id,subcategoria_id)
 select p.material_id,m.slug,mapa.nova_id from public.catalogo_produtos p
 join public.marca_materiais mm on mm.material_id=p.material_id
 join public.marcas m on m.id=mm.marca_id
 left join mapa_subcategorias_site mapa on mapa.anterior_id=p.categoria_id
 where p.status='publicado';

insert into public.site_classificacao_indicacoes(indicacao_id,principal_id,subcategoria_id)
 select i.material_id,m.slug,mapa.nova_id from public.catalogo_indicacoes i
 join public.marca_indicacoes_catalogo mi on mi.material_id=i.material_id
 join public.marcas m on m.id=mi.marca_id
 left join mapa_subcategorias_site mapa on mapa.anterior_id=i.categoria_id
 where i.status='publicado';

do $$
begin
 if (select count(*) from public.site_subcategorias)<>(select count(*) from public.catalogo_categorias)
 or (select count(*) from public.site_classificacao_produtos)<>(select count(*) from public.catalogo_produtos where status='publicado')
 or (select count(*) from public.site_classificacao_indicacoes)<>(select count(*) from public.catalogo_indicacoes where status='publicado') then
  raise exception 'Transferência incompleta; nenhuma alteração foi aplicada';
 end if;
end; $$;
commit;
