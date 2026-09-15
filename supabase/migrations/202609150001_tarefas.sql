create table public.tarefas (
  id uuid primary key default gen_random_uuid(),
  responsavel text not null check (char_length(btrim(responsavel)) between 1 and 150),
  descricao text not null check (char_length(btrim(descricao)) between 1 and 5000),
  previsao_entrega date not null,
  status text not null default 'pendente' check (status in ('pendente', 'fazendo', 'terminado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tarefas_status_entrega_idx on public.tarefas(status, previsao_entrega);
create trigger tarefas_updated_at before update on public.tarefas
for each row execute function public.set_updated_at();
alter table public.tarefas enable row level security;
create policy tarefas_staff on public.tarefas for all to authenticated
using (public.usuario_ativo()) with check (public.usuario_ativo());
grant select, insert, update, delete on public.tarefas to authenticated;
