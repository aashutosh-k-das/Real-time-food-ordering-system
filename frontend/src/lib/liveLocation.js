export function getCurrentPosition(options = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }) {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return Promise.reject(new Error("This browser does not support live location."));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

export async function resolveLiveLocation() {
  const position = await getCurrentPosition();
  const latitude = Number(position.coords.latitude.toFixed(6));
  const longitude = Number(position.coords.longitude.toFixed(6));

  return {
    latitude,
    longitude,
    address: `Lat ${latitude.toFixed(5)}, Lng ${longitude.toFixed(5)}`,
  };
}
