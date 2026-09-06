import { formatNumber as fmtNumber } from "../lib/formatters.js";

export default function MaterialSelect({ materiais, value, onChange }) {
  return (
    <label>
      Produto
      <select value={value} onChange={(e) => onChange(e.target.value)} required>
        <option value="">Selecione um produto</option>
        {materiais.map((item) => (
          <option value={item.id} key={item.id}>
            {item.nome} — {fmtNumber(item.quantidade_atual)}
          </option>
        ))}
      </select>
    </label>
  );
}

