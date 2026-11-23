begin;
create or replace function public.duplicar_catalogo(p_produto uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare m public.materiais; c public.catalogo_produtos; novo uuid; codigo bigint; marca_original uuid;
begin
 if not public.usuario_ativo() then raise exception 'Acesso não autorizado'; end if;
 select * into m from public.materiais where id=p_produto;
 if not found then raise exception 'Produto não encontrado'; end if;
 select marca_id into marca_original from public.marca_materiais where material_id=p_produto;
 if marca_original is null then raise exception 'Marca do produto não encontrada'; end if;
 select * into c from public.catalogo_produtos where material_id=p_produto;
 insert into public.materiais(nome,unidade,custo_medio,categoria,filamento_gramas,filamento_valor_kg)
 values(m.nome||' (cópia)',m.unidade,m.custo_medio,m.categoria,m.filamento_gramas,m.filamento_valor_kg) returning id,public.materiais.codigo into novo,codigo;
 update public.marca_materiais set marca_id=marca_original where material_id=novo;
 if not found then raise exception 'Vínculo da cópia não encontrado'; end if;
 perform public.salvar_catalogo(novo,coalesce(to_jsonb(c),'{}'::jsonb)||jsonb_build_object('slug','produto-'||codigo,'status','rascunho','titulo',coalesce(nullif(c.titulo,''),m.nome)||' (cópia)'),null);
 return novo;
end; $$;
commit;
