import { useId, useState } from 'react';

const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

export default function ProductSearchSelect({ label = 'Produto', items = [], value, onChange, required = false, disabled = false, emptyLabel = 'Todos os produtos', emptyValue = '', getDescription }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const selected = items.find(item => String(item.id) === String(value));
  const matches = items.filter(item => normalize(`${item.nome} ${item.codigo ?? ''}`).includes(normalize(query)));
  const choose = item => { onChange(item ? item.id : emptyValue); setQuery(''); setOpen(false); setActive(0); };
  return <div className="product-search-field">
    <label htmlFor={id}>{label}</label>
    <div className="product-search-control">
      <input id={id} type="text" role="combobox" autoComplete="off" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`} aria-activedescendant={open && matches[active] ? `${id}-option-${active}` : undefined} placeholder={required ? 'Buscar produto por nome ou código' : emptyLabel} disabled={disabled} required={required} value={open ? query : selected?.nome || ''}
        ref={node => { if (node) node.setCustomValidity(required && !selected ? 'Selecione um produto da lista.' : ''); }}
        onFocus={() => { setQuery(''); setActive(0); setOpen(true); }}
        onChange={event => { setQuery(event.target.value); setOpen(true); setActive(0); if (selected) onChange(emptyValue); }}
        onBlur={() => { setOpen(false); setQuery(''); }}
        onKeyDown={event => {
          if (event.key === 'ArrowDown') { event.preventDefault(); setActive(current => open ? Math.min(current + 1, Math.max(0, matches.length - 1)) : 0); setOpen(true); }
          else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(current => Math.max(current - 1, 0)); }
          else if (event.key === 'Enter' && open && matches[active]) { event.preventDefault(); choose(matches[active]); }
          else if (event.key === 'Escape') { setOpen(false); setQuery(''); }
        }} />
      {value && value !== emptyValue && !disabled && <button type="button" className="product-search-clear" aria-label={`Limpar ${label.toLowerCase()}`} onMouseDown={event => event.preventDefault()} onClick={() => choose(null)}>×</button>}
    </div>
    {open && <ul id={`${id}-list`} className="product-search-options" role="listbox" onMouseDown={event => event.preventDefault()}>
      {!required && <li role="option" aria-selected={!selected} onClick={() => choose(null)}>{emptyLabel}</li>}
      {matches.map((item,index) => <li key={item.id} id={`${id}-option-${index}`} role="option" aria-selected={selected?.id === item.id} className={index===active ? 'active' : ''} onMouseEnter={() => setActive(index)} onClick={() => choose(item)}><span>{item.nome}</span>{getDescription && <small>{getDescription(item)}</small>}</li>)}
      {!matches.length && <li className="product-search-empty">Nenhum produto encontrado.</li>}
    </ul>}
  </div>;
}
