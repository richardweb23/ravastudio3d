import { useState } from "react";
import { supabase } from "../supabase.js";
import Header from "./Header.jsx";
import RegistrationTables from "./consignacao/RegistrationTables.jsx";


export default function Cadastros({ locais, vendedores, onSaved, show, onNavigate }) {
  const emptyLocal = {
    nome: "",
    tipo: "vendedor",
    responsavel: "",
    telefone: "",
    email: "",
    url: "",
    endereco: "",
    observacoes: "",
    ativo: true,
  };
  const [local, setLocal] = useState(emptyLocal);
  const [editingLocalId, setEditingLocalId] = useState(null);
  const emptySeller = { nome: "", telefone: "", endereco: "", observacoes: "", ativo: true };
  const [editingSeller, setEditingSeller] = useState(null);
  const [vendedor, setVendedor] = useState(emptySeller);
  async function addLocal(e) {
    e.preventDefault();
    if (editingLocalId && !local.ativo && locais.find(item => item.id === editingLocalId)?.ativo && !window.confirm("Desativar este local? O histórico será mantido.")) return;
    const request = editingLocalId
      ? supabase.from("locais_estoque").update(local).eq("id", editingLocalId)
      : supabase.from("locais_estoque").insert(local);
    const { error } = await request;
    if (error) return show(error.message, "error");
    show(editingLocalId ? "Local atualizado." : "Local cadastrado.");
    setLocal(emptyLocal);
    setEditingLocalId(null);
    onSaved();
  }
  function editLocal(item) {
    setEditingLocalId(item.id);
    setLocal({
      nome: item.nome || "",
      tipo: item.tipo || "outro",
      responsavel: item.responsavel || "",
      telefone: item.telefone || "",
      email: item.email || "",
      url: item.url || "",
      endereco: item.endereco || "",
      observacoes: item.observacoes || "",
      ativo: item.ativo,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function removeLocal(item) {
    if (
      !window.confirm(
        `Excluir o local “${item.nome}”? Esta ação não pode ser desfeita.`,
      )
    )
      return;
    const { error } = await supabase
      .from("locais_estoque")
      .delete()
      .eq("id", item.id);
    if (error)
      return show(
        "Não foi possível excluir este local. Ele pode estar vinculado a estoque, compras, vendas ou pedidos.",
        "error",
      );
    if (editingLocalId === item.id) {
      setEditingLocalId(null);
      setLocal(emptyLocal);
    }
    show("Local excluído.");
    onSaved();
  }
  function editSeller(item) {
    setEditingSeller(item.id);
    setVendedor({ nome: item.nome, telefone: item.telefone || "", endereco: item.endereco || "", observacoes: item.observacoes || "", ativo: item.ativo });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function addVendedor(e) {
    e.preventDefault();
    if (editingSeller && !vendedor.ativo && vendedores.find(item => item.id === editingSeller)?.ativo && !window.confirm("Desativar este vendedor? O histórico será mantido.")) return;
    const { error } = await (editingSeller ? supabase.from("vendedores").update(vendedor).eq("id", editingSeller) : supabase.from("vendedores").insert(vendedor));
    if (error) return show(error.message, "error");
    show(editingSeller ? "Vendedor atualizado." : "Vendedor cadastrado.");
    setVendedor(emptySeller);
    setEditingSeller(null);
    onSaved();
  }
  return (
    <>
      <Header
        title="Locais e vendedores"
        subtitle="Cadastre onde os produtos ficam e quem realiza as vendas."
      />
      <div className="split">
        <form className="panel form" onSubmit={addLocal}>
          <h2>{editingLocalId ? "Editar local" : "Novo local"}</h2>
          <label>
            Nome
            <input
              placeholder="Ex.: Loja Parceira Centro"
              value={local.nome}
              onChange={(e) => setLocal({ ...local, nome: e.target.value })}
              required
            />
          </label>
          <label>
            Tipo
            <select
              value={local.tipo}
              onChange={(e) => setLocal({ ...local, tipo: e.target.value })}
            >
              <option value="principal">Estoque principal</option>
              <option value="vendedor">Com vendedor</option>
              <option value="estabelecimento">Estabelecimento</option>
              <option value="rua">Venda na rua</option>
              <option value="outro">Outro</option>
            </select>
          </label>
          <label>
            Responsável
            <input
              value={local.responsavel}
              onChange={(e) =>
                setLocal({ ...local, responsavel: e.target.value })
              }
            />
          </label>
          <label>
            Telefone de contato
            <input
              type="tel"
              placeholder="Ex.: (11) 99999-9999"
              value={local.telefone}
              onChange={(e) => setLocal({ ...local, telefone: e.target.value })}
            />
          </label>
          <label>
            E-mail de contato
            <input
              type="email"
              placeholder="Ex.: contato@loja.com"
              value={local.email}
              onChange={(e) => setLocal({ ...local, email: e.target.value })}
            />
          </label>
          <label>
            Site ou rede social
            <input
              type="url"
              placeholder="Ex.: https://instagram.com/sua-loja"
              value={local.url}
              onChange={(e) => setLocal({ ...local, url: e.target.value })}
            />
          </label>
          <label>
            Endereço / referência
            <input
              value={local.endereco}
              onChange={(e) => setLocal({ ...local, endereco: e.target.value })}
            />
          </label>
          <label>Observações<textarea value={local.observacoes} onChange={event => setLocal({ ...local, observacoes: event.target.value })} /></label>
          <label className="checkbox-line"><input type="checkbox" checked={local.ativo} onChange={event => setLocal({ ...local, ativo: event.target.checked })} />Local ativo</label>
          <div className="actions">
            <button className="primary">
              {editingLocalId ? "Salvar alterações" : "Cadastrar local"}
            </button>
            {editingLocalId && (
              <button
                type="button"
                onClick={() => {
                  setEditingLocalId(null);
                  setLocal(emptyLocal);
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
        <form className="panel form" onSubmit={addVendedor}>
          <h2>{editingSeller ? "Editar vendedor" : "Novo vendedor"}</h2>
          <label>
            Nome
            <input
              value={vendedor.nome}
              onChange={(e) =>
                setVendedor({ ...vendedor, nome: e.target.value })
              }
              required
            />
          </label>
          <label>
            Telefone
            <input
              value={vendedor.telefone}
              onChange={(e) =>
                setVendedor({ ...vendedor, telefone: e.target.value })
              }
            />
          </label>
          <label>Endereço<input value={vendedor.endereco} onChange={event => setVendedor({ ...vendedor, endereco: event.target.value })} /></label>
          <label>Observações<textarea value={vendedor.observacoes} onChange={event => setVendedor({ ...vendedor, observacoes: event.target.value })} /></label>
          <label className="checkbox-line"><input type="checkbox" checked={vendedor.ativo} onChange={event => setVendedor({ ...vendedor, ativo: event.target.checked })} />Vendedor ativo</label>
          <div className="actions"><button className="primary">{editingSeller ? "Salvar alterações" : "Cadastrar vendedor"}</button>{editingSeller && <button type="button" onClick={() => { setEditingSeller(null); setVendedor(emptySeller); }}>Cancelar</button>}</div>
        </form>
      </div>
      <RegistrationTables locais={locais} vendedores={vendedores} onNavigate={onNavigate} onEditLocal={editLocal} onEditSeller={editSeller} onRemoveLocal={removeLocal} />
    </>
  );
}

