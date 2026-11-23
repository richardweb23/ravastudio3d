begin;

-- Identidades comerciais independentes das categorias de materiais e dos caixas.
-- Esta etapa não altera produtos ou dados financeiros existentes.
create table public.marcas (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 nome text not null check (length(btrim(nome)) between 1 and 100),
 ativa boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

insert into public.marcas (slug, nome)
values ('rava', 'Rava Studio 3D'), ('rivoxel', 'Rivoxel');

alter table public.marcas enable row level security;
revoke all on public.marcas from public, anon, authenticated;
grant select on public.marcas to authenticated;
create policy marcas_leitura on public.marcas for select to authenticated
 using (public.usuario_ativo());

commit;
