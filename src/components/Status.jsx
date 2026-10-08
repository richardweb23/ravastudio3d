import StatusBadge from './StatusBadge.jsx';
import { orderStatusLabel as statusLabel } from "../lib/formatters.js";

export default function Status({ value }) {
  return <StatusBadge value={value}>{statusLabel[value]}</StatusBadge>;
}

