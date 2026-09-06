export const DEFAULT_PARTNERS = Object.freeze([
  { id: "richard", nome: "Richard", percentual_bp: 5000 },
  { id: "xandy", nome: "Xandy", percentual_bp: 5000 },
]);

export function normalizeCents(value) {
  const cents = Number(value);
  return Number.isFinite(cents) ? Math.round(cents) : 0;
}

export function reaisToCents(value) {
  if (typeof value === "number") return Math.round(value * 100);
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s|R\$/gi, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

export function centsToInput(cents) {
  return (normalizeCents(cents) / 100).toFixed(2);
}

export function formatBRLCents(cents) {
  return (normalizeCents(cents) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function splitAmount(totalCents, partners = DEFAULT_PARTNERS) {
  const total = normalizeCents(totalCents);
  const active = partners.filter((partner) => partner.ativo !== false);
  if (!active.length) return [];
  const percentageTotal = active.reduce(
    (sum, partner) => sum + Number(partner.percentual_bp || 0),
    0,
  );
  if (percentageTotal !== 10000) {
    throw new Error("A soma da participação dos sócios deve ser 100%.");
  }
  let allocated = 0;
  return active.map((partner, index) => {
    const value = index === active.length - 1
      ? total - allocated
      : Math.round((total * Number(partner.percentual_bp)) / 10000);
    allocated += value;
    return { ...partner, valor_centavos: value };
  });
}

export function splitInstallments(totalCents, quantity) {
  const total = normalizeCents(totalCents);
  const count = Math.max(1, Math.trunc(Number(quantity) || 1));
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

export function installmentStatus(installment, today = new Date()) {
  if (installment.pago) return "pago";
  const due = new Date(`${installment.vencimento}T12:00:00`);
  const comparison = new Date(today);
  comparison.setHours(0, 0, 0, 0);
  return due < comparison ? "vencido" : "pendente";
}

export function monthKey(date) {
  return String(date || "").slice(0, 7);
}

export function monthLabel(key) {
  if (!/^\d{4}-\d{2}$/.test(key || "")) return "";
  const [year, month] = key.split("-").map(Number);
  const label = new Date(year, month - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function shiftMonth(key, offset) {
  const [year, month] = key.split("-").map(Number);
  const shifted = new Date(year, month - 1 + offset, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}`;
}

export function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function summarizeInstallments(installments, partners, selectedMonth) {
  const inMonth = installments.filter((item) => monthKey(item.vencimento) === selectedMonth);
  const total = inMonth.reduce((sum, item) => sum + normalizeCents(item.valor_centavos), 0);
  const paid = inMonth
    .filter((item) => item.pago)
    .reduce((sum, item) => sum + normalizeCents(item.valor_centavos), 0);
  const overdue = inMonth
    .filter((item) => installmentStatus(item) === "vencido")
    .reduce((sum, item) => sum + normalizeCents(item.valor_centavos), 0);
  const responsibilities = splitAmount(total, partners);
  const paidByPartner = Object.fromEntries(
    partners.map((partner) => [partner.id, inMonth.reduce((sum, item) => {
      if (!item.pago) return sum;
      if (Array.isArray(item.financeiro_pagamentos_parcela)) {
        return sum + item.financeiro_pagamentos_parcela
          .filter((payment) => payment.pago_por_tipo === "socio" && payment.socio_id === partner.id)
          .reduce((paymentSum, payment) => paymentSum + normalizeCents(payment.valor_centavos), 0);
      }
      return sum + (item.pago_por_socio_id === partner.id ? normalizeCents(item.valor_centavos) : 0);
    }, 0)]),
  );
  return {
    items: inMonth,
    total,
    paid,
    pending: total - paid,
    overdue,
    responsibilities,
    paidByPartner,
  };
}

export function settlementSuggestion(summary) {
  const partnerBalances = summary.responsibilities.map((responsibility) => ({
    ...responsibility,
    pago_centavos: summary.paidByPartner[responsibility.id] || 0,
    saldo_centavos: (summary.paidByPartner[responsibility.id] || 0) - responsibility.valor_centavos,
  }));
  if (partnerBalances.length !== 2) return null;
  const creditor = partnerBalances.find((partner) => partner.saldo_centavos > 0);
  const debtor = partnerBalances.find((partner) => partner.saldo_centavos < 0);
  if (!creditor || !debtor) return null;
  const amount = Math.min(creditor.saldo_centavos, Math.abs(debtor.saldo_centavos));
  return amount > 0 ? { creditor, debtor, amount } : null;
}
