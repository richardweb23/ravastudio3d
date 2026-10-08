begin;
alter table public.filamento_movimentos drop constraint filamento_movimentos_tipo_check;
alter table public.filamento_movimentos add constraint filamento_movimentos_tipo_check check(tipo in ('entrada','baixa','estorno_baixa'));
alter table public.filamento_movimentos add column estorno_de uuid unique references public.filamento_movimentos(id);
alter table public.filamento_movimentos add constraint filamento_estorno_origem check((tipo='estorno_baixa')=(estorno_de is not null));

create function public.remover_baixa_filamento(p_movimento_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare m public.filamento_movimentos; v public.filamento_estoque; v_estorno uuid;
begin
 if not public.usuario_ativo() then raise exception 'Acesso não autorizado'; end if;
 perform pg_advisory_xact_lock(29092601);
 select * into m from public.filamento_movimentos where id=p_movimento_id for update;
 if not found then raise exception 'Baixa não encontrada'; end if;
 if m.tipo<>'baixa' then raise exception 'Somente baixas podem ser removidas'; end if;
 select id into v_estorno from public.filamento_movimentos where estorno_de=m.id;
 if found then return m.estoque_id; end if;
 select * into strict v from public.filamento_estoque where id=m.estoque_id for update;
 -- Restore the removed material at its original cost, even after later purchases.
 update public.filamento_estoque set
  custo_medio_centavos=round((v.quantidade_gramas::numeric*v.custo_medio_centavos+m.quantidade_gramas::numeric*m.valor_kg_centavos)/(v.quantidade_gramas+m.quantidade_gramas)),
  quantidade_gramas=v.quantidade_gramas+m.quantidade_gramas,updated_at=now()
 where id=v.id;
 insert into public.filamento_movimentos(estoque_id,tipo,quantidade_gramas,valor_kg_centavos,data,observacao,requisicao,dados,criado_por,estorno_de)
 values(m.estoque_id,'estorno_baixa',m.quantidade_gramas,m.valor_kg_centavos,current_date,'Baixa removida: quantidade devolvida ao estoque.',gen_random_uuid(),jsonb_build_object('movimento_id',m.id),auth.uid(),m.id);
 return m.estoque_id;
end $$;
revoke all on function public.remover_baixa_filamento(uuid) from public,anon;
grant execute on function public.remover_baixa_filamento(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
