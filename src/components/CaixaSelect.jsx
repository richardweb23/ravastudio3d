import { SALES_BOXES } from '../lib/vendas.js';
export default function CaixaSelect({ value, onChange }) {
  return <label>Caixa da venda<select name="caixa" value={value} onChange={onChange} required><option value="">Selecione a caixa</option>{SALES_BOXES.map(box => <option key={box} value={box}>{box}</option>)}</select></label>;
}
