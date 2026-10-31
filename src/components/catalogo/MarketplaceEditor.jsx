import { useState } from 'react';
import { supabase } from '../../supabase.js';
import { catalogCents, catalogSlug, marketplaceUrl } from '../../lib/catalogo.js';
import CatalogDialog from './CatalogDialog.jsx';
export default function MarketplaceEditor({ record, categories, onClose, onSaved }) {
  const [form,setForm]=useState(() => ({ titulo:record?.titulo || '', descricao:record?.descricao || '', resumo:record?.resumo || '', price:((record?.preco_centavos || 0)/100).toFixed(2), categoria_id:record?.categoria_id || '', link_marketplace:record?.link_marketplace || '', imagem_externa:record?.imagem_externa || '', status:record?.status || 'rascunho' }));
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const change=(name,value)=>setForm(current=>({...current,[name]:value}));
  async function save(event){
    event.preventDefault(); if(busy)return; setError('');
    try {
      if(!marketplaceUrl(form.link_marketplace)) throw Error('Informe um link de compra HTTP ou HTTPS válido.');
      if(form.imagem_externa && !marketplaceUrl(form.imagem_externa)) throw Error('Informe um link de imagem HTTP ou HTTPS válido.');
      if(form.status==='publicado' && !form.descricao.trim()) throw Error('Preencha a descrição para publicar.');
      const payload={titulo:form.titulo.trim(), descricao:form.descricao.trim(), resumo:form.resumo.trim(), preco_centavos:catalogCents(form.price), categoria_id:form.categoria_id, link_marketplace:form.link_marketplace.trim(), imagem_externa:form.imagem_externa.trim() || null, status:form.status};
      setBusy(true);
      const query=record ? supabase.from('catalogo_indicacoes').update(payload).eq('material_id',record.material_id).eq('versao',record.versao) : supabase.from('catalogo_indicacoes').insert({...payload,slug:`${catalogSlug(form.titulo).slice(0,100) || 'indicacao'}-${crypto.randomUUID()}`});
      const {error:err}=await query.select('material_id').single(); if(err) throw err;
      await onSaved(); onClose();
    } catch(err){setError(err.message || 'Não foi possível salvar a indicação.');} finally {setBusy(false);}
  }
  return <CatalogDialog title={record ? 'Editar indicação Marketplace' : 'Nova indicação Marketplace'} onClose={onClose} busy={busy}>
    <p>Este produto aparece somente no catálogo e não cria produto nem estoque na Gestão.</p>
    <form className="catalog-admin-form" onSubmit={save}><fieldset disabled={busy}>
      <label>Nome do produto<input required maxLength={180} value={form.titulo} onChange={e=>change('titulo',e.target.value)} /></label>
      <label>Categoria Marketplace<select required value={form.categoria_id} onChange={e=>change('categoria_id',e.target.value)}><option value="">Selecione uma categoria</option>{categories.filter(c=>c.marketplace && (c.ativa || c.id===form.categoria_id)).map(c=><option key={c.id} value={c.id}>{c.nome}{!c.ativa?' (inativa)':''}</option>)}</select></label>
      <label>Link de compra<input type="url" required maxLength={2048} placeholder="https://..." value={form.link_marketplace} onChange={e=>change('link_marketplace',e.target.value)} /></label>
      <label>Link da imagem (opcional)<input type="url" maxLength={2048} placeholder="https://..." value={form.imagem_externa} onChange={e=>change('imagem_externa',e.target.value)} /></label>
      <label>Preço de referência (R$)<input type="number" min="0" step="0.01" required value={form.price} onChange={e=>change('price',e.target.value)} /></label>
      <label>Resumo<input maxLength={300} value={form.resumo} onChange={e=>change('resumo',e.target.value)} /></label>
      <label>Descrição<textarea maxLength={10000} value={form.descricao} onChange={e=>change('descricao',e.target.value)} /></label>
      <label>Status<select value={form.status} onChange={e=>change('status',e.target.value)}><option value="rascunho">Não publicado</option><option value="publicado">Publicado</option><option value="inativo">Arquivado</option></select></label>
    </fieldset>{error && <p role="alert" className="catalog-admin-error">{error}</p>}<div className="actions"><button className="primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar indicação'}</button><button type="button" disabled={busy} onClick={onClose}>Cancelar</button></div></form>
  </CatalogDialog>;
}
