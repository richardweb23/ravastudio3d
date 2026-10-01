import { useEffect, useState } from "react";
import { supabase } from "../../supabase.js";
import { currentMonthKey, monthLabel, shiftMonth } from "../../lib/financeiro.js";

export default function PreviousMonthPayablesAlert({ page, revision }) {
  const [pendingMonth, setPendingMonth] = useState(null);

  useEffect(() => {
    let active = true;
    let request = 0;
    async function checkPendingAccounts() {
      const currentRequest = ++request;
      const currentMonth = currentMonthKey();
      const previousMonth = shiftMonth(currentMonth, -1);
      try {
        const { data, error } = await supabase.from("financeiro_parcelas")
          .select("id")
          .eq("pago", false)
          .gte("vencimento", previousMonth + "-01")
          .lt("vencimento", currentMonth + "-01")
          .limit(1);
        if (!active || currentRequest !== request) return;
        if (error) throw error;
        setPendingMonth(data?.length ? previousMonth : null);
      } catch (error) {
        if (active && currentRequest === request) {
          console.error("Não foi possível verificar as contas do mês anterior.", error);
        }
      }
    }
    checkPendingAccounts();
    const interval = window.setInterval(checkPendingAccounts, 60000);
    window.addEventListener("focus", checkPendingAccounts);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", checkPendingAccounts);
    };
  }, [page, revision]);

  if (!pendingMonth) return null;
  return (
    <div className="previous-month-payables-alert" role="status">
      <strong>Existem contas a pagar no mês anterior.</strong>
      <span>Há contas em aberto com vencimento em {monthLabel(pendingMonth).toLocaleLowerCase("pt-BR")}. Confira em Contas a pagar.</span>
    </div>
  );
}
