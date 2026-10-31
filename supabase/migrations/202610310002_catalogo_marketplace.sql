alter table public.catalogo_categorias add column marketplace boolean not null default false;
alter table public.catalogo_produtos add column link_marketplace text check (link_marketplace is null or (length(link_marketplace) <= 2048 and link_marketplace ~* '^https?://[^/[:space:]@]+([/?#][^[:space:]]*)?$'));

create or replace function public.salvar_catalogo(p_material_id uuid,p_dados jsonb,p_versao integer default null) returns public.catalogo_produtos
language plpgsql security definer set search_path='' as $$
declare c public.catalogo_produtos; novo public.catalogo_produtos; codigo bigint; v_slug text;
begin
 if not public.usuario_ativo() then raise exception 'Acesso não autorizado';end if;
 select m.codigo into codigo from public.materiais m where id=p_material_id for update;
 if not found then raise exception 'Produto não encontrado';end if;
 select * into c from public.catalogo_produtos where material_id=p_material_id for update;
 if found and c.versao is distinct from p_versao then raise exception 'Produto alterado por outra sessão. Reabra a edição';end if;
 if coalesce(p_dados->>'status','rascunho')='publicado' and exists(select 1 from public.catalogo_categorias where id=nullif(p_dados->>'categoria_id','')::uuid and marketplace) and nullif(btrim(case when p_dados ? 'link_marketplace' then p_dados->>'link_marketplace' else c.link_marketplace end),'') is null then raise exception 'Informe o link de compra do Marketplace para publicar'; end if;
 v_slug:=coalesce(nullif(btrim(p_dados->>'slug'),''),'produto-'||codigo);
 -- Reserve every old and current slug; an old link can never point to another product.
 if exists(select 1 from public.catalogo_slugs s where s.slug=v_slug and s.material_id<>p_material_id) then raise exception 'Este endereço já pertence a outro produto';end if;
 insert into public.catalogo_produtos(material_id,titulo,descricao,resumo,slug,preco_centavos,promocional_centavos,categoria_id,material,dimensoes,peso_gramas,cores,personalizavel,prazo,destaque,status,ordem,link_marketplace)
 values(p_material_id,btrim(coalesce(p_dados->>'titulo','')),btrim(coalesce(p_dados->>'descricao','')),btrim(coalesce(p_dados->>'resumo','')),v_slug,
 coalesce((p_dados->>'preco_centavos')::bigint,0),nullif(p_dados->>'promocional_centavos','')::bigint,nullif(p_dados->>'categoria_id','')::uuid,
 coalesce(p_dados->>'material',''),coalesce(p_dados->>'dimensoes',''),nullif(p_dados->>'peso_gramas','')::numeric,coalesce(p_dados->>'cores',''),coalesce((p_dados->>'personalizavel')::boolean,false),coalesce(p_dados->>'prazo',''),coalesce((p_dados->>'destaque')::boolean,false),coalesce(p_dados->>'status','rascunho'),coalesce((p_dados->>'ordem')::integer,0),case when p_dados ? 'link_marketplace' then nullif(btrim(p_dados->>'link_marketplace'),'') else c.link_marketplace end)
 on conflict(material_id) do update set titulo=excluded.titulo,descricao=excluded.descricao,resumo=excluded.resumo,slug=excluded.slug,preco_centavos=excluded.preco_centavos,promocional_centavos=excluded.promocional_centavos,categoria_id=excluded.categoria_id,material=excluded.material,dimensoes=excluded.dimensoes,peso_gramas=excluded.peso_gramas,cores=excluded.cores,personalizavel=excluded.personalizavel,prazo=excluded.prazo,destaque=excluded.destaque,status=excluded.status,ordem=excluded.ordem,link_marketplace=excluded.link_marketplace,versao=public.catalogo_produtos.versao+1,updated_at=now()
 returning * into novo;
 insert into public.catalogo_slugs(slug,material_id) values(novo.slug,p_material_id) on conflict do nothing;
 if exists(select 1 from public.catalogo_slugs s where s.slug=novo.slug and s.material_id<>p_material_id) then raise exception 'Este endereço já pertence a outro produto';end if;
 return novo;
end;$$;

create or replace function public.catalogo_publico(p_busca text default '',p_categoria uuid default null,p_ordem text default 'novos',p_offset integer default 0,p_slug text default null) returns jsonb
language sql stable security definer set search_path='' as $$
 with selected as (
 select c.*,coalesce(nullif(c.titulo,''),m.nome) nome,m.codigo,cat.nome categoria_nome, coalesce(cat.marketplace,false) categoria_marketplace
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
 'id',material_id,'codigo',codigo,'nome',nome,'slug',slug,'descricao',descricao,'resumo',resumo,'preco_centavos',preco_centavos,'promocional_centavos',promocional_centavos,'categoria_id',categoria_id,'categoria',categoria_nome,'marketplace',categoria_marketplace,'link_marketplace',case when categoria_marketplace then link_marketplace else null end,'material',material,'dimensoes',dimensoes,'peso_gramas',peso_gramas,'cores',cores,'personalizavel',personalizavel,'prazo',prazo,'destaque',destaque,
 'imagens',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'caminho',i.caminho,'miniatura',i.miniatura,'alt',i.alt) order by i.ordem,i.id) from public.catalogo_imagens i where i.material_id=page.material_id and i.estado='pronta'),'[]'::jsonb)
 ) order by case when p_ordem='preco_asc' then coalesce(promocional_centavos,preco_centavos) end asc,
 case when p_ordem='preco_desc' then coalesce(promocional_centavos,preco_centavos) end desc,
 case when p_ordem='novos' then created_at end desc,
 case when p_ordem <> 'novos' then destaque end desc,
 case when p_ordem <> 'novos' then ordem end,
 case when p_ordem <> 'novos' then nome end, material_id) from page),'[]'::jsonb),'categorias',coalesce((select jsonb_agg(jsonb_build_object('id',id,'nome',nome) order by nome) from public.catalogo_categorias where ativa),'[]'::jsonb));
$$;
