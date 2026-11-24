-- PROPOSTA PARA TESTE ISOLADO: modifica somente indicações do catálogo do site.
begin;
alter table public.catalogo_indicacoes alter column categoria_id drop not null;
create or replace function public.validar_indicacao_catalogo() returns trigger language plpgsql set search_path='' as $$
begin
 if new.categoria_id is not null and not exists(select 1 from public.catalogo_categorias where id=new.categoria_id and marketplace) then raise exception 'Selecione uma categoria Marketplace'; end if;
 if exists(select 1 from public.catalogo_slugs where slug=new.slug) then raise exception 'Este endereço já pertence a outro produto'; end if;
 if new.status='publicado' and new.categoria_id is not null and not exists(select 1 from public.catalogo_categorias where id=new.categoria_id and ativa)
   and not exists(select 1 from public.site_classificacao_indicacoes where indicacao_id=new.material_id) then
  raise exception 'Selecione uma categoria ativa';
 end if;
 if tg_op='UPDATE' then new.updated_at:=now(); new.versao:=old.versao+1; end if;
 return new;
end;$$;
commit;
