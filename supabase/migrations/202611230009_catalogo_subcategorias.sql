begin;

-- Este contrato lista somente itens publicados. A marca solicitada não é
-- credencial: dados privados continuam fora desta RPC pública.
create or replace function public.catalogo_publico_marca(p_marca text,p_busca text default '',p_categoria uuid default null,p_ordem text default 'novos',p_offset integer default 0,p_slug text default null) returns jsonb
language sql stable security definer set search_path='' as $$
 with marca as (select id from public.marcas where slug=p_marca and ativa), selected as (
 select c.*,coalesce(nullif(c.titulo,''),m.nome) nome,m.codigo,cat.nome categoria_nome,coalesce(cat.marketplace,false) categoria_marketplace,null::text imagem_externa
 from public.catalogo_produtos c
 join public.materiais m on m.id=c.material_id
 join public.marca_materiais mm on mm.material_id=m.id and mm.marca_id=(select id from marca)
 left join public.catalogo_categorias cat on cat.id=c.categoria_id and cat.ativa and (cat.pai_id is null or exists(select 1 from public.catalogo_categorias pai join public.marca_categorias_catalogo mp on mp.categoria_id=pai.id where pai.id=cat.pai_id and pai.ativa and mp.marca_id=(select id from marca)))
 left join public.marca_categorias_catalogo mc on mc.categoria_id=cat.id and mc.marca_id=(select id from marca)
 where c.status='publicado' and (c.categoria_id is null or (cat.id is not null and mc.categoria_id is not null))
 and (p_slug is null or c.material_id=(select s.material_id from public.catalogo_slugs s where s.slug=p_slug))
 and (p_categoria is null or c.categoria_id=p_categoria or cat.pai_id=p_categoria)
 and (coalesce(p_busca,'')='' or coalesce(nullif(c.titulo,''),m.nome) ilike '%'||left(p_busca,150)||'%')
 union all
 select c.material_id,c.titulo,c.descricao,c.resumo,c.slug,c.preco_centavos,c.promocional_centavos,c.categoria_id,c.material,c.dimensoes,c.peso_gramas,c.cores,c.personalizavel,c.prazo,c.destaque,c.status,c.ordem,c.versao,c.created_at,c.updated_at,c.link_marketplace,
 c.titulo nome,null::bigint codigo,cat.nome categoria_nome,true categoria_marketplace,c.imagem_externa
 from public.catalogo_indicacoes c
 join public.marca_indicacoes_catalogo mi on mi.material_id=c.material_id and mi.marca_id=(select id from marca)
 join public.catalogo_categorias cat on cat.id=c.categoria_id and cat.ativa and (cat.pai_id is null or exists(select 1 from public.catalogo_categorias pai join public.marca_categorias_catalogo mp on mp.categoria_id=pai.id where pai.id=cat.pai_id and pai.ativa and mp.marca_id=(select id from marca))) and cat.marketplace
 join public.marca_categorias_catalogo mc on mc.categoria_id=cat.id and mc.marca_id=(select id from marca)
 where c.status='publicado' and (p_slug is null or c.slug=p_slug)
 and (p_categoria is null or c.categoria_id=p_categoria or cat.pai_id=p_categoria)
 and (coalesce(p_busca,'')='' or c.titulo ilike '%'||left(p_busca,150)||'%')
 ), page as (
 select * from selected order by
 case when p_ordem='preco_asc' then coalesce(promocional_centavos,preco_centavos) end asc,
 case when p_ordem='preco_desc' then coalesce(promocional_centavos,preco_centavos) end desc,
 case when p_ordem='novos' then created_at end desc,
 case when p_ordem <> 'novos' then destaque end desc,
 case when p_ordem <> 'novos' then ordem end,
 case when p_ordem <> 'novos' then nome end, material_id limit 24 offset greatest(coalesce(p_offset,0),0)
 ) select jsonb_build_object('total',(select count(*) from selected),'produtos',coalesce((select jsonb_agg(jsonb_build_object(
 'id',material_id,'codigo',codigo,'nome',nome,'slug',slug,'descricao',descricao,'resumo',resumo,'preco_centavos',preco_centavos,'promocional_centavos',promocional_centavos,'categoria_id',categoria_id,'categoria',categoria_nome,'marketplace',categoria_marketplace,'link_marketplace',case when categoria_marketplace then link_marketplace else null end,'material',material,'dimensoes',dimensoes,'peso_gramas',peso_gramas,'cores',cores,'personalizavel',personalizavel,'prazo',prazo,'destaque',destaque,
 'imagem_externa',imagem_externa,'imagens',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'caminho',i.caminho,'miniatura',i.miniatura,'alt',i.alt) order by i.ordem,i.id) from public.catalogo_imagens i where i.material_id=page.material_id and i.estado='pronta'),'[]'::jsonb)
 ) order by case when p_ordem='preco_asc' then coalesce(promocional_centavos,preco_centavos) end asc,
 case when p_ordem='preco_desc' then coalesce(promocional_centavos,preco_centavos) end desc,
 case when p_ordem='novos' then created_at end desc,
 case when p_ordem <> 'novos' then destaque end desc,
 case when p_ordem <> 'novos' then ordem end,
 case when p_ordem <> 'novos' then nome end, material_id) from page),'[]'::jsonb),
 'categorias',coalesce((select jsonb_agg(jsonb_build_object('id',cat.id,'nome',cat.nome,'pai_id',cat.pai_id) order by cat.nome) from public.catalogo_categorias cat join public.marca_categorias_catalogo mc on mc.categoria_id=cat.id where cat.ativa and mc.marca_id=(select id from marca) and (cat.pai_id is null or exists(select 1 from public.catalogo_categorias pai join public.marca_categorias_catalogo mp on mp.categoria_id=pai.id where pai.id=cat.pai_id and pai.ativa and mp.marca_id=(select id from marca)))),'[]'::jsonb));
$$;
revoke all on function public.catalogo_publico_marca(text,text,uuid,text,integer,text) from public;
grant execute on function public.catalogo_publico_marca(text,text,uuid,text,integer,text) to anon, authenticated;


commit;
