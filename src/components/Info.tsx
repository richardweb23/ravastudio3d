import type { ReactNode } from "react";

export default function Info({ title, text }: { title: ReactNode; text: ReactNode }) {
  return (
    <section className="panel info">
      <h2>{title}</h2>
      <p>{text}</p>
    </section>
  );
}

