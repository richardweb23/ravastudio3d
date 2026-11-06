import type { SelectChange } from "./SearchSelect";
import SearchSelect from './SearchSelect.tsx';
import { SALES_BOXES } from '../lib/vendas.js';
export default function CaixaSelect({ value, onChange, label = "Caixa da venda", boxes = SALES_BOXES }: { value: string; onChange: SelectChange; label?: string; boxes?: string[] }) {
  return <label>{label}<SearchSelect name="caixa" value={value} onChange={onChange} required><option value="">Selecione a caixa</option>{boxes.map(box => <option key={box} value={box}>{box}</option>)}</SearchSelect></label>;
}
