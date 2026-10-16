begin;
-- Defaults populate the new properties without changing any existing cost.
alter table public.materiais
 add column filamento_gramas numeric(14,3) not null default 0 check (filamento_gramas between 0 and 10000000),
 add column filamento_valor_kg numeric(14,2) not null default 0 check (filamento_valor_kg between 0 and 10000000);

create function public.calcular_custo_filamento_produto() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.filamento_gramas > 0 and new.filamento_valor_kg > 0 then
   new.custo_medio := round(new.filamento_gramas / 1000 * new.filamento_valor_kg, 2);
 end if;
 return new;
end; $$;
create trigger materiais_custo_filamento before insert or update of filamento_gramas, filamento_valor_kg, custo_medio
on public.materiais for each row execute function public.calcular_custo_filamento_produto();
revoke all on function public.calcular_custo_filamento_produto() from public,anon,authenticated;

create function public.salvar_material(p_material_id uuid,p_nome text,p_custo_medio numeric,
 p_quantidade numeric,p_local_id uuid,p_categoria text,p_filamento_gramas numeric,p_filamento_valor_kg numeric)
returns uuid language plpgsql set search_path='' as $$
declare
 v_id uuid;
 v_gramas numeric := coalesce(p_filamento_gramas,0);
 v_valor numeric := coalesce(p_filamento_valor_kg,0);
 v_custo numeric := p_custo_medio;
begin
 if not public.usuario_ativo() then raise exception 'Acesso não autorizado'; end if;
 if not (v_gramas between 0 and 10000000) or not (v_valor between 0 and 10000000)
    or v_gramas <> round(v_gramas,3) or v_valor <> round(v_valor,2) then
   raise exception 'Parâmetros de filamento inválidos: use até 3 casas para gramas e 2 para o valor por kg';
 end if;
 if p_material_id is not null then
   perform 1 from public.materiais where id=p_material_id for update;
   if not found then raise exception 'Produto não encontrado'; end if;
   if v_custo is null then select custo_medio into v_custo from public.materiais where id=p_material_id; end if;
   -- Set parameters first so the existing save can switch back to manual cost.
   update public.materiais set filamento_gramas=v_gramas,filamento_valor_kg=v_valor where id=p_material_id;
 end if;
 if v_gramas > 0 and v_valor > 0 then v_custo := round(v_gramas / 1000 * v_valor,2); end if;
 v_id := public.salvar_material(p_material_id,p_nome,v_custo,p_quantidade,p_local_id,p_categoria);
 if p_material_id is null then
   update public.materiais set filamento_gramas=v_gramas,filamento_valor_kg=v_valor where id=v_id;
 end if;
 return v_id;
end; $$;
revoke all on function public.salvar_material(uuid,text,numeric,numeric,uuid,text,numeric,numeric) from public,anon;
grant execute on function public.salvar_material(uuid,text,numeric,numeric,uuid,text,numeric,numeric) to authenticated;
commit;
