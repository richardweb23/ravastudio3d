export const movementLabels = { entrada: "Entrada", venda: "Venda", retirada: "Retirada / devolução", ajuste: "Ajuste", saldo_inicial: "Saldo inicial" };

export function moneyInputCents(value) {
  const text = String(value ?? "").trim().replace(/^R\$\s*/, "");
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(text) && !/^\d+\.\d{1,2}$/.test(text)) throw new Error("Informe um valor monetário válido, com até duas casas decimais.");
  const normalized = text.includes(",") ? text.replaceAll(".", "").replace(",", ".") : /^\d{1,3}(?:\.\d{3})+$/.test(text) ? text.replaceAll(".", "") : text;
  const [whole, decimal = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > 1000000000) throw new Error("Valor monetário fora do limite permitido.");
  return cents;
}
export function validQuantity(value, available = Infinity, adjustment = false) {
  const quantity = Number(value);
  if (!Number.isSafeInteger(quantity) || quantity === 0 || Math.abs(quantity) > 1000000 || (!adjustment && quantity < 0)) throw new Error("Informe uma quantidade inteira válida.");
  if (!adjustment && quantity > available) throw new Error("Quantidade maior que o estoque disponível.");
  if (adjustment && available + quantity < 0) throw new Error("O ajuste não pode deixar o estoque negativo.");
  return quantity;
}
function sumCents(values) {
  const total = values.reduce((sum, value) => sum + Number(value || 0), 0);
  if (!Number.isSafeInteger(total)) throw new Error("Total monetário fora do limite seguro.");
  return total;
}
export function repasseStatus(sale) {
  if (!sale.acordo_registrado) return "sem_acordo";
  if (Number(sale.repasse_total_centavos) === 0) return "sem_repasse";
  return sale.pagamento_id ? "pago" : "pendente";
}
export const repasseLabels = { pendente: "Pendente", pago: "Pago", sem_repasse: "Sem repasse", sem_acordo: "Sem acordo registrado" };
export function summarizeConsignment({ materiais = [], estoque = [], acordos = [], vendas = [], movimentos = [] }) {
  const ids = new Set([...estoque, ...acordos, ...vendas, ...movimentos].map(row => row.material_id));
  const products = [...ids].map(id => {
    const product = materiais.find(row => row.id === id) || { id, nome: "Produto indisponível" };
    const agreement = acordos.find(row => row.material_id === id);
    const sales = vendas.filter(row => row.material_id === id);
    const movements = movimentos.filter(row => row.material_id === id);
    const available = Number(estoque.find(row => row.material_id === id)?.quantidade || 0);
    return { ...product, acordo: agreement, disponivel: available,
      enviada: movements.filter(row => row.tipo === "entrada").reduce((sum, row) => sum + Number(row.quantidade), 0),
      inicial: movements.filter(row => row.tipo === "saldo_inicial").reduce((sum, row) => sum + Number(row.quantidade), 0),
      vendida: sales.reduce((sum, row) => sum + Number(row.quantidade), 0),
      totalVendido: sumCents(sales.map(row => row.total_centavos)),
      pendente: sumCents(sales.filter(row => repasseStatus(row) === "pendente").map(row => row.repasse_total_centavos)),
      potencial: Math.round(available * Number(agreement?.preco_centavos || 0)),
    };
  }).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return { products, unidades: products.reduce((sum, row) => sum + row.disponivel, 0),
    potencial: sumCents(products.map(row => row.potencial)), vendido: sumCents(vendas.map(row => row.total_centavos)),
    pendente: sumCents(vendas.filter(row => repasseStatus(row) === "pendente").map(row => row.repasse_total_centavos)),
    pago: sumCents(vendas.filter(row => repasseStatus(row) === "pago").map(row => row.repasse_total_centavos)),
  };
}
export function filterConsignmentSales(sales, status = "", start = "", end = "") {
  return sales.filter(sale => (!status || repasseStatus(sale) === status) && (!start || sale.data >= start) && (!end || sale.data <= end));
}
export function localDetailsPage(type, id) { return "localDetalhes:" + type + ":" + id; }
export function parseLocalDetailsPage(page) {
  const match = /^localDetalhes:(local|vendedor):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(page || "");
  return match ? { type: match[1].toLowerCase(), id: match[2] } : null;
}

// Os indicadores da listagem usam o mesmo resumo dos detalhes, agrupado por local.
export function summarizeLocations({ estoque = [], vendas = [] }) {
  const groups = new Map();
  for (const [key, rows] of [["estoque", estoque], ["vendas", vendas]]) {
    for (const row of rows) {
      if (!groups.has(row.local_id)) groups.set(row.local_id, { estoque: [], vendas: [] });
      groups.get(row.local_id)[key].push(row);
    }
  }
  return Object.fromEntries([...groups].map(([id, rows]) => {
    const { unidades, vendido, pendente } = summarizeConsignment(rows);
    return [id, { unidades, vendido, pendente }];
  }));
}
