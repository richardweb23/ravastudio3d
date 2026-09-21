begin;
alter table public.tarefas drop constraint tarefas_status_check;
alter table public.tarefas add constraint tarefas_status_check
  check(status in ('pendente','fazendo','terminado','concluido'));

create function public.validar_conclusao_tarefa() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'concluido' then raise exception 'A tarefa precisa passar por Terminado antes de ser concluída.'; end if;
  elsif new.status is distinct from old.status then
    if old.status = 'concluido' then raise exception 'A tarefa concluída permanece no histórico.'; end if;
    if new.status = 'concluido' and old.status <> 'terminado' then
      raise exception 'Somente tarefas em Terminado podem ser concluídas.';
    end if;
  end if;
  return new;
end; $$;
create trigger tarefas_validar_conclusao before insert or update on public.tarefas
  for each row execute function public.validar_conclusao_tarefa();
revoke all on function public.validar_conclusao_tarefa() from public,anon,authenticated;
commit;
