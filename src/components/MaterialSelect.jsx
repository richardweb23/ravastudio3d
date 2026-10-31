import ProductSearchSelect from './ProductSearchSelect.jsx';
import { formatNumber as fmtNumber } from '../lib/formatters.js';
export default function MaterialSelect({ materiais, value, onChange }) {
  return <ProductSearchSelect items={materiais} value={value} onChange={onChange} required getDescription={item => `Saldo: ${fmtNumber(item.quantidade_atual)}`} />;
}
