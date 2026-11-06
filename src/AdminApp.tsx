import type { Session } from "@supabase/supabase-js";
import type { Tables } from "./database.types";
import { errorMessage, type AdminData, type Task, type Order, type ChangeSubtask } from "./adminTypes";
import { orderAdvanceWarning } from "./lib/orderBoard.js";
import { loadAllTableRows } from "./services/tableRows.js";
import useCaixaPedido from "./hooks/useCaixaPedido.js";
import CaixaPedidoModal from "./components/CaixaPedidoModal.tsx";
import { loadSales } from "./services/vendas.js";
/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useRef, useState } from "react";
import logo from "../logo.svg";
import { isSupabaseConfigured, supabase, requireSupabase } from "./supabase.js";
import { orderStatusLabel } from "./lib/formatters.js";
import { getAdminPage, getAdminPageHref } from "./lib/adminNavigation.js";
import { LoginScreen, PasswordScreen, SetupScreen } from "./components/auth/AuthScreens.tsx";
import Dashboard from "./components/dashboard/Dashboard.tsx";
import CatalogAdmin from "./components/catalogo/CatalogAdmin.tsx";
import EstoqueComLocais from "./components/EstoqueComLocais.tsx";
import EstoquePorLocal from "./components/EstoquePorLocal.tsx";
import ComprasComLocal from "./components/ComprasComLocal.tsx";
import VendasComLocal from "./components/VendasComLocal.tsx";
import PedidosComLocal from "./components/pedidos/PedidosComLocal.tsx";
import Filamentos from "./components/Filamentos.tsx";
import Cadastros from "./components/Cadastros.tsx";
import HistoricoPage from "./components/historico/HistoricoPage.tsx";
import CalculadoraCustos from "./components/CalculadoraCustos.tsx";
import CalculadoraEscala from "./components/CalculadoraEscala.tsx";
import EstimativaImpressao from "./components/EstimativaImpressao.tsx";
import FinanceiroModule from "./components/financeiro/FinanceiroModule.tsx";
import PreviousMonthPayablesAlert from "./components/financeiro/PreviousMonthPayablesAlert.tsx";

import LocalDetails from "./components/consignacao/LocalDetails.tsx";
import { parseLocalDetailsPage } from "./lib/consignacao.js";
import TasksPage from "./components/tarefas/TasksPage.tsx";

function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
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
  ["vendas", "Vendas"],
  ["pedidos", "Novo pedido"],
];

const stockNavigation = [
  ["catalogo", "Catálogo do site"],
  ["estoque", "Criar novo produto"],
  ["compras", "Entrada de produto"],
  ["cadastros", "Locais e vendedores"],
  ["estoquePorLocal", "Saldo por local"],
];

const organizationNavigation = [["tarefas", "Tarefas"], ["filamentos", "Filamentos"]];

const utilityNavigation = [
  ["calculadora", "Calculadora de custos"],
  ["calculadoraEscala", "Calculadora de escala"],
  ["estimativaImpressao", "Estimativa de impressão"],
  ["historico", "Histórico"],
];

const financeNavigation = [
  ["financeiro", "Visão geral"],
  ["financeiroCaixa", "Caixa e extrato"],
  ["financeiroReembolsos", "Reembolsos aos sócios"],
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
  return ["invite", "recovery"].includes(hash.get("type") || query.get("type") || "");
}

export default function AdminApp() {
  const { open: caixaOpen, requestCaixa, finishCaixa } = useCaixaPedido();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [page, setPage] = useState(() => getAdminPage(window.location));
  const [loading, setLoading] = useState(true);
  const [boardUpdating, setBoardUpdating] = useState(false);
  const boardUpdateLock = useRef(false);
  const [taskCreateRequested, setTaskCreateRequested] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(initialPasswordMode);
  const [tarefas, setTarefas] = useState<Task[]>([]);
  const [taskError, setTaskError] = useState<unknown>(null);
  const [notice, setNotice] = useState<{ message: string; type: string } | null>(null);
  const [financeRevision, setFinanceRevision] = useState(0);
  const refreshPayablesAlert = useCallback(() => setFinanceRevision(value => value + 1), []);
  const [data, setData] = useState<AdminData>({
    subtarefas: [], materiais: [], compras: [], vendas: [], pedidos: [], pedidoItens: [],
    pagamentos: [], locais: [], vendedores: [], locaisTodos: [], vendedoresTodos: [], estoqueLocal: [],
  });

  const show = useCallback((message: string, type = "success") => {
    setNotice({ message, type });
    window.setTimeout(() => setNotice(null), 4500);
  }, []);

  const refreshTasks = useCallback(async () => {
    if (!supabase || !session?.user?.id) return;
    try {
      const tasks = [];
      const pageSize = 1000;
      for (let offset = 0; ; offset += pageSize) {
        const { data: batch, error } = await supabase.from("tarefas").select("*")
          .order("previsao_entrega").order("id").range(offset, offset + pageSize - 1);
        if (error) throw error;
        tasks.push(...(batch || []));
        if (!batch || batch.length < pageSize) break;
      }
      const error = null;
      setTaskError(error);
      if (!error) setTarefas(tasks || []);
    } catch (error) { setTaskError(error); }
  }, [session?.user?.id]);

  useEffect(() => {
    if (profile?.id) refreshTasks();
    else { setTarefas([]); setTaskError(null); }
  }, [profile?.id, refreshTasks]);

  const refresh = useCallback(async (silent = false) => {
    if (!supabase || !session?.user?.id) return;
    if (!silent) setLoading(true);
    const results = await Promise.all([
      loadAllTableRows(supabase.from("pedido_subtarefas").select("*").order("created_at").order("id")),
      loadAllTableRows(supabase.from("materiais").select("*").order("nome")),
      loadAllTableRows(supabase.from("compras").select("*, materiais(nome), locais_estoque(nome)").order("data", { ascending: false })),
      loadSales(),
      loadAllTableRows(supabase.from("pedidos").select("*, locais_estoque(nome)").order("data_pedido", { ascending: false })),
      loadAllTableRows(supabase.from("pedido_itens").select("*, materiais(nome), locais_estoque(nome)")),
      loadAllTableRows(supabase.from("pedido_pagamentos").select("*").is("estornado_em", null).order("data", { ascending: false })),
      loadAllTableRows(supabase.from("locais_estoque").select("*").order("nome")),
      loadAllTableRows(supabase.from("vendedores").select("*").order("nome")),
      loadAllTableRows(supabase.from("estoque_por_local").select("*, locais_estoque(nome, tipo)"), ["material_id", "local_id"]),
    ]);
    const firstError = results.find((result) => result.error)?.error;
    if (firstError) show(firstError.message, "error");
    else {
      const [subtarefas, materiais, compras, vendas, pedidos, pedidoItens, pagamentos, locais, vendedores, estoqueLocal] = results;
      setData({
        subtarefas: subtarefas.data || [],
        materiais: materiais.data || [], compras: compras.data || [],
        vendas: vendas.data || [], pedidos: pedidos.data || [],
        pedidoItens: pedidoItens.data || [], pagamentos: pagamentos.data || [],
        locais: (locais.data || []).filter(row => row.ativo), vendedores: (vendedores.data || []).filter(row => row.ativo),
        locaisTodos: locais.data || [], vendedoresTodos: vendedores.data || [],
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
    window.addEventListener("hashchange", handleHistoryNavigation);
    return () => {
      window.removeEventListener("popstate", handleHistoryNavigation);
      window.removeEventListener("hashchange", handleHistoryNavigation);
    };
  }, []);

  useEffect(() => {
    if (!session?.user?.id) {
      setProfile(null);
      return;
    }
    requireSupabase().from("profiles").select("*").eq("id", session.user.id).single()
      .then(async ({ data: userProfile, error }) => {
        if (error || !userProfile) {
          show("Seu perfil de acesso ainda não foi configurado.", "error");
          await requireSupabase().auth.signOut();
          return;
        }
        if (!userProfile.ativo) {
          show("Este acesso está bloqueado.", "error");
          await requireSupabase().auth.signOut();
          return;
        }
        setProfile(userProfile);
      });
  }, [session?.user?.id, show]);

  useEffect(() => {
    if (profile?.id) refresh();
  }, [profile?.id, refresh]);

  const authView = (screen: React.ReactNode) => (
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

  async function updateBoard(action: () => Promise<void>) {
    if (boardUpdateLock.current) return;
    boardUpdateLock.current = true;
    setBoardUpdating(true);
    try {
      await action();
      return true;
    } catch (error) {
      show(errorMessage(error, "Não foi possível atualizar o quadro. Tente novamente."), "error");
      return false;
    } finally {
      boardUpdateLock.current = false;
      setBoardUpdating(false);
    }
  }

  async function changeOrderStatus(order: Order, status: Order["status"]) {
    const warning = orderAdvanceWarning(order, data.subtarefas, status);
    if (status === "entregue") {
      if (!window.confirm([warning, 'Confirmar a entrega e baixa de estoque? O pedido sairá deste quadro.'].filter(Boolean).join('\n\n'))) return;
    } else if (warning && !window.confirm(warning + '\n\nMover para Prontos para entrega mesmo assim?')) return;
    const orderItems = data.pedidoItens.filter(item => item.pedido_id === order.id);
    const caixa = status === "entregue" ? (orderItems.length && orderItems.every(item => item.caixa) ? orderItems[0].caixa : await requestCaixa()) : null;
    if (status === "entregue" && !caixa) return;
    return updateBoard(async () => {
    const { error } = await requireSupabase().rpc("alterar_status_pedido", {
      p_pedido_id: order.id,
      p_status: status,
      ...(caixa ? { p_caixa: caixa } : {}),
    });
    if (error) throw error;
    else {
      show(`Pedido movido para ${orderStatusLabel[status]}.`);
      await refresh(true);
    }
    });
  }

  async function changeOrderPriority(status: Order["status"], ids: string[]) {
    return updateBoard(async () => {
      const { error } = await requireSupabase().rpc("ordenar_pedidos", { p_status: status, p_ids: ids });
      if (error) throw error;
      await refresh(true);
    });
  }

  async function saveOrderSituation(order: Order, situacao: string, situacao_descricao: string) {
    const { data: saved, error } = await requireSupabase().from("pedidos").update({ situacao, situacao_descricao })
      .eq("id", order.id).select("id, situacao, situacao_descricao").single();
    if (error) throw error;
    setData(current => ({ ...current, pedidos: current.pedidos.map(item => item.id === saved.id ? { ...item, ...saved } : item) }));
  }
  async function changeOrderSubtask(...[action, task, patch]: Parameters<ChangeSubtask>) {
    let query;
    if (action === 'create') query = requireSupabase().from('pedido_subtarefas').insert({ pedido_id: task.pedido_id, titulo: patch.titulo });
    else if (action === 'delete') query = requireSupabase().from('pedido_subtarefas').delete().eq('id', task.id).eq('pedido_id', task.pedido_id);
    else query = requireSupabase().from('pedido_subtarefas').update(patch).eq('id', task.id).eq('pedido_id', task.pedido_id);
    const { data: saved, error } = await query.select('*').single();
    if (error) throw error;
    setData(current => ({ ...current, subtarefas: (action === 'delete'
      ? current.subtarefas.filter(item => item.id !== saved.id)
      : [...current.subtarefas.filter(item => item.id !== saved.id), saved])
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)) }));
  }

  async function saveOrderDescription(order: Order, description: string) {
    const { data: saved, error } = await requireSupabase().from("pedidos")
      .update({ observacao: description || null }).eq("id", order.id)
      .select("id, observacao").single();
    if (error) throw error;
    setData(current => ({ ...current, pedidos: current.pedidos.map(item =>
      item.id === saved.id ? { ...item, observacao: saved.observacao } : item) }));
  }

  async function saveOrderLinks(order: Order, links: string[], colors: string[]) {
    // Compare the saved list so another user's changes are not silently overwritten.
    const previous = `{${(order.links || []).map(link => JSON.stringify(link)).join(",")}}`;
    const previousColors = `{${(order.links_cores || []).map(color => JSON.stringify(color)).join(",")}}`;
    const { data: saved, error } = await requireSupabase().from("pedidos")
      .update({ links, links_cores: colors }).eq("id", order.id).filter("links", "eq", previous).filter("links_cores", "eq", previousColors)
      .select("id, links, links_cores").maybeSingle();
    if (error) throw error;
    if (!saved) throw new Error("Os links deste pedido foram alterados em outra sessão. Atualize a página e tente novamente.");
    setData(current => ({ ...current, pedidos: current.pedidos.map(item =>
      item.id === saved.id ? { ...item, links: saved.links, links_cores: saved.links_cores } : item) }));
  }

  async function changeTaskStatus(task: Task, status: string) {
    return updateBoard(async () => {
      const { error } = await requireSupabase().from("tarefas").update({ status }).eq("id", task.id).eq("status", task.status).select("id").single();
      if (error) throw error;
      await refreshTasks();
      show(status === "concluido" ? "Tarefa concluída. Disponível no histórico de tarefas." : "Etapa da tarefa atualizada.");
    });
  }

  const taskProps = { tarefas, error: taskError, onNavigate: navigate, onSaved: refreshTasks, onStatusChange: changeTaskStatus, show };
  const detailRoute = parseLocalDetailsPage(page);
  const pages: Record<string, React.ReactNode> = {
    tarefas: <TasksPage key="tarefas" initialOpen={taskCreateRequested} {...taskProps} />,
    dashboard: <Dashboard tarefas={tarefas} taskError={taskError} onTaskStatusChange={changeTaskStatus} data={data} onNavigate={navigate} onItemStatusChange={(item, concluido) => updateBoard(async () => {
      const { error } = await requireSupabase().from("pedido_itens").update({ concluido }).eq("id", item.id);
      if (error) throw error;
      await refresh(true);
    })} onStatusChange={changeOrderStatus} onPriorityChange={changeOrderPriority} onDescriptionSave={saveOrderDescription} onLinksSave={saveOrderLinks} onSituationSave={saveOrderSituation} onSubtaskChange={changeOrderSubtask} />,
    catalogo: <CatalogAdmin materiais={data.materiais} locais={data.locais} onSaved={refresh} show={show} />,
    estoque: <EstoqueComLocais materiais={data.materiais} locais={data.locais} estoqueLocal={data.estoqueLocal} onSaved={refresh} show={show} />,
    estoquePorLocal: <EstoquePorLocal materiais={data.materiais} locais={data.locaisTodos} estoqueLocal={data.estoqueLocal} />,
    compras: <ComprasComLocal materiais={data.materiais} locais={data.locais} compras={data.compras} estoqueLocal={data.estoqueLocal} onSaved={refresh} show={show} />,
    vendas: <VendasComLocal materiais={data.materiais} locais={data.locaisTodos} vendedores={data.vendedoresTodos} estoqueLocal={data.estoqueLocal} vendas={data.vendas} onSaved={refresh} show={show} />,
    pedidos: <PedidosComLocal subtarefas={data.subtarefas} materiais={data.materiais} locais={data.locais} vendedores={data.vendedores} pedidos={data.pedidos} itens={data.pedidoItens} pagamentos={data.pagamentos} onSaved={refresh} show={show} />,
    filamentos: <Filamentos />,
    cadastros: <Cadastros locais={data.locaisTodos} vendedores={data.vendedoresTodos} onNavigate={navigate} onSaved={refresh} show={show} />,
    calculadora: <CalculadoraCustos materiais={data.materiais} show={show} />,
    calculadoraEscala: <CalculadoraEscala />,
    estimativaImpressao: <EstimativaImpressao />,
    historico: <HistoricoPage vendas={data.vendas} materiais={data.materiais} locais={data.locais} vendedores={data.vendedores} />,
    financeiro: <FinanceiroModule onDataChanged={refreshPayablesAlert} page="financeiro" onNavigate={navigate} show={show} />,
    financeiroCaixa: <FinanceiroModule onDataChanged={refreshPayablesAlert} page="financeiroCaixa" onNavigate={navigate} show={show} />,
    financeiroReembolsos: <FinanceiroModule onDataChanged={refreshPayablesAlert} page="financeiroReembolsos" onNavigate={navigate} show={show} />,
    financeiroContas: <FinanceiroModule onDataChanged={refreshPayablesAlert} page="financeiroContas" onNavigate={navigate} show={show} />,
    financeiroDespesas: <FinanceiroModule onDataChanged={refreshPayablesAlert} page="financeiroDespesas" onNavigate={navigate} show={show} />,
    financeiroParcelas: <FinanceiroModule onDataChanged={refreshPayablesAlert} page="financeiroParcelas" onNavigate={navigate} show={show} />,
    financeiroFaturas: <FinanceiroModule onDataChanged={refreshPayablesAlert} page="financeiroFaturas" onNavigate={navigate} show={show} />,
    financeiroCartoes: <FinanceiroModule onDataChanged={refreshPayablesAlert} page="financeiroCartoes" onNavigate={navigate} show={show} />,
    financeiroCategorias: <FinanceiroModule onDataChanged={refreshPayablesAlert} page="financeiroCategorias" onNavigate={navigate} show={show} />,
  };

  function navigate(target: string, options: { createTask?: boolean } = {}) {
    setTaskCreateRequested(Boolean(options.createTask));
    const href = getAdminPageHref(target);
    window.history.pushState({ page: target }, "", href);
    setPage(target);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
    <div className="app-shell" inert={boardUpdating} aria-busy={boardUpdating}>
      {caixaOpen && <CaixaPedidoModal onDone={finishCaixa} />}
      <button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Abrir menu"><span /><span /><span /></button>
      {menuOpen && <button className="sidebar-scrim" onClick={() => setMenuOpen(false)} aria-label="Fechar menu" />}
      <aside className={menuOpen ? "sidebar open" : "sidebar"}>
        <div className="sidebar-brand"><img src={logo} alt="RAVA Studio 3D" /></div>
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
            <div className={stockNavigation.some(([id]) => id === page || (id === "cadastros" && detailRoute)) ? "nav-group-title active" : "nav-group-title"}>
              <span><Icon name="warehouse" /></span>Estoque
            </div>
            <div className="nav-subitems">
              {stockNavigation.map(([id, label]) => (
                <a
                  key={id}
                  className={page === id || (id === "cadastros" && detailRoute) ? "nav-subitem active" : "nav-subitem"}
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
            <div className={organizationNavigation.some(([id]) => id === page) ? "nav-group-title active" : "nav-group-title"}>
              <span><Icon name="orders" /></span>Organização
            </div>
            <div className="nav-subitems">
              {organizationNavigation.map(([id, label]) => <a key={id} className={page === id || (id === "cadastros" && detailRoute) ? "nav-subitem active" : "nav-subitem"} href={getAdminPageHref(id)} onClick={event => {
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault(); navigate(id);
              }}>{label}</a>)}
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
                  className={page === id || (id === "cadastros" && detailRoute) ? "nav-subitem active" : "nav-subitem"}
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
                  className={page === id || (id === "cadastros" && detailRoute) ? "nav-subitem active" : "nav-subitem"}
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
          <button className="logout" onClick={() => requireSupabase().auth.signOut()}>Sair</button>
        </div>
      </aside>
      <main className="content">
        <PreviousMonthPayablesAlert key={profile.id} page={page} revision={financeRevision} />
        {notice && <div className={`notice ${notice.type}`} role="status">{notice.message}</div>}
        {loading ? <div className="loading">Atualizando dados…</div> : detailRoute ? <LocalDetails key={page} {...detailRoute} onNavigate={navigate} onSaved={() => refresh(true)} show={show} /> : pages[page] || pages.dashboard}
      </main>
    </div>
    {boardUpdating && (
      <div className="board-update-overlay" role="status" aria-live="polite">
        <div className="board-update-indicator">
          <span className="board-update-spinner" aria-hidden="true" />
          <span>Atualizando quadro…</span>
        </div>
      </div>
    )}
    </>
  );
}
