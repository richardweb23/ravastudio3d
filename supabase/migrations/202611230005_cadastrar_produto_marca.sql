begin;

-- Novo cadastro, associação e estoque inicial ocorrem na mesma transação.
-- A reclassificação de produtos existentes permanece bloqueada nesta etapa.
create function public.cadastrar_material_marca(p_marca_id uuid,p_nome text,p_custo_medio numeric,p_quantidade numeric,p_local_id uuid,p_categoria text,p_filamento_gramas numeric,p_filamento_valor_kg numeric) returns uuid
language plpgsql security definer set search_path='' as $$
declare material uuid;
begin
 if not public.usuario_ativo() then raise exception 'Usuário não autorizado'; end if;
 if not exists(select 1 from public.marcas where id=p_marca_id and ativa) then raise exception 'Selecione uma marca ativa'; end if;
 material := public.salvar_material(null,p_nome,p_custo_medio,p_quantidade,p_local_id,p_categoria,p_filamento_gramas,p_filamento_valor_kg);
 update public.marca_materiais set marca_id=p_marca_id where material_id=material;
 if not found then raise exception 'Vínculo de marca do produto não encontrado'; end if;
 return material;
end; $$;
revoke all on function public.cadastrar_material_marca(uuid,text,numeric,numeric,uuid,text,numeric,numeric) from public,anon,authenticated;
grant execute on function public.cadastrar_material_marca(uuid,text,numeric,numeric,uuid,text,numeric,numeric) to authenticated;

commit;
