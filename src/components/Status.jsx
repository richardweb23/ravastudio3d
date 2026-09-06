import { orderStatusLabel as statusLabel } from "../lib/formatters.js";

export default function Status({ value }) {
  return <span className={`status ${value}`}>{statusLabel[value]}</span>;
}

