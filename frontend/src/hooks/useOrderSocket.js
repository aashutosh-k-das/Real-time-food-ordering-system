import { useEffect, useMemo, useState } from "react";

import { getApiBaseUrl } from "../api/client";

function buildWebSocketUrl(orderId, token) {
  const baseUrl = new URL(getApiBaseUrl(), window.location.origin);
  const protocol = baseUrl.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${baseUrl.host}/ws/orders/${orderId}?token=${encodeURIComponent(token)}`;
}

export function useOrderSocket(orderId, token) {
  const [messages, setMessages] = useState([]);
  const [socketState, setSocketState] = useState("idle");
  const socketUrl = useMemo(() => {
    if (!orderId || !token) {
      return null;
    }
    return buildWebSocketUrl(orderId, token);
  }, [orderId, token]);

  useEffect(() => {
    if (!socketUrl) {
      setMessages([]);
      setSocketState("idle");
      return undefined;
    }

    const socket = new WebSocket(socketUrl);
    setSocketState("connecting");

    socket.onopen = () => {
      setSocketState("open");
    };

    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      setMessages((current) => [...current, payload]);
    };

    socket.onerror = () => {
      setSocketState("error");
    };

    socket.onclose = () => {
      setSocketState("closed");
    };

    return () => {
      socket.close();
    };
  }, [socketUrl]);

  return { messages, socketState };
}
