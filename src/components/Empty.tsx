import type { ReactNode } from "react";

export default function Empty({ text }: { text: ReactNode }) {
  return <p className="empty">{text}</p>;
}

