import React, { useState, useEffect, useMemo } from "react";
import { History, RefreshCw, Search } from "lucide-react";
import { fetchAuditLog, ACTION_LABELS } from "../utils/auditUtils";

const COLOR_CLASSES = {
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

function timeAgo(timestamp) {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
}

export function AuditLogPanel({ companyId }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await fetchAuditLog(companyId);
      setEntries(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter((e) =>
      [e.actorName, e.action, e.target, JSON.stringify(e.details || {})]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [entries, search]);

  return (
    <div className="surface-elevated p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-amber-50 text-amber-600">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold tracking-tight">Activity log</h3>
            <p className="text-xs text-[var(--text-muted)]">
              Last 100 admin actions in this workspace
            </p>
          </div>
        </div>
        <button onClick={load} className="btn btn-secondary btn-icon" title="Refresh">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search activity..."
          className="input-field pl-9"
        />
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)] py-8 text-center">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] py-8 text-center">
          {entries.length === 0 ? "No activity yet" : `No matches for "${search}"`}
        </p>
      ) : (
        <div className="divide-y divide-[var(--border)] -mx-2 max-h-[500px] overflow-y-auto">
          {filtered.map((e) => {
            const def = ACTION_LABELS[e.action] || { verb: e.action, color: "indigo", icon: "·" };
            return (
              <div key={e.id} className="flex items-start gap-3 py-3 px-2">
                <span
                  className={`flex-shrink-0 w-8 h-8 rounded-md border flex items-center justify-center text-sm ${COLOR_CLASSES[def.color] || COLOR_CLASSES.indigo}`}
                >
                  {def.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <strong>{e.actorName || "Someone"}</strong>{" "}
                    <span className="text-[var(--text-secondary)]">{def.verb}</span>
                    {e.details?.targetName && (
                      <>
                        {" "}
                        <span className="font-medium">{e.details.targetName}</span>
                      </>
                    )}
                    {e.details?.summary && (
                      <span className="text-[var(--text-muted)]"> · {e.details.summary}</span>
                    )}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{timeAgo(e.timestamp)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
