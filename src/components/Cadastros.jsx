import { useEffect, useRef, useState } from "react";
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
  const [localOpen, setLocalOpen] = useState(false);
  const localDialog = useRef(null);
  useEffect(() => {
    if (localOpen) localDialog.current?.showModal();
    else localDialog.current?.close();
  }, [localOpen]);
  const [editingLocalId, setEditingLocalId] = useState(null);
  const emptySeller = { nome: "", telefone: "", endereco: "", observacoes: "", ativo: true };
  const [sellerOpen, setSellerOpen] = useState(false);
  const sellerDialog = useRef(null);
  useEffect(() => {
    if (sellerOpen) sellerDialog.current?.showModal();
    else sellerDialog.current?.close();
  }, [sellerOpen]);
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
    setLocalOpen(false);
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
    setLocalOpen(true);
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
    setSellerOpen(true);
  }
  async function addVendedor(e) {
    e.preventDefault();
    if (editingSeller && !vendedor.ativo && vendedores.find(item => item.id === editingSeller)?.ativo && !window.confirm("Desativar este vendedor? O histórico será mantido.")) return;
    const { error } = await (editingSeller ? supabase.from("vendedores").update(vendedor).eq("id", editingSeller) : supabase.from("vendedores").insert(vendedor));
    if (error) return show(error.message, "error");
    show(editingSeller ? "Vendedor atualizado." : "Vendedor cadastrado.");
    setVendedor(emptySeller);
    setEditingSeller(null);
    setSellerOpen(false);
    onSaved();
  }
  return (
    <>
      <Header
        title="Locais e vendedores"
        subtitle="Cadastre onde os produtos ficam e quem realiza as vendas."
      />
      <div className="registration-toolbar">
        <button type="button" className="primary" onClick={() => { setEditingLocalId(null); setLocal(emptyLocal); setLocalOpen(true); }}>Novo local</button>
        <button type="button" className="primary" onClick={() => { setEditingSeller(null); setVendedor(emptySeller); setSellerOpen(true); }}>Novo vendedor</button>
      </div>
      <dialog ref={localDialog} className="modal-card registration-dialog" aria-labelledby="local-dialog-title" onClose={() => setLocalOpen(false)}>
        <form className="panel form" onSubmit={addLocal}>
          <div className="modal-heading">
            <h2 id="local-dialog-title">{editingLocalId ? "Editar local" : "Novo local"}</h2>
            <button type="button" className="close-modal" aria-label="Fechar" onClick={() => setLocalOpen(false)}>×</button>
          </div>
          <label>
            Nome
            <input
              autoFocus
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
            <button type="button" onClick={() => setLocalOpen(false)}>Cancelar</button>
          </div>
        </form>
      </dialog>
      <dialog ref={sellerDialog} className="modal-card registration-dialog" aria-labelledby="seller-dialog-title" onClose={() => setSellerOpen(false)}>
        <form className="panel form" onSubmit={addVendedor}>
          <div className="modal-heading"><h2 id="seller-dialog-title">{editingSeller ? "Editar vendedor" : "Novo vendedor"}</h2><button type="button" className="close-modal" aria-label="Fechar" onClick={() => setSellerOpen(false)}>×</button></div>
          <label>
            Nome
            <input
              autoFocus
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
          <div className="actions"><button className="primary">{editingSeller ? "Salvar alterações" : "Cadastrar vendedor"}</button><button type="button" onClick={() => setSellerOpen(false)}>Cancelar</button></div>
        </form>
      </dialog>
      <RegistrationTables locais={locais} vendedores={vendedores} onNavigate={onNavigate} onEditLocal={editLocal} onEditSeller={editSeller} onRemoveLocal={removeLocal} />
    </>
  );
}

