import { useState } from "react";
import { supabase } from "../supabase.js";
import DataTable from "./DataTable.jsx";
import { formatMoney as fmtMoney, formatNumber as fmtNumber } from "../lib/formatters.js";
import Header from "./Header.jsx";
import ProdutoForm from "./ProdutoForm.jsx";

export default function EstoqueComLocais({ materiais, locais, estoqueLocal, onSaved, show }) {
  const [editing, setEditing] = useState(null);
  async function remover(produto) {
    if (
      !window.confirm(
        `Excluir o produto “${produto.nome}”? Essa ação não pode ser desfeita.`,
      )
    )
      return;
    const { error } = await supabase
      .from("materiais")
      .delete()
      .eq("id", produto.id);
    if (error)
      return show(
        "Não foi possível excluir. Este produto pode estar vinculado a entradas, vendas ou pedidos.",
        "error",
      );
    show("Produto excluído.");
    onSaved();
  }
  function editar(produto) {
    setEditing(produto);
  }
  return (
    <>
      <Header title="Criar novo produto" subtitle="Cadastre um novo produto e informe seu estoque inicial." />
      <ProdutoForm locais={locais} onSaved={onSaved} show={show} />
      <section className="panel table-panel stock-products-table">
        <h2>Produtos cadastrados</h2>
        <DataTable
          heads={["Produto", "Categoria", "Custo", "Saldo total", "Ações"]}
          rows={materiais.map((item) => (
            <tr key={item.id}>
              <td>
                <strong>{item.nome}</strong>
              </td>
              <td>{item.categoria || "Rivoxel"}</td>
              <td>{fmtMoney(item.custo_medio)}</td>
              <td>{fmtNumber(item.quantidade_atual)}</td>
              <td>
                <div className="row-actions product-table-actions">
                  <button type="button" className="registration-icon-button" title="Editar produto" aria-label={"Editar " + item.nome} onClick={() => editar(item)}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6L16 3Z" /><path d="m13 6 5 5" /></svg>
                  </button>
                  <button type="button" className="registration-icon-button registration-icon-danger" title="Excluir produto" aria-label={"Excluir " + item.nome} onClick={() => remover(item)}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></svg>
                  </button>
                </div>
              </td>
            </tr>
          ))}
          empty="Nenhum produto cadastrado."
        />
      </section>
      {editing && (
        <div className="modal-backdrop" role="presentation" onClick={event => { if (event.target === event.currentTarget) setEditing(null); }}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-label="Editar produto" onKeyDown={event => { if (event.key === "Escape") setEditing(null); }}>
            <ProdutoForm key={editing.id} produto={editing} materiais={materiais} locais={locais} estoqueLocal={estoqueLocal} show={show} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); onSaved(); }} />
          </div>
        </div>
      )}
    </>
  );
}
