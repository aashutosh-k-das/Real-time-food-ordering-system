import { STATUS_META, statusLabel } from "../lib/orderStatus";

export function StatusBadge({ status }) {
  const tone = STATUS_META[status]?.tone ?? "info";
  return (
    <span className={`badge badge--${tone}`}>
      <span className="badge__dot" />
      {statusLabel(status)}
    </span>
  );
}
