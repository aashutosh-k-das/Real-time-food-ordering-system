import { startTransition, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bike,
  ChefHat,
  CircleAlert,
  CircleCheck,
  Clock3,
  LogOut,
  LocateFixed,
  MapPin,
  Minus,
  PackageCheck,
  Plus,
  Radio,
  RefreshCcw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  Utensils,
  X,
  XCircle,
  Zap,
} from "lucide-react";

import {
  fetchCurrentUser,
  fetchMenu,
  fetchOrder,
  fetchOrderEvents,
  fetchOrders,
  fetchRestaurants,
  login,
  placeOrder,
  updateCourierLocation,
  updateOrderStatus,
} from "./api/client";
import { FoodGuide } from "./components/FoodGuide";
import { LocationMap } from "./components/LocationMap";
import { StatusBadge } from "./components/StatusBadge";
import { StatusTimeline } from "./components/StatusTimeline";
import { useOrderSocket } from "./hooks/useOrderSocket";
import { resolveLiveLocation } from "./lib/liveLocation";
import { formatRelative, formatTime, isActiveStatus, statusLabel } from "./lib/orderStatus";

const SESSION_KEY = "food_ordering_session";
const DELIVERY_FEE_MINOR = 499;
const MAX_ITEM_QUANTITY = 20;
const LOW_STOCK_THRESHOLD = 5;
const MIN_ADDRESS_LENGTH = 10;
const DEMO_USERS = {
  customer: { email: "customer@example.com", password: "portfolio123" },
  restaurant: { email: "restaurant@example.com", password: "portfolio123" },
  delivery_partner: { email: "delivery@example.com", password: "portfolio123" },
};
const ROLE_BLURBS = {
  customer: "Browse, order and track",
  restaurant: "Run the kitchen queue",
  delivery_partner: "Pick up and deliver",
};
const INITIAL_DELIVERY = {
  deliveryAddress: "221B Fleet Street, Bengaluru",
  deliveryLatitude: 12.9716,
  deliveryLongitude: 77.5946,
};
const ACTION_ICONS = {
  confirmed: CircleCheck,
  preparing: ChefHat,
  out_for_delivery: Truck,
  delivered: PackageCheck,
  cancelled: XCircle,
};
const ACTION_LABELS = {
  confirmed: "Accept order",
  preparing: "Start preparing",
  out_for_delivery: "Hand to courier",
  delivered: "Mark delivered",
  cancelled: "Cancel order",
};

function formatCurrency(amountMinor) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format((amountMinor ?? 0) / 100);
}

function roleLabel(role) {
  if (role === "delivery_partner") return "Delivery Partner";
  return role ? role[0].toUpperCase() + role.slice(1) : "Guest";
}

function initials(name) {
  return (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function hueFor(text) {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

function pluralize(count, noun) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function shortId(id) {
  return `#${id.slice(0, 8)}`;
}

function etaLabel(order) {
  if (!order) return "—";
  if (order.status === "delivered") return "Arrived";
  if (order.status === "cancelled") return "—";
  return order.eta_minutes ? `${order.eta_minutes} min` : "Estimating";
}

function RoleIcon({ role, size = 18 }) {
  if (role === "restaurant") return <Utensils size={size} />;
  if (role === "delivery_partner") return <Bike size={size} />;
  return <ShoppingBag size={size} />;
}

function nextActionsFor(role, status) {
  if (role === "restaurant") {
    if (status === "placed") return ["confirmed", "cancelled"];
    if (status === "confirmed") return ["preparing", "cancelled"];
    if (status === "preparing") return ["out_for_delivery", "cancelled"];
  }
  if (role === "delivery_partner" && status === "out_for_delivery") return ["delivered"];
  return [];
}

function buildLiveEvent(message) {
  if (!message.status) return null;
  return {
    status: message.status,
    actor_user_id: null,
    metadata: {
      live_message: message.message,
      actor_role: message.actor_role,
    },
    created_at: message.emitted_at,
  };
}

function readStoredSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function PanelHeader({ eyebrow, title, aside }) {
  return (
    <div className="panel__header">
      <div className="panel__title">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
      </div>
      {aside ? <div className="panel__aside">{aside}</div> : null}
    </div>
  );
}

function LiveIndicator({ socketState }) {
  const label = socketState === "open" ? "Live" : socketState === "connecting" ? "Connecting" : "Offline";
  return (
    <span className={`live live--${socketState}`} title={`WebSocket ${socketState}`}>
      <span className="live__dot" />
      {label}
    </span>
  );
}

const PREVIEW_STEPS = [
  { status: "placed", eta: 32 },
  { status: "confirmed", eta: 28 },
  { status: "preparing", eta: 21 },
  { status: "out_for_delivery", eta: 9 },
  { status: "delivered", eta: 0 },
];
const FAMOUS_DISHES = [
  { dish: "Biryani", place: "Hyderabad", emoji: "🍛" },
  { dish: "Vada Pav", place: "Mumbai", emoji: "🍔" },
  { dish: "Rosogolla", place: "Kolkata", emoji: "🍡" },
  { dish: "Appam & Stew", place: "Kerala", emoji: "🥘" },
];

function TrackingPreview() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setStep(3);
      return undefined;
    }
    const timer = setInterval(() => setStep((current) => (current + 1) % PREVIEW_STEPS.length), 2200);
    return () => clearInterval(timer);
  }, []);
  const current = PREVIEW_STEPS[step];

  return (
    <div className="preview" aria-hidden="true">
      <div className="preview__map">
        <svg viewBox="0 0 320 150" preserveAspectRatio="none">
          <path className="preview__road" d="M20 120 C 90 120, 90 40, 160 40 S 240 110, 300 30" />
          <path
            className="preview__route"
            d="M20 120 C 90 120, 90 40, 160 40 S 240 110, 300 30"
            style={{ strokeDashoffset: 400 - (step / (PREVIEW_STEPS.length - 1)) * 400 }}
          />
        </svg>
        <span className="preview__pin preview__pin--kitchen">
          <ChefHat size={14} />
        </span>
        <span className="preview__pin preview__pin--home">
          <MapPin size={14} />
        </span>
        <span className="preview__courier" style={{ offsetDistance: `${(step / (PREVIEW_STEPS.length - 1)) * 100}%` }}>
          <Bike size={14} />
        </span>
      </div>
      <div className="preview__body">
        <div className="preview__row">
          <div>
            <small>Order #A17 · Copper Kadhai</small>
            <strong>{current.eta ? `Arriving in ${current.eta} min` : "Delivered. Enjoy!"}</strong>
          </div>
          <StatusBadge status={current.status} />
        </div>
        <div className="preview__bar">
          {PREVIEW_STEPS.map((item, index) => (
            <span key={item.status} className={index <= step ? "is-done" : ""} />
          ))}
        </div>
      </div>
    </div>
  );
}

function AuthPanel({ loginForm, onChange, onSubmit, onDemoLogin, loading }) {
  return (
    <section className="auth">
      <div className="auth__story">
        <div className="brand brand--light">
          <span className="brand__mark">
            <Zap size={18} />
          </span>
          Dispatch
        </div>

        <div className="auth__hero">
          <div className="auth__copy">
            <span className="auth__kicker">
              <span className="live__dot" /> Live in Bengaluru
            </span>
            <h1>
              Hot food, <em>tracked live</em> from kitchen to doorstep.
            </h1>
            <p className="lede">
              Order from local kitchens, watch every step in real time, and ask our AI Food Guide what any city is
              famous for.
            </p>
          </div>

          <div className="auth__visual">
            <TrackingPreview />
            {FAMOUS_DISHES.map(({ dish, place, emoji }, index) => (
              <span key={dish} className={`dish-tag dish-tag--${index}`} aria-hidden="true">
                <b>{emoji}</b>
                <span>
                  {dish}
                  <small>{place}</small>
                </span>
              </span>
            ))}
          </div>
        </div>

        <ul className="auth__features">
          <li>
            <Radio size={16} /> Real-time tracking
          </li>
          <li>
            <ShieldCheck size={16} /> Never oversold
          </li>
          <li>
            <Sparkles size={16} /> AI Food Guide
          </li>
        </ul>
      </div>

      <div className="auth__panel">
        <div className="auth__card">
          <div>
            <h2>Welcome back</h2>
            <p className="muted">Pick a demo role to jump straight in.</p>
          </div>
          <div className="role-grid">
            {Object.entries(DEMO_USERS).map(([role, credentials]) => (
              <button
                key={role}
                className="role-card"
                disabled={loading}
                type="button"
                onClick={() => onDemoLogin(credentials)}
              >
                <span className={`role-card__icon role-card__icon--${role}`}>
                  <RoleIcon role={role} />
                </span>
                <span className="role-card__text">
                  <strong>{roleLabel(role)}</strong>
                  <small>{ROLE_BLURBS[role]}</small>
                </span>
                <ArrowRight size={16} className="role-card__arrow" />
              </button>
            ))}
          </div>
          <div className="divider">
            <span>or sign in with email</span>
          </div>
          <form className="auth-form" onSubmit={onSubmit}>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="username"
                value={loginForm.email}
                onChange={(event) => onChange("email", event.target.value)}
                placeholder="customer@example.com"
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={loginForm.password}
                onChange={(event) => onChange("password", event.target.value)}
                placeholder="portfolio123"
              />
            </label>
            <button className="primary-button" disabled={loading} type="submit">
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
          <p className="fine-print">Demo accounts share the password portfolio123.</p>
        </div>
      </div>
    </section>
  );
}

function Topbar({ user, socketState, onLogout }) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand__mark">
          <Zap size={18} />
        </span>
        Dispatch
        <span className="topbar__role">
          <RoleIcon role={user.role} size={14} />
          {roleLabel(user.role)}
        </span>
      </div>
      <div className="topbar__meta">
        <LiveIndicator socketState={socketState} />
        <div className="user-chip">
          <span className="avatar">{initials(user.full_name)}</span>
          <span className="user-chip__text">
            <strong>{user.full_name}</strong>
            <small>{user.email}</small>
          </span>
        </div>
        <button className="icon-button" onClick={onLogout} type="button" title="Sign out" aria-label="Sign out">
          <LogOut size={17} />
        </button>
      </div>
    </header>
  );
}

function StatsBand({ user, orders, selectedOrder }) {
  const activeCount = orders.filter((order) => isActiveStatus(order.status)).length;
  const ordersLabel =
    user.role === "restaurant" ? "Kitchen queue" : user.role === "delivery_partner" ? "Assigned" : "Your orders";
  const stats = [
    { label: ordersLabel, value: orders.length, icon: ShoppingBag },
    { label: "In progress", value: activeCount, icon: Zap },
    { label: "Selected total", value: selectedOrder ? formatCurrency(selectedOrder.total_minor) : "—", icon: PackageCheck },
    { label: "ETA", value: etaLabel(selectedOrder), icon: Clock3 },
  ];
  return (
    <section className="stats-band">
      {stats.map(({ label, value, icon: Icon }) => (
        <div key={label} className="stat-block">
          <span className="stat-block__icon">
            <Icon size={18} />
          </span>
          <div>
            <span className="stat-block__label">{label}</span>
            <strong>{value}</strong>
          </div>
        </div>
      ))}
    </section>
  );
}

const QUEUE_FILTERS = [
  { key: "active", label: "Active", match: (order) => isActiveStatus(order.status) },
  { key: "done", label: "Completed", match: (order) => !isActiveStatus(order.status) },
  { key: "all", label: "All", match: () => true },
];

function OrderQueue({ orders, selectedOrderId, onRefresh, onSelect }) {
  const [filter, setFilter] = useState("active");
  const activeFilter = QUEUE_FILTERS.find((item) => item.key === filter);
  const visibleOrders = orders.filter(activeFilter.match);
  return (
    <section className="panel">
      <PanelHeader
        eyebrow="Queue"
        title="Orders"
        aside={
          <button className="ghost-button" onClick={onRefresh} type="button">
            <RefreshCcw size={15} />
            Refresh
          </button>
        }
      />
      <div className="tabs" role="tablist">
        {QUEUE_FILTERS.map((item) => (
          <button
            key={item.key}
            role="tab"
            aria-selected={filter === item.key}
            className={filter === item.key ? "is-active" : ""}
            type="button"
            onClick={() => setFilter(item.key)}
          >
            {item.label}
            <span>{orders.filter(item.match).length}</span>
          </button>
        ))}
      </div>
      <div className="queue-list">
        {visibleOrders.length === 0 ? (
          <div className="empty-state">
            <ShoppingBag size={22} />
            <p>
              {orders.length === 0
                ? "No orders yet in this workspace."
                : `No ${activeFilter.label.toLowerCase()} orders right now.`}
            </p>
          </div>
        ) : (
          visibleOrders.map((order) => (
            <button
              key={order.id}
              className={`queue-card ${selectedOrderId === order.id ? "queue-card--active" : ""}`}
              type="button"
              onClick={() => onSelect(order.id)}
            >
              <div className="queue-card__main">
                <div className="queue-card__top">
                  <code>{shortId(order.id)}</code>
                  <StatusBadge status={order.status} />
                </div>
                {order.delivery_address ? (
                  <small className="queue-card__address">
                    <MapPin size={13} />
                    {order.delivery_address}
                  </small>
                ) : null}
              </div>
              <div className="queue-card__side">
                <strong>{formatCurrency(order.total_minor)}</strong>
                <small>{formatRelative(order.created_at)}</small>
              </div>
            </button>
          ))
        )}
      </div>
    </section>
  );
}

function MenuCard({ item, quantity, onChange }) {
  const maxQuantity = Math.min(item.available_inventory, MAX_ITEM_QUANTITY);
  const soldOut = item.available_inventory <= 0;
  const hue = hueFor(item.name);
  return (
    <article className={`menu-card ${quantity > 0 ? "menu-card--selected" : ""}`}>
      <div className="menu-card__art" style={{ "--hue": hue }}>
        {initials(item.name)}
      </div>
      <div className="menu-card__body">
        <div className="menu-card__head">
          <h3>{item.name}</h3>
          <strong>{formatCurrency(item.price_minor)}</strong>
        </div>
        <p>{item.description ?? "No description provided."}</p>
        <div className="menu-card__footer">
          <small className={item.available_inventory <= LOW_STOCK_THRESHOLD ? "stock stock--low" : "stock"}>
            {soldOut
              ? "Sold out"
              : item.available_inventory <= LOW_STOCK_THRESHOLD
                ? `Only ${item.available_inventory} left`
                : `${item.available_inventory} available`}
          </small>
          {quantity === 0 ? (
            <button className="add-button" disabled={soldOut} type="button" onClick={() => onChange(1)}>
              <Plus size={15} />
              Add
            </button>
          ) : (
            <div className="stepper">
              <button type="button" aria-label="Decrease quantity" onClick={() => onChange(quantity - 1)}>
                <Minus size={15} />
              </button>
              <span>{quantity}</span>
              <button
                type="button"
                aria-label="Increase quantity"
                disabled={quantity >= maxQuantity}
                onClick={() => onChange(quantity + 1)}
              >
                <Plus size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function CustomerComposer({
  restaurants,
  selectedRestaurantId,
  setSelectedRestaurantId,
  menuItems,
  cart,
  updateCartItem,
  deliveryDetails,
  setDeliveryDetails,
  onUseLiveLocation,
  liveLocationLoading,
  onSubmit,
  loading,
  menuLoading,
}) {
  const cartItems = menuItems
    .filter((item) => (cart[item.id] ?? 0) > 0)
    .map((item) => ({
      ...item,
      quantity: cart[item.id],
      lineTotal: item.price_minor * cart[item.id],
    }));
  const subtotalMinor = cartItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const deliveryFeeMinor = cartItems.length > 0 ? DELIVERY_FEE_MINOR : 0;
  const totalMinor = subtotalMinor + deliveryFeeMinor;
  const selectedRestaurant = restaurants.find((restaurant) => restaurant.id === selectedRestaurantId);
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const addressTooShort = deliveryDetails.deliveryAddress.trim().length < MIN_ADDRESS_LENGTH;

  return (
    <>
      <section className="panel">
        <PanelHeader
          eyebrow="Menu"
          title={selectedRestaurant?.name ?? "Menu selection"}
          aside={
            restaurants.length > 1 ? (
              <label className="inline-control">
                <span className="sr-only">Restaurant</span>
                <select value={selectedRestaurantId} onChange={(event) => setSelectedRestaurantId(event.target.value)}>
                  {restaurants.map((restaurant) => (
                    <option key={restaurant.id} value={restaurant.id}>
                      {restaurant.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null
          }
        />
        {selectedRestaurant?.description ? <p className="panel__lede">{selectedRestaurant.description}</p> : null}
        <div className="menu-grid">
          {menuLoading && menuItems.length === 0
            ? [0, 1, 2].map((index) => <div key={index} className="menu-card menu-card--skeleton" />)
            : null}
          {menuItems.map((item) => (
            <MenuCard
              key={item.id}
              item={item}
              quantity={cart[item.id] ?? 0}
              onChange={(quantity) => updateCartItem(item.id, quantity)}
            />
          ))}
        </div>
      </section>

      <form className="panel" id="checkout" onSubmit={onSubmit}>
        <PanelHeader
          eyebrow="Checkout"
          title="Delivery details"
          aside={
            <button
              className="ghost-button"
              type="button"
              disabled={liveLocationLoading}
              onClick={onUseLiveLocation}
            >
              <LocateFixed size={15} />
              {liveLocationLoading ? "Locating..." : "Use my location"}
            </button>
          }
        />
        <div className="checkout-grid">
          <div className="checkout-grid__map">
            <label className="field">
              <span>Address</span>
              <input
                value={deliveryDetails.deliveryAddress}
                aria-invalid={addressTooShort}
                placeholder="House number, street, area"
                onChange={(event) =>
                  setDeliveryDetails((current) => ({ ...current, deliveryAddress: event.target.value }))
                }
              />
              {addressTooShort ? (
                <small className="field__error">
                  <CircleAlert size={13} />
                  Add a bit more detail — at least {MIN_ADDRESS_LENGTH} characters.
                </small>
              ) : null}
            </label>
            <LocationMap
              label="Drop pin — click or drag to adjust"
              latitude={deliveryDetails.deliveryLatitude}
              longitude={deliveryDetails.deliveryLongitude}
              onChange={({ latitude, longitude }) =>
                setDeliveryDetails((current) => ({
                  ...current,
                  deliveryLatitude: latitude,
                  deliveryLongitude: longitude,
                }))
              }
            />
            <details className="disclosure">
              <summary>Edit coordinates manually</summary>
              <div className="field-row">
                <label className="field">
                  <span>Latitude</span>
                  <input
                    type="number"
                    step="0.0001"
                    value={deliveryDetails.deliveryLatitude}
                    onChange={(event) =>
                      setDeliveryDetails((current) => ({ ...current, deliveryLatitude: event.target.value }))
                    }
                  />
                </label>
                <label className="field">
                  <span>Longitude</span>
                  <input
                    type="number"
                    step="0.0001"
                    value={deliveryDetails.deliveryLongitude}
                    onChange={(event) =>
                      setDeliveryDetails((current) => ({ ...current, deliveryLongitude: event.target.value }))
                    }
                  />
                </label>
              </div>
            </details>
          </div>

          <div className="cart">
            <h3>Your cart</h3>
            {cartItems.length === 0 ? (
              <div className="empty-state empty-state--compact">
                <ShoppingBag size={20} />
                <p>Add dishes from the menu to start an order.</p>
              </div>
            ) : (
              <div className="receipt">
                {cartItems.map((item) => (
                  <div key={item.id} className="receipt__row">
                    <span>
                      <b>{item.quantity}×</b> {item.name}
                    </span>
                    <span>{formatCurrency(item.lineTotal)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="receipt receipt--totals">
              <div className="receipt__row">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotalMinor)}</span>
              </div>
              <div className="receipt__row">
                <span>Delivery fee</span>
                <span>{formatCurrency(deliveryFeeMinor)}</span>
              </div>
              <div className="receipt__row receipt__row--total">
                <span>Total</span>
                <strong>{formatCurrency(totalMinor)}</strong>
              </div>
            </div>
            <button
              className="primary-button"
              disabled={loading || cartItems.length === 0 || addressTooShort}
              type="submit"
            >
              <Truck size={18} />
              {loading ? "Placing order..." : `Place order · ${formatCurrency(totalMinor)}`}
            </button>
            <p className="fine-print">Stock is locked while your order is placed, so it can't be oversold.</p>
          </div>
        </div>
      </form>

      {itemCount > 0 ? (
        <button
          className="cart-bar"
          type="button"
          onClick={() => document.getElementById("checkout")?.scrollIntoView({ behavior: "smooth" })}
        >
          <span className="cart-bar__count">{itemCount}</span>
          <span>View cart</span>
          <strong>{formatCurrency(totalMinor)}</strong>
        </button>
      ) : null}
    </>
  );
}

function OperationsPanel({
  user,
  selectedOrder,
  onStatusChange,
  statusLoading,
  courierDraft,
  setCourierDraft,
  onCourierUpdate,
  onUseLiveCourierLocation,
  liveLocationLoading,
}) {
  const actions = nextActionsFor(user.role, selectedOrder?.status ?? "");
  const isCourier = user.role === "delivery_partner";
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  useEffect(() => setConfirmingCancel(false), [selectedOrder?.id, selectedOrder?.status]);

  return (
    <>
      <section className="panel">
        <PanelHeader
          eyebrow={isCourier ? "Delivery" : "Kitchen"}
          title={selectedOrder ? `Order ${shortId(selectedOrder.id)}` : "No order selected"}
          aside={selectedOrder ? <StatusBadge status={selectedOrder.status} /> : null}
        />
        {selectedOrder ? (
          <>
            <div className="order-brief">
              {selectedOrder.delivery_address ? (
                <span>
                  <MapPin size={14} />
                  {selectedOrder.delivery_address}
                </span>
              ) : null}
              <span>
                <ShoppingBag size={14} />
                {pluralize(selectedOrder.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0, "item")} ·{" "}
                {formatCurrency(selectedOrder.total_minor)}
              </span>
              <span>
                <Clock3 size={14} />
                Placed {formatRelative(selectedOrder.created_at)}
              </span>
            </div>
            {actions.length === 0 ? (
              <div className="callout">
                <CircleCheck size={18} />
                <p>
                  {isActiveStatus(selectedOrder.status)
                    ? isCourier
                      ? "Waiting for the kitchen to hand this order over."
                      : "Order is with the courier — nothing left for the kitchen."
                    : `This order is ${statusLabel(selectedOrder.status).toLowerCase()}. No further actions.`}
                </p>
              </div>
            ) : confirmingCancel ? (
              <div className="confirm-strip">
                <p>
                  <CircleAlert size={18} />
                  Cancel this order? The customer is notified and this can't be undone.
                </p>
                <div className="action-strip">
                  <button
                    className="danger-button danger-button--solid"
                    disabled={statusLoading}
                    onClick={() => onStatusChange("cancelled")}
                    type="button"
                  >
                    <XCircle size={17} />
                    Yes, cancel order
                  </button>
                  <button className="ghost-button ghost-button--large" onClick={() => setConfirmingCancel(false)} type="button">
                    Keep order
                  </button>
                </div>
              </div>
            ) : (
              <div className="action-strip">
                {actions.map((action) => {
                  const Icon = ACTION_ICONS[action] ?? Truck;
                  return (
                    <button
                      key={action}
                      className={action === "cancelled" ? "danger-button" : "primary-button"}
                      disabled={statusLoading}
                      onClick={() => (action === "cancelled" ? setConfirmingCancel(true) : onStatusChange(action))}
                      type="button"
                    >
                      <Icon size={17} />
                      {ACTION_LABELS[action] ?? statusLabel(action)}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="empty-state empty-state--compact">
            <p>Pick an order from the queue to manage it.</p>
          </div>
        )}
      </section>

      {isCourier ? (
        <section className="panel">
          <PanelHeader
            eyebrow="Courier"
            title="Your location"
            aside={
              <label className={`switch ${courierDraft.is_available ? "switch--on" : ""}`}>
                <input
                  type="checkbox"
                  checked={courierDraft.is_available}
                  onChange={(event) =>
                    setCourierDraft((current) => ({ ...current, is_available: event.target.checked }))
                  }
                />
                <span className="switch__track" />
                {courierDraft.is_available ? "Available" : "Offline"}
              </label>
            }
          />
          <LocationMap
            label="Courier pin — click or drag to adjust"
            latitude={courierDraft.latitude}
            longitude={courierDraft.longitude}
            onChange={({ latitude, longitude }) =>
              setCourierDraft((current) => ({
                ...current,
                latitude,
                longitude,
              }))
            }
          />
          <details className="disclosure">
            <summary>Edit coordinates manually</summary>
            <div className="field-row">
              <label className="field">
                <span>Latitude</span>
                <input
                  type="number"
                  step="0.0001"
                  value={courierDraft.latitude}
                  onChange={(event) => setCourierDraft((current) => ({ ...current, latitude: event.target.value }))}
                />
              </label>
              <label className="field">
                <span>Longitude</span>
                <input
                  type="number"
                  step="0.0001"
                  value={courierDraft.longitude}
                  onChange={(event) => setCourierDraft((current) => ({ ...current, longitude: event.target.value }))}
                />
              </label>
            </div>
          </details>
          <div className="button-row">
            <button className="primary-button" onClick={onCourierUpdate} type="button">
              <MapPin size={17} />
              Save location
            </button>
            <button
              className="ghost-button ghost-button--large"
              disabled={liveLocationLoading}
              onClick={onUseLiveCourierLocation}
              type="button"
            >
              <LocateFixed size={17} />
              {liveLocationLoading ? "Capturing GPS..." : "Use live GPS"}
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}

function TrackingPanel({ selectedOrder, events }) {
  const liveEvents = events
    .slice()
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
  const chronological = liveEvents.slice().reverse();

  return (
    <aside className="panel panel--sticky panel--tracking">
      {selectedOrder ? (
        <>
          <PanelHeader eyebrow="Live tracking" title={`Order ${shortId(selectedOrder.id)}`} />
          <div className={`eta-hero eta-hero--${selectedOrder.status}`}>
            <div>
              <span>
                {isActiveStatus(selectedOrder.status)
                  ? "Estimated arrival"
                  : selectedOrder.status === "delivered"
                    ? "Order complete"
                    : "Order closed"}
              </span>
              <strong>
                {isActiveStatus(selectedOrder.status) ? etaLabel(selectedOrder) : statusLabel(selectedOrder.status)}
              </strong>
            </div>
            {isActiveStatus(selectedOrder.status) ? <StatusBadge status={selectedOrder.status} /> : null}
          </div>
          <StatusTimeline currentStatus={selectedOrder.status} events={chronological} />

          {selectedOrder.items?.length ? (
            <div className="tracking-section">
              <h3>Items</h3>
              <div className="receipt">
                {selectedOrder.items.map((item) => (
                  <div key={item.menu_item_id} className="receipt__row">
                    <span>
                      <b>{item.quantity}×</b> {item.menu_item_name}
                    </span>
                    <span>{formatCurrency(item.line_total_minor)}</span>
                  </div>
                ))}
              </div>
              <div className="receipt receipt--totals">
                {selectedOrder.subtotal_minor != null ? (
                  <>
                    <div className="receipt__row">
                      <span>Subtotal</span>
                      <span>{formatCurrency(selectedOrder.subtotal_minor)}</span>
                    </div>
                    <div className="receipt__row">
                      <span>Delivery fee</span>
                      <span>{formatCurrency(selectedOrder.delivery_fee_minor)}</span>
                    </div>
                  </>
                ) : null}
                <div className="receipt__row receipt__row--total">
                  <span>Total</span>
                  <strong>{formatCurrency(selectedOrder.total_minor)}</strong>
                </div>
              </div>
            </div>
          ) : null}

          {liveEvents.length > 0 ? (
            <div className="tracking-section">
              <h3>Activity</h3>
              <ul className="activity">
                {liveEvents.map((event, index) => (
                  <li key={`${event.status}-${event.created_at}-${index}`}>
                    <span className="activity__time">{formatTime(event.created_at)}</span>
                    <p>
                      {event.metadata?.live_message ?? `Order moved to ${statusLabel(event.status).toLowerCase()}.`}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <PanelHeader eyebrow="Live tracking" title="Nothing to track yet" />
          <div className="empty-state">
            <Truck size={24} />
            <p>Select or place an order to follow it live.</p>
          </div>
        </>
      )}
    </aside>
  );
}

function Toast({ message, tone = "error", onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, tone === "success" ? 3500 : 6000);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <div className={`toast toast--${tone}`} role={tone === "error" ? "alert" : "status"}>
      {tone === "success" ? <CircleCheck size={18} /> : <XCircle size={18} />}
      <p>{message}</p>
      <button type="button" onClick={onDismiss} aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  );
}

export default function App() {
  const storedSession = useMemo(() => readStoredSession(), []);
  const [token, setToken] = useState(storedSession?.token ?? "");
  const [user, setUser] = useState(storedSession?.user ?? null);
  const [loginForm, setLoginForm] = useState(DEMO_USERS.customer);
  const [loginLoading, setLoginLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState({});
  const [deliveryDetails, setDeliveryDetails] = useState(INITIAL_DELIVERY);
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [events, setEvents] = useState([]);
  const [courierDraft, setCourierDraft] = useState({
    latitude: 12.9756,
    longitude: 77.6387,
    is_available: true,
  });
  const [locationLoading, setLocationLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [menuLoading, setMenuLoading] = useState(false);

  const { messages, socketState } = useOrderSocket(selectedOrderId, token);

  useEffect(() => {
    fetchRestaurants()
      .then((data) => {
        setRestaurants(data);
        if (data.length > 0) setSelectedRestaurantId(data[0].id);
      })
      .catch((error) => setErrorMessage(error.message));
  }, []);

  useEffect(() => {
    if (!selectedRestaurantId) return;
    setMenuLoading(true);
    fetchMenu(selectedRestaurantId)
      .then((data) => setMenuItems(data))
      .catch((error) => setErrorMessage(error.message))
      .finally(() => setMenuLoading(false));
  }, [selectedRestaurantId]);

  useEffect(() => {
    if (!token) {
      localStorage.removeItem(SESSION_KEY);
      return;
    }
    if (user) {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ token, user }));
    }
  }, [token, user]);

  useEffect(() => {
    if (!token) return;
    fetchCurrentUser(token)
      .then((profile) => setUser(profile))
      .catch(() => {
        setToken("");
        setUser(null);
      });
  }, [token]);

  function refreshOrders() {
    if (!token) return;
    fetchOrders(token)
      .then((data) => {
        setOrders(data);
        if (data.length > 0) {
          setSelectedOrderId((current) => (current && data.some((order) => order.id === current) ? current : data[0].id));
        } else {
          setSelectedOrderId("");
        }
      })
      .catch((error) => setErrorMessage(error.message));
  }

  useEffect(() => {
    if (!token || !user) {
      setOrders([]);
      setSelectedOrderId("");
      setSelectedOrder(null);
      setEvents([]);
      return;
    }
    refreshOrders();
  }, [token, user]);

  useEffect(() => {
    if (!token || !selectedOrderId) {
      setSelectedOrder(null);
      setEvents([]);
      return;
    }
    Promise.all([fetchOrder({ token, orderId: selectedOrderId }), fetchOrderEvents({ token, orderId: selectedOrderId })])
      .then(([orderPayload, eventPayload]) => {
        setSelectedOrder(orderPayload);
        setEvents(eventPayload);
      })
      .catch((error) => setErrorMessage(error.message));
  }, [selectedOrderId, token]);

  useEffect(() => {
    const latestMessage = messages.at(-1);
    if (!latestMessage?.status) return;
    const liveEvent = buildLiveEvent(latestMessage);
    startTransition(() => {
      setSelectedOrder((current) =>
        current && current.id === latestMessage.order_id
          ? {
              ...current,
              status: latestMessage.status,
              delivery_partner_id: latestMessage.delivery_partner_id ?? current.delivery_partner_id,
              eta_minutes: latestMessage.eta_minutes ?? current.eta_minutes,
            }
          : current,
      );
      setOrders((current) =>
        current.map((order) =>
          order.id === latestMessage.order_id
            ? {
                ...order,
                status: latestMessage.status,
                delivery_partner_id: latestMessage.delivery_partner_id ?? order.delivery_partner_id,
              }
            : order,
        ),
      );
      setEvents((current) =>
        liveEvent && current.at(-1)?.created_at !== liveEvent.created_at ? [...current, liveEvent] : current,
      );
    });
  }, [messages]);

  function updateCartItem(itemId, nextQuantity) {
    setCart((current) => ({
      ...current,
      [itemId]: Math.max(0, nextQuantity),
    }));
  }

  async function signIn(credentials) {
    setErrorMessage("");
    setLoginLoading(true);
    try {
      const authResponse = await login(credentials);
      setToken(authResponse.access_token);
      setUser(authResponse.user);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoginLoading(false);
    }
  }

  function handleLogin(event) {
    event.preventDefault();
    signIn(loginForm);
  }

  function handleDemoLogin(credentials) {
    setLoginForm(credentials);
    signIn(credentials);
  }

  async function handlePlaceOrder(event) {
    event.preventDefault();
    const cartItems = menuItems.filter((item) => (cart[item.id] ?? 0) > 0);
    if (cartItems.length === 0) {
      setErrorMessage("Add at least one item before placing an order.");
      return;
    }
    setActionLoading(true);
    setErrorMessage("");
    try {
      const createdOrder = await placeOrder({
        token,
        payload: {
          restaurant_id: selectedRestaurantId,
          delivery_address: deliveryDetails.deliveryAddress,
          delivery_latitude: Number(deliveryDetails.deliveryLatitude),
          delivery_longitude: Number(deliveryDetails.deliveryLongitude),
          items: cartItems.map((item) => ({
            menu_item_id: item.id,
            quantity: cart[item.id],
          })),
        },
      });
      setCart({});
      setOrders((current) => [
        { ...createdOrder, delivery_address: deliveryDetails.deliveryAddress },
        ...current,
      ]);
      setSelectedOrderId(createdOrder.id);
      setSelectedOrder(createdOrder);
      setNotice("Order placed — follow it live in tracking.");
      if (window.innerWidth < 1180) {
        document.querySelector(".panel--tracking")?.scrollIntoView({ behavior: "smooth" });
      }
      const latestMenu = await fetchMenu(selectedRestaurantId);
      setMenuItems(latestMenu);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStatusChange(nextStatus) {
    if (!selectedOrderId) return;
    setActionLoading(true);
    setErrorMessage("");
    try {
      const updatedOrder = await updateOrderStatus({ token, orderId: selectedOrderId, status: nextStatus });
      setSelectedOrder(updatedOrder);
      setOrders((current) =>
        current.map((order) => (order.id === updatedOrder.id ? { ...order, status: updatedOrder.status } : order)),
      );
      setNotice(`Order ${shortId(updatedOrder.id)} is now ${statusLabel(updatedOrder.status).toLowerCase()}.`);
      const refreshedEvents = await fetchOrderEvents({ token, orderId: selectedOrderId });
      setEvents(refreshedEvents);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCourierUpdate() {
    setActionLoading(true);
    setErrorMessage("");
    try {
      await updateCourierLocation({
        token,
        payload: {
          latitude: Number(courierDraft.latitude),
          longitude: Number(courierDraft.longitude),
          is_available: courierDraft.is_available,
        },
      });
      setNotice("Courier location saved.");
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUseLiveLocation() {
    setLocationLoading(true);
    setErrorMessage("");
    try {
      const liveLocation = await resolveLiveLocation();
      setDeliveryDetails((current) => ({
        ...current,
        deliveryAddress: liveLocation.address,
        deliveryLatitude: liveLocation.latitude,
        deliveryLongitude: liveLocation.longitude,
      }));
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLocationLoading(false);
    }
  }

  async function handleUseLiveCourierLocation() {
    setLocationLoading(true);
    setErrorMessage("");
    try {
      const liveLocation = await resolveLiveLocation();
      setCourierDraft((current) => ({
        ...current,
        latitude: liveLocation.latitude,
        longitude: liveLocation.longitude,
      }));
      await updateCourierLocation({
        token,
        payload: {
          latitude: liveLocation.latitude,
          longitude: liveLocation.longitude,
          is_available: courierDraft.is_available,
        },
      });
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLocationLoading(false);
    }
  }

  function handleLogout() {
    setToken("");
    setUser(null);
    setOrders([]);
    setSelectedOrderId("");
    setSelectedOrder(null);
    setEvents([]);
  }

  const selectedOrderView = selectedOrder
    ? {
        delivery_address: orders.find((order) => order.id === selectedOrder.id)?.delivery_address,
        ...selectedOrder,
      }
    : null;
  const toast = errorMessage ? (
    <Toast message={errorMessage} onDismiss={() => setErrorMessage("")} />
  ) : notice ? (
    <Toast message={notice} tone="success" onDismiss={() => setNotice("")} />
  ) : null;

  if (!user) {
    return (
      <main className="shell shell--landing">
        <AuthPanel
          loginForm={loginForm}
          loading={loginLoading}
          onChange={(key, value) => setLoginForm((current) => ({ ...current, [key]: value }))}
          onDemoLogin={handleDemoLogin}
          onSubmit={handleLogin}
        />
        {toast}
      </main>
    );
  }

  return (
    <>
      <Topbar user={user} socketState={socketState} onLogout={handleLogout} />
      <main className="shell">
        <StatsBand user={user} orders={orders} selectedOrder={selectedOrder} />

        <section className="app-grid">
          <div className="stack">
            {user.role === "customer" ? (
              <CustomerComposer
                restaurants={restaurants}
                selectedRestaurantId={selectedRestaurantId}
                setSelectedRestaurantId={setSelectedRestaurantId}
                menuItems={menuItems}
                cart={cart}
                updateCartItem={updateCartItem}
                deliveryDetails={deliveryDetails}
                setDeliveryDetails={setDeliveryDetails}
                onUseLiveLocation={handleUseLiveLocation}
                liveLocationLoading={locationLoading}
                onSubmit={handlePlaceOrder}
                loading={actionLoading}
                menuLoading={menuLoading}
              />
            ) : (
              <OperationsPanel
                user={user}
                selectedOrder={selectedOrderView}
                onStatusChange={handleStatusChange}
                statusLoading={actionLoading}
                courierDraft={courierDraft}
                setCourierDraft={setCourierDraft}
                onCourierUpdate={handleCourierUpdate}
                onUseLiveCourierLocation={handleUseLiveCourierLocation}
                liveLocationLoading={locationLoading}
              />
            )}
            <OrderQueue
              orders={orders}
              selectedOrderId={selectedOrderId}
              onRefresh={refreshOrders}
              onSelect={setSelectedOrderId}
            />
          </div>

          <TrackingPanel selectedOrder={selectedOrderView} events={events} />
        </section>
      </main>
      <FoodGuide token={token} />
      {toast}
    </>
  );
}
