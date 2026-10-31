import SearchSelect from './SearchSelect.jsx';
export default function ProductSearchSelect({ label = 'Produto', items = [], value, onChange, required = false, disabled = false, emptyLabel = 'Todos os produtos', emptyValue = '', getDescription }) {
  return <label className="product-search-field">{label}<SearchSelect value={value} onChange={event => onChange(event.target.value)} required={required} disabled={disabled}>
    <option value={emptyValue}>{required ? 'Selecione um produto' : emptyLabel}</option>
    {items.map(item => <option value={item.id} key={item.id}>{item.nome}{item.codigo != null ? ` · ${item.codigo}` : ''}{getDescription ? ` — ${getDescription(item)}` : ''}</option>)}
  </SearchSelect></label>;
}
