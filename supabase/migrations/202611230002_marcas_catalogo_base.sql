begin;

-- Vínculos separados preservam o formato das tabelas e das RPCs legadas.
create table public.marca_materiais (
 material_id uuid primary key references public.materiais(id) on delete cascade,
 marca_id uuid not null references public.marcas(id) on delete restrict
);
create table public.marca_categorias_catalogo (
 categoria_id uuid primary key references public.catalogo_categorias(id) on delete cascade,
 marca_id uuid not null references public.marcas(id) on delete restrict
);
create table public.marca_indicacoes_catalogo (
 material_id uuid primary key references public.catalogo_indicacoes(material_id) on delete cascade,
 marca_id uuid not null references public.marcas(id) on delete restrict
);

insert into public.marca_materiais(material_id, marca_id)
 select m.id, b.id from public.materiais m cross join public.marcas b where b.slug='rava';
insert into public.marca_categorias_catalogo(categoria_id, marca_id)
 select c.id, b.id from public.catalogo_categorias c cross join public.marcas b where b.slug='rava';
insert into public.marca_indicacoes_catalogo(material_id, marca_id)
 select i.material_id, b.id from public.catalogo_indicacoes i cross join public.marcas b where b.slug='rava';

-- Enquanto os clientes atuais não têm seletor de marca, novos cadastros seguem na Rava.
create function public.atribuir_marca_rava_ao_cadastro() returns trigger
language plpgsql security definer set search_path='' as $$
declare marca_rava uuid;
begin
 select id into strict marca_rava from public.marcas where slug='rava';
 if tg_table_name='materiais' then
  insert into public.marca_materiais(material_id,marca_id) values(new.id,marca_rava);
 elsif tg_table_name='catalogo_categorias' then
  insert into public.marca_categorias_catalogo(categoria_id,marca_id) values(new.id,marca_rava);
 elsif tg_table_name='catalogo_indicacoes' then
  insert into public.marca_indicacoes_catalogo(material_id,marca_id) values(new.material_id,marca_rava);
 else raise exception 'Tabela de origem inesperada'; end if;
 return new;
end; $$;
revoke all on function public.atribuir_marca_rava_ao_cadastro() from public, anon, authenticated;
create trigger marca_rava_material after insert on public.materiais for each row execute function public.atribuir_marca_rava_ao_cadastro();
create trigger marca_rava_categoria after insert on public.catalogo_categorias for each row execute function public.atribuir_marca_rava_ao_cadastro();
create trigger marca_rava_indicacao after insert on public.catalogo_indicacoes for each row execute function public.atribuir_marca_rava_ao_cadastro();

alter table public.marca_materiais enable row level security;
alter table public.marca_categorias_catalogo enable row level security;
alter table public.marca_indicacoes_catalogo enable row level security;
revoke all on public.marca_materiais, public.marca_categorias_catalogo, public.marca_indicacoes_catalogo from public, anon, authenticated;
grant select on public.marca_materiais, public.marca_categorias_catalogo, public.marca_indicacoes_catalogo to authenticated;
create policy marca_materiais_leitura on public.marca_materiais for select to authenticated using(public.usuario_ativo());
create policy marca_categorias_leitura on public.marca_categorias_catalogo for select to authenticated using(public.usuario_ativo());
create policy marca_indicacoes_leitura on public.marca_indicacoes_catalogo for select to authenticated using(public.usuario_ativo());

commit;
