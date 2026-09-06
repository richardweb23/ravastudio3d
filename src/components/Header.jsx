import { useEffect } from "react";

export default function Header({ title, subtitle, action }) {
  useEffect(() => {
    if (title !== "Pedidos") return undefined;
    const target = document.querySelector(".orders .panel-title");
    if (!target || target.querySelector(".status-filter-control"))
      return undefined;
    const select = document.createElement("select");
    select.className = "filter-select status-filter-control";
    select.setAttribute("aria-label", "Filtrar pedidos por status");
    [
      ["todos", "Todos os status"],
      ["recebido", "Recebidos"],
      ["em_producao", "Em produção"],
      ["pronto", "Prontos"],
      ["entregue", "Entregues"],
    ].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.append(option);
    });
    const onChange = () =>
      window.dispatchEvent(
        new CustomEvent("rava:pedido-status-filter", {
          detail: select.value,
        }),
      );
    select.addEventListener("change", onChange);
    target.append(select);
    return () => {
      select.removeEventListener("change", onChange);
      select.remove();
    };
  }, [title]);
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </header>
  );
}


