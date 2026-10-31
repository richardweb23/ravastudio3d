import { Children, isValidElement, useId, useState } from 'react';
import './search-select.css';

const textOf = children => Children.toArray(children).map(child => isValidElement(child) ? textOf(child.props.children) : String(child)).join('');
const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

export default function SearchSelect({ children, value, onChange, name, required = false, disabled = false, autoFocus, id: suppliedId, className = '', 'aria-label': ariaLabel, 'aria-describedby': describedBy }) {
  const generatedId = useId();
  const id = suppliedId || generatedId;
  const [open, setOpen] = useState(false), [query, setQuery] = useState(''), [active, setActive] = useState(0);
  const options = Children.toArray(children).filter(child => isValidElement(child) && child.type === 'option').map(child => ({ value: String(child.props.value ?? textOf(child.props.children)), label: textOf(child.props.children), disabled: Boolean(child.props.disabled) }));
  const selected = options.find(option => option.value === String(value ?? ''));
  const matches = options.filter(option => normalize(option.label).includes(normalize(query)));
  const available = matches.filter(option => !option.disabled);
  const current = available[Math.min(active, Math.max(0, available.length - 1))];
  const choose = option => {
    if (!option || option.disabled) return;
    const target = { name, value: option.value };
    onChange?.({ target, currentTarget: target });
    setOpen(false); setQuery(''); setActive(0);
  };
  const emptyOption = options.find(option => option.value === '');
  return <span className={`shared-select ${className}`}>
    <input id={id} name={name} autoFocus={autoFocus} disabled={disabled} required={required} role="combobox" aria-label={ariaLabel} aria-describedby={describedBy} aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`} aria-activedescendant={open && current ? `${id}-option-${options.indexOf(current)}` : undefined} autoComplete="off" placeholder={emptyOption?.label || 'Selecione uma opção'} value={open ? query : selected?.label || ''}
      ref={node => { if (node) node.setCustomValidity(required && (!selected || !selected.value) ? 'Selecione uma opção da lista.' : ''); }}
      onFocus={() => { setQuery(''); setActive(0); setOpen(true); }}
      onChange={event => { setQuery(event.target.value); setActive(0); setOpen(true); }}
      onBlur={() => { setOpen(false); setQuery(''); }}
      onKeyDown={event => {
        if(event.key==='ArrowDown'){ event.preventDefault(); setActive(index => open ? Math.min(index+1,Math.max(0,available.length-1)) : 0); setOpen(true); }
        else if(event.key==='ArrowUp'){event.preventDefault(); setActive(index => Math.max(0,index-1));}
        else if(event.key==='Enter' && open && current){event.preventDefault(); choose(current);}
        else if(event.key==='Escape' && open){event.preventDefault(); event.stopPropagation(); setOpen(false); setQuery('');}
      }} />
    <svg className="shared-select-arrow" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 10 5 5 5-5" /></svg>
    {open && <span className="shared-select-menu" id={`${id}-list`} role="listbox" onMouseDown={event => event.preventDefault()}>
      {matches.map(option => <span role="option" key={option.value} id={`${id}-option-${options.indexOf(option)}`} aria-selected={option.value===String(value ?? '')} aria-disabled={option.disabled || undefined} className={`${option === current ? 'active' : ''} ${option.disabled ? 'disabled' : ''}`} onMouseEnter={() => { const index=available.indexOf(option); if(index>=0)setActive(index); }} onClick={() => choose(option)}>{option.label}</span>)}
      {!matches.length && <span className="shared-select-empty">Nenhuma opção encontrada.</span>}
    </span>}
  </span>;
}
