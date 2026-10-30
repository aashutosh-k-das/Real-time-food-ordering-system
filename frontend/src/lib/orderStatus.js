export const STATUS_META = {
  placed: { label: "Placed", tone: "info" },
  confirmed: { label: "Confirmed", tone: "info" },
  preparing: { label: "Preparing", tone: "warm" },
  out_for_delivery: { label: "Out for delivery", tone: "accent" },
  delivered: { label: "Delivered", tone: "good" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

export const TRACKABLE_STATUSES = ["placed", "confirmed", "preparing", "out_for_delivery", "delivered"];

export function statusLabel(status) {
  return STATUS_META[status]?.label ?? status?.replaceAll("_", " ") ?? "";
}

export function isActiveStatus(status) {
  return status !== "delivered" && status !== "cancelled";
}

export function formatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatRelative(value) {
  if (!value) return "";
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(value).toLocaleDateString([], { day: "numeric", month: "short" });
}
