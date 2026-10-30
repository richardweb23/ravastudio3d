export const formatMoney = (value) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
export const formatNumber = (value) =>
  Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
export const today = () => new Date().toISOString().slice(0, 10);

export const orderStatusLabel = {
  recebido: "Recebido",
  em_preparacao: "Em preparação",
  em_producao: "Em produção",
  pronto: "Pronto para entrega",
  entregue: "Entregue",
};

