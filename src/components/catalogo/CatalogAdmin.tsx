import type { AdminData, Show } from "../../adminTypes";
import { errorMessage } from "../../adminTypes";
import type { Tables } from "../../database.types";
import SearchSelect from '../SearchSelect.tsx';
/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import { requireSupabase } from "../../supabase.js";
import { catalogCode, catalogMoney, catalogSlug, catalogLink } from "../../lib/catalogo.js";
import { hasImageFiles, adminCatalog, catalogImageUrl, imageAction, removeCatalogImage, saveCatalog, unwrap } from "../../services/catalogo.js";
import Header from "../Header.tsx";
import DataTable from "../DataTable.tsx";
import ProdutoForm from "../ProdutoForm.tsx";
import CatalogDialog from "./CatalogDialog.tsx";
import CatalogEditor from "./CatalogEditor.tsx";
import MarketplaceEditor from "./MarketplaceEditor.tsx";
import SiteCatalogCategories from "./SiteCatalogCategories.tsx";
import { catalogSiteLink } from "../../lib/rivoxel-urls.js";
import type { SiteConfiguracao, SitePrincipal } from "../../siteCatalogTypes";
import "../../catalogo.css";
import "./catalog-admin.css";
export default function CatalogAdmin({ materiais, locais, onSaved, show }: Pick<AdminData, "materiais" | "locais"> & { onSaved: () => Promise<void>; show: Show }) {
  const categoriasExperimentais = import.meta.env.VITE_SITE_CATEGORIAS_EXPERIMENTAL === 'true';
  const [data, setData] = useState<Awaited<ReturnType<typeof adminCatalog>>>({ products: [], categories: [], images: [], indicacoes: [], marcas: [], materialMarcas: [], categoriaMarcas: [], indicacaoMarcas: [] });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [marca, setMarca] = useState("");
  const [siteConfig, setSiteConfig] = useState<SiteConfiguracao | null>(null);
  const [editing, setEditing] = useState(() => new URLSearchParams(window.location.search).get("produto"));
  const [creating, setCreating] = useState(false);
  const [marketEditing, setMarketEditing] = useState<Tables<"catalogo_indicacoes"> | "new" | null>(null);
  const [categoryModal, setCategoryModal] = useState(false);
  const [categoryBrand, setCategoryBrand] = useState("");
  const [categoryParent, setCategoryParent] = useState("");
  const [categoryEdit, setCategoryEdit] = useState<Pick<Tables<"catalogo_categorias">, "nome" | "slug" | "ativa"> & Partial<Pick<Tables<"catalogo_categorias">, "id" | "marketplace">>>({ nome: "", slug: "", ativa: true });
  const [publishedPages, setPublishedPages] = useState<string[]>([]);
  useEffect(() => { fetch('/catalogo-paginas.json', { cache: 'no-cache' }).then(response => response.ok ? response.json() : []).then(pages => { if (Array.isArray(pages)) setPublishedPages(pages); }).catch(() => {}); }, []);
  const refresh = useCallback(async () => {
    setError("");
    try { setData(await adminCatalog(categoriasExperimentais)); }
    catch (err) { setError(errorMessage(err, "Não foi possível atualizar o catálogo.")); throw err; }
    finally { setLoading(false); }
  }, [categoriasExperimentais]);
  useEffect(() => { refresh().catch(() => {}); }, [refresh]);
  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true); setError("");
    try { await action(); await refresh(); }
    catch (err) { setError(errorMessage(err, "Não foi possível atualizar o catálogo.")); }
    finally { setBusy(false); }
  }
  const records = new Map(data.products.map(p => [p.material_id, p]));
  const materialMarca = new Map(data.materialMarcas.map(v => [v.material_id, v.marca_id]));
  const categoriaMarca = new Map(data.categoriaMarcas.map(v => [v.categoria_id, v.marca_id]));
  const indicacaoMarca = new Map(data.indicacaoMarcas.map(v => [v.material_id, v.marca_id]));
  const nomeMarca = (id?: string) => data.marcas.find(m => m.id === id)?.nome || "Sem marca";
  const siteLink = (site: SitePrincipal | undefined, slug: string, subcategoriaId?: string | null) => {
    if (!site || (subcategoriaId && !siteConfig?.subcategorias.find(c => c.id === subcategoriaId && c.ativa))) return null;
    return catalogSiteLink(site, slug, window.location.origin);
  };
  const classificacaoAtiva = (value?: { subcategoria_id: string | null }) => Boolean(value && (!value.subcategoria_id || siteConfig?.subcategorias.some(c => c.id === value.subcategoria_id && c.ativa)));
  const normalized = (value: unknown) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const products = materiais.filter(p => {
    const record = records.get(p.id);
    const classificacao = siteConfig?.produtos.find(c => c.produto_id === p.id);
    return normalized(`${p.nome} ${record?.titulo || ""} ${catalogCode(p.codigo)}`).includes(normalized(search)) &&
      (!marca || (categoriasExperimentais ? classificacao?.principal_id === marca : materialMarca.get(p.id) === marca)) &&
      (!category || (categoriasExperimentais ? classificacao?.subcategoria_id === category : record?.categoria_id === category)) && (!status || (record?.status || "rascunho") === status);
  }).sort((a, b) => (records.get(a.id)?.ordem || 0) - (records.get(b.id)?.ordem || 0) || Number(a.codigo) - Number(b.codigo));
  const product = materiais.find(p => p.id === editing);
  async function duplicate(source: AdminData["materiais"][number]) {
    if (!window.confirm(`Duplicar “${source.nome}” como um novo produto não publicado e sem estoque?`)) return;
    await run(async () => {
      const id = await unwrap(requireSupabase().rpc("duplicar_catalogo", { p_produto: source.id }));
      if (!id) throw Error("Não foi possível duplicar o produto.");
      try {
        for (const image of data.images.filter(i => i.material_id === source.id && i.estado === "pronta").sort((a, b) => a.ordem - b.ordem)) {
          const copy = await imageAction("reservar", id, null, { arquivo: image.arquivo, alt: image.alt });
          if (!hasImageFiles(copy)) throw Error("Não foi possível reservar a imagem.");
          try {
            await unwrap(requireSupabase().storage.from("catalogo-produtos").copy(image.caminho, copy.caminho));
            await unwrap(requireSupabase().storage.from("catalogo-produtos").copy(image.miniatura, copy.miniatura));
            await imageAction("confirmar", id, copy.id);
          } catch (err) {
            if (!hasImageFiles(copy)) throw Error("Não foi possível reservar a imagem.");
          try { await removeCatalogImage(copy); } catch { /* Manifest remains available for cleanup in the editor. */ }
            throw err;
          }
        }
        show("Cópia criada sem estoque e sem publicação.");
      } catch (err) { throw Error(`A cópia foi criada, mas nem todas as imagens foram copiadas: ${errorMessage(err, "Falha na duplicação.")}`); }
      finally { await onSaved(); setEditing(id); }
    });
  }
  return <div className="catalog-admin">
    <Header title="Catálogo" subtitle="Publique seus produtos no site, independentemente do estoque." />
    <div className="actions"><button className="primary" onClick={() => setCreating(true)}>Novo produto</button><button onClick={() => setMarketEditing("new")}>Nova indicação Marketplace</button><button onClick={() => setCategoryModal(true)}>Gerenciar categorias</button><a href="/catalogo/" target="_blank" rel="noopener noreferrer">Abrir catálogo público ↗</a></div>
    {categoriasExperimentais && <SiteCatalogCategories open={categoryModal} onClose={() => setCategoryModal(false)} onConfig={setSiteConfig} itens={[...data.products.map(p => ({ id: p.material_id, nome: p.titulo || materiais.find(m => m.id === p.material_id)?.nome || 'Produto', tipo: 'produto' as const })), ...data.indicacoes.map(i => ({ id: i.material_id, nome: i.titulo, tipo: 'indicacao' as const }))]} />}
    {error && <p role="alert" className="catalog-admin-error">{error} <button disabled={busy} onClick={() => refresh().catch(() => {})}>Tentar novamente</button></p>}
    <section className="panel table-panel">
      <div className="sales-filters">
        <label>Nome ou código<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto" /></label>
        {!categoriasExperimentais && <label>Marca no site<SearchSelect value={marca} onChange={e => { setMarca(e.target.value); setCategory(""); }}><option value="">Todas</option>{data.marcas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}</SearchSelect></label>}
        {!categoriasExperimentais && <label>Categoria do site<SearchSelect value={category} onChange={e => setCategory(e.target.value)}><option value="">Todas</option>{data.categories.filter(c => !marca || categoriaMarca.get(c.id) === marca).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</SearchSelect></label>}
        {categoriasExperimentais && <label>Categoria principal<SearchSelect value={marca} onChange={e => { setMarca(e.target.value); setCategory(""); }}><option value="">Todas</option>{siteConfig?.principais.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</SearchSelect></label>}
        {categoriasExperimentais && <label>Subcategoria<SearchSelect value={category} onChange={e => setCategory(e.target.value)}><option value="">Todas</option>{siteConfig?.subcategorias.filter(c => !marca || c.principal_id === marca).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</SearchSelect></label>}
        <label>Status<SearchSelect value={status} onChange={e => setStatus(e.target.value)}><option value="">Todos</option><option value="rascunho">Não publicado</option><option value="publicado">Publicado</option><option value="inativo">Arquivado</option></SearchSelect></label>
      </div>
      {loading ? <p role="status">Carregando catálogo…</p> : <DataTable heads={["Produto", ...(categoriasExperimentais ? ["Categoria principal", "Subcategoria"] : ["Marca no site", "Categoria do site"]), "Preço", "Status", "Ordem", "Ações"]} empty="Nenhum produto encontrado." rows={products.map(item => {
        const record = records.get(item.id);
        const classificacao = siteConfig?.produtos.find(c => c.produto_id === item.id);
        const destino = record?.status === 'publicado' && (categoriasExperimentais || !record.categoria_id || data.categories.find(c => c.id === record.categoria_id)?.ativa) && (categoriasExperimentais
          ? siteLink(classificacao?.principal_id, record.slug, classificacao?.subcategoria_id)
          : materialMarca.get(item.id) === data.marcas.find(m => m.slug === 'rivoxel')?.id
            ? catalogSiteLink('rivoxel', record.slug, window.location.origin)
            : materialMarca.get(item.id) === data.marcas.find(m => m.slug === 'rava')?.id
              ? catalogLink(record.slug, window.location.origin, publishedPages.includes(record.slug)) : null);
        const image = data.images.filter(i => i.material_id === item.id && i.estado === "pronta").sort((a, b) => a.ordem - b.ordem)[0];
        return <tr key={item.id}>
          <td><div className="catalog-admin-product">{image && <img src={catalogImageUrl(image.miniatura)} alt="" loading="lazy" />}<div><strong>{catalogCode(item.codigo)} · {record?.titulo || item.nome}</strong>{record?.titulo && <small>{item.nome}</small>}</div></div></td>
          {!categoriasExperimentais && <><td>{nomeMarca(materialMarca.get(item.id))}</td><td>{data.categories.find(c => c.id === record?.categoria_id)?.nome || "—"}</td></>}
          {categoriasExperimentais && <><td>{siteConfig?.principais.find(c => c.id === classificacao?.principal_id)?.nome || '—'}</td><td>{siteConfig?.subcategorias.find(c => c.id === classificacao?.subcategoria_id)?.nome || '—'}</td></>}
          <td>{record ? catalogMoney(record.promocional_centavos ?? record.preco_centavos) : "—"}</td>
          <td>{record?.status === "publicado" && data.categories.find(c => c.id === record.categoria_id)?.marketplace && !record.link_marketplace && <span>Marketplace sem link · </span>}{record?.status === "publicado" ? "Publicado" : record?.status === "inativo" ? "Arquivado" : "Não publicado"}{categoriasExperimentais && record?.status === 'publicado' && !classificacaoAtiva(classificacao) && <span> · Categoria do site ausente ou inativa</span>}</td><td>{record?.ordem || 0}</td>
          <td><div className="row-actions"><button disabled={busy} onClick={() => setEditing(item.id)}>Editar catálogo</button><button disabled={busy} onClick={() => duplicate(item)}>Duplicar</button>{record && <button disabled={busy || (categoriasExperimentais && record.status !== 'publicado' && !classificacaoAtiva(classificacao))} title={categoriasExperimentais && record.status !== 'publicado' && !classificacaoAtiva(classificacao) ? 'Escolha uma categoria principal e uma subcategoria ativa antes de publicar.' : undefined} onClick={() => run(async () => { await saveCatalog(item.id, { ...record, status: record.status === "publicado" ? "rascunho" : "publicado" }, record.versao); })}>{record.status === "publicado" ? "Despublicar" : "Publicar"}</button>}{destino && <a href={destino} target="_blank" rel="noopener noreferrer">Ver no site ↗</a>}</div></td>
        </tr>;
      })} />}
    </section>
    <section className="panel table-panel"><h2>Indicações Marketplace</h2><p>Produtos de terceiros, exibidos apenas na vitrine.</p>
      <DataTable heads={["Produto", ...(categoriasExperimentais ? ["Categoria principal", "Subcategoria"] : ["Marca", "Categoria"]), "Preço", "Status", "Ações"]} empty="Nenhuma indicação cadastrada." rows={data.indicacoes.filter(item => {
        const classificacao = siteConfig?.indicacoes.find(c => c.indicacao_id === item.material_id);
        return normalized(item.titulo).includes(normalized(search)) && (!marca || (categoriasExperimentais ? classificacao?.principal_id === marca : indicacaoMarca.get(item.material_id) === marca)) && (!category || (categoriasExperimentais ? classificacao?.subcategoria_id === category : item.categoria_id === category)) && (!status || item.status === status);
      }).map(item => {
        const classificacao = siteConfig?.indicacoes.find(c => c.indicacao_id === item.material_id);
        const destino = item.status === 'publicado' && (categoriasExperimentais || !item.categoria_id || data.categories.find(c => c.id === item.categoria_id)?.ativa) && (categoriasExperimentais
          ? siteLink(classificacao?.principal_id, item.slug, classificacao?.subcategoria_id)
          : indicacaoMarca.get(item.material_id) === data.marcas.find(m => m.slug === 'rivoxel')?.id
            ? catalogSiteLink('rivoxel', item.slug, window.location.origin)
            : indicacaoMarca.get(item.material_id) === data.marcas.find(m => m.slug === 'rava')?.id
              ? catalogLink(item.slug, window.location.origin, publishedPages.includes(item.slug)) : null);
        return <tr key={item.material_id}><td><strong>{item.titulo}</strong></td>{!categoriasExperimentais ? <><td>{nomeMarca(indicacaoMarca.get(item.material_id))}</td><td>{data.categories.find(c=>c.id===item.categoria_id)?.nome || '—'}</td></> : <><td>{siteConfig?.principais.find(c => c.id === classificacao?.principal_id)?.nome || '—'}</td><td>{siteConfig?.subcategorias.find(c => c.id === classificacao?.subcategoria_id)?.nome || '—'}</td></>}<td>{catalogMoney(item.preco_centavos)}</td><td>{item.status === 'publicado' ? 'Publicado' : item.status === 'inativo' ? 'Arquivado' : 'Não publicado'}{categoriasExperimentais && item.status === 'publicado' && !classificacaoAtiva(classificacao) && <span> · Categoria do site ausente ou inativa</span>}</td><td><div className="row-actions"><button onClick={()=>setMarketEditing(item)}>Editar</button><button onClick={()=>{if(window.confirm(`Excluir a indicação “${item.titulo}”?`))run(()=>unwrap(requireSupabase().from('catalogo_indicacoes').delete().eq('material_id',item.material_id)));}}>Excluir</button>{destino && <a href={destino} target="_blank" rel="noopener noreferrer">Ver no site ↗</a>}</div></td></tr>;
      })} />
    </section>
    {marketEditing && <MarketplaceEditor record={marketEditing !== "new" ? marketEditing : null} siteClassificado={marketEditing !== 'new' && classificacaoAtiva(siteConfig?.indicacoes.find(c => c.indicacao_id === marketEditing.material_id))} categories={categoriasExperimentais ? data.categories : data.categories.filter(c => categoriaMarca.get(c.id) === (marketEditing === "new" ? data.marcas.find(m => m.slug === "rava")?.id : indicacaoMarca.get(marketEditing.material_id)))} onSaved={refresh} onClose={()=>setMarketEditing(null)} />}
    {product && <CatalogEditor key={product.id} product={product} record={records.get(product.id)} marcas={data.marcas} marcaAtual={materialMarca.get(product.id) || ""} siteClassificado={classificacaoAtiva(siteConfig?.produtos.find(c => c.produto_id === product.id))} categories={categoriasExperimentais ? data.categories : data.categories.filter(c => categoriaMarca.get(c.id) === materialMarca.get(product.id))} images={data.images.filter(i => i.material_id === product.id)} onSaved={refresh} onClose={() => setEditing(null)} />}
    {creating && <CatalogDialog title="Cadastrar produto na Gestão" onClose={() => setCreating(false)}><ProdutoForm locais={locais} show={show} onSaved={async id => { await onSaved(); setCreating(false); setEditing(id); }} /></CatalogDialog>}
    {!categoriasExperimentais && categoryModal && <CatalogDialog title="Categorias do site" onClose={() => setCategoryModal(false)} busy={busy}>
      <p>Estas categorias são exclusivas do catálogo. Ao desativar uma categoria, seus produtos deixam de aparecer no site.</p>
      <form className="catalog-admin-form" onSubmit={e => { e.preventDefault(); run(async () => {
        const payload = { nome: categoryEdit.nome.trim(), slug: categoryEdit.slug || catalogSlug(categoryEdit.nome), ativa: categoryEdit.ativa, marketplace: Boolean(categoryEdit.marketplace) };
        const brandId = categoryBrand || data.marcas.find(m => m.slug === "rava")?.id;
        if (!brandId) throw Error("Selecione uma marca para a categoria.");
        await unwrap(requireSupabase().rpc("salvar_categoria_site", { p_categoria_id: categoryEdit.id || null, p_marca_id: brandId, p_nome: payload.nome, p_slug: payload.slug, p_ativa: payload.ativa, p_marketplace: payload.marketplace, p_pai_id: categoryParent || null }));
        setCategoryEdit({ nome: "", slug: "", ativa: true });
        setCategoryBrand("");
        setCategoryParent("");
      }); }}>
        <div className="form-grid"><label>Marca<SearchSelect value={categoryBrand || data.marcas.find(m => m.slug === "rava")?.id || ""} onChange={e => { setCategoryBrand(e.target.value); setCategoryParent(""); }}><option value="">Selecione</option>{data.marcas.filter(m => m.ativa).map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}</SearchSelect></label><label>Categoria principal<SearchSelect value={categoryParent} onChange={e => setCategoryParent(e.target.value)}><option value="">Nenhuma (categoria principal)</option>{data.categories.filter(c => !c.pai_id && c.id !== categoryEdit.id && categoriaMarca.get(c.id) === (categoryBrand || data.marcas.find(m => m.slug === "rava")?.id)).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</SearchSelect></label><label>Nome<input required maxLength={100} value={categoryEdit.nome} onChange={e => setCategoryEdit({ ...categoryEdit, nome: e.target.value })} /></label><label>Slug<input pattern="[a-z0-9]+(-[a-z0-9]+)*" value={categoryEdit.slug} placeholder={catalogSlug(categoryEdit.nome)} onChange={e => setCategoryEdit({ ...categoryEdit, slug: e.target.value })} /></label></div>
        <label className="catalog-inline-check"><input type="checkbox" checked={categoryEdit.ativa} onChange={e => setCategoryEdit({ ...categoryEdit, ativa: e.target.checked })} />Ativa</label>
        <label className="catalog-inline-check"><input type="checkbox" checked={Boolean(categoryEdit.marketplace)} onChange={e => setCategoryEdit({ ...categoryEdit, marketplace: e.target.checked })} />Categoria Marketplace</label><small>Produtos desta categoria usam o link de compra cadastrado em cada produto.</small>
        <div className="actions"><button className="primary" disabled={busy}>{categoryEdit.id ? "Salvar categoria" : "Criar categoria"}</button>{categoryEdit.id && <button type="button" onClick={() => { setCategoryEdit({ nome: "", slug: "", ativa: true }); setCategoryBrand(""); setCategoryParent(""); }}>Cancelar edição</button>}</div>
      </form>
      {error && <p role="alert" className="catalog-admin-error">{error}</p>}
      <ul className="catalog-category-list">{data.categories.map(c => <li key={c.id}><span>{c.pai_id ? `${data.categories.find(p => p.id === c.pai_id)?.nome || "Categoria principal"} › ` : ""}{c.nome} · {nomeMarca(categoriaMarca.get(c.id))} · {c.ativa ? "Ativa" : "Inativa"}{c.marketplace ? " · Marketplace" : ""}</span><button disabled={busy} onClick={() => { setCategoryEdit(c); setCategoryBrand(categoriaMarca.get(c.id) || ""); setCategoryParent(c.pai_id || ""); }}>Editar</button><button disabled={busy} onClick={() => { if (window.confirm(`Excluir a categoria “${c.nome}”? Categorias com produtos ou subcategorias vinculados não podem ser excluídas.`)) run(() => unwrap(requireSupabase().from("catalogo_categorias").delete().eq("id", c.id))); }}>Excluir</button></li>)}</ul>
    </CatalogDialog>}
  </div>;
}
