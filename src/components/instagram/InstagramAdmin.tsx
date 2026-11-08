/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import Header from "../Header.tsx";
import { requireSupabase } from "../../supabase.js";
import { matchesInstagramKeyword } from "../../lib/instagram.js";
import { instagramRequest } from "../../services/instagram.js";
import { loadAllTableRows } from "../../services/tableRows.js";

type Settings = { ativa: boolean; palavras_chave: string[]; resposta_publica: string; mensagem_produto: string; mensagem_alternativa: string; catalogo_url: string; whatsapp_url: string; sem_produto: string };
type Post = { id: string; legenda: string; permalink: string | null; miniatura_url: string | null; publicada_em: string | null; monitorada: boolean };
type Binding = { publicacao_id: string; material_id: string };
type Product = { material_id: string; titulo: string; status: string; materiais: { nome: string } | null };
type Activity = { id: number; comentario: string | null; status: string; detalhe: string | null; created_at: string; publicacao_id: string | null };
type Tab = "Resumo" | "Publicações" | "Atividade" | "Configurações";
const client = () => requireSupabase() as unknown as SupabaseClient;
function safeInstagramPermalink(value: string | null) {
  try { const url = new URL(value || ""); return url.protocol === "https:" && (url.hostname === "instagram.com" || url.hostname === "www.instagram.com") && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}
function safeThumbnail(value: string | null) {
  try { const url = new URL(value || ''); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}

export default function InstagramAdmin() {
  const [tab, setTab] = useState<Tab>("Resumo");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [keywords, setKeywords] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [bindings, setBindings] = useState<Binding[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [period, setPeriod] = useState(30);
  const [summary, setSummary] = useState<{ identified: number; messages: number; attempts: number; failed: number } | null>(null);
  const [page, setPage] = useState(0);
  const [activityFilter, setActivityFilter] = useState('');
  const [query, setQuery] = useState("");
  const [onlyUnlinked, setOnlyUnlinked] = useState(false);
  const [comment, setComment] = useState("");
  const [tested, setTested] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setError("");
    try {
      const db = client();
      const [overview, activity, stats, catalog] = await Promise.all([
        instagramRequest<{ settings: Settings; posts: Post[]; bindings: Binding[] }>('overview'),
        instagramRequest<{ rows: Activity[]; hasMore: boolean }>('activity', { page, status: activityFilter }),
        instagramRequest<{ identified: number; messages: number; attempts: number; failed: number }>('summary', { days: period }),
        loadAllTableRows(db.from("catalogo_produtos").select("material_id,titulo,status,materiais(nome)").eq('status', 'publicado'), ['material_id']),
      ]);
      if (catalog.error) throw catalog.error;
      const config = overview.settings;
      setSettings(config); setKeywords(config.palavras_chave.join("\n"));
      setPosts(overview.posts || []); setBindings(overview.bindings || []);
      setProducts((catalog.data || []) as unknown as Product[]); setActivities(activity.rows || []); setHasMore(activity.hasMore);
      setSummary(stats);
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível carregar o módulo. Verifique se a migração foi aplicada no ambiente de teste."); }
    finally { setLoading(false); }
  }, [page, activityFilter, period]);
  useEffect(() => { void refresh(); }, [refresh]);
  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); await refresh(); setNotice(message); }
    catch (err) { setError(err instanceof Error ? err.message : "Não foi possível salvar. Tente novamente."); }
    finally { setBusy(false); }
  }
  function saveSettings() {
    if (!settings) return;
    const words = [...new Set(keywords.split("\n").map(value => value.trim()).filter(Boolean))];
    if (!words.length || words.length > 100 || words.some(word => word.length > 100)) { setError("Informe de 1 a 100 palavras-chave com até 100 caracteres cada."); return; }
    if (!settings.mensagem_produto.includes("{produtos}") || !settings.mensagem_alternativa.includes("{catalogo}") || !settings.mensagem_alternativa.includes("{whatsapp}")) { setError("Mantenha {produtos}, {catalogo} e {whatsapp} nas respectivas mensagens."); return; }
    if (settings.sem_produto === "catalogo" && !settings.whatsapp_url) { setError("Configure o link do WhatsApp para usar a mensagem alternativa."); return; }
    for (const url of [settings.catalogo_url, settings.whatsapp_url].filter(Boolean)) {
      try { if (new URL(url).protocol !== "https:") throw Error(); }
      catch { setError("Os links devem começar com https:// e ser válidos."); return; }
    }
    const { resposta_publica, mensagem_produto, mensagem_alternativa, catalogo_url, whatsapp_url, sem_produto } = settings;
    void run(() => instagramRequest('settings', { values: { resposta_publica, mensagem_produto, mensagem_alternativa, catalogo_url, whatsapp_url, sem_produto, palavras_chave: words } }), "Configurações salvas.");
  }
  const tabs: Tab[] = ["Resumo", "Publicações", "Atividade", "Configurações"];
  const filtered = posts.filter(post => post.legenda.toLowerCase().includes(query.toLowerCase()) && (!onlyUnlinked || !bindings.some(binding => binding.publicacao_id === post.id)));
  return <div>
    <Header title="Instagram" subtitle="Gerenciamento da automação de comentários" />
    <p className="panel">Vincule produtos às publicações para enviar seus preços atuais por mensagem.</p>
    <nav className="actions" aria-label="Seções do Instagram">{tabs.map(item => <button key={item} aria-current={tab === item ? "page" : undefined} className={tab === item ? "primary" : ""} onClick={() => setTab(item)}>{item}</button>)}</nav>
    {notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}
    {loading ? <p>Carregando…</p> : !settings ? <button onClick={() => void refresh()}>Tentar novamente</button> : <>
      {tab === "Resumo" && <section className="panel"><h2>Resumo</h2><label>Período<select value={period} onChange={event => setPeriod(Number(event.target.value))}><option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option><option value={90}>Últimos 90 dias</option></select></label><p>Conexão: ainda não verificada</p><p>Automação configurada: {settings.ativa ? "ativada" : "desativada"}</p><p>Publicações monitoradas nesta lista: {posts.filter(post => post.monitorada).length}</p>{summary && <><p>Comentários identificados: {summary.identified}</p><p>Mensagens privadas confirmadas: {summary.messages}</p><p>Falhas ou resultados incertos: {summary.failed}</p><p>Taxa de confirmação entre tentativas: {summary.attempts ? `${Math.round(summary.messages / summary.attempts * 100)}%` : 'Sem tentativas'}</p></>}</section>}
      {tab === "Publicações" && <section className="panel"><h2>Publicações</h2><div className="actions"><button disabled={busy} onClick={() => void run(() => instagramRequest('sync', {}, 'instagram-sync'), 'Sincronização concluída.')}>Sincronizar publicações</button></div>
        <label>Pesquisar legenda<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <label><input type="checkbox" checked={onlyUnlinked} onChange={event => setOnlyUnlinked(event.target.checked)} /> Sem produto vinculado</label>
        {!filtered.length && <p>Nenhuma publicação encontrada.</p>}
        {filtered.map(post => <article key={post.id} className="panel">{safeThumbnail(post.miniatura_url) && <img src={safeThumbnail(post.miniatura_url) || undefined} alt="Miniatura da publicação" loading="lazy" style={{ maxWidth: 160, maxHeight: 160, objectFit: 'cover' }} />}<p>{post.legenda || "Sem legenda"}</p><p>{post.publicada_em ? new Date(post.publicada_em).toLocaleDateString("pt-BR") : "Data indisponível"}</p>
          {safeInstagramPermalink(post.permalink) && <a href={safeInstagramPermalink(post.permalink) || undefined} target="_blank" rel="noopener noreferrer">Abrir no Instagram ↗</a>}
          <label><input type="checkbox" checked={post.monitorada} disabled={busy} onChange={event => { const enabled = event.target.checked; void run(() => instagramRequest('monitor', { postId: post.id, enabled }), "Publicação atualizada."); }} /> Monitorar comentários</label>
          <ul>{bindings.filter(binding => binding.publicacao_id === post.id).map(binding => <li key={binding.material_id}>{products.find(product => product.material_id === binding.material_id)?.titulo || products.find(product => product.material_id === binding.material_id)?.materiais?.nome || "Produto indisponível"} <button disabled={busy} onClick={() => void run(() => instagramRequest('unlink', { postId: post.id, productId: binding.material_id }), "Vínculo removido.")}>Remover</button></li>)}</ul>
          <label>Vincular produto<select value="" disabled={busy} onChange={event => { const id = event.target.value; if (id) void run(() => instagramRequest('link', { postId: post.id, productId: id }), "Produto vinculado."); }}><option value="">Selecione…</option>{products.filter(product => !bindings.some(binding => binding.publicacao_id === post.id && binding.material_id === product.material_id)).map(product => <option key={product.material_id} value={product.material_id}>{product.titulo || product.materiais?.nome || product.material_id} ({product.status})</option>)}</select></label>
        </article>)}
      </section>}
      {tab === "Atividade" && <section className="panel"><h2>Atividade</h2><label>Status<select value={activityFilter} onChange={event => { setActivityFilter(event.target.value); setPage(0); }}><option value="">Todos</option><option value="recebido">Recebido</option><option value="ignorado">Ignorado</option><option value="enviado">Enviado</option><option value="falha">Falha</option><option value="envio_privado_incerto">Envio privado incerto</option><option value="envio_privado_recusado">Envio privado recusado</option><option value="resposta_publica_incerta">Resposta pública incerta</option><option value="resposta_publica_recusada">Resposta pública recusada</option></select></label>{!activities.length && <p>Nenhuma atividade registrada.</p>}{activities.map(item => <article key={item.id}><p>{new Date(item.created_at).toLocaleString("pt-BR")} · {item.status}</p><p>{item.comentario}</p>{item.detalhe && <p>{item.detalhe}</p>}</article>)}<div className="actions"><button disabled={page === 0} onClick={() => setPage(value => value - 1)}>Anterior</button><span>Página {page + 1}</span><button disabled={!hasMore} onClick={() => setPage(value => value + 1)}>Próxima</button></div></section>}
      {tab === "Configurações" && <section className="panel"><h2>Configurações</h2>
        <label><input type="checkbox" checked={settings.ativa} disabled={busy} onChange={event => { const ativa = event.target.checked; if (ativa && !window.confirm('Ativar a automação? Se o envio estiver habilitado no servidor, mensagens reais poderão ser enviadas.')) return; void run(() => instagramRequest('settings', { values: { ativa } }), ativa ? 'Automação configurada como ativa.' : 'Automação desativada.'); }} /> Ativar automação</label>
        <label>Palavras-chave, uma por linha<textarea rows={7} value={keywords} onChange={event => setKeywords(event.target.value)} /></label>
        <label>Resposta pública<textarea value={settings.resposta_publica} onChange={event => setSettings({ ...settings, resposta_publica: event.target.value })} maxLength={2000} /></label>
        <label>Mensagem de produtos (use {'{produtos}'})<textarea value={settings.mensagem_produto} onChange={event => setSettings({ ...settings, mensagem_produto: event.target.value })} maxLength={2000} /></label>
        <label>Mensagem alternativa (use {'{catalogo}'} e {'{whatsapp}'})<textarea value={settings.mensagem_alternativa} onChange={event => setSettings({ ...settings, mensagem_alternativa: event.target.value })} maxLength={2000} /></label>
        <label>Link do catálogo<input type="url" value={settings.catalogo_url} onChange={event => setSettings({ ...settings, catalogo_url: event.target.value })} /></label>
        <label>Link do WhatsApp<input type="url" value={settings.whatsapp_url} onChange={event => setSettings({ ...settings, whatsapp_url: event.target.value })} /></label>
        <label>Sem produto vinculado<select value={settings.sem_produto} onChange={event => setSettings({ ...settings, sem_produto: event.target.value })}><option value="ignorar">Ignorar comentário</option><option value="catalogo">Usar mensagem alternativa</option></select></label>
        <div className="actions"><button className="primary" disabled={busy} onClick={saveSettings}>Salvar configurações</button></div>
        <h3>Simulação local</h3><label>Comentário de exemplo<input value={comment} onChange={event => { setComment(event.target.value); setTested(false); }} maxLength={2000} /></label><button disabled={!comment.trim()} onClick={() => setTested(true)}>Simular palavra-chave</button>
        {tested && <p role="status">{matchesInstagramKeyword(comment, keywords.split("\n")) ? "Palavra-chave identificada." : "Nenhuma palavra-chave identificada."} A elegibilidade na Meta não foi verificada.</p>}
        <h3>Prévia com dados de exemplo</h3><p style={{ whiteSpace: "pre-wrap" }}>{settings.mensagem_produto.replaceAll("{produtos}", "Produto de exemplo — R$ 50,00\nhttps://ravastudio3d.com.br/catalogo/?produto=exemplo")}</p>
        <h3>Prévia da mensagem alternativa</h3><p style={{ whiteSpace: "pre-wrap" }}>{settings.mensagem_alternativa.replaceAll("{catalogo}", settings.catalogo_url || "[catálogo não configurado]").replaceAll("{whatsapp}", settings.whatsapp_url || "[WhatsApp não configurado]")}</p>
      </section>}
    </>}
  </div>;
}
