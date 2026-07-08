const STATUS_LABELS = {
  placed: "Placed",
  confirmed: "Confirmed",
  preparing: "Preparing",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const TRACKABLE_STATUSES = ["placed", "confirmed", "preparing", "out_for_delivery", "delivered"];

export function StatusTimeline({ currentStatus }) {
  const currentIndex = TRACKABLE_STATUSES.indexOf(currentStatus);

  return (
    <ol className="timeline">
      {TRACKABLE_STATUSES.map((status, index) => {
        const isComplete = currentStatus === "cancelled" ? false : index <= currentIndex;
        return (
          <li
            key={status}
            className={`timeline__item ${isComplete ? "timeline__item--complete" : ""} ${
              currentStatus === "cancelled" ? "timeline__item--cancelled" : ""
            }`}
          >
            <span className="timeline__dot" />
            <div>
              <p>{STATUS_LABELS[status]}</p>
              <small>{status === currentStatus ? "Current status" : "Pending"}</small>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
