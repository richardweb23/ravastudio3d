begin;

alter table public.tarefas add column titulo text;

-- Preserva as tarefas existentes usando o início da descrição como título.
update public.tarefas
set titulo = left(btrim(descricao), 150);

alter table public.tarefas
  alter column titulo set not null,
  add constraint tarefas_titulo_length check (char_length(btrim(titulo)) between 1 and 150);

commit;
