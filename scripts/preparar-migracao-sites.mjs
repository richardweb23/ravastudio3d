import { readFile } from 'node:fs/promises';

const proposals = [
  'supabase/propostas/catalogo_site_categorias.sql',
  'supabase/propostas/catalogo_site_padrao_rava_publicados.sql',
  'supabase/propostas/catalogo_site_indicacoes_compatibilidade.sql',
];

// Montagem para ensaio: não executa SQL nem se conecta a bancos.
export async function prepararMigracaoSites() {
  const parts = [];
  for (const path of proposals) {
    const source = await readFile(path, 'utf8');
    if ((source.match(/^begin;\s*$/gim) || []).length !== 1 || (source.match(/^commit;\s*$/gim) || []).length !== 1) {
      throw new Error(`Limites de transação inesperados em ${path}.`);
    }
    parts.push(source.replace(/^begin;\s*$/im, '').replace(/^commit;\s*$/im, ''));
  }
  const preflight = `
do $$
begin
  if to_regclass('public.site_categorias_principais') is not null
    or to_regclass('public.site_subcategorias') is not null
    or to_regclass('public.site_classificacao_produtos') is not null
    or to_regclass('public.site_classificacao_indicacoes') is not null then
    raise exception 'Estruturas de classificação do site já existem; revisar antes de prosseguir';
  end if;
  if to_regprocedure('public.catalogo_publico(text,uuid,text,integer,text)') is null
    or to_regprocedure('public.usuario_ativo()') is null
    or to_regprocedure('public.validar_indicacao_catalogo()') is null then
    raise exception 'Função esperada do catálogo não encontrada';
  end if;
  if md5(regexp_replace(pg_get_functiondef('public.validar_indicacao_catalogo()'::regprocedure), '\\s+', '', 'g')) <> '2a30026c69613ded27f9ef3ad65e6b2f' then
    raise exception 'Validação legada das indicações mudou; revisar antes de prosseguir';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public'
    and table_name='catalogo_indicacoes' and column_name='categoria_id' and is_nullable='NO') then
    raise exception 'Restrição legada da categoria de indicação divergente';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid='public.catalogo_indicacoes'::regclass
    and tgname='validar_indicacao_catalogo' and not tgisinternal and tgenabled <> 'D'
    and tgfoid='public.validar_indicacao_catalogo()'::regprocedure) then
    raise exception 'Gatilho esperado de indicação ausente ou desativado';
  end if;
end; $$;`;
  return `begin;\n${preflight}\n${parts.join('\n')}\ncommit;\n`;
}
