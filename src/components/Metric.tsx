import type { ReactNode } from "react";

export default function Metric({ label, value, danger }: { label: ReactNode; value: ReactNode; danger?: boolean }) {
  return (
    <section className={"metric " + (danger ? "danger" : "")}>
      <span>{label}</span>
      <strong>{value}</strong>
    </section>
  );
}

