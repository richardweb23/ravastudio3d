import { useMemo, useState } from "react";
import { calculateScale, parseMeasurement } from "../lib/scale.js";
import Header from "./Header.jsx";

const SIZES = [5, 10, 12, 15, 20, 25, 30, 35, 40, 50];
const formatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const format = (value) =>
  Number.isFinite(value) ? formatter.format(value) : "—";
const signed = (value, suffix = "") => {
  if (!Number.isFinite(value)) return "—";
  const normalized = Math.abs(value) < 0.005 ? 0 : value;
  return `${normalized > 0 ? "+" : ""}${format(normalized)}${suffix}`;
};
function validation(value, parsed, allowZero = false) {
  if (!value.trim()) return "";
  if (parsed === null) return "Informe um número válido.";
  if (parsed < 0 || (!allowZero && parsed === 0))
    return allowZero
      ? "O tamanho não pode ser negativo."
      : "O tamanho deve ser maior que zero.";
  return "";
}

export default function CalculadoraEscala() {
  const [currentInput, setCurrentInput] = useState("");
  const [desiredInput, setDesiredInput] = useState("");
  const currentSize = parseMeasurement(currentInput);
  const desiredSize = parseMeasurement(desiredInput);
  const currentError = validation(currentInput, currentSize);
  const desiredError = validation(desiredInput, desiredSize, true);
  const result = useMemo(
    () => calculateScale(currentSize, desiredSize),
    [currentSize, desiredSize],
  );
  const suggestions = useMemo(
    () =>
      SIZES.map((size) => ({
        size,
        result: calculateScale(currentSize, size),
      })),
    [currentSize],
  );
  const stateLabel = result
    ? {
        increase: "Aumento",
        reduction: "Redução",
        original: "Tamanho original",
      }[result.state]
    : "Aguardando medidas";

  return (
    <div className="scale-page">
      <Header
        title="Calculadora de Escala"
        subtitle="Descubra a escala exata para usar no Bambu Studio."
      />
      <div className="scale-layout">
        <section className="panel scale-form form">
          <h2>Medidas do modelo</h2>
          <p>Informe as medidas em centímetros usando vírgula ou ponto.</p>
          <label>
            Tamanho atual (cm)
            <input
              type="text"
              inputMode="decimal"
              placeholder="Ex.: 12,5"
              value={currentInput}
              onChange={(event) => setCurrentInput(event.target.value)}
              aria-invalid={Boolean(currentError)}
              aria-describedby="current-size-error"
            />
            <small id="current-size-error" className="scale-error">
              {currentError}
            </small>
          </label>
          <label>
            Tamanho desejado (cm)
            <input
              type="text"
              inputMode="decimal"
              placeholder="Ex.: 20"
              value={desiredInput}
              onChange={(event) => setDesiredInput(event.target.value)}
              aria-invalid={Boolean(desiredError)}
              aria-describedby="desired-size-error"
            />
            <small id="desired-size-error" className="scale-error">
              {desiredError}
            </small>
          </label>
        </section>
        <section
          className={`panel scale-result ${result?.state || "neutral"}`}
          aria-live="polite"
        >
          <span className="scale-state">{stateLabel}</span>
          <p>Escala no Bambu Studio</p>
          <strong>{result ? `${format(result.scale)}%` : "—"}</strong>
          <div className="scale-secondary-results">
            <div>
              <span>Alteração percentual</span>
              <b>
                {result
                  ? result.state === "original"
                    ? "Tamanho original"
                    : signed(result.percentageChange, "%")
                  : "—"}
              </b>
            </div>
            <div>
              <span>Diferença física</span>
              <b>{result ? signed(result.physicalDifference, " cm") : "—"}</b>
            </div>
          </div>
          {!result && !currentError && !desiredError && (
            <small>Preencha os dois tamanhos para ver o resultado.</small>
          )}
        </section>
      </div>
      <section className="panel table-panel scale-suggestions">
        <div className="scale-section-heading">
          <h2>Sugestões de Tamanhos</h2>
          <p>Selecione um tamanho para preencher a medida desejada.</p>
        </div>
        {!currentSize || currentSize <= 0 ? (
          <p className="empty">
            Informe o tamanho atual para calcular as sugestões.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tamanho desejado</th>
                  <th>Escala no Bambu Studio</th>
                  <th>Alteração</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map(({ size, result: suggestion }) => {
                  const selected = desiredSize === size;
                  return (
                    <tr className={selected ? "selected" : ""} key={size}>
                      <td>
                        <button
                          className="scale-size-button"
                          onClick={() => setDesiredInput(String(size))}
                          aria-pressed={selected}
                        >
                          {format(size)} cm
                        </button>
                      </td>
                      <td>{format(suggestion.scale)}%</td>
                      <td>
                        {suggestion.state === "original"
                          ? "Original"
                          : signed(suggestion.percentageChange, "%")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

