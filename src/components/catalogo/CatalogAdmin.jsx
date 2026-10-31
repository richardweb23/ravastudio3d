/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../supabase.js";
import { catalogCode, catalogMoney, catalogSlug, catalogLink } from "../../lib/catalogo.js";
import { adminCatalog, catalogImageUrl, imageAction, removeCatalogImage, saveCatalog, unwrap } from "../../services/catalogo.js";
import Header from "../Header.jsx";
import DataTable from "../DataTable.jsx";
import ProdutoForm from "../ProdutoForm.jsx";
import CatalogDialog from "./CatalogDialog.jsx";
import CatalogEditor from "./CatalogEditor.jsx";
import "../../catalogo.css";
import "./catalog-admin.css";
export default function CatalogAdmin({ materiais, locais, onSaved, show }) {
  const [data, setData] = useState({ products: [], categories: [], images: [] });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState(() => new URLSearchParams(window.location.search).get("produto"));
  const [creating, setCreating] = useState(false);
  const [categoryModal, setCategoryModal] = useState(false);
  const [categoryEdit, setCategoryEdit] = useState({ nome: "", slug: "", ativa: true });
  const refresh = useCallback(async () => {
    setError("");
    try { setData(await adminCatalog()); }
    catch (err) { setError(err.message); throw err; }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh().catch(() => {}); }, [refresh]);
  async function run(action) {
    if (busy) return;
    setBusy(true); setError("");
    try { await action(); await refresh(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  const records = new Map(data.products.map(p => [p.material_id, p]));
  const normalized = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const products = materiais.filter(p => {
    const record = records.get(p.id);
    return normalized(`${p.nome} ${record?.titulo || ""} ${catalogCode(p.codigo)}`).includes(normalized(search)) &&
      (!category || record?.categoria_id === category) && (!status || (record?.status || "rascunho") === status);
  }).sort((a, b) => (records.get(a.id)?.ordem || 0) - (records.get(b.id)?.ordem || 0) || Number(a.codigo) - Number(b.codigo));
  const product = materiais.find(p => p.id === editing);
  async function duplicate(source) {
    if (!window.confirm(`Duplicar “${source.nome}” como um novo produto não publicado e sem estoque?`)) return;
    await run(async () => {
      const id = await unwrap(supabase.rpc("duplicar_catalogo", { p_produto: source.id }));
      try {
        for (const image of data.images.filter(i => i.material_id === source.id && i.estado === "pronta").sort((a, b) => a.ordem - b.ordem)) {
          const copy = await imageAction("reservar", id, null, { arquivo: image.arquivo, alt: image.alt });
          try {
            await unwrap(supabase.storage.from("catalogo-produtos").copy(image.caminho, copy.caminho));
            await unwrap(supabase.storage.from("catalogo-produtos").copy(image.miniatura, copy.miniatura));
            await imageAction("confirmar", id, copy.id);
          } catch (err) {
            try { await removeCatalogImage(copy); } catch { /* Manifest remains available for cleanup in the editor. */ }
            throw err;
          }
        }
        show("Cópia criada sem estoque e sem publicação.");
      } catch (err) { throw Error(`A cópia foi criada, mas nem todas as imagens foram copiadas: ${err.message}`); }
      finally { await onSaved(); setEditing(id); }
    });
  }
  return <div className="catalog-admin">
    <Header title="Catálogo" subtitle="Publique seus produtos no site, independentemente do estoque." />
    <div className="actions"><button className="primary" onClick={() => setCreating(true)}>Novo produto</button><button onClick={() => setCategoryModal(true)}>Categorias do site</button><a href="/catalogo/" target="_blank" rel="noopener noreferrer">Abrir catálogo público ↗</a></div>
    {error && <p role="alert" className="catalog-admin-error">{error} <button disabled={busy} onClick={() => refresh().catch(() => {})}>Tentar novamente</button></p>}
    <section className="panel table-panel">
      <div className="sales-filters">
        <label>Nome ou código<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto" /></label>
        <label>Categoria do site<select value={category} onChange={e => setCategory(e.target.value)}><option value="">Todas</option>{data.categories.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
        <label>Status<select value={status} onChange={e => setStatus(e.target.value)}><option value="">Todos</option><option value="rascunho">Não publicado</option><option value="publicado">Publicado</option><option value="inativo">Arquivado</option></select></label>
      </div>
      {loading ? <p role="status">Carregando catálogo…</p> : <DataTable heads={["Produto", "Categoria do site", "Preço", "Status", "Ordem", "Ações"]} empty="Nenhum produto encontrado." rows={products.map(item => {
        const record = records.get(item.id);
        const image = data.images.filter(i => i.material_id === item.id && i.estado === "pronta").sort((a, b) => a.ordem - b.ordem)[0];
        return <tr key={item.id}>
          <td><div className="catalog-admin-product">{image && <img src={catalogImageUrl(image.miniatura)} alt="" loading="lazy" />}<div><strong>{catalogCode(item.codigo)} · {record?.titulo || item.nome}</strong>{record?.titulo && <small>{item.nome}</small>}</div></div></td>
          <td>{data.categories.find(c => c.id === record?.categoria_id)?.nome || "—"}</td>
          <td>{record ? catalogMoney(record.promocional_centavos ?? record.preco_centavos) : "—"}</td>
          <td>{record?.status === "publicado" && data.categories.find(c => c.id === record.categoria_id)?.marketplace && !record.link_marketplace && <span>Marketplace sem link · </span>}{record?.status === "publicado" ? "Publicado" : record?.status === "inativo" ? "Arquivado" : "Não publicado"}</td><td>{record?.ordem || 0}</td>
          <td><div className="row-actions"><button disabled={busy} onClick={() => setEditing(item.id)}>Editar catálogo</button><button disabled={busy} onClick={() => duplicate(item)}>Duplicar</button>{record && <button disabled={busy} onClick={() => run(async () => { await saveCatalog(item.id, { ...record, status: record.status === "publicado" ? "rascunho" : "publicado" }, record.versao); })}>{record.status === "publicado" ? "Despublicar" : "Publicar"}</button>}{record?.status === "publicado" && <a href={catalogLink(record.slug)} target="_blank" rel="noopener noreferrer">Ver no site ↗</a>}</div></td>
        </tr>;
      })} />}
    </section>
    {product && <CatalogEditor key={product.id} product={product} record={records.get(product.id)} categories={data.categories} images={data.images.filter(i => i.material_id === product.id)} onSaved={refresh} onClose={() => setEditing(null)} />}
    {creating && <CatalogDialog title="Cadastrar produto na Gestão" onClose={() => setCreating(false)}><ProdutoForm locais={locais} show={show} onSaved={async id => { await onSaved(); setCreating(false); setEditing(id); }} /></CatalogDialog>}
    {categoryModal && <CatalogDialog title="Categorias do site" onClose={() => setCategoryModal(false)} busy={busy}>
      <p>Estas categorias são exclusivas do catálogo. Ao desativar uma categoria, seus produtos deixam de aparecer no site.</p>
      <form className="catalog-admin-form" onSubmit={e => { e.preventDefault(); run(async () => {
        const payload = { nome: categoryEdit.nome.trim(), slug: categoryEdit.slug || catalogSlug(categoryEdit.nome), ativa: categoryEdit.ativa, marketplace: Boolean(categoryEdit.marketplace) };
        if (categoryEdit.id) await unwrap(supabase.from("catalogo_categorias").update(payload).eq("id", categoryEdit.id));
        else await unwrap(supabase.from("catalogo_categorias").insert(payload));
        setCategoryEdit({ nome: "", slug: "", ativa: true });
      }); }}>
        <div className="form-grid"><label>Nome<input required maxLength={100} value={categoryEdit.nome} onChange={e => setCategoryEdit({ ...categoryEdit, nome: e.target.value })} /></label><label>Slug<input pattern="[a-z0-9]+(-[a-z0-9]+)*" value={categoryEdit.slug} placeholder={catalogSlug(categoryEdit.nome)} onChange={e => setCategoryEdit({ ...categoryEdit, slug: e.target.value })} /></label></div>
        <label className="catalog-inline-check"><input type="checkbox" checked={categoryEdit.ativa} onChange={e => setCategoryEdit({ ...categoryEdit, ativa: e.target.checked })} />Ativa</label>
        <label className="catalog-inline-check"><input type="checkbox" checked={Boolean(categoryEdit.marketplace)} onChange={e => setCategoryEdit({ ...categoryEdit, marketplace: e.target.checked })} />Categoria Marketplace</label><small>Produtos desta categoria usam o link de compra cadastrado em cada produto.</small>
        <div className="actions"><button className="primary" disabled={busy}>{categoryEdit.id ? "Salvar categoria" : "Criar categoria"}</button>{categoryEdit.id && <button type="button" onClick={() => setCategoryEdit({ nome: "", slug: "", ativa: true })}>Cancelar edição</button>}</div>
      </form>
      {error && <p role="alert" className="catalog-admin-error">{error}</p>}
      <ul className="catalog-category-list">{data.categories.map(c => <li key={c.id}><span>{c.nome} · {c.ativa ? "Ativa" : "Inativa"}{c.marketplace ? " · Marketplace" : ""}</span><button disabled={busy} onClick={() => setCategoryEdit(c)}>Editar</button><button disabled={busy} onClick={() => { if (window.confirm(`Excluir a categoria “${c.nome}”? Categorias com produtos vinculados não podem ser excluídas.`)) run(() => unwrap(supabase.from("catalogo_categorias").delete().eq("id", c.id))); }}>Excluir</button></li>)}</ul>
    </CatalogDialog>}
  </div>;
}
