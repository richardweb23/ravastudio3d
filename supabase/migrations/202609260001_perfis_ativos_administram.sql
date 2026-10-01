begin;

-- Enquanto o sistema é de uso interno, qualquer perfil ativo administra o sistema.
create or replace function public.usuario_administrador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and ativo
  );
$$;

revoke all on function public.usuario_administrador() from public, anon;
grant execute on function public.usuario_administrador() to authenticated;
notify pgrst, 'reload schema';
commit;