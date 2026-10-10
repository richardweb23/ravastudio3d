import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase.js';
import Header from './Header.jsx';
import DataTable from './DataTable.jsx';
import { today } from '../lib/formatters.js';
import { SALES_BOXES } from '../lib/vendas.js';
import './filamentos.css';

const categories = ['Standard', 'Matte', 'Silk', 'Duo Color'];
const kg = grams => `${(Number(grams) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg`;
const money = cents => (Number(cents) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const blankEntry = () => ({ marca_id: '', cor_nome: '', cor_hex: '#ffffff', tipo: 'PLA', categoria: 'Matte', caixa: '', quantidade: '', valor: '', data: today(), observacao: '' });
const emptyFilters = { busca: '', marca: '', tipo: '', categoria: '', caixa: '', saldo: 'disponivel' };
async function allRows(table, columns, order) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const result = await supabase.from(table).select(columns).order(order).order('id').range(from, from + 999);
    if (result.error) throw result.error;
    rows.push(...result.data);
    if (result.data.length < 1000) return rows;
  }
}
function Dialog({ title, variant, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => { const node = ref.current; node.showModal(); return () => node.close(); }, []);
  return <dialog ref={ref} className={`modal-card registration-dialog filament-dialog filament-dialog--${variant || "marca"}`} aria-label={title} onCancel={e => { e.preventDefault(); onClose(); }}><header className="filament-dialog-heading"><h2>{title}</h2><button type="button" className="filament-dialog-close" onClick={onClose} aria-label="Fechar modal">×</button></header>{children}</dialog>;
}
function ActionIcon({ kind }) {
 const paths = { adicionar: <path d="M12 5v14M5 12h14" />, baixa: <><path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4" /></>, historico: <><path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2" /></> };
 return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[kind]}</svg>;
}
export default function Filamentos() {
  const [brands, setBrands] = useState([]), [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [entry, setEntry] = useState(blankEntry), [filters, setFilters] = useState(emptyFilters);
  const [modal, setModal] = useState(null), [dialogError, setDialogError] = useState(''), [busy, setBusy] = useState(false);
  const [brand, setBrand] = useState({ id: '', nome: '', valor: '' });
  const [replenishment, setReplenishment] = useState({ quantidade: '', valor: '', data: today(), observacao: '' });
  const [withdrawal, setWithdrawal] = useState({ quantidade: '', data: today(), observacao: '' });
  const [history, setHistory] = useState([]), [historyLoading, setHistoryLoading] = useState(false);
  const submitting = useRef(false), request = useRef(null), historyRequest = useRef(0);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, s] = await Promise.all([allRows('filamento_marcas', '*', 'nome'), allRows('filamento_estoque', '*,filamento_marcas(nome)', 'cor_nome')]);
      setBrands(b); setStock(s); setError(''); return s;
    } catch (err) { setError(`Não foi possível carregar os filamentos: ${err.message}`); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { let active = true; Promise.resolve().then(() => { if (active) void load(); }); return () => { active = false; }; }, [load]);
  const update = e => setEntry(v => ({ ...v, [e.target.name]: e.target.value }));
  const close = () => { if (!submitting.current) { historyRequest.current++; setModal(null); setDialogError(''); } };
  const open = (type, row) => { setDialogError(''); setModal({ type, row }); request.current = null; };
  async function perform(action, data) {
    const signature = JSON.stringify({ action, data });
    if (request.current?.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
    const result = await supabase.rpc('movimentar_filamento', { p_acao: action, p_dados: data, p_requisicao: request.current.id });
    if (result.error) throw result.error;
    request.current = null;
  }
  async function saveEntry(e) {
    e.preventDefault(); if (submitting.current) return;
    submitting.current = true; setBusy(true); setError(''); setNotice('');
    try {
      await perform('entrada', { marca_id: entry.marca_id, cor_nome: entry.cor_nome.trim(), cor_hex: entry.cor_hex, tipo: entry.tipo, categoria: entry.categoria, caixa: entry.caixa, quantidade_gramas: Math.round(Number(entry.quantidade) * 1000), valor_kg_centavos: Math.round(Number(entry.valor) * 100), data: entry.data, observacao: entry.observacao.trim() });
      setEntry(blankEntry()); setNotice('Entrada registrada. Estoque atualizado.'); await load();
    } catch (err) { setError(err.message); }
    finally { submitting.current = false; setBusy(false); }
  }
  async function saveBrand(e) {
    e.preventDefault(); if (submitting.current) return;
    submitting.current = true; setBusy(true); setDialogError('');
    try {
      const data = { nome: brand.nome.trim(), valor_medio_centavos: Math.round(Number(brand.valor) * 100) };
      const result = await (brand.id ? supabase.from('filamento_marcas').update(data).eq('id', brand.id) : supabase.from('filamento_marcas').insert(data)).select().single();
      if (result.error) throw result.error;
      setEntry(v => ({ ...v, marca_id: result.data.id, valor: (Number(result.data.valor_medio_centavos) / 100).toFixed(2) }));
      setModal(null); setNotice('Marca salva. Valor por kg sugerido na entrada.'); await load();
    } catch (err) { setDialogError(err.code === '23505' ? 'Já existe uma marca com esse nome.' : err.message); }
    finally { submitting.current = false; setBusy(false); }
  }
  async function saveWithdrawal(e) {
    e.preventDefault(); if (submitting.current) return;
    submitting.current = true; setBusy(true); setDialogError('');
    try {
      await perform('baixa', { estoque_id: modal.row.id, quantidade_gramas: Math.round(Number(withdrawal.quantidade) * 1000), data: withdrawal.data, observacao: withdrawal.observacao.trim() });
      setModal(null); setNotice('Baixa registrada. Histórico preservado.'); await load();
    } catch (err) { setDialogError(err.message); }
    finally { submitting.current = false; setBusy(false); }
  }
  async function saveReplenishment(e) {
    e.preventDefault(); if (submitting.current) return;
    submitting.current = true; setBusy(true); setDialogError('');
    try {
      const row = modal.row;
      await perform('entrada', { marca_id: row.marca_id, cor_nome: row.cor_nome, cor_hex: row.cor_hex, tipo: row.tipo, categoria: row.categoria, caixa: row.caixa, quantidade_gramas: Math.round(Number(replenishment.quantidade) * 1000), valor_kg_centavos: Math.round(Number(replenishment.valor) * 100), data: replenishment.data, observacao: replenishment.observacao.trim() || 'Reposição de filamento' });
      setModal(null); setNotice('Filamento adicionado. Saldo e custo médio atualizados.'); await load();
    } catch (err) { setDialogError(err.message); }
    finally { submitting.current = false; setBusy(false); }
  }
  async function showHistory(row) {
    open('historico', row); setHistory([]); setHistoryLoading(true);
    const seq = ++historyRequest.current;
    try {
      const rows = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from('filamento_movimentos').select('*').eq('estoque_id', row.id).order('created_at', { ascending: false }).order('id').range(from, from + 999);
        if (error) throw error;
        rows.push(...data); if (data.length < 1000) break;
      }
      if (seq === historyRequest.current) setHistory(rows);
    } catch (err) { if (seq === historyRequest.current) setDialogError(err.message); }
    finally { if (seq === historyRequest.current) setHistoryLoading(false); }
  }
  async function removeWithdrawal(movement) {
    if (submitting.current) return;
    if (!window.confirm(`Remover esta baixa de ${kg(movement.quantidade_gramas)}? A quantidade voltará ao estoque de ${modal.row.cor_nome} no caixa ${modal.row.caixa}.`)) return;
    submitting.current = true; setBusy(true); setDialogError('');
    try {
      const { error } = await supabase.rpc('remover_baixa_filamento', { p_movimento_id: movement.id });
      if (error) throw error;
      const updated = await load();
      if (!updated) throw new Error('Baixa removida, mas não foi possível atualizar a tela. Feche o histórico e clique em Atualizar.');
      const fresh = updated.find(item => item.id === movement.estoque_id);
      await showHistory(fresh || modal.row);
      setNotice('Baixa removida. Quantidade devolvida ao estoque.');
    } catch (err) { setDialogError(err.message); }
    finally { submitting.current = false; setBusy(false); }
  }
  const reversedWithdrawals = new Set(history.filter(row => row.estorno_de).map(row => row.estorno_de));
  const filtered = stock.filter(row => {
    const query = `${row.cor_nome} ${row.filamento_marcas?.nome || ''}`.toLocaleLowerCase('pt-BR');
    return query.includes(filters.busca.trim().toLocaleLowerCase('pt-BR')) && (!filters.marca || row.marca_id === filters.marca) && (!filters.tipo || row.tipo === filters.tipo) && (!filters.categoria || row.categoria === filters.categoria) && (!filters.caixa || row.caixa === filters.caixa) && (!filters.saldo || (filters.saldo === 'disponivel' ? Number(row.quantidade_gramas) > 0 : Number(row.quantidade_gramas) === 0));
  });
  const filter = e => setFilters(v => ({ ...v, [e.target.name]: e.target.value }));
  return <div className="filaments-page">
    <Header title="Filamentos" subtitle="Entradas, consumo e saldo por caixa, em quilogramas." action={<button onClick={() => { setBrand({ id: '', nome: '', valor: '' }); open('marca'); }}>Cadastrar marca</button>} />
    {error && <p className="negative" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <div className="metrics filament-metrics">{SALES_BOXES.map(box => <section className="metric" key={box}><span>{box} · estoque</span><strong>{loading ? '…' : kg(stock.filter(row => row.caixa === box).reduce((s, row) => s + Number(row.quantidade_gramas), 0))}</strong></section>)}</div>
    <form className="panel form" onSubmit={saveEntry}>
      <div className="panel-title"><h2>Entrada de filamento</h2><span>1 kg = 1.000 g</span></div>
      <fieldset disabled={busy || loading} className="filament-fields">
        <label>Marca<select aria-label="Marca" name="marca_id" value={entry.marca_id} required onChange={e => { const b = brands.find(b => b.id === e.target.value); setEntry(v => ({ ...v, marca_id: e.target.value, valor: b ? (Number(b.valor_medio_centavos) / 100).toFixed(2) : '' })); }}><option value="">Selecione a marca</option>{brands.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}</select></label>
        <div className="filament-brand-action"><button type="button" disabled={!entry.marca_id} onClick={() => { const b = brands.find(b => b.id === entry.marca_id); setBrand({ id: b.id, nome: b.nome, valor: (Number(b.valor_medio_centavos) / 100).toFixed(2) }); open('marca'); }}>Editar marca / valor médio</button></div>
        <label>Nome da cor<input name="cor_nome" value={entry.cor_nome} onChange={update} required maxLength={100} placeholder="Ex.: Azul oceano" /></label>
        <label>Cor<div className="filament-color"><input type="color" aria-label="Cor" name="cor_hex" value={entry.cor_hex} onChange={update} /><span>{entry.cor_hex.toUpperCase()}</span></div></label>
        <label>Tipo<select aria-label="Tipo" name="tipo" value={entry.tipo} onChange={update}>{['PLA', 'PETG'].map(v => <option key={v}>{v}</option>)}</select></label>
        <label>Categoria<select aria-label="Categoria" name="categoria" value={entry.categoria} onChange={update}>{categories.map(v => <option key={v}>{v}</option>)}</select></label>
        <label>Caixa<select aria-label="Caixa" name="caixa" value={entry.caixa} onChange={update} required><option value="">Selecione o caixa</option>{SALES_BOXES.map(v => <option key={v}>{v}</option>)}</select></label>
        <label>Quantidade (kg)<input type="number" name="quantidade" min="0.001" max="1000000" step="0.001" value={entry.quantidade} onChange={update} required placeholder="Ex.: 1,000" /></label>
        <label>Valor por kg (R$)<input type="number" name="valor" min="0" max="1000000" step="0.01" value={entry.valor} onChange={update} required /></label>
        <label>Data da entrada<input type="date" name="data" max={today()} value={entry.data} onChange={update} required /></label>
        <label className="filament-wide">Observação<input name="observacao" value={entry.observacao} onChange={update} maxLength={500} placeholder="Compra, reposição ou saldo inicial" /></label>
      </fieldset>
      {!loading && !brands.length && <p>Cadastre a primeira marca para registrar uma entrada.</p>}
      <div className="actions"><button className="primary" disabled={busy || loading || !brands.length}>{busy ? 'Salvando…' : 'Registrar entrada'}</button><span>Total da entrada: <strong>{money(Math.round(Number(entry.quantidade || 0) * Number(entry.valor || 0) * 100))}</strong></span></div>
    </form>
    <section className="panel table-panel">
      <div className="panel-title"><h2>Estoque de filamentos</h2><button onClick={load} disabled={loading || busy}>Atualizar</button></div>
      <div className="filament-filters">
        <label>Buscar marca ou cor<input name="busca" value={filters.busca} onChange={filter} type="search" placeholder="Digite para filtrar" /></label>
        <label>Filtrar marca<select aria-label="Filtrar marca" name="marca" value={filters.marca} onChange={filter}><option value="">Todas</option>{brands.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}</select></label>
        <label>Filtrar tipo<select aria-label="Filtrar tipo" name="tipo" value={filters.tipo} onChange={filter}><option value="">Todos</option>{['PLA', 'PETG'].map(v => <option key={v}>{v}</option>)}</select></label>
        <label>Filtrar categoria<select aria-label="Filtrar categoria" name="categoria" value={filters.categoria} onChange={filter}><option value="">Todas</option>{categories.map(v => <option key={v}>{v}</option>)}</select></label>
        <label>Filtrar caixa<select aria-label="Filtrar caixa" name="caixa" value={filters.caixa} onChange={filter}><option value="">Todos</option>{SALES_BOXES.map(v => <option key={v}>{v}</option>)}</select></label>
        <label>Saldo<select aria-label="Saldo" name="saldo" value={filters.saldo} onChange={filter}><option value="disponivel">Com estoque</option><option value="">Todos</option><option value="zerado">Sem estoque</option></select></label>
      </div>
      <div className="actions"><button className="link" onClick={() => setFilters(emptyFilters)}>Limpar filtros</button><span>{filtered.length} combinações · {kg(filtered.reduce((s, r) => s + Number(r.quantidade_gramas), 0))}</span></div>
      {loading ? <p role="status">Carregando estoque…</p> : <DataTable heads={['Marca', 'Cor', 'Tipo', 'Categoria', 'Caixa', 'Saldo', 'Custo médio / kg', 'Valor em estoque', 'Ações']} rows={filtered.map(row => <tr key={row.id}>
        <td>{row.filamento_marcas?.nome}</td><td><span className="filament-swatch" style={{ backgroundColor: row.cor_hex }} aria-hidden="true" />{row.cor_nome}<small>{row.cor_hex.toUpperCase()}</small></td><td>{row.tipo}</td><td>{row.categoria}</td><td>{row.caixa}</td><td><strong>{kg(row.quantidade_gramas)}</strong></td><td>{money(row.custo_medio_centavos)}</td><td>{money(Math.round(Number(row.quantidade_gramas) * Number(row.custo_medio_centavos) / 1000))}</td>
        <td><div className="row-actions filament-actions">
          <button type="button" className="registration-icon-button" title="Adicionar filamento" aria-label={`Adicionar filamento: ${row.cor_nome} · ${row.caixa}`} disabled={busy} onClick={() => { setReplenishment({ quantidade: '', valor: (Number(row.custo_medio_centavos) / 100).toFixed(2), data: today(), observacao: '' }); open('reposicao', row); }}><ActionIcon kind="adicionar" /></button>
          <button type="button" className="registration-icon-button" title="Dar baixa" aria-label={`Dar baixa: ${row.cor_nome} · ${row.caixa}`} disabled={busy || Number(row.quantidade_gramas) === 0} onClick={() => { setWithdrawal({ quantidade: '', data: today(), observacao: '' }); open('baixa', row); }}><ActionIcon kind="baixa" /></button>
          <button type="button" className="registration-icon-button" title="Histórico" aria-label={`Histórico: ${row.cor_nome} · ${row.caixa}`} disabled={busy} onClick={() => showHistory(row)}><ActionIcon kind="historico" /></button>
        </div></td>
      </tr>)} empty="Nenhum filamento encontrado com estes filtros." />}
    </section>
    {modal && <Dialog variant={modal.type} title={modal.type === 'marca' ? (brand.id ? 'Editar marca' : 'Cadastrar marca') : modal.type === 'baixa' ? 'Dar baixa no filamento' : modal.type === 'reposicao' ? 'Adicionar filamento ao estoque' : 'Histórico do filamento'} onClose={close}>
      {dialogError && <p role="alert" className="negative">{dialogError}</p>}
      {modal.type === 'marca' && <form className="form" onSubmit={saveBrand}><label>Nome da marca<input value={brand.nome} onChange={e => setBrand(v => ({ ...v, nome: e.target.value }))} required maxLength={100} disabled={busy} /></label><label>Valor médio por kg (R$)<input type="number" value={brand.valor} min="0" max="1000000" step="0.01" onChange={e => setBrand(v => ({ ...v, valor: e.target.value }))} required disabled={busy} /></label><p>Valor sugerido nas próximas entradas. Você pode informar o preço efetivo de cada compra.</p><div className="actions"><button className="primary" disabled={busy}>Salvar marca</button><button type="button" onClick={close} disabled={busy}>Cancelar</button></div></form>}
      {modal.type === 'reposicao' && <form className="form" onSubmit={saveReplenishment}>
        <div className="filament-dialog-summary"><div><span className="filament-dialog-eyebrow">Reposição de estoque</span><strong>{modal.row.filamento_marcas?.nome} · {modal.row.cor_nome}</strong><span>{modal.row.tipo} · {modal.row.categoria} · {modal.row.caixa}</span></div><div className="filament-dialog-balance"><span>Saldo atual</span><strong>{kg(modal.row.quantidade_gramas)}</strong></div></div>
        <div className="filament-withdrawal-fields">
          <label>Quantidade a adicionar (kg)<input type="number" min="0.001" max="1000000" step="0.001" required autoFocus disabled={busy} value={replenishment.quantidade} onChange={e => setReplenishment(v => ({ ...v, quantidade: e.target.value }))} /></label>
          <label>Valor da reposição por kg (R$)<input type="number" min="0" max="1000000" step="0.01" required disabled={busy} value={replenishment.valor} onChange={e => setReplenishment(v => ({ ...v, valor: e.target.value }))} /></label>
          <label>Data da reposição<input type="date" max={today()} required disabled={busy} value={replenishment.data} onChange={e => setReplenishment(v => ({ ...v, data: e.target.value }))} /></label>
          <div className="filament-replenishment-preview">Saldo após adicionar<strong>{kg(Number(modal.row.quantidade_gramas) + Math.round(Number(replenishment.quantidade || 0) * 1000))}</strong></div>
          <label className="filament-wide">Observação<textarea rows={3} maxLength={500} disabled={busy} value={replenishment.observacao} onChange={e => setReplenishment(v => ({ ...v, observacao: e.target.value }))} placeholder="Ex.: Compra de novo rolo" /></label>
        </div>
        <div className="actions filament-dialog-footer"><button type="button" disabled={busy} onClick={close}>Cancelar</button><button className="primary" disabled={busy}>{busy ? 'Adicionando…' : 'Adicionar ao estoque'}</button></div>
      </form>}
      {modal.type === 'baixa' && <form className="form filament-withdrawal" onSubmit={saveWithdrawal}><div className="filament-dialog-summary"><div><span className="filament-dialog-eyebrow">Filamento selecionado</span><strong>{modal.row.filamento_marcas?.nome} · {modal.row.cor_nome}</strong><span>{modal.row.tipo} · {modal.row.categoria} · {modal.row.caixa}</span></div><div className="filament-dialog-balance"><span>Disponível</span><strong>{kg(modal.row.quantidade_gramas)}</strong></div></div><div className="filament-withdrawal-fields"><label>Quantidade da baixa (kg)<input type="number" min="0.001" max={Number(modal.row.quantidade_gramas) / 1000} step="0.001" value={withdrawal.quantidade} onChange={e => setWithdrawal(v => ({ ...v, quantidade: e.target.value }))} required disabled={busy} /></label><label>Data da baixa<input type="date" max={today()} value={withdrawal.data} onChange={e => setWithdrawal(v => ({ ...v, data: e.target.value }))} required disabled={busy} /></label><label className="filament-wide">Motivo da baixa<textarea rows={3} value={withdrawal.observacao} onChange={e => setWithdrawal(v => ({ ...v, observacao: e.target.value }))} required maxLength={500} disabled={busy} placeholder="Ex.: Impressão do pedido ou perda de material" /></label></div><div className="actions filament-dialog-footer"><button type="button" onClick={close} disabled={busy}>Cancelar</button><button className="primary" disabled={busy}>Confirmar baixa</button></div></form>}
      {modal.type === 'historico' && <><div className="filament-dialog-summary"><div><span className="filament-dialog-eyebrow">Entradas e baixas</span><strong>{modal.row.filamento_marcas?.nome} · {modal.row.cor_nome}</strong><span>{modal.row.tipo} · {modal.row.categoria} · {modal.row.caixa}</span></div><div className="filament-dialog-balance"><span>Saldo atual</span><strong>{kg(modal.row.quantidade_gramas)}</strong></div></div><div className="filament-history-table">{historyLoading ? <p role="status">Carregando histórico…</p> : <DataTable heads={['Data', 'Movimento', 'Peso', 'Valor / kg', 'Observação', 'Ações']} rows={history.map(row => <tr key={row.id}><td>{row.data.split('-').reverse().join('/')}</td><td>{{ entrada: 'Entrada', baixa: 'Baixa', estorno_baixa: 'Devolução ao estoque' }[row.tipo]}{reversedWithdrawals.has(row.id) && <small><span className="status finance-neutro">Removida</span></small>}</td><td>{row.tipo === 'baixa' ? '−' : '+'}{kg(row.quantidade_gramas)}</td><td>{money(row.valor_kg_centavos)}</td><td>{row.observacao || '—'}</td><td>{row.tipo === 'baixa' && !reversedWithdrawals.has(row.id) ? <div className="row-actions"><button type="button" className="danger-text" disabled={busy} onClick={() => removeWithdrawal(row)}>Remover baixa</button></div> : '—'}</td></tr>)} empty="Nenhum movimento registrado." />}</div><div className="actions filament-dialog-footer"><button onClick={close}>Fechar</button></div></>}
    </Dialog>}
  </div>;
}
