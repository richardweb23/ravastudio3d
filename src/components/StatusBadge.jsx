const tones = {
 pago: 'pago', paga: 'pago', ativo: 'pago', ativa: 'pago', pronto: 'pago', terminado: 'pago', concluido: 'pago', entregue: 'pago',
 pendente: 'pendente', recebido: 'pendente', parcial: 'parcial', em_producao: 'parcial', fazendo: 'parcial',
 vencido: 'vencido', vencida: 'vencido', estornado: 'neutro', devolvida: 'neutro', devolvido: 'neutro', inativo: 'neutro',
 healthy: 'pago', reduced: 'pendente', low: 'vencido', negative: 'vencido',
};
export default function StatusBadge({ value, children }) {
 return <span className={`status finance-${tones[value] || 'neutro'}`}>{children}</span>;
}
