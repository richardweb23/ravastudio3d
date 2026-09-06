export default function Info({ title, text }) {
  return (
    <section className="panel info">
      <h2>{title}</h2>
      <p>{text}</p>
    </section>
  );
}

