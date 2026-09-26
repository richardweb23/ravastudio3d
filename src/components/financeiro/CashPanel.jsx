import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../supabase.js';
import { SALES_BOXES } from '../../lib/vendas.js';
import { formatBRLCents as money, reaisToCents, currentMonthKey } from '../../lib/financeiro.js';
import { today } from '../../lib/formatters.js';
import CaixaSelect from '../CaixaSelect.jsx';
import DataTable from '../DataTable.jsx';

const labels = { abertura:'Saldo inicial', entrada:'Entrada manual', venda:'Venda recebida', pedido:'Pedido recebido', despesa:'Despesa paga', repasse:'Repasse', reembolso:'Reembolso ao sócio', estorno:'Estorno', devolucao_cliente:'Devolução ao cliente' };
const orderedCaixas = (caixas = []) => SALES_BOXES.map((nome) => caixas.find((caixa) => caixa.nome === nome)).filter(Boolean);
export function CashBalances({ refreshKey }) {
 const [state,setState]=useState(null), [error,setError]=useState('');
 useEffect(()=>{let active=true; supabase.rpc('financeiro_resumo').then(({data,error})=>{if(active){setState(data);setError(error?.message || '');}});return()=>{active=false;};},[refreshKey]);
 if(error) return <p className="negative" role="alert">Não foi possível consultar o caixa: {error}</p>;
 if(!state) return <p>Consultando caixas…</p>;
 return <><div className="metrics finance-metrics">{orderedCaixas(state.caixas).map(c=><section className="metric" key={c.nome}><span>{c.nome} · saldo disponível</span><strong>{state.abertura ? money(c.saldo_centavos) : 'Aguardando abertura'}</strong></section>)}</div>{!state.abertura && <p>Configure os saldos iniciais em Financeiro → Caixa e extrato.</p>}</>;
}

export default function CashPanel({ view='cash', onNavigate }) {
 const [summary,setSummary]=useState(null),[rows,setRows]=useState([]),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [month,setMonth]=useState(currentMonthKey),[box,setBox]=useState(''),[kind,setKind]=useState(view==='partners'?'reembolso':''),[offset,setOffset]=useState(0);
 const [modal,setModal]=useState(null),[busy,setBusy]=useState(false),[detail,setDetail]=useState(null);
 const submitting=useRef(false),request=useRef(null);
 const [form,setForm]=useState({data:today(),caixa:'',valor:'',descricao:'',socio_id:'',caixa_legado:'',Rivoxel:'0',Rava:'0',Bonecos:'0'});
 const update=e=>setForm(s=>({...s,[e.target.name]:e.target.value}));
 const sequence=useRef(0);
 const load=useCallback(async()=>{
  const current=++sequence.current;
  const start=month?month+'-01':null;
  const end=month?new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).toLocaleDateString('sv-SE'):null;
  const [s,e]=await Promise.all([supabase.rpc('financeiro_resumo',{p_inicio:start,p_fim:end}),supabase.rpc('financeiro_extrato',{p_caixa:box||null,p_inicio:start,p_fim:end,p_tipo:kind||null,p_offset:offset})]);
  if(current!==sequence.current)return;
  if(s.error||e.error){setError((s.error||e.error).message);return;}
  setSummary(s.data);setRows(e.data||[]);setError('');
 },[month,box,kind,offset]);
 useEffect(()=>{let live=true; Promise.resolve().then(()=>{if(live)load();});return()=>{live=false;};},[load]);
 const open=(action,row=null,socio='')=>{setError('');request.current=null;setForm({data:today(),caixa:row?.caixa||'',valor:'',descricao:'',socio_id:socio,caixa_legado:'',Rivoxel:'0',Rava:'0',Bonecos:'0'});setModal({action,row});};
 async function submit(e){
  e.preventDefault();if(submitting.current)return;submitting.current=true;setBusy(true);setError('');
  try{
   const action=modal.action;
   const data={data:form.data};
   if(action==='abertura'){data.saldos=Object.fromEntries(SALES_BOXES.map(c=>[c,reaisToCents(form[c])]));data.caixa_legado=form.caixa_legado||null;}
   else {data.descricao=form.descricao.trim();if(action!=='estorno')data.valor_centavos=reaisToCents(form.valor);}
   if(['entrada','reembolso'].includes(action))data.caixa=form.caixa;
   if(action==='reembolso')data.socio_id=form.socio_id;
   if(modal.row)data.movimento_id=modal.row.id;
   const signature=JSON.stringify({action,data});
   if(request.current?.signature!==signature)request.current={signature,id:crypto.randomUUID()};
   const result=await supabase.rpc('financeiro_operar',{p_acao:action,p_dados:data,p_requisicao:request.current.id});
   if(result.error)throw result.error;
   setModal(null);setNotice('Operação registrada. Saldos atualizados.');await load();
  }catch(err){setError(err.message);}finally{submitting.current=false;setBusy(false);}
 }
 const credit=(summary?.socios||[]).reduce((s,p)=>s+Number(p.saldo_centavos),0);
 return <section className="cash-panel">
  {error&&<p className="negative" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {!summary&&!error&&<p>Consultando financeiro…</p>}
  {summary&&<>
   {view!=='partners'&&<>
    <div className="metrics finance-metrics">{orderedCaixas(summary.caixas).map(c=><section className="metric" key={c.nome}><span>{c.nome} · disponível</span><strong>{summary.abertura?money(c.saldo_centavos):'Sem abertura'}</strong></section>)}<section className="metric"><span>Total da empresa</span><strong>{money(summary.caixas.reduce((s,c)=>s+Number(c.saldo_centavos),0))}</strong></section></div>
    {!summary.abertura?<section className="panel"><h2>Configure os caixas</h2><p>Informe o saldo disponível no início da data escolhida. As entradas e saídas a partir desse dia serão contabilizadas separadamente. Valores anteriores não entrarão novamente.</p><button className="primary" onClick={()=>open('abertura')}>Registrar abertura</button></section>:<p>Controle desde {summary.abertura.split('-').reverse().join('/')}. O saldo disponível é acumulado, independentemente do período abaixo.</p>}
    <div className="metrics finance-metrics"><section className="metric"><span>Entradas no período</span><strong>{money(summary.entradas_centavos)}</strong></section><section className="metric"><span>Saídas no período</span><strong>{money(summary.saidas_centavos)}</strong></section><section className="metric"><span>A devolver aos sócios · acumulado</span><strong>{money(credit)}</strong></section></div>
   </>}
   {view==='partners'&&<section className="panel"><h2>Valores que a empresa deve aos sócios</h2><p>Pagamentos efetivos de despesas, incluindo o histórico. Estes saldos não são limitados ao mês selecionado.</p><div className="partner-grid">{summary.socios.map(p=><article key={p.id}><h3>{p.nome}</h3><dl><div><dt>Adiantou à empresa</dt><dd>{money(p.adiantado_centavos)}</dd></div><div><dt>Já recebeu de volta</dt><dd>{money(p.reembolsado_centavos)}</dd></div><div><dt>A receber</dt><dd><strong>{money(p.saldo_centavos)}</strong></dd></div></dl><button className="primary" disabled={!summary.abertura||Number(p.saldo_centavos)<=0} onClick={()=>open('reembolso',null,p.id)}>Registrar reembolso</button></article>)}</div>{!summary.abertura&&<p>Abra os caixas no Financeiro antes de registrar reembolsos.</p>}</section>}
   {view==='overview'&&<section className="finance-overview-cash panel">
    <div className="finance-overview-heading"><div><span className="eyebrow">Liquidez</span><h2>Caixa da empresa</h2></div><button className="link" onClick={()=>onNavigate?.('financeiroCaixa')}>Abrir extrato</button></div>
    <p className="finance-overview-note">Saldo acumulado dos caixas. Entradas e saídas acima consideram o período selecionado.</p>
    <div className="finance-overview-partners"><div><span>A empresa deve aos sócios</span><strong>{money(credit)}</strong></div><button onClick={()=>onNavigate?.('financeiroReembolsos')}>Ver reembolsos</button></div>
    <div className="finance-overview-partner-list">{summary.socios.map(p=><span key={p.id}>{p.nome}<strong>{money(p.saldo_centavos)}</strong></span>)}</div>
   </section>}   {view!=='overview'&&<section className="panel table-panel"><div className="panel-title"><h2>{view==='partners'?'Histórico de reembolsos':'Caixa e extrato'}</h2><div className="actions">{view!=='partners'&&<button disabled={!summary.abertura} onClick={()=>open('entrada')}>Registrar entrada</button>}{view==='overview'&&onNavigate&&<button onClick={()=>onNavigate('financeiroReembolsos')}>Reembolsar sócios</button>}</div></div>
    <div className="finance-filters"><label>Período<input type="month" value={month} onChange={e=>{setMonth(e.target.value);setOffset(0);}}/></label><button className="link" onClick={()=>{setMonth('');setOffset(0);}}>Todo o histórico</button><label>Caixa<select value={box} onChange={e=>{setBox(e.target.value);setOffset(0);}}><option value="">Todos</option>{SALES_BOXES.map(c=><option key={c}>{c}</option>)}</select></label><label>Tipo<select value={kind} onChange={e=>{setKind(e.target.value);setOffset(0);}}><option value="">Todos</option>{Object.entries(labels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label></div>
    <DataTable heads={['Data','Caixa','Tipo','Descrição','Valor','Ações']} rows={rows.map(r=><tr key={r.id}><td>{r.data.split('-').reverse().join('/')}</td><td>{r.caixa}</td><td>{labels[r.tipo]}{r.estornado&&<small>Estornado</small>}</td><td>{r.descricao}{r.reembolso&&<small>{r.reembolso.socio}</small>}</td><td>{money(r.valor_centavos)}</td><td><div className="row-actions"><button onClick={()=>setDetail(r)}>Detalhes / origem</button>{!r.estornado&&!r.estorno_de&&r.tipo!=='abertura'&&<button onClick={()=>r.tipo==='despesa'?onNavigate?.('financeiroContas'):open('estorno',r)}>{r.tipo==='despesa'?'Ver conta':'Estornar'}</button>}{!r.estornado&&['venda','pedido'].includes(r.tipo)&&<button onClick={()=>open('devolucao_cliente',r)}>Devolver ao cliente</button>}</div></td></tr>)} empty="Nenhum movimento neste período."/>
    <div className="actions"><button disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-100))}>Anterior</button><span>Página {offset/100+1}</span><button disabled={rows.length<100} onClick={()=>setOffset(offset+100)}>Próxima</button></div>
   </section>}
  </>}
  {detail&&<div className="modal-backdrop"><section role="dialog" aria-modal="true" aria-label="Origem do movimento" className="panel modal-card"><h2>{labels[detail.tipo]}</h2><p>{detail.descricao} · {money(detail.valor_centavos)} · {detail.caixa}</p><>{detail.origem&&<><h3>{detail.origem.titulo}</h3><p>{detail.origem.data?.split("-").reverse().join("/")} · {money(detail.origem.valor_centavos)}{detail.origem.parcela ? " · Parcela " + detail.origem.parcela : ""}{detail.origem.metodo ? " · " + detail.origem.metodo : ""}</p>{detail.origem.quantidade&&<p>{detail.origem.quantidade} unidade(s){detail.origem.devolvida ? " · Mercadoria devolvida" : ""}</p>}</>}<p>Origem: {detail.origem_id||'Abertura'}<br/>Registrado em: {new Date(detail.created_at).toLocaleString('pt-BR')}</p></>{detail.reembolso&&<><h3>{detail.reembolso.socio}</h3>{detail.reembolso.itens.map(i=><p key={i.pagamento_id}>{i.despesa} · parcela {i.parcela}: {money(i.valor_centavos)}</p>)}</>}{onNavigate&&<button onClick={()=>{onNavigate(['pedido'].includes(detail.tipo)?'pedidos':detail.tipo==='venda'?'vendas':detail.tipo==='repasse'?'cadastros':'financeiroContas');setDetail(null);}}>Abrir módulo de origem</button>}<button onClick={()=>setDetail(null)}>Fechar</button></section></div>}
  {modal&&<div className="modal-backdrop"><form className="panel form modal-card" role="dialog" aria-modal="true" aria-label="Operação de caixa" onSubmit={submit}><h2>{{abertura:'Abertura dos caixas',entrada:'Entrada manual',reembolso:'Reembolso ao sócio',estorno:'Estornar lançamento',devolucao_cliente:'Devolver dinheiro ao cliente'}[modal.action]}</h2><fieldset disabled={busy}>
   <label>Data<input type="date" name="data" value={form.data} max={today()} min={modal.action==='abertura'?undefined:summary?.abertura||undefined} onChange={update} required/></label>
   {modal.action==='abertura'?<><p>Informe o saldo no início do dia, antes das movimentações dessa data.</p>{SALES_BOXES.map(c=><label key={c}>{c} (R$)<input name={c} type="number" step="0.01" min="0" value={form[c]} onChange={update} required/></label>)}<label>Caixa de pedidos e repasses antigos sem classificação<select name="caixa_legado" value={form.caixa_legado} onChange={update}><option value="">Não há / escolher se necessário</option>{SALES_BOXES.map(c=><option key={c}>{c}</option>)}</select></label><small>Despesas antigas pagas por “Caixa da RAVA” pertencem ao caixa Rava.</small></>:<>
   {modal.action==='reembolso'&&<label>Sócio<select name="socio_id" value={form.socio_id} onChange={update} required><option value="">Selecione</option>{summary.socios.map(s=><option key={s.id} value={s.id}>{s.nome} · {money(s.saldo_centavos)} a receber</option>)}</select></label>}
   {['entrada','reembolso'].includes(modal.action)&&<CaixaSelect label={modal.action === "entrada" ? "Caixa de destino" : "Caixa de origem"} value={form.caixa} onChange={update}/>}
   {modal.action!=='estorno'&&<label>Valor (R$)<input name="valor" type="number" min="0.01" step="0.01" value={form.valor} onChange={update} required/></label>}
   <label>{modal.action==='estorno'?'Motivo do estorno':'Descrição / observação'}<textarea name="descricao" value={form.descricao} onChange={update} maxLength={2000} required/></label>
   {modal.action==='estorno'&&<p>Correção de lançamento: registra o movimento inverso e preserva o histórico. Para devolver dinheiro ao cliente, use a ação específica.</p>}
   {modal.action==='devolucao_cliente'&&<p>A saída será feita pelo caixa {modal.row.caixa}. Isso não altera o estoque nem marca a venda como não paga.</p>}
   </>}
   </fieldset>{error&&<p className="negative" role="alert">{error}</p>}<div className="actions"><button className="primary" disabled={busy}>{busy?'Registrando…':'Confirmar'}</button><button type="button" disabled={busy} onClick={()=>setModal(null)}>Cancelar</button></div></form></div>}
 </section>;
}

