begin;
create table public.filamento_marcas (
 id uuid primary key default gen_random_uuid(),
 nome text not null check(length(btrim(nome)) between 1 and 100),
 valor_medio_centavos bigint not null check(valor_medio_centavos between 0 and 100000000),
 created_at timestamptz not null default now()
);
create unique index filamento_marcas_nome on public.filamento_marcas(lower(btrim(nome)));
create table public.filamento_estoque (
 id uuid primary key default gen_random_uuid(),
 marca_id uuid not null references public.filamento_marcas,
 cor_nome text not null check(length(btrim(cor_nome)) between 1 and 100),
 cor_hex text not null check(cor_hex ~ '^#[0-9a-f]{6}$'),
 tipo text not null check(tipo in ('PLA','PETG')),
 categoria text not null check(categoria in ('Standard','Matte','Silk','Duo Color')),
 caixa text not null check(caixa in ('Rivoxel','Rava','Bonecos')),
 quantidade_gramas bigint not null default 0 check(quantidade_gramas between 0 and 1000000000),
 custo_medio_centavos bigint not null default 0 check(custo_medio_centavos between 0 and 100000000),
 updated_at timestamptz not null default now()
);
create unique index filamento_estoque_variacao on public.filamento_estoque(marca_id,lower(btrim(cor_nome)),cor_hex,tipo,categoria,caixa);
create table public.filamento_movimentos (
 id uuid primary key default gen_random_uuid(),
 estoque_id uuid not null references public.filamento_estoque,
 tipo text not null check(tipo in ('entrada','baixa')),
 quantidade_gramas bigint not null check(quantidade_gramas between 1 and 1000000000),
 valor_kg_centavos bigint not null check(valor_kg_centavos between 0 and 100000000),
 data date not null,
 observacao text not null default '' check(length(observacao)<=500),
 requisicao uuid not null unique,
 dados jsonb not null,
 criado_por uuid not null references auth.users,
 created_at timestamptz not null default now()
);
create index filamento_movimentos_estoque on public.filamento_movimentos(estoque_id,created_at desc);
alter table public.filamento_marcas enable row level security;
alter table public.filamento_estoque enable row level security;
alter table public.filamento_movimentos enable row level security;
revoke all on public.filamento_marcas,public.filamento_estoque,public.filamento_movimentos from anon,authenticated;
grant select on public.filamento_marcas,public.filamento_estoque,public.filamento_movimentos to authenticated;
grant insert,update on public.filamento_marcas to authenticated;
create policy marcas_ler on public.filamento_marcas for select to authenticated using(public.usuario_ativo());
create policy marcas_criar on public.filamento_marcas for insert to authenticated with check(public.usuario_administrador());
create policy marcas_editar on public.filamento_marcas for update to authenticated using(public.usuario_administrador()) with check(public.usuario_administrador());
create policy filamentos_ler on public.filamento_estoque for select to authenticated using(public.usuario_ativo());
create policy filamentos_historico on public.filamento_movimentos for select to authenticated using(public.usuario_ativo());

create function public.movimentar_filamento(p_acao text,p_dados jsonb,p_requisicao uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare
 v public.filamento_estoque; anterior public.filamento_movimentos;
 v_id uuid; v_quantidade bigint; v_valor bigint;
 v_data date := (p_dados->>'data')::date;
 v_obs text := btrim(coalesce(p_dados->>'observacao',''));
begin
 if not public.usuario_ativo() then raise exception 'Acesso não autorizado'; end if;
 if p_requisicao is null then raise exception 'Identificador obrigatório'; end if;
 -- Serialize this small inventory, including creation of a previously absent variant.
 perform pg_advisory_xact_lock(29092601);
 select * into anterior from public.filamento_movimentos where requisicao=p_requisicao;
 if found then
  if anterior.tipo is distinct from p_acao or anterior.dados is distinct from p_dados or anterior.criado_por is distinct from auth.uid() then raise exception 'Identificador reutilizado com dados diferentes'; end if;
  return anterior.estoque_id;
 end if;
 if (p_dados->>'quantidade_gramas') is null or (p_dados->>'quantidade_gramas') !~ '^[0-9]+$' then raise exception 'Informe o peso em gramas inteiras'; end if;
 v_quantidade := (p_dados->>'quantidade_gramas')::bigint;
 if v_quantidade not between 1 and 1000000000 then raise exception 'Quantidade inválida'; end if;
 if v_data is null or v_data>current_date then raise exception 'Informe uma data até hoje'; end if;
 if length(v_obs)>500 then raise exception 'Observação deve ter até 500 caracteres'; end if;
 if p_acao='entrada' then
  if (p_dados->>'valor_kg_centavos') is null or (p_dados->>'valor_kg_centavos') !~ '^[0-9]+$' then raise exception 'Informe o valor por kg em centavos'; end if;
  v_valor := (p_dados->>'valor_kg_centavos')::bigint;
  if v_valor not between 0 and 100000000 then raise exception 'Valor inválido'; end if;
  insert into public.filamento_estoque(marca_id,cor_nome,cor_hex,tipo,categoria,caixa)
  values((p_dados->>'marca_id')::uuid,btrim(p_dados->>'cor_nome'),lower(p_dados->>'cor_hex'),p_dados->>'tipo',p_dados->>'categoria',p_dados->>'caixa')
  on conflict do nothing;
  select * into strict v from public.filamento_estoque
  where marca_id=(p_dados->>'marca_id')::uuid and lower(btrim(cor_nome))=lower(btrim(p_dados->>'cor_nome'))
  and cor_hex=lower(p_dados->>'cor_hex') and tipo=p_dados->>'tipo' and categoria=p_dados->>'categoria' and caixa=p_dados->>'caixa' for update;
  update public.filamento_estoque set
   custo_medio_centavos=round((quantidade_gramas::numeric*custo_medio_centavos+v_quantidade::numeric*v_valor)/(quantidade_gramas+v_quantidade)),
   quantidade_gramas=quantidade_gramas+v_quantidade,updated_at=now() where id=v.id;
 elsif p_acao='baixa' then
  if v_obs='' then raise exception 'Informe o motivo da baixa'; end if;
  select * into v from public.filamento_estoque where id=(p_dados->>'estoque_id')::uuid for update;
  if not found then raise exception 'Filamento não encontrado'; end if;
  if v.quantidade_gramas<v_quantidade then raise exception 'Estoque insuficiente para esta baixa'; end if;
  v_valor:=v.custo_medio_centavos;
  update public.filamento_estoque set quantidade_gramas=quantidade_gramas-v_quantidade,updated_at=now() where id=v.id;
 else raise exception 'Operação inválida';
 end if;
 insert into public.filamento_movimentos(estoque_id,tipo,quantidade_gramas,valor_kg_centavos,data,observacao,requisicao,dados,criado_por)
 values(v.id,p_acao,v_quantidade,v_valor,v_data,v_obs,p_requisicao,p_dados,auth.uid()) returning id into v_id;
 return v.id;
end $$;
revoke all on function public.movimentar_filamento(text,jsonb,uuid) from public,anon;
grant execute on function public.movimentar_filamento(text,jsonb,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
