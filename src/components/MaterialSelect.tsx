import type { Tables } from "../database.types";
import ProductSearchSelect from './ProductSearchSelect.tsx';
import { formatNumber as fmtNumber } from '../lib/formatters.js';
export default function MaterialSelect({ materiais, value, onChange }: { materiais: Tables<"materiais">[]; value: string; onChange: (value: string) => void }) {
  return <ProductSearchSelect items={materiais} value={value} onChange={onChange} required getDescription={item => `Saldo: ${fmtNumber(item.quantidade_atual)}`} />;
}
