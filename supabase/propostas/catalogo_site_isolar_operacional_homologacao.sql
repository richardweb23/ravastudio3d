-- PROTÓTIPO PARA TESTES ISOLADOS: não executar em produção.
-- Remove a dependência criada na homologação sobre o cadastro operacional.
begin;
drop trigger if exists marca_rava_material on public.materiais;

-- Compatibilidade temporária com o catálogo legado: o vínculo antigo é
-- criado somente quando se cadastra um item no catálogo, nunca em materiais.
create function public.site_vinculo_legado_no_catalogo() returns trigger
language plpgsql security definer set search_path='' as $$
declare marca uuid;
begin
 if exists(select 1 from public.marca_materiais where material_id=new.material_id) then return new; end if;
 if new.categoria_id is not null then
  select marca_id into marca from public.marca_categorias_catalogo where categoria_id=new.categoria_id;
 else
  select id into marca from public.marcas where slug='rava';
 end if;
 if marca is null then raise exception 'Categoria de catálogo sem vínculo reconhecido'; end if;
 insert into public.marca_materiais(material_id,marca_id) values(new.material_id,marca) on conflict(material_id) do nothing;
 return new;
end; $$;
revoke all on function public.site_vinculo_legado_no_catalogo() from public,anon,authenticated;
create trigger aa_site_vinculo_legado before insert on public.catalogo_produtos for each row execute function public.site_vinculo_legado_no_catalogo();

-- A indicação pertence apenas ao catálogo; a categoria legada continua
-- preservada quando já existe, mas não é exigida para novas indicações.
alter table public.catalogo_indicacoes alter column categoria_id drop not null;
create or replace function public.validar_indicacao_catalogo() returns trigger language plpgsql set search_path='' as $$
begin
 if new.categoria_id is not null and not exists(select 1 from public.catalogo_categorias where id=new.categoria_id and marketplace) then raise exception 'Selecione uma categoria Marketplace'; end if;
 if exists(select 1 from public.catalogo_slugs where slug=new.slug) then raise exception 'Este endereço já pertence a outro produto'; end if;
 if new.status='publicado' and new.categoria_id is not null and not exists(select 1 from public.catalogo_categorias where id=new.categoria_id and ativa) then raise exception 'Selecione uma categoria ativa'; end if;
 if tg_op='UPDATE' then new.updated_at:=now(); new.versao:=old.versao+1; end if;
 return new;
end;$$;

-- Definição anterior à etapa intermediária de vínculo de marca.
create or replace function public.duplicar_catalogo(p_produto uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare m public.materiais; c public.catalogo_produtos; novo uuid; codigo bigint;
begin
 if not public.usuario_ativo() then raise exception 'Acesso não autorizado';end if;
 select * into m from public.materiais where id=p_produto;
 if not found then raise exception 'Produto não encontrado';end if;
 select * into c from public.catalogo_produtos where material_id=p_produto;
 insert into public.materiais(nome,unidade,custo_medio,categoria,filamento_gramas,filamento_valor_kg)
 values(m.nome||' (cópia)',m.unidade,m.custo_medio,m.categoria,m.filamento_gramas,m.filamento_valor_kg) returning id,public.materiais.codigo into novo,codigo;
 perform public.salvar_catalogo(novo,coalesce(to_jsonb(c),'{}'::jsonb)||jsonb_build_object('slug','produto-'||codigo,'status','rascunho','titulo',coalesce(nullif(c.titulo,''),m.nome)||' (cópia)'),null);
 return novo;
end;$$;
-- Restaura o contrato legado para integrações existentes; os sites usam a nova consulta.
create or replace function public.catalogo_publico(p_busca text default '',p_categoria uuid default null,p_ordem text default 'novos',p_offset integer default 0,p_slug text default null) returns jsonb
language sql stable security definer set search_path='' as $$
 with selected as (
 select c.*,coalesce(nullif(c.titulo,''),m.nome) nome,m.codigo,cat.nome categoria_nome, coalesce(cat.marketplace,false) categoria_marketplace, null::text imagem_externa
 from public.catalogo_produtos c join public.materiais m on m.id=c.material_id
 left join public.catalogo_categorias cat on cat.id=c.categoria_id and cat.ativa
 where c.status='publicado' and (c.categoria_id is null or cat.id is not null)
 and (p_slug is null or c.material_id=(select s.material_id from public.catalogo_slugs s where s.slug=p_slug))
 and (p_categoria is null or c.categoria_id=p_categoria)
 and (coalesce(p_busca,'')='' or coalesce(nullif(c.titulo,''),m.nome) ilike '%'||left(p_busca,150)||'%')
 union all
 select c.material_id,c.titulo,c.descricao,c.resumo,c.slug,c.preco_centavos,c.promocional_centavos,c.categoria_id,c.material,c.dimensoes,c.peso_gramas,c.cores,c.personalizavel,c.prazo,c.destaque,c.status,c.ordem,c.versao,c.created_at,c.updated_at,c.link_marketplace,
 c.titulo nome,null::bigint codigo,cat.nome categoria_nome,true categoria_marketplace,c.imagem_externa
 from public.catalogo_indicacoes c join public.catalogo_categorias cat on cat.id=c.categoria_id and cat.ativa and cat.marketplace
 where c.status='publicado' and (p_slug is null or c.slug=p_slug)
 and (p_categoria is null or c.categoria_id=p_categoria)
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
 case when p_ordem <> 'novos' then nome end, material_id) from page),'[]'::jsonb),'categorias',coalesce((select jsonb_agg(jsonb_build_object('id',id,'nome',nome) order by nome) from public.catalogo_categorias where ativa),'[]'::jsonb));
$$;
commit;
