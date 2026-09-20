begin;
alter table public.materiais add column categoria text not null default 'Rivoxel'
  check (categoria in ('Rivoxel','Rava','Bonecos'));

-- The legacy signature remains available and preserves existing categories.
create function public.salvar_material(p_material_id uuid,p_nome text,p_custo_medio numeric,
  p_quantidade numeric,p_local_id uuid,p_categoria text)
returns uuid language plpgsql set search_path = '' as $$
declare v_id uuid;
begin
  if not public.usuario_ativo() then raise exception 'Acesso não autorizado'; end if;
  if p_categoria is null or p_categoria not in ('Rivoxel','Rava','Bonecos') then
    raise exception 'Selecione uma categoria válida';
  end if;
  v_id := public.salvar_material(p_material_id,p_nome,p_custo_medio,p_quantidade,p_local_id);
  update public.materiais set categoria=p_categoria where id=v_id;
  return v_id;
end; $$;
revoke all on function public.salvar_material(uuid,text,numeric,numeric,uuid,text) from public,anon;
grant execute on function public.salvar_material(uuid,text,numeric,numeric,uuid,text) to authenticated;
commit;
