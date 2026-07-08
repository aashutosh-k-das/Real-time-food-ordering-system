const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

function buildHeaders(token) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function parseJson(response, fallbackMessage) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: fallbackMessage }));
    throw new Error(error.detail ?? fallbackMessage);
  }
  return response.json();
}

export async function login(payload) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson(response, "Failed to sign in");
}

export async function fetchCurrentUser(token) {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: buildHeaders(token),
  });
  return parseJson(response, "Failed to load current user");
}

export async function fetchRestaurants() {
  const response = await fetch(`${API_BASE_URL}/restaurants`);
  return parseJson(response, "Failed to load restaurants");
}

export async function fetchMenu(restaurantId) {
  const response = await fetch(`${API_BASE_URL}/restaurants/${restaurantId}/menu`);
  return parseJson(response, "Failed to load menu");
}

export async function placeOrder({ token, payload }) {
  const response = await fetch(`${API_BASE_URL}/orders`, {
    method: "POST",
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  });
  return parseJson(response, "Failed to place order");
}

export async function fetchOrders(token) {
  const response = await fetch(`${API_BASE_URL}/orders`, {
    headers: buildHeaders(token),
  });
  return parseJson(response, "Failed to load orders");
}

export async function fetchOrder({ token, orderId }) {
  const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
    headers: buildHeaders(token),
  });
  return parseJson(response, "Failed to load order");
}

export async function fetchOrderEvents({ token, orderId }) {
  const response = await fetch(`${API_BASE_URL}/orders/${orderId}/events`, {
    headers: buildHeaders(token),
  });
  return parseJson(response, "Failed to load order events");
}

export async function updateOrderStatus({ token, orderId, status }) {
  const response = await fetch(`${API_BASE_URL}/orders/${orderId}/status`, {
    method: "PATCH",
    headers: buildHeaders(token),
    body: JSON.stringify({ status }),
  });
  return parseJson(response, "Failed to update order status");
}

export async function updateCourierLocation({ token, payload }) {
  const response = await fetch(`${API_BASE_URL}/delivery/me/location`, {
    method: "PATCH",
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  });
  return parseJson(response, "Failed to update courier location");
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}
