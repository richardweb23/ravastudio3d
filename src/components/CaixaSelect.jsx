import { SALES_BOXES } from '../lib/vendas.js';
export default function CaixaSelect({ value, onChange, label = "Caixa da venda", boxes = SALES_BOXES }) {
  return <label>{label}<select name="caixa" value={value} onChange={onChange} required><option value="">Selecione a caixa</option>{boxes.map(box => <option key={box} value={box}>{box}</option>)}</select></label>;
}
