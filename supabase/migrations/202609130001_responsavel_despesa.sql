-- NULL representa Ambos e preserva o rateio das despesas existentes.
alter table public.financeiro_despesas
  add column responsavel_socio_id uuid references public.financeiro_socios(id) on delete restrict;

create or replace function public.salvar_despesa_financeira(
  p_despesa_id uuid,
  p_despesa jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_responsavel uuid := nullif(p_despesa ->> 'responsavel_socio_id', '')::uuid;
  v_total bigint := coalesce((p_despesa ->> 'valor_total_centavos')::bigint, 0);
  v_quantidade integer := coalesce((p_despesa ->> 'quantidade_parcelas')::integer, 1);
  v_primeiro_vencimento date := (p_despesa ->> 'primeiro_vencimento')::date;
  v_base bigint;
  v_resto bigint;
  v_indice integer;
begin
  if not public.usuario_ativo() then raise exception 'Acesso não autorizado'; end if;
  if nullif(trim(p_despesa ->> 'nome'), '') is null then raise exception 'Informe o nome da compra'; end if;
  if v_total <= 0 then raise exception 'Informe um valor total válido'; end if;
  if v_quantidade < 1 or v_quantidade > 240 then raise exception 'Quantidade de parcelas inválida'; end if;
  if v_primeiro_vencimento is null then raise exception 'Informe o primeiro vencimento'; end if;
  if p_despesa ->> 'forma_pagamento' = 'credito'
     and nullif(p_despesa ->> 'cartao_id', '') is null then
    raise exception 'Informe o cartão utilizado';
  end if;

  if v_responsavel is not null and not exists (
    select 1 from public.financeiro_socios where id = v_responsavel and ativo
  ) then raise exception 'Selecione um sócio ativo como responsável'; end if;

  if p_despesa_id is null then
    insert into public.financeiro_despesas (
      nome, categoria_id, descricao, numero_compra, data_compra, fornecedor,
      valor_total_centavos, forma_pagamento, cartao_id, quantidade_parcelas,
      primeiro_vencimento, observacoes, responsavel_socio_id
    ) values (
      trim(p_despesa ->> 'nome'), nullif(p_despesa ->> 'categoria_id', '')::uuid,
      nullif(trim(p_despesa ->> 'descricao'), ''), nullif(trim(p_despesa ->> 'numero_compra'), ''),
      coalesce(nullif(p_despesa ->> 'data_compra', '')::date, current_date),
      nullif(trim(p_despesa ->> 'fornecedor'), ''), v_total,
      p_despesa ->> 'forma_pagamento', nullif(p_despesa ->> 'cartao_id', '')::uuid,
      v_quantidade, v_primeiro_vencimento, nullif(trim(p_despesa ->> 'observacoes'), ''), v_responsavel
    ) returning id into v_id;
  else
    if exists (
      select 1 from public.financeiro_parcelas
      where despesa_id = p_despesa_id and pago
    ) then
      raise exception 'Não é possível alterar uma compra que já possui parcelas pagas';
    end if;
    update public.financeiro_despesas set
      responsavel_socio_id = case when p_despesa ? 'responsavel_socio_id' then v_responsavel else responsavel_socio_id end,
      nome = trim(p_despesa ->> 'nome'),
      categoria_id = nullif(p_despesa ->> 'categoria_id', '')::uuid,
      descricao = nullif(trim(p_despesa ->> 'descricao'), ''),
      numero_compra = nullif(trim(p_despesa ->> 'numero_compra'), ''),
      data_compra = coalesce(nullif(p_despesa ->> 'data_compra', '')::date, current_date),
      fornecedor = nullif(trim(p_despesa ->> 'fornecedor'), ''),
      valor_total_centavos = v_total,
      forma_pagamento = p_despesa ->> 'forma_pagamento',
      cartao_id = nullif(p_despesa ->> 'cartao_id', '')::uuid,
      quantidade_parcelas = v_quantidade,
      primeiro_vencimento = v_primeiro_vencimento,
      observacoes = nullif(trim(p_despesa ->> 'observacoes'), '')
    where id = p_despesa_id;
    if not found then raise exception 'Compra não encontrada'; end if;
    delete from public.financeiro_parcelas where despesa_id = p_despesa_id;
    v_id := p_despesa_id;
  end if;

  v_base := v_total / v_quantidade;
  v_resto := v_total % v_quantidade;
  for v_indice in 0..v_quantidade - 1 loop
    insert into public.financeiro_parcelas (
      despesa_id, numero, total_parcelas, valor_centavos, vencimento
    ) values (
      v_id, v_indice + 1, v_quantidade,
      v_base + case when v_indice < v_resto then 1 else 0 end,
      (v_primeiro_vencimento + make_interval(months => v_indice))::date
    );
  end loop;
  return v_id;
end;
$$;

