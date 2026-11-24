import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../../adminTypes';
import { requireSupabase } from '../../supabase';
import type { SiteConfiguracao, SitePrincipal } from '../../siteCatalogTypes';

import CatalogDialog from './CatalogDialog';

type Item = { id: string; nome: string; tipo: 'produto' | 'indicacao' };

export default function SiteCatalogCategories({ open, onClose, itens, onConfig }: { open: boolean; onClose: () => void; itens: Item[]; onConfig: (config: SiteConfiguracao) => void }) {
  const [config, setConfig] = useState<SiteConfiguracao | null>(null);
  const [principal, setPrincipal] = useState<SitePrincipal>('rava');
  const [classPrincipal, setClassPrincipal] = useState<SitePrincipal | ''>('');
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
  const [classificar, setClassificar] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const list = config?.subcategorias.filter(c => c.principal_id === principal) || [];
  function resetEdit() { setEditId(null); setNome(''); }
  if (!open) return error ? <p role="alert" className="catalog-admin-error">{error}</p> : null;
  return <CatalogDialog title="Gerenciar categorias do site" busy={busy} onClose={() => {
    resetEdit(); setClassificar(false); setMessage(''); onClose();
  }}>
    <div className="actions" role="group" aria-label="Ações do catálogo">
      <button disabled={busy} aria-pressed={!classificar} className={!classificar ? 'primary' : ''} onClick={() => { setClassificar(false); setMessage(''); }}>Subcategorias</button>
      <button disabled={busy} aria-pressed={classificar} className={classificar ? 'primary' : ''} onClick={() => { setClassificar(true); setMessage(''); }}>Classificar publicação</button>
    </div>
    {error && <p role="alert">{error}</p>}
    <p role="status">{message || (!config && !error ? 'Carregando categorias…' : '')}</p>
    {config && (!classificar ? <>
      <form className="catalog-admin-form" onSubmit={event => { event.preventDefault(); void run(async () => {
        const { error: failure } = await requireSupabase().rpc('site_salvar_subcategoria', { p_id: editId, p_principal_id: principal, p_nome: nome.trim(), p_ativa: list.find(c => c.id === editId)?.ativa ?? true });
        if (failure) throw failure;
        resetEdit();
      }, editId ? 'Subcategoria atualizada.' : 'Subcategoria criada.'); }}>
        <div className="form-grid">
          <label>Categoria principal<select value={principal} onChange={e => { setPrincipal(e.target.value as SitePrincipal); resetEdit(); setMessage(''); }} disabled={busy}>{config.principais.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
          <label>{editId ? 'Editar nome' : 'Nova subcategoria'}<input id="site-subcategory-name" required maxLength={100} value={nome} onChange={e => setNome(e.target.value)} disabled={busy} /></label>
        </div>
        <div className="actions"><button className="primary" type="submit" disabled={busy || !nome.trim()}>{editId ? 'Salvar nome' : 'Criar subcategoria'}</button>{editId && <button type="button" onClick={resetEdit} disabled={busy}>Cancelar edição</button>}</div>
      </form>
      <h3>Subcategorias de {config.principais.find(c => c.id === principal)?.nome}</h3>
      {!list.length && <p>Nenhuma subcategoria cadastrada.</p>}
      <ul className="catalog-category-list">{list.map(c => <li key={c.id}>
        <span>{c.nome} · {c.ativa ? 'Ativa' : 'Inativa'}</span>
        <div className="actions"><button type="button" disabled={busy} onClick={() => { setEditId(c.id); setNome(c.nome); document.getElementById('site-subcategory-name')?.focus(); }}>Renomear</button>
        <button type="button" disabled={busy} onClick={() => {
          if (c.ativa && !window.confirm('Desativar esta subcategoria? Os produtos associados deixarão de aparecer no site enquanto ela estiver inativa.')) return;
          void run(async () => { const { error: failure } = await requireSupabase().rpc('site_salvar_subcategoria', { p_id: c.id, p_principal_id: c.principal_id, p_nome: c.nome, p_ativa: !c.ativa }); if (failure) throw failure; }, 'Subcategoria atualizada.');
        }}>{c.ativa ? 'Desativar' : 'Ativar'}</button>
      </div></li>)}</ul>
      </> :
      <form className="catalog-admin-form" onSubmit={event => { event.preventDefault(); if (!selected || !classPrincipal) return; void run(async () => {
        const db = requireSupabase();
        const result = selected.tipo === 'produto'
          ? await db.rpc('site_classificar_produto', { p_produto_id: selected.id, p_principal_id: classPrincipal, p_subcategoria_id: subcategoria || null })
          : await db.rpc('site_classificar_indicacao', { p_indicacao_id: selected.id, p_principal_id: classPrincipal, p_subcategoria_id: subcategoria || null });
        if (result.error) throw result.error;
      }, 'Classificação do site atualizada.'); }}>
        <h3>Classificar produto para o site</h3>
        <div className="form-grid">
          <label>Produto do catálogo<select required value={item} disabled={busy} onChange={e => {
            const value = e.target.value; setItem(value);
            const found = itens.find(candidate => `${candidate.tipo}:${candidate.id}` === value);
            const existing = found?.tipo === 'produto' ? config.produtos.find(c => c.produto_id === found.id) : config.indicacoes.find(c => c.indicacao_id === found?.id);
            if (existing) { setClassPrincipal(existing.principal_id); setSubcategoria(existing.subcategoria_id || ''); }
            else { setClassPrincipal(''); setSubcategoria(''); }
          }}><option value="">Selecione um produto</option>{itens.map(value => <option key={`${value.tipo}:${value.id}`} value={`${value.tipo}:${value.id}`}>{value.nome}{value.tipo === 'indicacao' ? ' (indicação)' : ''}</option>)}</select></label>
          <label>Categoria principal<select required value={classPrincipal} disabled={busy} onChange={e => { setClassPrincipal(e.target.value as SitePrincipal | ''); setSubcategoria(''); }}><option value="">Selecione</option>{config.principais.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
          <label>Subcategoria<select value={subcategoria} disabled={busy || !classPrincipal} onChange={e => setSubcategoria(e.target.value)}><option value="">Sem subcategoria</option>{config.subcategorias.filter(c => c.principal_id === classPrincipal && c.ativa).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
        </div>
        <div className="actions"><button className="primary" type="submit" disabled={busy || !selected || !classPrincipal}>Salvar classificação</button></div>
      </form>
    )}
  </CatalogDialog>;
}
