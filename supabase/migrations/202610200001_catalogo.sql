begin;
create sequence public.produto_codigo_seq;
alter table public.materiais add column codigo bigint;
alter table public.materiais disable trigger materiais_updated_at;
with numbered as (select id,row_number() over(order by created_at,id) n from public.materiais)
update public.materiais m set codigo=n.n from numbered n where n.id=m.id;
alter table public.materiais enable trigger materiais_updated_at;
select setval('public.produto_codigo_seq',coalesce((select max(codigo) from public.materiais),0)+1,false);
alter table public.materiais alter column codigo set not null, alter column codigo set default nextval('public.produto_codigo_seq');
alter table public.materiais add constraint materiais_codigo_unique unique(codigo);
grant usage on sequence public.produto_codigo_seq to authenticated;
create function public.proteger_codigo_produto() returns trigger language plpgsql set search_path='' as $$
begin if new.codigo is distinct from old.codigo then raise exception 'O código do produto é permanente'; end if;return new;end;$$;
create trigger materiais_codigo_permanente before update of codigo on public.materiais for each row execute function public.proteger_codigo_produto();

create table public.catalogo_categorias (
 id uuid primary key default gen_random_uuid(), nome text not null check(length(btrim(nome)) between 1 and 100),
 slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), ativa boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.catalogo_produtos (
 material_id uuid primary key references public.materiais(id) on delete restrict,
 titulo text not null default '' check(length(titulo)<=180), descricao text not null default '' check(length(descricao)<=10000),
 resumo text not null default '' check(length(resumo)<=300), slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 preco_centavos bigint not null default 0 check(preco_centavos between 0 and 1000000000),
 promocional_centavos bigint check(promocional_centavos>=0 and promocional_centavos<preco_centavos),
 categoria_id uuid references public.catalogo_categorias(id) on delete restrict,
 material text not null default '' check(length(material)<=200), dimensoes text not null default '' check(length(dimensoes)<=200),
 peso_gramas numeric(14,3) check(peso_gramas>=0 and peso_gramas<=10000000),
 cores text not null default '' check(length(cores)<=500), personalizavel boolean not null default false,
 prazo text not null default '' check(length(prazo)<=200), destaque boolean not null default false,
 status text not null default 'rascunho' check(status in ('rascunho','publicado','inativo')),
 ordem integer not null default 0, versao integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(status<>'publicado' or length(btrim(descricao))>0)
);
create index catalogo_produtos_status_ordem on public.catalogo_produtos(status,ordem,material_id);
create table public.catalogo_slugs (
 slug text primary key, material_id uuid not null references public.catalogo_produtos(material_id) on delete cascade
);
create table public.catalogo_imagens (
 id uuid primary key default gen_random_uuid(), material_id uuid not null references public.catalogo_produtos(material_id) on delete restrict,
 arquivo text not null check(length(arquivo)<=255), alt text not null default '' check(length(alt)<=300),
 caminho text not null unique, miniatura text not null unique,
 substitui uuid references public.catalogo_imagens(id) on delete set null,
 estado text not null default 'enviando' check(estado in ('enviando','pronta','excluindo')),
 ordem integer not null default 0, created_at timestamptz not null default now(),
 check(caminho=material_id::text||'/'||id::text||'/principal.webp'),
 check(miniatura=material_id::text||'/'||id::text||'/miniatura.webp')
);
create index catalogo_imagens_produto on public.catalogo_imagens(material_id,estado,ordem,id);

alter table public.catalogo_categorias enable row level security;
alter table public.catalogo_produtos enable row level security;
alter table public.catalogo_imagens enable row level security;
alter table public.catalogo_slugs enable row level security;
create policy catalogo_categorias_staff on public.catalogo_categorias for all to authenticated using(public.usuario_ativo()) with check(public.usuario_ativo());
create policy catalogo_produtos_staff on public.catalogo_produtos for select to authenticated using(public.usuario_ativo());
create policy catalogo_imagens_staff on public.catalogo_imagens for select to authenticated using(public.usuario_ativo());
create policy catalogo_slugs_staff on public.catalogo_slugs for select to authenticated using(public.usuario_ativo());
revoke all on public.catalogo_produtos,public.catalogo_imagens,public.catalogo_slugs,public.catalogo_categorias from anon,authenticated;
grant select on public.catalogo_produtos,public.catalogo_imagens,public.catalogo_slugs to authenticated;
grant select,insert,update,delete on public.catalogo_categorias to authenticated;

create function public.salvar_catalogo(p_material_id uuid,p_dados jsonb,p_versao integer default null) returns public.catalogo_produtos
language plpgsql security definer set search_path='' as $$
declare c public.catalogo_produtos; novo public.catalogo_produtos; codigo bigint; v_slug text;
begin
 if not public.usuario_ativo() then raise exception 'Acesso não autorizado';end if;
 select m.codigo into codigo from public.materiais m where id=p_material_id for update;
 if not found then raise exception 'Produto não encontrado';end if;
 select * into c from public.catalogo_produtos where material_id=p_material_id for update;
 if found and c.versao is distinct from p_versao then raise exception 'Produto alterado por outra sessão. Reabra a edição';end if;
 v_slug:=coalesce(nullif(btrim(p_dados->>'slug'),''),'produto-'||codigo);
 -- Reserve every old and current slug; an old link can never point to another product.
 if exists(select 1 from public.catalogo_slugs s where s.slug=v_slug and s.material_id<>p_material_id) then raise exception 'Este endereço já pertence a outro produto';end if;
 insert into public.catalogo_produtos(material_id,titulo,descricao,resumo,slug,preco_centavos,promocional_centavos,categoria_id,material,dimensoes,peso_gramas,cores,personalizavel,prazo,destaque,status,ordem)
 values(p_material_id,btrim(coalesce(p_dados->>'titulo','')),btrim(coalesce(p_dados->>'descricao','')),btrim(coalesce(p_dados->>'resumo','')),v_slug,
 coalesce((p_dados->>'preco_centavos')::bigint,0),nullif(p_dados->>'promocional_centavos','')::bigint,nullif(p_dados->>'categoria_id','')::uuid,
 coalesce(p_dados->>'material',''),coalesce(p_dados->>'dimensoes',''),nullif(p_dados->>'peso_gramas','')::numeric,coalesce(p_dados->>'cores',''),coalesce((p_dados->>'personalizavel')::boolean,false),coalesce(p_dados->>'prazo',''),coalesce((p_dados->>'destaque')::boolean,false),coalesce(p_dados->>'status','rascunho'),coalesce((p_dados->>'ordem')::integer,0))
 on conflict(material_id) do update set titulo=excluded.titulo,descricao=excluded.descricao,resumo=excluded.resumo,slug=excluded.slug,preco_centavos=excluded.preco_centavos,promocional_centavos=excluded.promocional_centavos,categoria_id=excluded.categoria_id,material=excluded.material,dimensoes=excluded.dimensoes,peso_gramas=excluded.peso_gramas,cores=excluded.cores,personalizavel=excluded.personalizavel,prazo=excluded.prazo,destaque=excluded.destaque,status=excluded.status,ordem=excluded.ordem,versao=public.catalogo_produtos.versao+1,updated_at=now()
 returning * into novo;
 insert into public.catalogo_slugs(slug,material_id) values(novo.slug,p_material_id) on conflict do nothing;
 if exists(select 1 from public.catalogo_slugs s where s.slug=novo.slug and s.material_id<>p_material_id) then raise exception 'Este endereço já pertence a outro produto';end if;
 return novo;
end;$$;

create function public.operar_imagem_catalogo(p_acao text,p_produto uuid,p_imagem uuid default null,p_dados jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.catalogo_imagens; image_id uuid; n integer;
begin
 if not public.usuario_ativo() then raise exception 'Acesso não autorizado';end if;
 perform 1 from public.catalogo_produtos where material_id=p_produto for update;
 if not found then raise exception 'Salve os dados do catálogo antes das imagens';end if;
 if p_acao='reservar' then
   if p_dados->>'substitui' is not null then
     if not exists(select 1 from public.catalogo_imagens where id=(p_dados->>'substitui')::uuid and material_id=p_produto and estado='pronta') or exists(select 1 from public.catalogo_imagens where substitui=(p_dados->>'substitui')::uuid) then raise exception 'Substituição indisponível';end if;
   elsif (select count(*) from public.catalogo_imagens where material_id=p_produto and substitui is null)>=8 then raise exception 'Limite de 8 imagens por produto. Remova imagens pendentes antes de enviar outras';end if;
   image_id:=gen_random_uuid();
   insert into public.catalogo_imagens(id,material_id,arquivo,alt,caminho,miniatura,ordem,substitui)
   values(image_id,p_produto,left(coalesce(p_dados->>'arquivo','imagem'),255),coalesce(p_dados->>'alt',''),p_produto||'/'||image_id||'/principal.webp',p_produto||'/'||image_id||'/miniatura.webp',coalesce((select max(ordem)+1 from public.catalogo_imagens where material_id=p_produto),0),(p_dados->>'substitui')::uuid) returning * into i;
   return to_jsonb(i);
 end if;
 if p_acao='ordenar' then
   if jsonb_typeof(p_dados->'ids') is distinct from 'array' then raise exception 'Ordem inválida';end if;
   select count(*) into n from public.catalogo_imagens where material_id=p_produto and estado='pronta';
   if jsonb_array_length(p_dados->'ids')<>n or (select count(distinct value) from jsonb_array_elements_text(p_dados->'ids'))<>n or exists(select 1 from jsonb_array_elements_text(p_dados->'ids') x where not exists(select 1 from public.catalogo_imagens where id=x.value::uuid and material_id=p_produto and estado='pronta')) then raise exception 'Imagens alteradas. Atualize a lista';end if;
   update public.catalogo_imagens target set ordem=x.ordinality::integer-1 from jsonb_array_elements_text(p_dados->'ids') with ordinality x where target.id=x.value::uuid and target.material_id=p_produto;
   return '{}'::jsonb;
 end if;
 select * into i from public.catalogo_imagens where id=p_imagem and material_id=p_produto for update;
 if not found then raise exception 'Imagem não encontrada';end if;
 if p_acao='confirmar' then
   if i.estado<>'enviando' then raise exception 'Upload não está pendente';end if;
   if (select count(*) from storage.objects where bucket_id='catalogo-produtos' and name in(i.caminho,i.miniatura))<>2 then raise exception 'Upload incompleto';end if;
   if i.substitui is not null then
     update public.catalogo_imagens set ordem=(select ordem from public.catalogo_imagens where id=i.substitui) where id=i.id;
     update public.catalogo_imagens set estado='excluindo' where id=i.substitui;
   end if;
   if (select count(*) from public.catalogo_imagens where material_id=p_produto and estado='pronta')>=8 then raise exception 'Limite de 8 imagens por produto';end if;
   update public.catalogo_imagens set estado='pronta' where id=i.id;
 elsif p_acao='remover' then update public.catalogo_imagens set estado='excluindo' where id=i.id;
 elsif p_acao='concluir_exclusao' then
   if i.estado<>'excluindo' or exists(select 1 from storage.objects where bucket_id='catalogo-produtos' and name in(i.caminho,i.miniatura)) then raise exception 'Remova os arquivos antes de concluir';end if;
   delete from public.catalogo_imagens where id=i.id;
 elsif p_acao='alt' then update public.catalogo_imagens set alt=coalesce(p_dados->>'alt','') where id=i.id;
 else raise exception 'Ação inválida';end if;
 return to_jsonb(i);
end;$$;

create function public.duplicar_catalogo(p_produto uuid) returns uuid language plpgsql security definer set search_path='' as $$
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

create function public.excluir_catalogo(p_produto uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.usuario_ativo() then raise exception 'Acesso não autorizado';end if;
 perform 1 from public.catalogo_produtos where material_id=p_produto for update;
 if exists(select 1 from public.catalogo_imagens where material_id=p_produto) then raise exception 'Remova todas as imagens antes de excluir os dados do catálogo';end if;
 delete from public.catalogo_produtos where material_id=p_produto;
end;$$;

-- Public DTOs never expose costs, stock, internal category or pending image uploads.
create function public.catalogo_publico(p_busca text default '',p_categoria uuid default null,p_ordem text default 'destaque',p_offset integer default 0,p_slug text default null) returns jsonb
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
 destaque desc,ordem,nome,material_id limit 24 offset greatest(coalesce(p_offset,0),0)
 ) select jsonb_build_object('total',(select count(*) from selected),'produtos',coalesce((select jsonb_agg(jsonb_build_object(
 'id',material_id,'codigo',codigo,'nome',nome,'slug',slug,'descricao',descricao,'resumo',resumo,'preco_centavos',preco_centavos,'promocional_centavos',promocional_centavos,'categoria_id',categoria_id,'categoria',categoria_nome,'material',material,'dimensoes',dimensoes,'peso_gramas',peso_gramas,'cores',cores,'personalizavel',personalizavel,'prazo',prazo,'destaque',destaque,
 'imagens',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'caminho',i.caminho,'miniatura',i.miniatura,'alt',i.alt) order by i.ordem,i.id) from public.catalogo_imagens i where i.material_id=page.material_id and i.estado='pronta'),'[]'::jsonb)
 )) from page),'[]'::jsonb),'categorias',coalesce((select jsonb_agg(jsonb_build_object('id',id,'nome',nome) order by nome) from public.catalogo_categorias where ativa),'[]'::jsonb));
$$;
revoke all on function public.salvar_catalogo(uuid,jsonb,integer),public.operar_imagem_catalogo(text,uuid,uuid,jsonb),public.duplicar_catalogo(uuid),public.excluir_catalogo(uuid) from public,anon;
grant execute on function public.salvar_catalogo(uuid,jsonb,integer),public.operar_imagem_catalogo(text,uuid,uuid,jsonb),public.duplicar_catalogo(uuid),public.excluir_catalogo(uuid) to authenticated;
revoke all on function public.catalogo_publico(text,uuid,text,integer,text) from public;
grant execute on function public.catalogo_publico(text,uuid,text,integer,text) to anon,authenticated;

-- Storage exists in Supabase; isolated SQL tests create a minimal equivalent schema.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('catalogo-produtos','catalogo-produtos',true,2097152,array['image/webp']) on conflict(id) do nothing;
create function public.catalogo_arquivo_permitido(p_nome text,p_exclusao boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select public.usuario_ativo() and exists(select 1 from public.catalogo_imagens where p_nome in(caminho,miniatura) and case when p_exclusao then estado='excluindo' else estado='enviando' end);
$$;
revoke all on function public.catalogo_arquivo_permitido(text,boolean) from public,anon;
grant execute on function public.catalogo_arquivo_permitido(text,boolean) to authenticated;
create policy catalogo_upload on storage.objects for insert to authenticated with check(bucket_id='catalogo-produtos' and public.catalogo_arquivo_permitido(name,false));
create policy catalogo_storage_read on storage.objects for select to authenticated using(bucket_id='catalogo-produtos' and public.usuario_ativo());
create policy catalogo_storage_delete on storage.objects for delete to authenticated using(bucket_id='catalogo-produtos' and public.catalogo_arquivo_permitido(name,true));
notify pgrst,'reload schema';
commit;
