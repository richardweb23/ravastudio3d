-- Temporary bootstrap is callable only by the service role.
create function public.instagram_instalar_vault_worker(p_secret text)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if length(p_secret) < 16 or length(p_secret) > 512 then raise exception 'Segredo invalido'; end if;
 if exists (select 1 from vault.secrets where name='instagram_worker_secret') then
   raise exception 'Segredo ja cadastrado; nao sera substituido';
 end if;
 perform vault.create_secret(p_secret, 'instagram_worker_secret', 'Chave de chamada do worker Instagram');
end;
$$;
revoke all on function public.instagram_instalar_vault_worker(text) from public, anon, authenticated;
grant execute on function public.instagram_instalar_vault_worker(text) to service_role;
