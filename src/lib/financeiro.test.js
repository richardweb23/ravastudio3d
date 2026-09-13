import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  reaisToCents,
  settlementSuggestion,
  splitAmount,
  splitInstallments,
  summarizeInstallments,
  summarizePartnerInstallments,
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

for (const responsible of ['r', 'x']) {
  it('atribui todo o custo ao sócio ' + responsible, () => {
    const summary = summarizeInstallments([{
      vencimento: '2026-09-10', valor_centavos: 10199, pago: false,
      financeiro_despesas: { responsavel_socio_id: responsible },
    }], partners, '2026-09');
    assert.equal(summary.responsibilities.find(p => p.id === responsible).valor_centavos, 10199);
    assert.equal(summary.responsibilities.find(p => p.id !== responsible).valor_centavos, 0);
  });
}
it('combina despesas individuais, compartilhadas e meses diferentes', () => {
  const summary = summarizeInstallments([
    { vencimento: '2026-09-10', valor_centavos: 10000, financeiro_despesas: { responsavel_socio_id: 'r' } },
    { vencimento: '2026-09-11', valor_centavos: 20000, financeiro_despesas: { responsavel_socio_id: 'x' } },
    { vencimento: '2026-09-12', valor_centavos: 10199, financeiro_despesas: { responsavel_socio_id: null } },
    { vencimento: '2026-10-12', valor_centavos: 90000, financeiro_despesas: { responsavel_socio_id: 'r' } },
  ], partners, '2026-09');
  assert.deepEqual(summary.responsibilities.map(p => p.valor_centavos), [15100, 25099]);
  assert.equal(summary.total, 40199);
});
it('pagamento de despesa exclusiva não gera dívida para o outro sócio', () => {
  const summary = summarizeInstallments([{
    vencimento: '2026-09-10', valor_centavos: 10000, pago: true, pago_por_socio_id: 'r',
    financeiro_despesas: { responsavel_socio_id: 'r' },
  }], partners, '2026-09');
  assert.equal(settlementSuggestion(summary), null);
});

it('filtro Ambos mantém todas as contas e os totais originais', () => {
  const items = [{ vencimento: '2026-09-10', valor_centavos: 10000, financeiro_despesas: { responsavel_socio_id: 'r' } }];
  assert.deepEqual(summarizePartnerInstallments(items, partners, '2026-09'), summarizeInstallments(items, partners, '2026-09'));
});
it('filtra contas individuais e compartilhadas com totais da parte do sócio', () => {
  const items = [
    { id: 'r', vencimento: '2026-09-10', valor_centavos: 10000, pago: true, financeiro_despesas: { responsavel_socio_id: 'r' } },
    { id: 'x', vencimento: '2026-09-10', valor_centavos: 20000, financeiro_despesas: { responsavel_socio_id: 'x' } },
    { id: 'both', vencimento: '2026-09-10', valor_centavos: 30000, financeiro_despesas: { responsavel_socio_id: null } },
    { id: 'next', vencimento: '2026-10-10', valor_centavos: 90000 },
  ];
  const richard = summarizePartnerInstallments(items, partners, '2026-09', 'r');
  assert.deepEqual(richard.items.map(item => item.id), ['r', 'both']);
  assert.equal(richard.total, 25000);
  assert.equal(richard.paid, 10000);
  assert.equal(richard.pending, 15000);
  assert.deepEqual(richard.responsibilities.map(p => p.id), ['r']);
  const xandy = summarizePartnerInstallments(items, partners, '2026-09', 'x');
  assert.deepEqual(xandy.items.map(item => item.id), ['x', 'both']);
  assert.equal(xandy.total, 35000);
  assert.equal(xandy.paid, 0);
  assert.equal(summarizePartnerInstallments([], partners, '2026-09', 'x').total, 0);
});
