create table public.catalogo_indicacoes (
 material_id uuid primary key default gen_random_uuid(),
 titulo text not null check(length(btrim(titulo)) between 1 and 180), descricao text not null default '' check(length(descricao)<=10000),
 resumo text not null default '' check(length(resumo)<=300), slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 preco_centavos bigint not null default 0 check(preco_centavos between 0 and 1000000000), promocional_centavos bigint check(promocional_centavos>=0 and promocional_centavos<preco_centavos),
 categoria_id uuid not null references public.catalogo_categorias(id) on delete restrict,
 material text not null default '', dimensoes text not null default '', peso_gramas numeric(14,3), cores text not null default '',
 personalizavel boolean not null default false, prazo text not null default '', destaque boolean not null default false,
 status text not null default 'rascunho' check(status in ('rascunho','publicado','inativo')),
 ordem integer not null default 0, versao integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 link_marketplace text not null check(link_marketplace ~* '^https?://[^/[:space:]@]+([/?#][^[:space:]]*)?$' and length(link_marketplace)<=2048),
 imagem_externa text check(imagem_externa is null or (imagem_externa ~* '^https?://[^/[:space:]@]+([/?#][^[:space:]]*)?$' and length(imagem_externa)<=2048)),
 check(status<>'publicado' or length(btrim(descricao))>0)
);
alter table public.catalogo_indicacoes enable row level security;
create policy indicacoes_staff on public.catalogo_indicacoes for all to authenticated using(public.usuario_ativo()) with check(public.usuario_ativo());
revoke all on public.catalogo_indicacoes from public,anon,authenticated;
grant select,insert,update,delete on public.catalogo_indicacoes to authenticated;
create function public.validar_indicacao_catalogo() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.catalogo_categorias where id=new.categoria_id and marketplace) then raise exception 'Selecione uma categoria Marketplace'; end if;
 if exists(select 1 from public.catalogo_slugs where slug=new.slug) then raise exception 'Este endereço já pertence a outro produto'; end if;
 if new.status='publicado' and not exists(select 1 from public.catalogo_categorias where id=new.categoria_id and ativa) then raise exception 'Selecione uma categoria ativa'; end if;
 if tg_op='UPDATE' then new.updated_at:=now(); new.versao:=old.versao+1; end if;
 return new;
end;$$;
create trigger validar_indicacao_catalogo before insert or update on public.catalogo_indicacoes for each row execute function public.validar_indicacao_catalogo();
-- Reserve standalone slugs so normal catalog entries cannot claim them.
create function public.validar_slug_catalogo_indicacao() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.catalogo_indicacoes where slug=new.slug) then raise exception 'Este endereço já pertence a uma indicação'; end if;
 return new;
end;$$;
create trigger validar_slug_catalogo_indicacao before insert or update of slug on public.catalogo_produtos for each row execute function public.validar_slug_catalogo_indicacao();

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
