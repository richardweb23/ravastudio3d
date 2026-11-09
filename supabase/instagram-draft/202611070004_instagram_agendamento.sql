-- Draft: apply only to the isolated Instagram project after explicit approval.
-- Prerequisites: pg_cron, pg_net and Vault; one Vault entry named
-- instagram_worker_secret containing the *existing* worker secret.
-- This schedules work but does not enable the send gate or automation.
begin;
do $$
begin
  if (select count(*) from vault.decrypted_secrets where name = 'instagram_worker_secret') <> 1 then
    raise exception 'Configure exatamente um segredo instagram_worker_secret no Vault';
  end if;
  if exists (select 1 from cron.job where jobname in ('instagram-worker', 'instagram-retencao')) then
    raise exception 'Agendamentos Instagram ja existem; revise antes de continuar';
  end if;
end;
$$;

select cron.schedule('instagram-worker', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://jmgasikbbuwnlckzxbdl.supabase.co/functions/v1/instagram-worker',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='instagram_worker_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 120000
  );
$$);

select cron.schedule('instagram-retencao', '15 3 * * *', $$
  select public.instagram_limpar_registros();
$$);
commit;
