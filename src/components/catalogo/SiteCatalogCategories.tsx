import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../../adminTypes';
import { requireSupabase } from '../../supabase';
import type { SiteConfiguracao, SitePrincipal } from '../../siteCatalogTypes';

type Item = { id: string; nome: string; tipo: 'produto' | 'indicacao' };

/** Interface experimental: só montar quando o backend isolado estiver disponível. */
export default function SiteCatalogCategories({ itens, onConfig }: { itens: Item[]; onConfig: (config: SiteConfiguracao) => void }) {
  const [config, setConfig] = useState<SiteConfiguracao | null>(null);
  const [principal, setPrincipal] = useState<SitePrincipal>('rava');
  const [nome, setNome] = useState('');
  const [item, setItem] = useState('');
  const [subcategoria, setSubcategoria] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const refresh = useCallback(async () => {
    const { data, error: failure } = await requireSupabase().rpc('site_configuracao_catalogo');
    if (failure) throw failure;
    setConfig(data);
    onConfig(data);
  }, [onConfig]);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => requireSupabase().rpc('site_configuracao_catalogo')).then(({ data, error: failure }) => {
      if (failure) throw failure;
      if (active) { setConfig(data); onConfig(data); }
    }).catch(e => { if (active) setError(errorMessage(e, 'Não foi possível carregar as categorias do site.')); });
    return () => { active = false; };
  }, [onConfig]);
  async function run(action: () => Promise<void>, success: string) {
    setBusy(true); setError(''); setMessage('');
    try { await action(); await refresh(); setMessage(success); }
    catch (e) { setError(errorMessage(e, 'Não foi possível atualizar o catálogo do site.')); }
    finally { setBusy(false); }
  }
  const selected = itens.find(value => `${value.tipo}:${value.id}` === item);
  return <section className="panel table-panel" aria-labelledby="site-categorias-titulo">
    <h2 id="site-categorias-titulo">Categorias do Catálogo do Site</h2>
    <p>Rava e Rivoxel são categorias principais do site. As categorias operacionais e os caixas não são alterados.</p>
    {error && <p role="alert">{error}</p>}
    <p role="status">{message || (!config && !error ? 'Carregando categorias…' : '')}</p>
    {config && <>
      <form className="catalog-admin-form" onSubmit={event => { event.preventDefault(); void run(async () => {
        const { error: failure } = await requireSupabase().rpc('site_salvar_subcategoria', { p_id: null, p_principal_id: principal, p_nome: nome, p_ativa: true });
        if (failure) throw failure;
        setNome('');
      }, 'Subcategoria criada.'); }}>
        <div className="form-grid">
          <label>Categoria principal<select value={principal} onChange={e => { setPrincipal(e.target.value as SitePrincipal); setSubcategoria(''); }} disabled={busy}>{config.principais.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
          <label>Nova subcategoria<input required maxLength={100} value={nome} onChange={e => setNome(e.target.value)} disabled={busy} /></label>
        </div>
        <button type="submit" disabled={busy}>Criar subcategoria</button>
      </form>
      {config.principais.map(root => <div key={root.id}><h3>{root.nome}</h3><ul className="catalog-category-list">{config.subcategorias.filter(c => c.principal_id === root.id).map(c => <li key={c.id}>
        <span>{c.nome} · {c.ativa ? 'Ativa' : 'Inativa'}</span>
        <button type="button" disabled={busy} onClick={() => {
          const novoNome = window.prompt('Nome da subcategoria', c.nome);
          if (novoNome === null) return;
          void run(async () => { const { error: failure } = await requireSupabase().rpc('site_salvar_subcategoria', { p_id: c.id, p_principal_id: c.principal_id, p_nome: novoNome, p_ativa: c.ativa }); if (failure) throw failure; }, 'Subcategoria atualizada.');
        }}>Renomear</button>
        <button type="button" disabled={busy} onClick={() => {
          if (c.ativa && !window.confirm('Desativar esta subcategoria? Os produtos associados deixarão de aparecer no site enquanto ela estiver inativa.')) return;
          void run(async () => { const { error: failure } = await requireSupabase().rpc('site_salvar_subcategoria', { p_id: c.id, p_principal_id: c.principal_id, p_nome: c.nome, p_ativa: !c.ativa }); if (failure) throw failure; }, 'Subcategoria atualizada.');
        }}>{c.ativa ? 'Desativar' : 'Ativar'}</button>
      </li>)}</ul></div>)}
      <form className="catalog-admin-form" onSubmit={event => { event.preventDefault(); if (!selected) return; void run(async () => {
        const db = requireSupabase();
        const result = selected.tipo === 'produto'
          ? await db.rpc('site_classificar_produto', { p_produto_id: selected.id, p_principal_id: principal, p_subcategoria_id: subcategoria || null })
          : await db.rpc('site_classificar_indicacao', { p_indicacao_id: selected.id, p_principal_id: principal, p_subcategoria_id: subcategoria || null });
        if (result.error) throw result.error;
      }, 'Classificação do site atualizada.'); }}>
        <h3>Classificar produto para o site</h3>
        <div className="form-grid">
          <label>Produto do catálogo<select required value={item} disabled={busy} onChange={e => {
            const value = e.target.value; setItem(value);
            const found = itens.find(candidate => `${candidate.tipo}:${candidate.id}` === value);
            const existing = found?.tipo === 'produto' ? config.produtos.find(c => c.produto_id === found.id) : config.indicacoes.find(c => c.indicacao_id === found?.id);
            if (existing) { setPrincipal(existing.principal_id); setSubcategoria(existing.subcategoria_id || ''); }
            else setSubcategoria('');
          }}><option value="">Selecione um produto</option>{itens.map(value => <option key={`${value.tipo}:${value.id}`} value={`${value.tipo}:${value.id}`}>{value.nome}{value.tipo === 'indicacao' ? ' (indicação)' : ''}</option>)}</select></label>
          <label>Categoria principal<select value={principal} disabled={busy} onChange={e => { setPrincipal(e.target.value as SitePrincipal); setSubcategoria(''); }}>{config.principais.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
          <label>Subcategoria<select value={subcategoria} disabled={busy} onChange={e => setSubcategoria(e.target.value)}><option value="">Sem subcategoria</option>{config.subcategorias.filter(c => c.principal_id === principal && c.ativa).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
        </div>
        <button type="submit" disabled={busy || !selected}>Salvar classificação</button>
      </form>
    </>}
  </section>;
}
