import { useEffect, useRef } from 'react';
import { formatMoney, formatNumber } from '../lib/formatters.js';
import { saleProductCategory } from '../lib/produtos.js';
import { bonecosTransferCost, saleCostCents, saleTotal } from '../lib/vendas.js';
import StatusBadge from './StatusBadge.tsx';

const dateLabel = value => value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : 'Não informada';

export default function VendaDetalhesModal({ sale, locais, onEditBox, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const node = dialog.current;
    const previous = document.activeElement;
    node.showModal();
    return () => { node.close(); previous?.focus(); };
  }, []);
  const transfer = bonecosTransferCost(sale);
  const payment = sale.pedido_id ? sale.pagamento_pedido || 'pendente' : sale.pago ? 'pago' : 'pendente';
  return <dialog ref={dialog} className="panel modal-card order-details-dialog sale-details-dialog" aria-labelledby="sale-details-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="order-dialog-layout">
      <div className="modal-heading"><div><h2 id="sale-details-title">Detalhes da venda</h2><p>{sale.materiais?.nome || 'Produto'}</p></div><button autoFocus type="button" className="close-modal" aria-label="Fechar detalhes" onClick={onClose}>×</button></div>
      <div className="order-dialog-body">
        <section className="sale-details-section"><h3>Venda</h3><dl className="sale-details-grid">
          <div><dt>Data da venda</dt><dd>{dateLabel(sale.data)}</dd></div>
          <div><dt>Categoria</dt><dd>{saleProductCategory(sale)}</dd></div>
          <div><dt>Local de saída</dt><dd>{sale.locais_estoque?.nome || 'Não informado'}</dd></div>
          <div><dt>Vendedor</dt><dd>{sale.vendedores?.nome || 'Não informado'}</dd></div>
          <div><dt>Quantidade</dt><dd>{formatNumber(sale.quantidade)}</dd></div>
          <div><dt>Preço unitário</dt><dd>{formatMoney(sale.preco_unitario)}</dd></div>
          <div><dt>Total da venda</dt><dd>{formatMoney(saleTotal(sale))}</dd></div>
          <div><dt>Status</dt><dd><StatusBadge value={sale.devolvida_em ? 'devolvida' : 'ativa'}>{sale.devolvida_em ? 'Devolvida' : 'Ativa'}</StatusBadge></dd></div>
        </dl>{sale.devolvida_em && <p>Venda devolvida em {dateLabel(sale.devolvida_em)}. Retorno ao estoque: {locais.find(local => local.id === sale.retorno_local_id)?.nome || 'Local registrado'}. O total acima considera a devolução.</p>}</section>
        <section className="sale-details-section"><h3>Pagamento</h3><dl className="sale-details-grid">
          <div><dt>Caixa</dt><dd>{sale.caixa || 'Rivoxel'} <button type="button" className="link sale-edit-box" onClick={onEditBox}>Alterar caixa</button></dd></div>
          <div><dt>Pagamento{sale.pedido_id ? ' do pedido' : ''}</dt><dd><StatusBadge value={payment}>{{ pago: 'Pago', parcial: 'Parcial', pendente: 'Pendente' }[payment] || 'Pendente'}</StatusBadge></dd></div>
          {!sale.pedido_id && sale.pago && <div><dt>Data do recebimento</dt><dd>{dateLabel(sale.data_recebimento)}</dd></div>}
        </dl>{sale.pedido_id && <p>Venda vinculada a um pedido. <a href="#/pedidos" onClick={onClose}>Ver pedidos</a></p>}</section>
        <section className="sale-details-section"><h3>Custos de produção</h3><dl className="sale-details-grid">
          <div><dt>Custo unitário atual</dt><dd>{sale.materiais?.custo_medio == null ? 'Não informado' : formatMoney(sale.materiais.custo_medio)}</dd></div>
          <div><dt>Custo total considerado</dt><dd>{formatMoney(saleCostCents(sale) / 100)}</dd></div>
        </dl><p>Valores baseados no custo atual do produto. Vendas devolvidas não entram no total de custos.</p>
        {sale.caixa === 'Bonecos' && <div className="sale-transfer-reference"><strong>Referência para transferência de materiais</strong>{transfer ? <p>{formatMoney(transfer.unit)} por unidade · {formatMoney(transfer.total)} no total{sale.devolvida_em ? '. Venda devolvida; o ajuste é manual.' : '.'}</p> : <p>Custo histórico indisponível para esta venda.</p>}</div>}</section>
      </div>
      <div className="actions order-dialog-footer"><button type="button" onClick={onClose}>Fechar</button></div>
    </div>
  </dialog>;
}
