begin;

-- Disabled initially; the worker also requires an explicit backend send gate.
create table public.instagram_configuracao (
 id boolean primary key default true check (id),
 ativa boolean not null default false,
 palavras_chave text[] not null default array['preço','valor','qual valor','quanto custa','quanto fica','qual o preço','tem valor','R$'] check (cardinality(palavras_chave) between 1 and 100 and array_position(palavras_chave,null) is null and length(array_to_string(palavras_chave,'')) <= 10000),
 resposta_publica text not null default 'Enviamos os detalhes no seu Direct! 😁' check (length(resposta_publica) <= 2000),
 mensagem_produto text not null default E'Olá! Seja muito bem-vindo(a) à Rava Studio 3D! 😊\n\nConfira os produtos e preços atuais:\n\n{produtos}\n\nSe precisar de ajuda, estamos por aqui!' check (length(mensagem_produto) <= 2000 and position('{produtos}' in mensagem_produto)>0),
 mensagem_alternativa text not null default E'Olá! Seja bem-vindo(a) à Rava Studio 3D! 😊\n\nObrigado pelo interesse em nossas peças!\n\nConfira nosso catálogo: {catalogo}\n\nFale com nossa equipe: {whatsapp}' check (length(mensagem_alternativa) <= 2000 and position('{catalogo}' in mensagem_alternativa)>0 and position('{whatsapp}' in mensagem_alternativa)>0),
 catalogo_url text not null default 'https://ravastudio3d.com.br/catalogo/' check (length(catalogo_url)<=2048 and catalogo_url ~ '^https://[^ /]+'),
 whatsapp_url text not null default '' check (length(whatsapp_url)<=2048 and (whatsapp_url='' or whatsapp_url ~ '^https://[^ /]+')),
 sem_produto text not null default 'ignorar' check (sem_produto in ('ignorar','catalogo')),
 updated_at timestamptz not null default now(),
 check (sem_produto <> 'catalogo' or whatsapp_url <> '')
);
insert into public.instagram_configuracao default values;

create table public.instagram_publicacoes (
 id text primary key check (length(id) between 1 and 128),
 legenda text not null default '', permalink text, miniatura_url text,
 publicada_em timestamptz, monitorada boolean not null default false,
 updated_at timestamptz not null default now()
);
create table public.instagram_publicacao_produtos (
 publicacao_id text not null references public.instagram_publicacoes(id) on delete cascade,
 material_id uuid not null references public.materiais(id) on delete cascade,
 primary key (publicacao_id, material_id)
);

-- Separate permanent deduplication keys from short-lived operational logs.
create table public.instagram_comentarios_recebidos (
 comentario_id text primary key check (length(comentario_id) between 1 and 128),
 recebido_em timestamptz not null default now()
);
-- A signed webhook is stored durably before it is acknowledged. Processing is
-- intentionally not enabled in this initial foundation.
create table public.instagram_eventos_brutos (
 digest text primary key check (digest ~ '^[0-9a-f]{64}$'),
 payload jsonb not null,
 estado text not null default 'pendente' check (estado in ('pendente','processando','concluido','falha')),
 bloqueado_ate timestamptz,
 tentativa_id uuid,
 tentativas integer not null default 0 check (tentativas >= 0),
 recebido_em timestamptz not null default now()
);
create index instagram_eventos_fila_idx on public.instagram_eventos_brutos(estado, recebido_em);
create table public.instagram_atividade (
 id bigint generated always as identity primary key,
 comentario_id text not null references public.instagram_comentarios_recebidos(comentario_id),
 publicacao_id text, comentario text, status text not null default 'recebido',
 detalhe text, created_at timestamptz not null default now()
);
create index instagram_atividade_created_at_idx on public.instagram_atividade(created_at desc);

alter table public.instagram_configuracao enable row level security;
alter table public.instagram_publicacoes enable row level security;
alter table public.instagram_publicacao_produtos enable row level security;
alter table public.instagram_comentarios_recebidos enable row level security;
alter table public.instagram_eventos_brutos enable row level security;
alter table public.instagram_atividade enable row level security;
revoke all on public.instagram_configuracao, public.instagram_publicacoes, public.instagram_publicacao_produtos, public.instagram_comentarios_recebidos, public.instagram_eventos_brutos, public.instagram_atividade from public, anon, authenticated;
grant select on public.instagram_configuracao, public.instagram_publicacoes, public.instagram_publicacao_produtos, public.instagram_atividade to authenticated;
grant update(ativa,palavras_chave,resposta_publica,mensagem_produto,mensagem_alternativa,catalogo_url,whatsapp_url,sem_produto) on public.instagram_configuracao to authenticated;
grant update(monitorada) on public.instagram_publicacoes to authenticated;
grant insert, delete on public.instagram_publicacao_produtos to authenticated;
create policy instagram_configuracao_leitura on public.instagram_configuracao for select to authenticated using (public.usuario_ativo());
create policy instagram_configuracao_edicao on public.instagram_configuracao for update to authenticated using (public.usuario_ativo()) with check (public.usuario_ativo());
create policy instagram_publicacoes_leitura on public.instagram_publicacoes for select to authenticated using (public.usuario_ativo());
create policy instagram_publicacoes_edicao on public.instagram_publicacoes for update to authenticated using (public.usuario_ativo()) with check (public.usuario_ativo());
create policy instagram_vinculos_leitura on public.instagram_publicacao_produtos for select to authenticated using (public.usuario_ativo());
create function public.instagram_produto_valido(p_material_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select public.usuario_ativo() and exists (select 1 from public.catalogo_produtos where material_id=p_material_id);
$$;
revoke all on function public.instagram_produto_valido(uuid) from public, anon;
grant execute on function public.instagram_produto_valido(uuid) to authenticated;
create policy instagram_vinculos_insert on public.instagram_publicacao_produtos for insert to authenticated with check (public.instagram_produto_valido(material_id));
create policy instagram_vinculos_delete on public.instagram_publicacao_produtos for delete to authenticated using (public.usuario_ativo());
create policy instagram_atividade_leitura on public.instagram_atividade for select to authenticated using (public.usuario_ativo());

-- Leases serialize workers. An abandoned lease can be recovered; each claim
-- has a unique token so an old worker cannot finish a newer claim.
create function public.instagram_reservar_evento() returns setof public.instagram_eventos_brutos
language sql security definer set search_path = '' as $$
 update public.instagram_eventos_brutos e
 set estado='processando', bloqueado_ate=now()+interval '5 minutes', tentativa_id=gen_random_uuid(), tentativas=e.tentativas+1
 where e.digest=(select q.digest from public.instagram_eventos_brutos q
  where q.estado='pendente' or (q.estado='processando' and q.bloqueado_ate < now())
  order by q.recebido_em, q.digest for update skip locked limit 1)
 returning e.*;
$$;
create function public.instagram_concluir_evento(p_digest text, p_tentativa_id uuid, p_estado text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
 if p_estado not in ('concluido','falha') then raise exception 'Estado inválido'; end if;
 update public.instagram_eventos_brutos set estado=p_estado, bloqueado_ate=null, tentativa_id=null
 where digest=p_digest and tentativa_id=p_tentativa_id and estado='processando';
 return found;
end; $$;
create function public.instagram_limpar_registros() returns void
language plpgsql security definer set search_path = '' as $$
begin
 delete from public.instagram_atividade where created_at < now() - interval '90 days';
 delete from public.instagram_eventos_brutos where estado in ('concluido','falha') and recebido_em < now() - interval '90 days';
end; $$;
create function public.instagram_reservar_comentario(p_id text, p_publicacao_id text, p_comentario text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
 if length(p_id) not between 1 and 128 or length(p_publicacao_id) not between 1 and 128 or length(p_comentario) > 2000 then raise exception 'Comentário inválido'; end if;
 insert into public.instagram_comentarios_recebidos(comentario_id) values(p_id) on conflict do nothing;
 if not found then return false; end if;
 insert into public.instagram_atividade(comentario_id,publicacao_id,comentario,status) values(p_id,p_publicacao_id,p_comentario,'recebido');
 return true;
end; $$;
create function public.instagram_registrar_estado(p_id text, p_estado text, p_detalhe text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if p_estado not in ('ignorado','falha','envio_privado_iniciado','envio_privado_confirmado','envio_privado_incerto','envio_privado_recusado','resposta_publica_iniciada','resposta_publica_incerta','resposta_publica_recusada','enviado') then raise exception 'Estado inválido'; end if;
 if p_detalhe is not null and length(p_detalhe)>300 then raise exception 'Detalhe inválido'; end if;
 update public.instagram_atividade set status=p_estado, detalhe=p_detalhe where comentario_id=p_id;
 if not found then raise exception 'Comentário desconhecido'; end if;
end; $$;
create function public.instagram_produtos_publicos(p_publicacao_id text)
returns table(nome text, slug text, preco_centavos bigint, promocional_centavos bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
 return query select coalesce(nullif(p.titulo,''),m.nome), p.slug, p.preco_centavos, p.promocional_centavos
 from public.instagram_publicacao_produtos v
 join public.catalogo_produtos p on p.material_id=v.material_id
 join public.materiais m on m.id=p.material_id
 left join public.catalogo_categorias c on c.id=p.categoria_id and c.ativa
 where v.publicacao_id=p_publicacao_id and p.status='publicado' and (p.categoria_id is null or c.id is not null)
 order by p.material_id;
end; $$;
create function public.instagram_contexto(p_publicacao_id text) returns jsonb
language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('configuracao', to_jsonb(c), 'monitorada', coalesce(p.monitorada,false))
 from public.instagram_configuracao c left join public.instagram_publicacoes p on p.id=p_publicacao_id where c.id;
$$;
create function public.instagram_sincronizar_publicacoes(p_items jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)>100 then raise exception 'Publicações inválidas'; end if;
 insert into public.instagram_publicacoes(id,legenda,permalink,miniatura_url,publicada_em)
 select x.id,coalesce(x.caption,''),x.permalink,coalesce(x.thumbnail_url,x.media_url),x.timestamp::timestamptz
 from jsonb_to_recordset(p_items) as x(id text,caption text,permalink text,thumbnail_url text,media_url text,timestamp text)
 on conflict(id) do update set legenda=excluded.legenda, permalink=excluded.permalink, miniatura_url=excluded.miniatura_url, publicada_em=excluded.publicada_em, updated_at=now();
end; $$;
revoke all on function public.instagram_reservar_evento(), public.instagram_concluir_evento(text,uuid,text), public.instagram_limpar_registros(), public.instagram_reservar_comentario(text,text,text), public.instagram_registrar_estado(text,text,text), public.instagram_produtos_publicos(text), public.instagram_contexto(text), public.instagram_sincronizar_publicacoes(jsonb) from public, anon, authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  grant execute on function public.instagram_reservar_evento(), public.instagram_concluir_evento(text,uuid,text), public.instagram_limpar_registros(), public.instagram_reservar_comentario(text,text,text), public.instagram_registrar_estado(text,text,text), public.instagram_produtos_publicos(text), public.instagram_contexto(text), public.instagram_sincronizar_publicacoes(jsonb) to service_role;
 end if;
end $$;

notify pgrst, 'reload schema';
commit;
