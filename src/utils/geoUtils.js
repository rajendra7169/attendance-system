// Distance in meters between two lat/lng pairs (haversine).
export function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Promise wrapper around navigator.geolocation.getCurrentPosition.
// Returns { lat, lng, accuracy } or throws { code, message }.
//   code: "unsupported" | "denied" | "unavailable" | "timeout"
export function getCurrentLocation({ timeoutMs = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject({ code: "unsupported", message: "Geolocation not supported by this browser." });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        const map = {
          1: { code: "denied", message: "Location permission was blocked." },
          2: { code: "unavailable", message: "Location is unavailable on this device." },
          3: { code: "timeout", message: "Getting your location took too long." },
        };
        reject(map[err.code] || { code: "unavailable", message: err.message || "Could not get location." });
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 },
    );
  });
}

// Best-effort permission read (Permissions API is not in every browser).
// Returns "granted" | "denied" | "prompt" | "unsupported".
export async function getLocationPermission() {
  if (!navigator.permissions?.query) return "unsupported";
  try {
    const status = await navigator.permissions.query({ name: "geolocation" });
    return status.state;
  } catch {
    return "unsupported";
  }
}
