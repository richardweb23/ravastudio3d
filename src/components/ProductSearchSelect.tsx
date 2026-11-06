import SearchSelect from './SearchSelect.tsx';
export default function ProductSearchSelect<T extends { id: string; nome: string; codigo?: number | null }>({ label = 'Produto', items = [], value, onChange, required = false, disabled = false, emptyLabel = 'Todos os produtos', emptyValue = '', getDescription }: { label?: string; items?: T[]; value: string; onChange: (value: string) => void; required?: boolean; disabled?: boolean; emptyLabel?: string; emptyValue?: string; getDescription?: (item: T) => string }) {
  return <label className="product-search-field">{label}<SearchSelect value={value} onChange={event => onChange(event.target.value)} required={required} disabled={disabled}>
    <option value={emptyValue}>{required ? 'Selecione um produto' : emptyLabel}</option>
    {items.map(item => <option value={item.id} key={item.id}>{item.nome}{item.codigo != null ? ` · ${item.codigo}` : ''}{getDescription ? ` — ${getDescription(item)}` : ''}</option>)}
  </SearchSelect></label>;
}
