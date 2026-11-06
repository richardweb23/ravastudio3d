import StatusBadge from './StatusBadge.tsx';
import { orderStatusLabel as statusLabel } from "../lib/formatters.js";

export default function Status({ value }: { value: keyof typeof statusLabel }) {
  return <StatusBadge value={value}>{statusLabel[value]}</StatusBadge>;
}

