begin;
create function public.corrigir_valor_item_pedido(p_item_id uuid, p_preco_unitario numeric, p_preco_anterior numeric, p_motivo text)
returns void language plpgsql security definer set search_path='' as $$
declare i public.pedido_itens; p public.pedidos; v public.vendas; total numeric;
begin
 if not public.usuario_ativo() then raise exception 'Acesso não autorizado'; end if;
 if p_preco_unitario is null or p_preco_unitario < 0 or p_preco_unitario > 10000000 or p_preco_unitario <> round(p_preco_unitario,2) then raise exception 'Informe um preço válido com até duas casas decimais'; end if;
 if coalesce(length(btrim(p_motivo)),0)=0 then raise exception 'Informe o motivo da correção'; end if;
 perform public.financeiro_travar();
 select * into p from public.pedidos where id=(select pedido_id from public.pedido_itens where id=p_item_id) for update;
 if not found or p.status <> 'entregue' then raise exception 'Selecione um pedido entregue'; end if;
 select * into i from public.pedido_itens where id=p_item_id for update;
 if i.preco_unitario is distinct from p_preco_anterior then raise exception 'Valor alterado. Atualize a página e tente novamente'; end if;
 perform 1 from public.consignacao_vendas where id in (select id from public.vendas where pedido_item_id=i.id) for update;
 select * into v from public.vendas where pedido_item_id=i.id for update;
 if not found then raise exception 'Venda vinculada não encontrada'; end if;
 if v.devolvida_em is not null then raise exception 'Item já devolvido'; end if;
 if exists(select 1 from public.consignacao_vendas where id=v.id and pagamento_id is not null) then raise exception 'Repasse já pago. Regularize antes de corrigir'; end if;
 if i.preco_unitario=p_preco_unitario then return; end if;
 select round(sum(quantidade * case when id=i.id then p_preco_unitario else preco_unitario end)-p.desconto,2) into total from public.pedido_itens where pedido_id=p.id;
 if total<0 then raise exception 'O desconto não pode ser maior que o subtotal corrigido'; end if;
 -- The existing financial guard rejects totals below active receipts atomically.
 update public.pedidos set valor_total=total,updated_at=now() where id=p.id;
 update public.pedido_itens set preco_unitario=p_preco_unitario where id=i.id;
 -- Existing sales triggers record before/after, reason and author; no stock movement.
 update public.vendas set preco_unitario=p_preco_unitario,motivo_alteracao=btrim(p_motivo),versao=versao+1 where id=v.id;
end; $$;
revoke all on function public.corrigir_valor_item_pedido(uuid,numeric,numeric,text) from public,anon;
grant execute on function public.corrigir_valor_item_pedido(uuid,numeric,numeric,text) to authenticated;
commit;
