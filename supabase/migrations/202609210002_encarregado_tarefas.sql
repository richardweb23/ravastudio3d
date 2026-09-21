begin;
create type public.pessoa_encarregada_tarefa as enum ('Richard','Xandy','Ambos');
alter table public.tarefas
  add column pessoa_encarregada public.pessoa_encarregada_tarefa,
  alter column responsavel drop not null;
create index tarefas_pessoa_encarregada_idx on public.tarefas(pessoa_encarregada);
-- Preserve legacy free-text names; synchronize when a structured choice is made.
create function public.sincronizar_encarregado_tarefa() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.pessoa_encarregada is not null then new.responsavel := new.pessoa_encarregada::text; end if;
  elsif new.pessoa_encarregada is distinct from old.pessoa_encarregada then
    new.responsavel := new.pessoa_encarregada::text;
  end if;
  return new;
end; $$;
create trigger tarefas_encarregado before insert or update on public.tarefas
  for each row execute function public.sincronizar_encarregado_tarefa();
revoke all on function public.sincronizar_encarregado_tarefa() from public,anon,authenticated;
commit;
