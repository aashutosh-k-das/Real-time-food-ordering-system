import { startTransition, useEffect, useMemo, useState } from "react";
import {
  Bike,
  Clock3,
  LogOut,
  LocateFixed,
  MapPin,
  Minus,
  Plus,
  Radio,
  RefreshCcw,
  ShieldCheck,
  ShoppingBag,
  Truck,
  Utensils,
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
import { LocationMap } from "./components/LocationMap";
import { StatusTimeline } from "./components/StatusTimeline";
import { useOrderSocket } from "./hooks/useOrderSocket";
import { resolveLiveLocation } from "./lib/liveLocation";

const SESSION_KEY = "food_ordering_session";
const DELIVERY_FEE_MINOR = 499;
const DEMO_USERS = {
  customer: { email: "customer@example.com", password: "portfolio123" },
  restaurant: { email: "restaurant@example.com", password: "portfolio123" },
  delivery_partner: { email: "delivery@example.com", password: "portfolio123" },
};
const INITIAL_DELIVERY = {
  deliveryAddress: "221B Fleet Street, Bengaluru",
  deliveryLatitude: 12.9716,
  deliveryLongitude: 77.5946,
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

function roleTag(role) {
  if (role === "customer") return "Customer workspace";
  if (role === "restaurant") return "Kitchen console";
  if (role === "delivery_partner") return "Courier console";
  return "Guest";
}

function RoleIcon({ role }) {
  if (role === "restaurant") return <Utensils size={18} />;
  if (role === "delivery_partner") return <Bike size={18} />;
  return <ShoppingBag size={18} />;
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

function humanizeStatus(value) {
  return value.replaceAll("_", " ");
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

function AuthPanel({ loginForm, onChange, onSubmit, onDemoFill, loading }) {
  return (
    <section className="panel panel--auth">
      <div className="auth-layout">
        <div className="auth-story">
          <p className="eyebrow">Dispatch Control</p>
          <h1>Live order orchestration for restaurant operations.</h1>
          <p className="lede">
            Customer checkout, kitchen workflow, courier handoff, Leaflet location capture, and WebSocket
            tracking in one portfolio-grade product surface.
          </p>
          <div className="hero-metrics">
            <div className="metric-card">
              <span>Roles</span>
              <strong>3</strong>
            </div>
            <div className="metric-card">
              <span>Realtime</span>
              <strong>WebSocket</strong>
            </div>
            <div className="metric-card">
              <span>Inventory</span>
              <strong>Locked</strong>
            </div>
          </div>
        </div>

        <div className="auth-card">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Demo access</p>
              <h2>Sign in</h2>
            </div>
            <p>Use a seeded account to open the matching workspace.</p>
          </div>
          <form className="auth-form" onSubmit={onSubmit}>
            <label className="field">
              <span>Email</span>
              <input
                value={loginForm.email}
                onChange={(event) => onChange("email", event.target.value)}
                placeholder="customer@example.com"
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={loginForm.password}
                onChange={(event) => onChange("password", event.target.value)}
                placeholder="portfolio123"
              />
            </label>
            <button className="primary-button" disabled={loading} type="submit">
              <ShieldCheck size={18} />
              {loading ? "Signing in..." : "Enter workspace"}
            </button>
          </form>
          <div className="quick-grid">
            {Object.entries(DEMO_USERS).map(([role, credentials]) => (
              <button
                key={role}
                className="secondary-button secondary-button--ghost"
                type="button"
                onClick={() => onDemoFill(credentials)}
              >
                <RoleIcon role={role} />
                {roleLabel(role)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SessionPanel({ user, socketState, onLogout }) {
  return (
    <aside className="panel panel--sticky">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Session</p>
          <h2>{user.full_name}</h2>
        </div>
        <span className={`pill pill--${socketState}`}>
          <Radio size={14} />
          socket {socketState}
        </span>
      </div>
      <div className="session-summary">
        <div className="summary-card">
          <span>Workspace</span>
          <strong>{roleTag(user.role)}</strong>
        </div>
        <div className="summary-card">
          <span>Email</span>
          <strong>{user.email}</strong>
        </div>
      </div>
      <button className="secondary-button secondary-button--wide" onClick={onLogout} type="button">
        <LogOut size={18} />
        Sign out
      </button>
    </aside>
  );
}

function StatsBand({ orders, selectedOrder }) {
  return (
    <section className="stats-band">
      <div className="stat-block">
        <span>Visible orders</span>
        <ShoppingBag size={20} />
        <strong>{orders.length}</strong>
      </div>
      <div className="stat-block">
        <span>Selected total</span>
        <ShieldCheck size={20} />
        <strong>{selectedOrder ? formatCurrency(selectedOrder.total_minor) : "—"}</strong>
      </div>
      <div className="stat-block">
        <span>ETA</span>
        <Clock3 size={20} />
        <strong>{selectedOrder?.eta_minutes ? `${selectedOrder.eta_minutes} min` : "Pending"}</strong>
      </div>
    </section>
  );
}

function OrderQueue({ orders, selectedOrderId, onRefresh, onSelect }) {
  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Operational queue</p>
          <h2>Orders</h2>
        </div>
        <button className="secondary-button secondary-button--ghost" onClick={onRefresh} type="button">
          <RefreshCcw size={17} />
          Refresh
        </button>
      </div>
      <div className="queue-list">
        {orders.length === 0 ? (
          <div className="empty-state empty-state--compact">
            <p>No orders yet in this workspace.</p>
          </div>
        ) : (
          orders.map((order) => (
            <button
              key={order.id}
              className={`queue-card ${selectedOrderId === order.id ? "queue-card--active" : ""}`}
              type="button"
              onClick={() => onSelect(order.id)}
            >
              <div className="queue-card__top">
                <strong>{humanizeStatus(order.status)}</strong>
                <span>{formatCurrency(order.total_minor)}</span>
              </div>
              <small>{order.id.slice(0, 8)}</small>
            </button>
          ))
        )}
      </div>
    </section>
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
}) {
  const cartItems = menuItems
    .filter((item) => (cart[item.id] ?? 0) > 0)
    .map((item) => ({
      ...item,
      quantity: cart[item.id],
      lineTotal: item.price_minor * cart[item.id],
    }));
  const subtotalMinor = cartItems.reduce((sum, item) => sum + item.lineTotal, 0);

  return (
    <>
      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Browse</p>
            <h2>Menu selection</h2>
          </div>
          <label className="inline-control">
            <span>Restaurant</span>
            <select value={selectedRestaurantId} onChange={(event) => setSelectedRestaurantId(event.target.value)}>
              {restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="menu-grid">
          {menuItems.map((item) => (
            <article key={item.id} className="menu-card">
              <div className="menu-card__head">
                <h3>{item.name}</h3>
                <span>{formatCurrency(item.price_minor)}</span>
              </div>
              <p>{item.description ?? "No description provided."}</p>
              <div className="menu-card__footer">
                <small>{item.available_inventory} available</small>
                <div className="stepper">
                  <button type="button" onClick={() => updateCartItem(item.id, (cart[item.id] ?? 0) - 1)}>
                    <Minus size={15} />
                  </button>
                  <span>{cart[item.id] ?? 0}</span>
                  <button type="button" onClick={() => updateCartItem(item.id, (cart[item.id] ?? 0) + 1)}>
                    <Plus size={15} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <form className="panel" onSubmit={onSubmit}>
        <div className="panel__header">
          <div>
            <p className="eyebrow">Checkout</p>
            <h2>Place order</h2>
          </div>
          <div>
            <p>Inventory is locked transactionally during checkout.</p>
            <button
              className="secondary-button secondary-button--ghost secondary-button--compact"
              type="button"
              disabled={liveLocationLoading}
              onClick={onUseLiveLocation}
            >
              <LocateFixed size={17} />
              {liveLocationLoading ? "Resolving live location..." : "Use live location"}
            </button>
          </div>
        </div>
        <label className="field">
          <span>Address</span>
          <input
            value={deliveryDetails.deliveryAddress}
            onChange={(event) =>
              setDeliveryDetails((current) => ({ ...current, deliveryAddress: event.target.value }))
            }
          />
        </label>
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
        <p className="helper-copy">
          Use live GPS or click the Leaflet map to set the delivery coordinates.
        </p>
        <LocationMap
          label="Delivery pin"
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
        <div className="receipt">
          {cartItems.map((item) => (
            <div key={item.id} className="receipt__row">
              <span>
                {item.name} x {item.quantity}
              </span>
              <strong>{formatCurrency(item.lineTotal)}</strong>
            </div>
          ))}
          <div className="receipt__row receipt__row--total">
            <span>Total</span>
            <strong>{formatCurrency(subtotalMinor + (cartItems.length > 0 ? DELIVERY_FEE_MINOR : 0))}</strong>
          </div>
        </div>
        <button className="primary-button" disabled={loading} type="submit">
          <Truck size={18} />
          {loading ? "Placing order..." : "Place order"}
        </button>
      </form>
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

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Actions</p>
          <h2>{user.role === "customer" ? "Order detail" : "Operational controls"}</h2>
        </div>
        <p>
          {user.role === "restaurant"
            ? "Drive the kitchen workflow."
            : user.role === "delivery_partner"
              ? "Maintain courier state and complete delivery."
              : "Track your live order state."}
        </p>
      </div>

      {user.role === "delivery_partner" ? (
        <div className="courier-box">
          <div className="field-row">
            <label className="field">
              <span>Courier latitude</span>
              <input
                type="number"
                step="0.0001"
                value={courierDraft.latitude}
                onChange={(event) => setCourierDraft((current) => ({ ...current, latitude: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Courier longitude</span>
              <input
                type="number"
                step="0.0001"
                value={courierDraft.longitude}
                onChange={(event) => setCourierDraft((current) => ({ ...current, longitude: event.target.value }))}
              />
            </label>
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={courierDraft.is_available}
              onChange={(event) =>
                setCourierDraft((current) => ({ ...current, is_available: event.target.checked }))
              }
            />
            <span>Mark courier as available</span>
          </label>
          <div className="button-stack">
            <button className="secondary-button secondary-button--wide" onClick={onCourierUpdate} type="button">
              <MapPin size={18} />
              Update courier location
            </button>
            <button
              className="secondary-button secondary-button--ghost secondary-button--wide"
              disabled={liveLocationLoading}
              onClick={onUseLiveCourierLocation}
              type="button"
            >
              <LocateFixed size={18} />
              {liveLocationLoading ? "Capturing live GPS..." : "Use live GPS location"}
            </button>
          </div>
          <p className="helper-copy">
            Drag the Leaflet pin or capture browser GPS to update courier availability and location.
          </p>
          <LocationMap
            label="Courier pin"
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
        </div>
      ) : null}

      {selectedOrder ? (
        <div className="action-strip">
          {actions.length === 0 ? (
            <div className="empty-state empty-state--compact">
              <p>No state transition available for this role and order status.</p>
            </div>
          ) : (
            actions.map((action) => (
              <button
                key={action}
                className={action === "cancelled" ? "danger-button" : "secondary-button"}
                disabled={statusLoading}
                onClick={() => onStatusChange(action)}
                type="button"
              >
                <Truck size={17} />
                Move to {humanizeStatus(action)}
              </button>
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}

function TrackingPanel({ selectedOrder, events, socketState }) {
  const liveEvents = events
    .slice()
    .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());

  return (
    <section className="panel panel--sticky panel--tracking">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Live view</p>
          <h2>Tracking</h2>
        </div>
        <span className={`pill pill--${socketState}`}>socket {socketState}</span>
      </div>
      {selectedOrder ? (
        <>
          <div className="tracking-meta">
            <div>
              <span>Status</span>
              <strong>{humanizeStatus(selectedOrder.status)}</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{formatCurrency(selectedOrder.total_minor)}</strong>
            </div>
            <div>
              <span>ETA</span>
              <strong>{selectedOrder.eta_minutes ? `${selectedOrder.eta_minutes} min` : "Pending"}</strong>
            </div>
          </div>
          <StatusTimeline currentStatus={selectedOrder.status} />
          <div className="event-log">
            {liveEvents.map((event, index) => (
              <article key={`${event.status}-${event.created_at}-${index}`} className="event-log__item">
                <strong>{humanizeStatus(event.status)}</strong>
                <p>{event.metadata.live_message ?? `Transition recorded at ${new Date(event.created_at).toLocaleString()}`}</p>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state">
          <p>Select or create an order to open live tracking.</p>
        </div>
      )}
    </section>
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
    fetchMenu(selectedRestaurantId)
      .then((data) => setMenuItems(data))
      .catch((error) => setErrorMessage(error.message));
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

  async function handleLogin(event) {
    event.preventDefault();
    setErrorMessage("");
    setLoginLoading(true);
    try {
      const authResponse = await login(loginForm);
      setToken(authResponse.access_token);
      setUser(authResponse.user);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoginLoading(false);
    }
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
      setOrders((current) => [createdOrder, ...current]);
      setSelectedOrderId(createdOrder.id);
      setSelectedOrder(createdOrder);
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

  if (!user) {
    return (
      <main className="shell shell--landing">
        <AuthPanel
          loginForm={loginForm}
          loading={loginLoading}
          onChange={(key, value) => setLoginForm((current) => ({ ...current, [key]: value }))}
          onDemoFill={(credentials) => setLoginForm(credentials)}
          onSubmit={handleLogin}
        />
        {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar panel">
        <div>
          <p className="eyebrow">Foodhub-style live dispatch</p>
          <h1>Operations Console</h1>
          <p className="lede">
            {roleLabel(user.role)} workspace with live order state, inventory-safe checkout, and
            real-time delivery tracking.
          </p>
        </div>
        <div className="topbar__meta">
          <span className={`pill pill--${socketState}`}>
            <Radio size={14} />
            socket {socketState}
          </span>
          <button className="secondary-button secondary-button--ghost" onClick={handleLogout} type="button">
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </header>

      <StatsBand orders={orders} selectedOrder={selectedOrder} />

      <section className="app-grid">
        <SessionPanel user={user} socketState={socketState} onLogout={handleLogout} />

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
            />
          ) : (
            <OperationsPanel
              user={user}
              selectedOrder={selectedOrder}
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

        <TrackingPanel selectedOrder={selectedOrder} events={events} socketState={socketState} />
      </section>

      {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}
    </main>
  );
}
