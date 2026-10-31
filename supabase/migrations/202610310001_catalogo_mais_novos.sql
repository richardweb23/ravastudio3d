create or replace function public.catalogo_publico(p_busca text default '',p_categoria uuid default null,p_ordem text default 'novos',p_offset integer default 0,p_slug text default null) returns jsonb
language sql stable security definer set search_path='' as $$
 with selected as (
 select c.*,coalesce(nullif(c.titulo,''),m.nome) nome,m.codigo,cat.nome categoria_nome
 from public.catalogo_produtos c join public.materiais m on m.id=c.material_id
 left join public.catalogo_categorias cat on cat.id=c.categoria_id and cat.ativa
 where c.status='publicado' and (c.categoria_id is null or cat.id is not null)
 and (p_slug is null or c.material_id=(select s.material_id from public.catalogo_slugs s where s.slug=p_slug))
 and (p_categoria is null or c.categoria_id=p_categoria)
 and (coalesce(p_busca,'')='' or coalesce(nullif(c.titulo,''),m.nome) ilike '%'||left(p_busca,150)||'%')
 ), page as (
 select * from selected order by
 case when p_ordem='preco_asc' then coalesce(promocional_centavos,preco_centavos) end asc,
 case when p_ordem='preco_desc' then coalesce(promocional_centavos,preco_centavos) end desc,
 case when p_ordem='novos' then created_at end desc,
 case when p_ordem <> 'novos' then destaque end desc,
 case when p_ordem <> 'novos' then ordem end,
 case when p_ordem <> 'novos' then nome end, material_id limit 24 offset greatest(coalesce(p_offset,0),0)
 ) select jsonb_build_object('total',(select count(*) from selected),'produtos',coalesce((select jsonb_agg(jsonb_build_object(
 'id',material_id,'codigo',codigo,'nome',nome,'slug',slug,'descricao',descricao,'resumo',resumo,'preco_centavos',preco_centavos,'promocional_centavos',promocional_centavos,'categoria_id',categoria_id,'categoria',categoria_nome,'material',material,'dimensoes',dimensoes,'peso_gramas',peso_gramas,'cores',cores,'personalizavel',personalizavel,'prazo',prazo,'destaque',destaque,
 'imagens',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'caminho',i.caminho,'miniatura',i.miniatura,'alt',i.alt) order by i.ordem,i.id) from public.catalogo_imagens i where i.material_id=page.material_id and i.estado='pronta'),'[]'::jsonb)
 ) order by case when p_ordem='preco_asc' then coalesce(promocional_centavos,preco_centavos) end asc,
 case when p_ordem='preco_desc' then coalesce(promocional_centavos,preco_centavos) end desc,
 case when p_ordem='novos' then created_at end desc,
 case when p_ordem <> 'novos' then destaque end desc,
 case when p_ordem <> 'novos' then ordem end,
 case when p_ordem <> 'novos' then nome end, material_id) from page),'[]'::jsonb),'categorias',coalesce((select jsonb_agg(jsonb_build_object('id',id,'nome',nome) order by nome) from public.catalogo_categorias where ativa),'[]'::jsonb));
$$;
