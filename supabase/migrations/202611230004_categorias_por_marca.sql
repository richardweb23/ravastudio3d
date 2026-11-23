begin;

-- Cadastros antigos permanecem válidos; categorias entre marcas não podem
-- ser misturadas mesmo quando a gravação vem da API ou de um cliente antigo.
create function public.validar_categoria_mesma_marca() returns trigger
language plpgsql security definer set search_path='' as $$
declare produto_marca uuid; categoria_marca uuid;
begin
 if new.categoria_id is null then return new; end if;
 if tg_table_name='catalogo_produtos' then
  select marca_id into produto_marca from public.marca_materiais where material_id=new.material_id;
 elsif tg_table_name='catalogo_indicacoes' then
  if tg_op='INSERT' then select id into produto_marca from public.marcas where slug='rava';
  else select marca_id into produto_marca from public.marca_indicacoes_catalogo where material_id=new.material_id; end if;
 else raise exception 'Tabela de origem inesperada'; end if;
 select marca_id into categoria_marca from public.marca_categorias_catalogo where categoria_id=new.categoria_id;
 if produto_marca is null or categoria_marca is null or produto_marca<>categoria_marca then
  raise exception 'A categoria deve pertencer à mesma marca do produto';
 end if;
 return new;
end; $$;
revoke all on function public.validar_categoria_mesma_marca() from public,anon,authenticated;
create trigger categoria_marca_produto before insert or update of categoria_id,material_id on public.catalogo_produtos for each row execute function public.validar_categoria_mesma_marca();
create trigger categoria_marca_indicacao before insert or update of categoria_id,material_id on public.catalogo_indicacoes for each row execute function public.validar_categoria_mesma_marca();

create function public.salvar_categoria_marca(p_categoria_id uuid,p_marca_id uuid,p_nome text,p_slug text,p_ativa boolean,p_marketplace boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare categoria uuid;
begin
 if not public.usuario_ativo() then raise exception 'Usuário não autorizado'; end if;
 if not exists(select 1 from public.marcas where id=p_marca_id and ativa) then raise exception 'Selecione uma marca ativa'; end if;
 if p_categoria_id is null then
  insert into public.catalogo_categorias(nome,slug,ativa,marketplace) values(p_nome,p_slug,p_ativa,p_marketplace) returning id into categoria;
 else
  select id into categoria from public.catalogo_categorias where id=p_categoria_id for update;
  if categoria is null then raise exception 'Categoria não encontrada'; end if;
  if exists(select 1 from public.catalogo_produtos p join public.marca_materiais mm on mm.material_id=p.material_id where p.categoria_id=categoria and mm.marca_id<>p_marca_id)
   or exists(select 1 from public.catalogo_indicacoes i join public.marca_indicacoes_catalogo mi on mi.material_id=i.material_id where i.categoria_id=categoria and mi.marca_id<>p_marca_id) then
   raise exception 'Não é possível alterar a marca de uma categoria com produtos de outra marca';
  end if;
  update public.catalogo_categorias set nome=p_nome,slug=p_slug,ativa=p_ativa,marketplace=p_marketplace where id=categoria;
 end if;
 update public.marca_categorias_catalogo set marca_id=p_marca_id where categoria_id=categoria;
 if not found then raise exception 'Vínculo de marca da categoria não encontrado'; end if;
 return categoria;
end; $$;
revoke all on function public.salvar_categoria_marca(uuid,uuid,text,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.salvar_categoria_marca(uuid,uuid,text,text,boolean,boolean) to authenticated;

commit;
