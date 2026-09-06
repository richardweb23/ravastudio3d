import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  reaisToCents,
  settlementSuggestion,
  splitAmount,
  splitInstallments,
  summarizeInstallments,
} from "./financeiro.js";

const partners = [
  { id: "r", nome: "Richard", percentual_bp: 5000, ativo: true },
  { id: "x", nome: "Xandy", percentual_bp: 5000, ativo: true },
];

describe("regras financeiras", () => {
  it("converte valores brasileiros para centavos", () => {
    assert.equal(reaisToCents("R$ 1.299,90"), 129990);
    assert.equal(reaisToCents("101,99"), 10199);
  });

  it("divide centavos sem perder o arredondamento", () => {
    const split = splitAmount(10199, partners);
    assert.deepEqual(split.map((item) => item.valor_centavos), [5100, 5099]);
    assert.equal(split.reduce((sum, item) => sum + item.valor_centavos, 0), 10199);
  });

  it("gera parcelas cuja soma é igual ao total", () => {
    assert.deepEqual(splitInstallments(10000, 3), [3334, 3333, 3333]);
  });

  it("separa responsabilidade de quem efetivamente pagou", () => {
    const summary = summarizeInstallments([
      { vencimento: "2026-09-10", valor_centavos: 100000, pago: true, pago_por_socio_id: "r" },
      { vencimento: "2026-09-20", valor_centavos: 100000, pago: true, pago_por_socio_id: "r" },
    ], partners, "2026-09");
    assert.equal(summary.responsibilities[0].valor_centavos, 100000);
    assert.equal(summary.paidByPartner.r, 200000);
    assert.equal(summary.paidByPartner.x, 0);
    const settlement = settlementSuggestion(summary);
    assert.equal(settlement.debtor.nome, "Xandy");
    assert.equal(settlement.creditor.nome, "Richard");
    assert.equal(settlement.amount, 100000);
  });

  it("soma pagamentos de dois sócios na mesma parcela", () => {
    const summary = summarizeInstallments([{
      vencimento: "2026-09-10",
      valor_centavos: 30000,
      pago: true,
      financeiro_pagamentos_parcela: [
        { pago_por_tipo: "socio", socio_id: "r", valor_centavos: 18000 },
        { pago_por_tipo: "socio", socio_id: "x", valor_centavos: 12000 },
      ],
    }], partners, "2026-09");
    assert.equal(summary.paidByPartner.r, 18000);
    assert.equal(summary.paidByPartner.x, 12000);
  });
});
