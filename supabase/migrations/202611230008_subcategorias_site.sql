begin;

-- A hierarquia pertence apenas ao catálogo, não às categorias internas.
alter table public.catalogo_categorias add column pai_id uuid references public.catalogo_categorias(id) on delete restrict;
create index catalogo_categorias_pai on public.catalogo_categorias(pai_id);

create function public.validar_pai_categoria_site() returns trigger
language plpgsql security definer set search_path='' as $$
declare marca_categoria uuid; marca_pai uuid; avo uuid;
begin
 if new.pai_id is null then return new; end if;
 if new.pai_id=new.id then raise exception 'Uma categoria não pode ser sua própria categoria principal'; end if;
 if exists(select 1 from public.catalogo_categorias where pai_id=new.id) then raise exception 'Uma categoria com subcategorias não pode ser movida para outra categoria'; end if;
 select c.pai_id,mc.marca_id into avo,marca_pai from public.catalogo_categorias c join public.marca_categorias_catalogo mc on mc.categoria_id=c.id where c.id=new.pai_id for update of c;
 if not found then raise exception 'Categoria principal não encontrada'; end if;
 if avo is not null then raise exception 'São permitidos somente dois níveis de categoria'; end if;
 if tg_op='INSERT' then select id into marca_categoria from public.marcas where slug='rava';
 else select marca_id into marca_categoria from public.marca_categorias_catalogo where categoria_id=new.id; end if;
 if marca_categoria is null or marca_categoria<>marca_pai then raise exception 'A categoria principal deve pertencer à mesma marca'; end if;
 return new;
end; $$;
revoke all on function public.validar_pai_categoria_site() from public,anon,authenticated;
create trigger catalogo_validar_pai before insert or update of pai_id on public.catalogo_categorias for each row execute function public.validar_pai_categoria_site();

create function public.validar_marca_hierarquia_categoria() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.marca_id is not distinct from old.marca_id then return new; end if;
 if exists(select 1 from public.catalogo_categorias c join public.marca_categorias_catalogo p on p.categoria_id=c.pai_id where c.id=new.categoria_id and p.marca_id<>new.marca_id)
 or exists(select 1 from public.catalogo_categorias f join public.marca_categorias_catalogo mf on mf.categoria_id=f.id where f.pai_id=new.categoria_id and mf.marca_id<>new.marca_id) then
  raise exception 'A categoria e suas subcategorias devem pertencer à mesma marca';
 end if;
 return new;
end; $$;
revoke all on function public.validar_marca_hierarquia_categoria() from public,anon,authenticated;
create trigger catalogo_validar_marca_hierarquia before update of marca_id on public.marca_categorias_catalogo for each row execute function public.validar_marca_hierarquia_categoria();

create function public.salvar_categoria_site(p_categoria_id uuid,p_marca_id uuid,p_nome text,p_slug text,p_ativa boolean,p_marketplace boolean,p_pai_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare categoria uuid;
begin
 if not public.usuario_ativo() then raise exception 'Usuário não autorizado'; end if;
 categoria := public.salvar_categoria_marca(p_categoria_id,p_marca_id,p_nome,p_slug,p_ativa,p_marketplace);
 update public.catalogo_categorias set pai_id=p_pai_id where id=categoria;
 return categoria;
end; $$;
revoke all on function public.salvar_categoria_site(uuid,uuid,text,text,boolean,boolean,uuid) from public,anon,authenticated;
grant execute on function public.salvar_categoria_site(uuid,uuid,text,text,boolean,boolean,uuid) to authenticated;

commit;
