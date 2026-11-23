begin;

-- O formulário operacional volta a usar o cadastro original de materiais.
drop function public.cadastrar_material_marca(uuid,text,numeric,numeric,uuid,text,numeric,numeric);

-- O vínculo controla apenas a apresentação no catálogo. Não modifica o
-- cadastro, estoque, categorias internas ou transações do produto.
create function public.alterar_marca_material(p_material_id uuid,p_marca_atual uuid,p_nova_marca uuid) returns void
language plpgsql security definer set search_path='' as $$
declare marca_existente uuid;
begin
 if not public.usuario_ativo() then raise exception 'Usuário não autorizado'; end if;
 if not exists(select 1 from public.marcas where id=p_nova_marca and ativa) then raise exception 'Selecione uma marca ativa'; end if;
 perform 1 from public.materiais where id=p_material_id for update;
 if not found then raise exception 'Produto não encontrado'; end if;
 select marca_id into marca_existente from public.marca_materiais where material_id=p_material_id for update;
 if marca_existente is null or marca_existente is distinct from p_marca_atual then raise exception 'Marca alterada por outra sessão. Reabra o produto'; end if;
 if marca_existente=p_nova_marca then return; end if;
 if exists(select 1 from public.catalogo_produtos where material_id=p_material_id and status='publicado') then
  raise exception 'Despublique o produto antes de alterar sua marca';
 end if;
 if exists(select 1 from public.catalogo_produtos p left join public.marca_categorias_catalogo c on c.categoria_id=p.categoria_id and c.marca_id=p_nova_marca where p.material_id=p_material_id and p.categoria_id is not null and c.categoria_id is null) then
  raise exception 'Remova a categoria atual antes de alterar a marca';
 end if;
 update public.marca_materiais set marca_id=p_nova_marca where material_id=p_material_id;
end; $$;
revoke all on function public.alterar_marca_material(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.alterar_marca_material(uuid,uuid,uuid) to authenticated;

commit;
