import { useState } from "react";
import { supabase } from "../../supabase.js";
import { catalogCents, catalogCode, catalogSlug } from "../../lib/catalogo.js";
import { catalogImageUrl, imageAction, removeCatalogImage, saveCatalog, unwrap, uploadCatalogImage } from "../../services/catalogo.js";
import CatalogDialog from "./CatalogDialog.jsx";
import ProductDetail from "./ProductDetail.jsx";
export default function CatalogEditor({ product, record, images, categories, onClose, onSaved }) {
  const suggestLink = title => `${catalogSlug(title?.trim() || product.nome).slice(0, 160).replace(/-$/, "") || "produto"}-${catalogCode(product.codigo)}`;
  const [saved, setSaved] = useState(record);
  const [automaticLink, setAutomaticLink] = useState(() => !record?.slug || record.slug === suggestLink(record?.titulo));
  const [form, setForm] = useState(() => ({
    titulo: record?.titulo || "", descricao: record?.descricao || "", resumo: record?.resumo || "",
    slug: record?.slug || suggestLink(record?.titulo),
    price: ((record?.preco_centavos || 0) / 100).toFixed(2),
    promo: record?.promocional_centavos != null ? (record.promocional_centavos / 100).toFixed(2) : "",
    categoria_id: record?.categoria_id || "", material: record?.material || "", dimensoes: record?.dimensoes || "",
    peso_gramas: record?.peso_gramas ?? "", cores: record?.cores || "", prazo: record?.prazo || "",
    personalizavel: record?.personalizavel || false, destaque: record?.destaque || false,
    status: record?.status || "rascunho", ordem: record?.ordem || 0,
  }));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [dirty, setDirty] = useState(false);
  const ready = images.filter(i => i.estado === "pronta").sort((a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id));
  const suggestedLink = suggestLink(form.titulo);
  function change(key, value) {
    setDirty(true);
    if (key === "slug") setAutomaticLink(value === suggestedLink);
    setForm(current => ({
      ...current, [key]: value,
      ...(key === "titulo" && automaticLink ? { slug: suggestLink(value) } : {}),
    }));
  }
  function applySuggestedLink() {
    setAutomaticLink(true);
    setDirty(true);
    setForm(current => ({ ...current, slug: suggestLink(current.titulo) }));
  }
  function data() {
    const price = catalogCents(form.price);
    const promo = form.promo === "" ? null : catalogCents(form.promo);
    if (promo !== null && promo >= price) throw Error("O preço promocional deve ser menor que o preço de venda.");
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(form.slug)) throw Error("Use letras minúsculas, números e hífens no endereço.");
    if (form.status === "publicado" && !form.descricao.trim()) throw Error("Preencha a descrição para publicar.");
    if (form.status === "publicado" && form.categoria_id && !categories.find(c => c.id === form.categoria_id)?.ativa) throw Error("Escolha uma categoria ativa para publicar.");
    return { ...form, preco_centavos: price, promocional_centavos: promo, peso_gramas: form.peso_gramas === "" ? null : Number(form.peso_gramas), ordem: Number(form.ordem) };
  }
  async function run(action, success = "") {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try { await action(); if (success) setMessage(success); }
    catch (err) { setMessage(""); setError(err.message || "Não foi possível concluir. Tente novamente."); }
    finally { setBusy(false); }
  }
  async function save() {
    const value = await saveCatalog(product.id, data(), saved?.versao);
    setSaved(value); setDirty(false); await onSaved();
  }
  function close() { if (!dirty || window.confirm("Sair sem salvar as alterações do produto?")) onClose(); }
  async function upload(files, replace = null) {
    if (!files.length) return;
    await run(async () => {
      if (!replace && ready.length + files.length > 8) throw Error("Cada produto pode ter até 8 imagens.");
      if (!saved || dirty) await save();
      try {
        for (const file of files) await uploadCatalogImage(product.id, file, setMessage, replace);
      } finally { await onSaved(); }
    }, "Imagens atualizadas.");
  }
  function field(label, key, options = {}) {
    return <label>{label}<input value={form[key]} onChange={e => change(key, e.target.value)} {...options} /></label>;
  }
  async function reorder(index, target) {
    const ordered = [...ready]; const [item] = ordered.splice(index, 1); ordered.splice(target, 0, item);
    await run(async () => { await imageAction("ordenar", product.id, null, { ids: ordered.map(i => i.id) }); await onSaved(); });
  }
  function showPreview() {
    try { setPreview({ ...data(), id: product.id, nome: form.titulo.trim() || product.nome, codigo: product.codigo, categoria: categories.find(c => c.id === form.categoria_id)?.nome, imagens: ready }); }
    catch (err) { setError(err.message); }
  }
  return <CatalogDialog title={`Catálogo · ${catalogCode(product.codigo)} — ${product.nome}`} onClose={close} busy={busy}>
    <form className="catalog-admin-form" onSubmit={e => { e.preventDefault(); run(save, "Produto salvo."); }}>
      <fieldset disabled={busy}>
        <p>Nome na Gestão: <strong>{product.nome}</strong> · Código: <strong>{catalogCode(product.codigo)}</strong></p>
        <div className="form-grid">
          {field("Título no catálogo (opcional)", "titulo", { maxLength: 180, placeholder: product.nome })}
          <label>Categoria do site<select value={form.categoria_id} onChange={e => change("categoria_id", e.target.value)}><option value="">Sem categoria</option>{categories.map(c => <option value={c.id} key={c.id}>{c.nome}{!c.ativa ? " (inativa)" : ""}</option>)}</select></label>
          {field("Preço de venda (R$)", "price", { type: "number", min: 0, max: 10000000, step: ".01", required: true })}
          {field("Preço promocional (R$)", "promo", { type: "number", min: 0, max: 10000000, step: ".01" })}
        </div>
        <label>Descrição completa<textarea rows={5} maxLength={10000} required={form.status === "publicado"} value={form.descricao} onChange={e => change("descricao", e.target.value)} /></label>
        <label>Descrição resumida<textarea rows={2} maxLength={300} value={form.resumo} onChange={e => change("resumo", e.target.value)} /></label>
        <div className="form-grid">
          {field("Material", "material", { maxLength: 200 })}{field("Dimensões", "dimensoes", { maxLength: 200 })}
          {field("Peso (g)", "peso_gramas", { type: "number", min: 0, max: 10000000, step: ".001" })}{field("Cores disponíveis", "cores", { maxLength: 500 })}
          {field("Prazo de produção", "prazo", { maxLength: 200 })}{field("Ordem de exibição", "ordem", { type: "number", step: 1, min: -2147483648, max: 2147483647 })}
          <div>
            {field("Link do produto", "slug", {
              pattern: "[a-z0-9]+(-[a-z0-9]+)*", required: true, maxLength: 200,
              placeholder: "Ex.: vaso-decorativo-001",
              "aria-describedby": `catalog-slug-help-${product.id}`,
              onBlur: () => { if (!form.slug.trim()) applySuggestedLink(); },
            })}
            <small id={`catalog-slug-help-${product.id}`}>Sugerido automaticamente pelo título e código do produto: <strong>{suggestedLink}</strong>. Você também pode personalizar usando letras minúsculas, números e hífens.</small>
            {!automaticLink && <button type="button" onClick={applySuggestedLink}>Usar sugestão automática</button>}
          </div>
          <label>Status<select value={form.status} onChange={e => change("status", e.target.value)}><option value="rascunho">Não publicado</option><option value="publicado">Publicado</option><option value="inativo">Arquivado</option></select></label>
        </div>
        <div className="catalog-checks"><label><input type="checkbox" checked={form.status === "publicado"} onChange={e => change("status", e.target.checked ? "publicado" : "rascunho")} />Exibir no site</label><label><input type="checkbox" checked={form.personalizavel} onChange={e => change("personalizavel", e.target.checked)} />Personalizável</label><label><input type="checkbox" checked={form.destaque} onChange={e => change("destaque", e.target.checked)} />Destaque</label></div>
        <div className="actions"><button className="primary" type="submit">Salvar produto</button><button type="button" onClick={showPreview}>Visualizar prévia</button><button type="button" onClick={close}>Fechar</button></div>
      </fieldset>
    </form>
    <section className="catalog-admin-images" aria-label="Imagens do produto">
      <h3>Imagens · {ready.length}/8</h3>
      <p>A primeira foto é a principal. JPEG, PNG ou WebP, até 10 MB por arquivo. As imagens serão públicas, inclusive enquanto o produto estiver oculto.</p>
      <div className="catalog-drop" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busy) upload(Array.from(e.dataTransfer.files)); }}>
        <label>Adicionar imagens ou arrastar arquivos aqui<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy || ready.length >= 8} onChange={e => { upload(Array.from(e.target.files)); e.target.value = ""; }} /></label>
      </div>
      <div className="catalog-admin-image-grid">{ready.map((image, index) => <article key={image.id}>
        <img src={catalogImageUrl(image.miniatura)} alt={image.alt || product.nome} />
        <strong>{index === 0 ? "Principal" : `Foto ${index + 1}`}</strong>
        <div className="actions"><button disabled={busy || index === 0} onClick={() => reorder(index, index - 1)} aria-label={`Mover foto ${index + 1} para antes`}>←</button><button disabled={busy || index === ready.length - 1} onClick={() => reorder(index, index + 1)} aria-label={`Mover foto ${index + 1} para depois`}>→</button><button disabled={busy || index === 0} onClick={() => reorder(index, 0)}>Principal</button></div>
        <label className="catalog-replace">Substituir foto<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => { upload(Array.from(e.target.files), image); e.target.value = ""; }} /></label>
        <div className="actions"><button disabled={busy} onClick={() => {
          const alt = window.prompt("Descrição da foto para acessibilidade", image.alt);
          if (alt !== null) run(async () => { await imageAction("alt", product.id, image.id, { alt }); await onSaved(); });
        }}>Descrição</button><button disabled={busy} onClick={() => { if (window.confirm("Excluir esta imagem?")) run(async () => { try { await removeCatalogImage(image); } finally { await onSaved(); } }); }}>Excluir</button></div>
      </article>)}</div>
      {images.filter(i => i.estado !== "pronta").map(image => <div className="catalog-pending" key={image.id}><span>{image.arquivo} — {image.estado === "enviando" ? "envio pendente" : "limpeza pendente"}</span><button disabled={busy} onClick={() => { if (window.confirm("Limpar este envio? Verifique se ninguém está enviando esta foto em outra aba.")) run(async () => { try { await removeCatalogImage(image); } finally { await onSaved(); } }); }}>Limpar envio</button></div>)}
    </section>
    <p role="status" aria-live="polite">{busy ? message || "Salvando…" : message}</p>
    {busy && <progress aria-label={message || "Salvando"} />}
    {error && <p role="alert" className="catalog-admin-error">{error}</p>}
    {saved && <button disabled={busy} className="catalog-delete" onClick={() => {
      if (window.confirm("Remover os dados do catálogo e todas as imagens? O produto da Gestão e seu histórico serão preservados.")) run(async () => {
        if (saved.status === "publicado") {
          const hidden = await saveCatalog(product.id, { ...saved, status: "inativo" }, saved.versao);
          setSaved(hidden); setForm(current => ({ ...current, status: "inativo" }));
        }
        try {
          for (const image of images) await removeCatalogImage(image);
          await unwrap(supabase.rpc("excluir_catalogo", { p_produto: product.id }));
          await onSaved(); onClose();
        } finally { await onSaved(); }
      });
    }}>Remover do catálogo e excluir imagens</button>}
    {preview && <ProductDetail product={preview} preview onClose={() => setPreview(null)} />}
  </CatalogDialog>;
}
