begin;
-- Identificações de mídia de anúncio observadas no webhook. O vínculo com o
-- post orgânico é escolhido pelo operador; o webhook não o presume.
create table public.instagram_anuncios (
 id text primary key check (id ~ '^[0-9]{1,128}$'),
 publicacao_original_id text references public.instagram_publicacoes(id) on delete set null,
 primeiro_evento timestamptz not null default now()
);
alter table public.instagram_anuncios enable row level security;
revoke all on public.instagram_anuncios from public, anon, authenticated;
grant select, insert, update on public.instagram_anuncios to service_role;

create function public.instagram_registrar_anuncio(p_id text) returns void
language sql security definer set search_path = '' as $$
 insert into public.instagram_anuncios(id) values (p_id) on conflict (id) do nothing;
$$;
revoke all on function public.instagram_registrar_anuncio(text) from public, anon, authenticated;
grant execute on function public.instagram_registrar_anuncio(text) to service_role;

-- Importa apenas IDs já recebidos e autenticados, sem copiar os comentários.
insert into public.instagram_anuncios(id, primeiro_evento)
select distinct on (media_id) media_id, recebido_em from (
 select ch->'value'->'media'->>'id' as media_id, e.recebido_em
 from public.instagram_eventos_brutos e
 cross join lateral jsonb_array_elements(case when jsonb_typeof(e.payload->'entry')='array' then e.payload->'entry' else '[]'::jsonb end) en
 cross join lateral jsonb_array_elements(case when jsonb_typeof(en->'changes')='array' then en->'changes' else '[]'::jsonb end) ch
 where ch->>'field'='comments' and ch->'value'->'media'->>'media_product_type'='AD'
) ads where media_id ~ '^[0-9]{1,128}$' order by media_id, recebido_em
on conflict (id) do nothing;
commit;
