/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import logo from "../logo.svg";
import { isSupabaseConfigured, supabase } from "./supabase.js";
import { orderStatusLabel } from "./lib/formatters.js";
import { getAdminPage, getAdminPageHref } from "./lib/adminNavigation.js";
import { LoginScreen, PasswordScreen, SetupScreen } from "./components/auth/AuthScreens.jsx";
import Dashboard from "./components/dashboard/Dashboard.jsx";
import EstoqueComLocais from "./components/EstoqueComLocais.jsx";
import EstoquePorLocal from "./components/EstoquePorLocal.jsx";
import ComprasComLocal from "./components/ComprasComLocal.jsx";
import VendasComLocal from "./components/VendasComLocal.jsx";
import PedidosComLocal from "./components/pedidos/PedidosComLocal.jsx";
import Cadastros from "./components/Cadastros.jsx";
import HistoricoPage from "./components/historico/HistoricoPage.jsx";
import CalculadoraCustos from "./components/CalculadoraCustos.jsx";
import CalculadoraEscala from "./components/CalculadoraEscala.jsx";
import FinanceiroModule from "./components/financeiro/FinanceiroModule.jsx";

function Icon({ name }) {
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></>,
    products: <><path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z" /><path d="m4 7.5 8 4.5 8-4.5M4 7.5V16l8 5 8-5V7.5" /></>,
    warehouse: <><path d="m3 10 9-7 9 7v10H3V10Z" /><path d="M8 20v-6h8v6" /></>,
    entries: <><path d="M12 3v11m-4-4 4 4 4-4M4 17v3h16v-3" /></>,
    sales: <><path d="M12 21V10m-4 4 4-4 4 4M4 7V4h16v3" /></>,
    orders: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
    locations: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    calculator: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2" /></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2" /></>,
    finance: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 9h18M7 15h3" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

const baseNavigation = [
  ["dashboard", "dashboard", "Visão geral"],
];

const productNavigation = [
  ["vendas", "Cadastrar venda"],
  ["pedidos", "Novo pedido"],
  ["compras", "Entrada de produto"],
  ["estoque", "Novo produto"],
  ["cadastros", "Locais e vendedores"],
];

const utilityNavigation = [
  ["calculadora", "Calculadora de custos"],
  ["calculadoraEscala", "Calculadora de escala"],
  ["historico", "Histórico"],
];

const financeNavigation = [
  ["financeiro", "Visão geral"],
  ["financeiroContas", "Contas a pagar"],
  ["financeiroDespesas", "Compras e despesas"],
  ["financeiroParcelas", "Parcelas"],
  ["financeiroFaturas", "Faturas"],
  ["financeiroCartoes", "Cartões"],
  ["financeiroCategorias", "Categorias"],
];

function initialPasswordMode() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  return ["invite", "recovery"].includes(hash.get("type") || query.get("type"));
}

export default function AdminApp() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [page, setPage] = useState(() => getAdminPage(window.location));
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(initialPasswordMode);
  const [notice, setNotice] = useState(null);
  const [data, setData] = useState({
    materiais: [], compras: [], vendas: [], pedidos: [], pedidoItens: [],
    pagamentos: [], locais: [], vendedores: [], estoqueLocal: [],
  });

  const show = useCallback((message, type = "success") => {
    setNotice({ message, type });
    window.setTimeout(() => setNotice(null), 4500);
  }, []);

  const refresh = useCallback(async () => {
    if (!supabase || !session?.user?.id) return;
    setLoading(true);
    const results = await Promise.all([
      supabase.from("materiais").select("*").order("nome"),
      supabase.from("compras").select("*, materiais(nome), locais_estoque(nome)").order("data", { ascending: false }).limit(50),
      supabase.from("vendas").select("*, materiais(nome), locais_estoque(nome), vendedores(nome)").order("data", { ascending: false }),
      supabase.from("pedidos").select("*").order("data_pedido", { ascending: false }),
      supabase.from("pedido_itens").select("*, materiais(nome)"),
      supabase.from("pedido_pagamentos").select("*").order("data", { ascending: false }),
      supabase.from("locais_estoque").select("*").eq("ativo", true).order("nome"),
      supabase.from("vendedores").select("*").eq("ativo", true).order("nome"),
      supabase.from("estoque_por_local").select("*, locais_estoque(nome, tipo)"),
    ]);
    const firstError = results.find((result) => result.error)?.error;
    if (firstError) show(firstError.message, "error");
    else {
      const [materiais, compras, vendas, pedidos, pedidoItens, pagamentos, locais, vendedores, estoqueLocal] = results;
      setData({
        materiais: materiais.data || [], compras: compras.data || [],
        vendas: vendas.data || [], pedidos: pedidos.data || [],
        pedidoItens: pedidoItens.data || [], pagamentos: pagamentos.data || [],
        locais: locais.data || [], vendedores: vendedores.data || [],
        estoqueLocal: estoqueLocal.data || [],
      });
    }
    setLoading(false);
  }, [session?.user?.id, show]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }
    supabase.auth.getSession().then(({ data: { session: current } }) => {
      setSession(current);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, current) => {
      setSession(current);
      if (event === "PASSWORD_RECOVERY") setNeedsPassword(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleHistoryNavigation = () => setPage(getAdminPage(window.location));
    window.addEventListener("popstate", handleHistoryNavigation);
    return () => window.removeEventListener("popstate", handleHistoryNavigation);
  }, []);

  useEffect(() => {
    if (!session?.user?.id) {
      setProfile(null);
      return;
    }
    supabase.from("profiles").select("*").eq("id", session.user.id).single()
      .then(async ({ data: userProfile, error }) => {
        if (error || !userProfile) {
          show("Seu perfil de acesso ainda não foi configurado.", "error");
          await supabase.auth.signOut();
          return;
        }
        if (!userProfile.ativo) {
          show("Este acesso está bloqueado.", "error");
          await supabase.auth.signOut();
          return;
        }
        setProfile(userProfile);
      });
  }, [session?.user?.id, show]);

  useEffect(() => {
    if (profile?.id) refresh();
  }, [profile?.id, refresh]);

  const authView = (screen) => (
    <>
      {notice && <div className={`notice auth-notice ${notice.type}`} role="status">{notice.message}</div>}
      {screen}
    </>
  );

  if (!isSupabaseConfigured) return <SetupScreen />;
  if (loading && !session) return <div className="app-loading">Carregando…</div>;
  if (!session) return authView(<LoginScreen onMessage={show} />);
  if (needsPassword)
    return authView(<PasswordScreen onMessage={show} onDone={() => setNeedsPassword(false)} />);
  if (!profile) return <div className="app-loading">Validando acesso…</div>;

  async function changeOrderStatus(order, status) {
    const { error } = await supabase.rpc("alterar_status_pedido", {
      p_pedido_id: order.id,
      p_status: status,
    });
    if (error) show(error.message, "error");
    else {
      show(`Pedido movido para ${orderStatusLabel[status]}.`);
      refresh();
    }
  }

  const pages = {
    dashboard: <Dashboard data={data} onNavigate={navigate} onItemStatusChange={async (item, concluido) => {
      const { error } = await supabase.from("pedido_itens").update({ concluido }).eq("id", item.id);
      if (error) show(error.message, "error"); else refresh();
    }} onStatusChange={changeOrderStatus} />,
    estoque: <EstoqueComLocais materiais={data.materiais} locais={data.locais} estoqueLocal={data.estoqueLocal} onSaved={refresh} show={show} />,
    estoquePorLocal: <EstoquePorLocal materiais={data.materiais} locais={data.locais} estoqueLocal={data.estoqueLocal} />,
    compras: <ComprasComLocal materiais={data.materiais} locais={data.locais} compras={data.compras} onSaved={refresh} show={show} />,
    vendas: <VendasComLocal materiais={data.materiais} locais={data.locais} vendedores={data.vendedores} estoqueLocal={data.estoqueLocal} vendas={data.vendas} onSaved={refresh} show={show} />,
    pedidos: <PedidosComLocal materiais={data.materiais} locais={data.locais} vendedores={data.vendedores} pedidos={data.pedidos} itens={data.pedidoItens} pagamentos={data.pagamentos} onSaved={refresh} show={show} />,
    cadastros: <Cadastros locais={data.locais} vendedores={data.vendedores} onSaved={refresh} show={show} />,
    calculadora: <CalculadoraCustos materiais={data.materiais} show={show} />,
    calculadoraEscala: <CalculadoraEscala />,
    historico: <HistoricoPage vendas={data.vendas} materiais={data.materiais} locais={data.locais} vendedores={data.vendedores} />,
    financeiro: <FinanceiroModule page="financeiro" onNavigate={navigate} show={show} />,
    financeiroContas: <FinanceiroModule page="financeiroContas" onNavigate={navigate} show={show} />,
    financeiroDespesas: <FinanceiroModule page="financeiroDespesas" onNavigate={navigate} show={show} />,
    financeiroParcelas: <FinanceiroModule page="financeiroParcelas" onNavigate={navigate} show={show} />,
    financeiroFaturas: <FinanceiroModule page="financeiroFaturas" onNavigate={navigate} show={show} />,
    financeiroCartoes: <FinanceiroModule page="financeiroCartoes" onNavigate={navigate} show={show} />,
    financeiroCategorias: <FinanceiroModule page="financeiroCategorias" onNavigate={navigate} show={show} />,
  };

  function navigate(target) {
    const href = getAdminPageHref(target);
    window.history.pushState({ page: target }, "", href);
    setPage(target);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="app-shell">
      <button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Abrir menu"><span /><span /><span /></button>
      {menuOpen && <button className="sidebar-scrim" onClick={() => setMenuOpen(false)} aria-label="Fechar menu" />}
      <aside className={menuOpen ? "sidebar open" : "sidebar"}>
        <div className="sidebar-brand"><img src={logo} alt="RAVA Studio 3D" /><small>Gestão</small></div>
        <nav>
          {baseNavigation.map(([id, icon, label]) => (
            <a
              key={id}
              className={page === id ? "nav-item active" : "nav-item"}
              href={getAdminPageHref(id)}
              onClick={(event) => {
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                navigate(id);
              }}
            >
              <span><Icon name={icon} /></span>{label}
            </a>
          ))}
          <div className="nav-group">
            <div className={productNavigation.some(([id]) => id === page) ? "nav-group-title active" : "nav-group-title"}>
              <span><Icon name="products" /></span>Produtos
            </div>
            <div className="nav-subitems">
              {productNavigation.map(([id, label]) => (
                <a
                  key={id}
                  className={page === id ? "nav-subitem active" : "nav-subitem"}
                  href={getAdminPageHref(id)}
                  onClick={(event) => {
                    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    event.preventDefault();
                    navigate(id);
                  }}
                >{label}</a>
              ))}
            </div>
          </div>
          <div className="nav-group">
            <div className={utilityNavigation.some(([id]) => id === page) ? "nav-group-title active" : "nav-group-title"}>
              <span><Icon name="calculator" /></span>Utilitários
            </div>
            <div className="nav-subitems">
              {utilityNavigation.map(([id, label]) => (
                <a
                  key={id}
                  className={page === id ? "nav-subitem active" : "nav-subitem"}
                  href={getAdminPageHref(id)}
                  onClick={(event) => {
                    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    event.preventDefault();
                    navigate(id);
                  }}
                >{label}</a>
              ))}
            </div>
          </div>
          <div className="nav-group">
            <a
              className={page === "financeiro" ? "nav-group-title active" : "nav-group-title"}
              href={getAdminPageHref("financeiro")}
              onClick={(event) => {
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                navigate("financeiro");
              }}
            >
              <span><Icon name="finance" /></span>Financeiro
            </a>
            <div className="nav-subitems">
              {financeNavigation.map(([id, label]) => (
                <a
                  key={id}
                  className={page === id ? "nav-subitem active" : "nav-subitem"}
                  href={getAdminPageHref(id)}
                  onClick={(event) => {
                    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    event.preventDefault();
                    navigate(id);
                  }}
                >{label}</a>
              ))}
            </div>
          </div>
        </nav>
        <div className="sidebar-bottom">
          <strong>{profile.nome}</strong>
          <span>{session.user.email}</span>
          <button className="logout" onClick={() => supabase.auth.signOut()}>Sair</button>
        </div>
      </aside>
      <main className="content">
        {notice && <div className={`notice ${notice.type}`} role="status">{notice.message}</div>}
        {loading ? <div className="loading">Atualizando dados…</div> : pages[page] || pages.dashboard}
      </main>
    </div>
  );
}
