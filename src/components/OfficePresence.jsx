import React, { useEffect, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import {
  distanceMeters,
  getCurrentLocation,
  getLocationPermission,
} from "../utils/geoUtils";

// Shows the staff member's live presence status:
//   - "In office" (green) if within company.officeRadius of office location
//   - "Not in office" (grey) with distance hint otherwise
//   - "Turn on location" button if permission is needed or has been denied
// Hidden entirely when the workspace has no office location configured.
export function OfficePresence({ company, onChange }) {
  const hasOffice =
    typeof company?.officeLat === "number" &&
    typeof company?.officeLng === "number";

  const [permission, setPermission] = useState("unknown");
  const [position, setPosition] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Bubble status up so the parent (Dashboard) can gate check-in actions.
  useEffect(() => {
    if (!onChange) return;
    if (!hasOffice) {
      onChange({ hasOffice: false, position: null, distance: null, inOffice: null });
      return;
    }
    const distance = position
      ? distanceMeters(position.lat, position.lng, company.officeLat, company.officeLng)
      : null;
    const radius = company.officeRadius || 100;
    onChange({
      hasOffice: true,
      position,
      distance,
      radius,
      inOffice: distance === null ? null : distance <= radius,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, hasOffice, company?.officeLat, company?.officeLng, company?.officeRadius]);

  // Try to read current permission state once on mount. If already granted,
  // fetch the position automatically — no extra click needed for returning users.
  useEffect(() => {
    if (!hasOffice) return;
    let cancelled = false;
    (async () => {
      const state = await getLocationPermission();
      if (cancelled) return;
      setPermission(state);
      if (state === "granted") fetchPosition();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasOffice]);

  const fetchPosition = async () => {
    setLoading(true);
    setError("");
    try {
      const pos = await getCurrentLocation();
      setPosition(pos);
      setPermission("granted");
    } catch (e) {
      setError(e.message || "Could not get location");
      if (e.code === "denied") setPermission("denied");
    } finally {
      setLoading(false);
    }
  };

  if (!hasOffice) return null;

  const radius = company.officeRadius || 100;
  const distance = position
    ? distanceMeters(position.lat, position.lng, company.officeLat, company.officeLng)
    : null;
  const inOffice = distance !== null && distance <= radius;

  const fmt = (m) => (m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`);

  // No position yet → ask for permission
  if (!position) {
    return (
      <div className="flex items-center justify-between gap-3 p-3 mb-4 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)]">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-2 h-2 rounded-full bg-[var(--text-muted)]" />
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {permission === "denied"
                ? "Location blocked"
                : "Turn on location to verify office"}
            </p>
            {error && (
              <p className="text-xs text-rose-600 truncate">{error}</p>
            )}
            {!error && permission === "denied" && (
              <p className="text-xs text-[var(--text-muted)]">
                Allow location in your browser's site settings, then retry.
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={fetchPosition}
          disabled={loading}
          className="btn btn-secondary flex-shrink-0"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Locating...
            </>
          ) : (
            <>
              <MapPin className="w-4 h-4" />
              {permission === "denied" ? "Retry" : "Turn on"}
            </>
          )}
        </button>
      </div>
    );
  }

  // Have a position → show status
  return (
    <div
      className={`flex items-center justify-between gap-3 p-3 mb-4 rounded-xl border ${
        inOffice
          ? "border-emerald-200 bg-emerald-50"
          : "border-[var(--border)] bg-[var(--bg-soft)]"
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className={`w-2.5 h-2.5 rounded-full ${
            inOffice ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
          }`}
        />
        <div className="min-w-0">
          <p
            className={`text-sm font-medium ${
              inOffice ? "text-emerald-800" : "text-[var(--text)]"
            }`}
          >
            {inOffice ? "In office" : "Not in office"}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            {inOffice
              ? `${fmt(distance)} from center · within ${radius}m`
              : `${fmt(distance)} away · office radius ${radius}m`}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={fetchPosition}
        disabled={loading}
        className="text-xs text-[var(--text-secondary)] hover:text-[var(--text)] transition"
        title="Refresh location"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Refresh"}
      </button>
    </div>
  );
}
