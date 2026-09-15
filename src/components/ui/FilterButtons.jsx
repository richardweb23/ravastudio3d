export default function FilterButtons({ label, value, onChange, options }) {
  return <div className="field-filter" role="group" aria-label={label}>
    <span className="field-filter-label">{label}</span>
    <div className="field-filter-options">{options.map(option => <button type="button" className="field-filter-option" key={option.value} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
      {value === option.value && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>}{option.label}
    </button>)}</div>
  </div>;
}
