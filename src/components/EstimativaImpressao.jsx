import { useMemo, useState } from "react";
import {
  addMinutes,
  calendarDayDifference,
  createAlternativeSchedule,
  createLocalDateTime,
  createPrintQueue,
  durationToMinutes,
  formatDurationCompact,
  formatDurationFriendly,
} from "../lib/printEstimate.js";
import Header from "./Header.jsx";

const quickDurations = [1, 2, 4, 6, 8, 12, 24];
const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
});
const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "long" });

function pad(value) {
  return String(value).padStart(2, "0");
}

function localInputValues(date = new Date()) {
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function formatLongDateTime(date) {
  return `${capitalize(weekdayFormatter.format(date))}, ${dateFormatter.format(date)} às ${timeFormatter.format(date)}`;
}

function formatShortDateTime(date) {
  return `${shortDateFormatter.format(date)} ${timeFormatter.format(date)}`;
}

function dayOffsetLabel(dayOffset) {
  if (!dayOffset) return "Mesmo dia";
  return `+${dayOffset} ${dayOffset === 1 ? "dia" : "dias"}`;
}

function isWholeNumber(value, minimum = 0) {
  return /^\d+$/.test(String(value).trim()) && Number(value) >= minimum;
}

export default function EstimativaImpressao() {
  const initial = useMemo(() => localInputValues(), []);
  const [startDateInput, setStartDateInput] = useState(initial.date);
  const [startTimeInput, setStartTimeInput] = useState(initial.time);
  const [hoursInput, setHoursInput] = useState("");
  const [minutesInput, setMinutesInput] = useState("0");
  const [quantityInput, setQuantityInput] = useState("1");
  const [pauseInput, setPauseInput] = useState("0");

  const start = useMemo(
    () => createLocalDateTime(startDateInput, startTimeInput),
    [startDateInput, startTimeInput],
  );
  const durationMinutes = useMemo(
    () => durationToMinutes(hoursInput, minutesInput === "" ? 0 : minutesInput),
    [hoursInput, minutesInput],
  );
  const end = useMemo(
    () => (start && durationMinutes > 0 ? addMinutes(start, durationMinutes) : null),
    [start, durationMinutes],
  );
  const alternatives = useMemo(
    () => (start && durationMinutes > 0
      ? createAlternativeSchedule(start, durationMinutes)
      : []),
    [start, durationMinutes],
  );

  const validQuantity =
    isWholeNumber(quantityInput, 1) && Number(quantityInput) <= 100;
  const validPause = isWholeNumber(pauseInput || "0");
  const queue = useMemo(
    () =>
      start && durationMinutes > 0 && validQuantity && validPause
        ? createPrintQueue(
            start,
            durationMinutes,
            Number(quantityInput),
            Number(pauseInput || 0),
          )
        : null,
    [
      durationMinutes,
      pauseInput,
      quantityInput,
      start,
      validPause,
      validQuantity,
    ],
  );

  const hoursError =
    hoursInput !== "" && !isWholeNumber(hoursInput)
      ? "Informe horas inteiras, sem limite de 24 horas."
      : "";
  const minutesError =
    minutesInput !== "" &&
    (!isWholeNumber(minutesInput) || Number(minutesInput) > 59)
      ? "Informe minutos entre 0 e 59."
      : "";

  function useNow() {
    const now = localInputValues();
    setStartDateInput(now.date);
    setStartTimeInput(now.time);
  }

  function addQuickDuration(hours) {
    const current = durationMinutes && durationMinutes > 0 ? durationMinutes : 0;
    const total = current + hours * 60;
    setHoursInput(String(Math.floor(total / 60)));
    setMinutesInput(String(total % 60));
  }

  return (
    <div className="print-estimate-page">
      <Header
        title="Estimativa de Impressão"
        subtitle="Planeje o término de uma impressão e organize produções consecutivas."
      />

      <div className="print-estimate-grid">
        <section className="panel form print-input-card">
          <div className="print-card-heading">
            <div>
              <span>01</span>
              <h2>Início</h2>
            </div>
            <button className="secondary-button" type="button" onClick={useNow}>
              Usar agora
            </button>
          </div>
          <label>
            Data de início
            <input
              type="date"
              value={startDateInput}
              onChange={(event) => setStartDateInput(event.target.value)}
            />
          </label>
          <label>
            Hora de início
            <input
              type="time"
              value={startTimeInput}
              onChange={(event) => setStartTimeInput(event.target.value)}
            />
          </label>
        </section>

        <section className="panel form print-input-card">
          <div className="print-card-heading">
            <div>
              <span>02</span>
              <h2>Duração</h2>
            </div>
          </div>
          <div className="print-duration-fields">
            <label>
              Horas
              <input
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                placeholder="Ex.: 6"
                value={hoursInput}
                onChange={(event) => setHoursInput(event.target.value)}
                aria-invalid={Boolean(hoursError)}
              />
              <small className="print-field-error">{hoursError}</small>
            </label>
            <label>
              Minutos
              <input
                type="number"
                inputMode="numeric"
                min="0"
                max="59"
                step="1"
                value={minutesInput}
                onChange={(event) => setMinutesInput(event.target.value)}
                aria-invalid={Boolean(minutesError)}
              />
              <small className="print-field-error">{minutesError}</small>
            </label>
          </div>
          <div className="print-shortcuts" aria-label="Atalhos de duração">
            {quickDurations.map((hours) => (
              <button
                type="button"
                key={hours}
                onClick={() => addQuickDuration(hours)}
              >
                +{hours}h
              </button>
            ))}
          </div>
        </section>

        <section className="panel print-result-card" aria-live="polite">
          <span className="print-result-eyebrow">Previsão de término</span>
          {end ? (
            <>
              <strong>{dateFormatter.format(end)}</strong>
              <b>às {timeFormatter.format(end)}</b>
              <div className="print-result-duration">
                <span>Tempo de impressão</span>
                <b>{formatDurationCompact(durationMinutes)}</b>
                <small>{formatDurationFriendly(durationMinutes)}</small>
              </div>
            </>
          ) : (
            <div className="print-result-empty">
              <strong>—</strong>
              <p>Informe uma duração maior que zero para calcular.</p>
            </div>
          )}
        </section>
      </div>

      <section className="panel print-timeline-panel">
        <div className="print-section-heading">
          <div>
            <span>Resumo</span>
            <h2>Janela da impressão</h2>
          </div>
          {end && (
            <span className="print-day-span">
              {dayOffsetLabel(calendarDayDifference(start, end))}
            </span>
          )}
        </div>
        {end ? (
          <div className="print-timeline">
            <article>
              <span>Início da impressão</span>
              <strong>{formatLongDateTime(start)}</strong>
            </article>
            <span className="print-timeline-arrow" aria-hidden="true">→</span>
            <article>
              <span>Término previsto</span>
              <strong>{formatLongDateTime(end)}</strong>
            </article>
          </div>
        ) : (
          <p className="empty">O resumo aparecerá assim que a duração for informada.</p>
        )}
      </section>

      <section className="panel table-panel print-alternatives-panel">
        <div className="print-section-heading">
          <div>
            <span>Simulador</span>
            <h2>Outros horários de início</h2>
          </div>
          {durationMinutes > 0 && (
            <small>Duração considerada: {formatDurationCompact(durationMinutes)}</small>
          )}
        </div>
        {alternatives.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Início</th>
                  <th>Término</th>
                  <th>Mudança de data</th>
                </tr>
              </thead>
              <tbody>
                {alternatives.map((item) => (
                  <tr key={item.start.getHours()}>
                    <td>{timeFormatter.format(item.start)}</td>
                    <td>
                      <strong>{timeFormatter.format(item.end)}</strong>
                      <small>{dateFormatter.format(item.end)}</small>
                    </td>
                    <td>
                      <span className={item.dayOffset ? "print-offset changed" : "print-offset"}>
                        {dayOffsetLabel(item.dayOffset)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">Informe a duração para comparar outros horários.</p>
        )}
      </section>

      <section className="panel print-queue-panel">
        <div className="print-section-heading">
          <div>
            <span>Planejamento</span>
            <h2>Fila de Impressões</h2>
          </div>
          {queue && <small>{queue.items.length} {queue.items.length === 1 ? "impressão" : "impressões"}</small>}
        </div>

        <div className="print-queue-controls form">
          <div className="print-readonly-field">
            <span>Duração por impressão</span>
            <strong>
              {durationMinutes > 0 ? formatDurationCompact(durationMinutes) : "—"}
            </strong>
          </div>
          <label>
            Quantidade de impressões
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="100"
              step="1"
              value={quantityInput}
              onChange={(event) => setQuantityInput(event.target.value)}
              aria-invalid={!validQuantity}
            />
            {!validQuantity && (
              <small className="print-field-error">Informe de 1 a 100 impressões.</small>
            )}
          </label>
          <label>
            Tempo entre impressões
            <span className="print-input-suffix">
              <input
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={pauseInput}
                onChange={(event) => setPauseInput(event.target.value)}
                aria-invalid={!validPause}
              />
              <small>min</small>
            </span>
            {!validPause && (
              <small className="print-field-error">Informe minutos inteiros.</small>
            )}
          </label>
        </div>

        {queue ? (
          <>
            <div className="print-queue-summary">
              <div>
                <span>Tempo total da fila</span>
                <strong>{formatDurationFriendly(queue.totalMinutes)}</strong>
              </div>
              <div>
                <span>Conclusão total prevista</span>
                <strong>{dateFormatter.format(queue.completion)} às {timeFormatter.format(queue.completion)}</strong>
              </div>
            </div>
            <div className="print-queue-list">
              {queue.items.map((item) => (
                <article key={item.number}>
                  <span className="print-queue-number">{pad(item.number)}</span>
                  <div>
                    <span>Impressão {item.number}</span>
                    <strong>
                      {formatShortDateTime(item.start)}
                      <span aria-hidden="true">→</span>
                      {formatShortDateTime(item.end)}
                    </strong>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <p className="empty">
            Informe a duração e os dados da fila para visualizar o planejamento.
          </p>
        )}
      </section>
    </div>
  );
}
