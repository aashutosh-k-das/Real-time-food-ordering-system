import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_ZOOM = 15;

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function LocationMap({ latitude, longitude, onChange, label = "Location" }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const initialLatitude = toNumber(latitude, 12.9716);
    const initialLongitude = toNumber(longitude, 77.5946);
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([initialLatitude, initialLongitude], DEFAULT_ZOOM);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);

    const marker = L.marker([initialLatitude, initialLongitude], {
      draggable: true,
      autoPan: true,
    }).addTo(map);

    marker.on("dragend", () => {
      const next = marker.getLatLng();
      onChange({ latitude: Number(next.lat.toFixed(6)), longitude: Number(next.lng.toFixed(6)) });
    });

    map.on("click", (event) => {
      marker.setLatLng(event.latlng);
      onChange({ latitude: Number(event.latlng.lat.toFixed(6)), longitude: Number(event.latlng.lng.toFixed(6)) });
    });

    mapRef.current = map;
    markerRef.current = marker;
    setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;

    const nextLatitude = toNumber(latitude, 12.9716);
    const nextLongitude = toNumber(longitude, 77.5946);
    const nextLocation = [nextLatitude, nextLongitude];

    markerRef.current.setLatLng(nextLocation);
    mapRef.current.setView(nextLocation, mapRef.current.getZoom() || DEFAULT_ZOOM, { animate: true });
  }, [latitude, longitude]);

  return (
    <div className="location-map-shell">
      <div className="location-map-toolbar">
        <span>{label}</span>
        <strong>
          {toNumber(latitude, 0).toFixed(5)}, {toNumber(longitude, 0).toFixed(5)}
        </strong>
      </div>
      <div ref={containerRef} className="location-map" />
    </div>
  );
}
