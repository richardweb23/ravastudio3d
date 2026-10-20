-- Manual rollback only, after approval and backup. Never run as a forward migration.
-- First remove catalog images through the application (including pending uploads).
-- Delete the empty catalogo-produtos bucket through the Supabase Storage API/Studio.
begin;
do $$
begin
 if exists(select 1 from public.catalogo_imagens) then
   raise exception 'Remova as imagens pelo aplicativo antes da reversão';
 end if;
 if exists(select 1 from storage.buckets where id='catalogo-produtos') then
   raise exception 'Remova o bucket vazio pela API do Storage antes da reversão';
 end if;
end;$$;
drop policy catalogo_upload on storage.objects;
drop policy catalogo_storage_read on storage.objects;
drop policy catalogo_storage_delete on storage.objects;
drop function public.catalogo_arquivo_permitido(text,boolean);
drop function public.catalogo_publico(text,uuid,text,integer,text);
drop function public.duplicar_catalogo(uuid);
drop function public.salvar_catalogo(uuid,jsonb,integer);
drop function public.operar_imagem_catalogo(text,uuid,uuid,jsonb);
drop function public.excluir_catalogo(uuid);
drop table public.catalogo_imagens;
drop table public.catalogo_slugs;
drop table public.catalogo_produtos;
drop table public.catalogo_categorias;
drop trigger materiais_codigo_permanente on public.materiais;
drop function public.proteger_codigo_produto();
alter table public.materiais drop column codigo;
drop sequence public.produto_codigo_seq;
notify pgrst,'reload schema';
commit;
