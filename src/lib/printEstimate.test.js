import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addMinutes,
  createLocalDateTime,
  createPrintQueue,
  durationToMinutes,
  formatDurationCompact,
  formatDurationFriendly,
} from "./printEstimate.js";

function localDate(value) {
  const [date, time] = value.split(" ");
  return createLocalDateTime(date, time);
}

function parts(date) {
  return [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
  ];
}

describe("estimativa de impressão", () => {
  it("calcula uma impressão que termina no mesmo dia", () => {
    assert.deepEqual(parts(addMinutes(localDate("2026-09-06 10:00"), 399)), [
      2026, 9, 6, 16, 39,
    ]);
  });

  it("calcula uma impressão atravessando a meia-noite", () => {
    assert.deepEqual(parts(addMinutes(localDate("2026-09-06 23:18"), 399)), [
      2026, 9, 7, 5, 57,
    ]);
  });

  it("aceita duração superior a 24 horas", () => {
    const duration = durationToMinutes(52, 30);
    assert.equal(duration, 3_150);
    assert.equal(formatDurationCompact(duration), "52h30min");
    assert.equal(formatDurationFriendly(duration), "2 dias, 4 horas e 30 minutos");
    assert.deepEqual(parts(addMinutes(localDate("2026-09-06 23:18"), duration)), [
      2026, 9, 9, 3, 48,
    ]);
  });

  it("calcula uma impressão atravessando a mudança de mês", () => {
    assert.deepEqual(parts(addMinutes(localDate("2026-01-31 23:30"), 120)), [
      2026, 2, 1, 1, 30,
    ]);
  });

  it("calcula uma impressão atravessando a mudança de ano", () => {
    assert.deepEqual(parts(addMinutes(localDate("2026-12-31 23:30"), 120)), [
      2027, 1, 1, 1, 30,
    ]);
  });

  it("gera uma fila de impressões consecutivas", () => {
    const queue = createPrintQueue(localDate("2026-09-06 23:18"), 399, 3);
    assert.equal(queue.items.length, 3);
    assert.deepEqual(parts(queue.items[1].start), [2026, 9, 7, 5, 57]);
    assert.deepEqual(parts(queue.completion), [2026, 9, 7, 19, 15]);
    assert.equal(queue.totalMinutes, 1_197);
  });

  it("considera o intervalo somente entre as impressões", () => {
    const queue = createPrintQueue(localDate("2026-09-06 10:00"), 60, 3, 10);
    assert.deepEqual(parts(queue.items[1].start), [2026, 9, 6, 11, 10]);
    assert.deepEqual(parts(queue.completion), [2026, 9, 6, 13, 20]);
    assert.equal(queue.totalMinutes, 200);
  });

  it("valida minutos e datas inexistentes", () => {
    assert.equal(durationToMinutes(2, 60), null);
    assert.equal(durationToMinutes(-1, 30), null);
    assert.equal(createLocalDateTime("2026-02-30", "10:00"), null);
  });
});
