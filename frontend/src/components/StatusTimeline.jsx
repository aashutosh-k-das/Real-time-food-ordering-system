import { Check, X } from "lucide-react";

import { STATUS_META, TRACKABLE_STATUSES, formatTime } from "../lib/orderStatus";

export function StatusTimeline({ currentStatus, events = [] }) {
  const isCancelled = currentStatus === "cancelled";
  const reachedAt = {};
  for (const event of events) {
    if (!reachedAt[event.status]) reachedAt[event.status] = event.created_at;
  }
  const currentIndex = isCancelled
    ? Math.max(...TRACKABLE_STATUSES.map((status, index) => (reachedAt[status] ? index : -1)))
    : TRACKABLE_STATUSES.indexOf(currentStatus);
  const steps = isCancelled ? [...TRACKABLE_STATUSES.slice(0, currentIndex + 1), "cancelled"] : TRACKABLE_STATUSES;

  return (
    <ol className="timeline">
      {steps.map((status, index) => {
        const state =
          status === "cancelled"
            ? "cancelled"
            : status === currentStatus
              ? "current"
              : index <= currentIndex
                ? "complete"
                : "upcoming";
        return (
          <li key={status} className={`timeline__item timeline__item--${state}`}>
            <span className="timeline__dot">
              {state === "complete" || (state === "current" && status === "delivered") ? <Check size={12} /> : null}
              {state === "cancelled" ? <X size={12} /> : null}
            </span>
            <div className="timeline__body">
              <p>{STATUS_META[status].label}</p>
              <small>
                {reachedAt[status]
                  ? formatTime(reachedAt[status])
                  : state === "current"
                    ? "In progress"
                    : state === "upcoming"
                      ? "Up next"
                      : ""}
              </small>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
