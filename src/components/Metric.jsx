export default function Metric({ label, value, danger }) {
  return (
    <section className={"metric " + (danger ? "danger" : "")}>
      <span>{label}</span>
      <strong>{value}</strong>
    </section>
  );
}

