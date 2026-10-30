alter table public.pedidos
  add column situacao text not null default 'normal' check (situacao in ('normal', 'aguardando', 'bloqueado')),
  add column situacao_descricao text not null default '',
  add constraint pedidos_situacao_descricao check (char_length(situacao_descricao) <= 250 and (situacao = 'normal' or length(btrim(situacao_descricao)) > 0));

create table public.pedido_subtarefas (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  titulo text not null check (length(btrim(titulo)) > 0 and char_length(titulo) <= 150),
  concluido boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pedido_subtarefas_pedido on public.pedido_subtarefas(pedido_id, created_at, id);
alter table public.pedido_subtarefas enable row level security;
create policy pedido_subtarefas_staff on public.pedido_subtarefas for all to authenticated
using (public.usuario_ativo()) with check (public.usuario_ativo());
grant select, insert, update, delete on public.pedido_subtarefas to authenticated;

create function public.validar_subtarefa_pedido() returns trigger
language plpgsql set search_path = public as $$
declare etapa public.status_pedido;
begin
  if tg_op = 'UPDATE' and new.pedido_id is distinct from old.pedido_id then
    raise exception 'A subtarefa não pode ser transferida para outro pedido';
  end if;
  select status into etapa from public.pedidos
    where id = case when tg_op = 'DELETE' then old.pedido_id else new.pedido_id end for update;
  if etapa = 'entregue' then raise exception 'Pedidos entregues não permitem editar subtarefas'; end if;
  if tg_op = 'DELETE' then return old; end if;
  new.titulo := btrim(new.titulo);
  if tg_op = 'UPDATE' then new.created_at := old.created_at; end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger validar_subtarefa_pedido before insert or update or delete on public.pedido_subtarefas
for each row execute function public.validar_subtarefa_pedido();
