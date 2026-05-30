import React from "react";
import { Calendar, Download } from "lucide-react";
import { getLeaveBalances, LEAVE_TYPE_LABELS } from "../utils/leaveUtils";
import { buildICS, downloadICS } from "../utils/icsExport";
import { useAuth } from "../hooks/useAuth";

const COLOR_BARS = {
  indigo: "bg-indigo-500",
  rose: "bg-rose-500",
  amber: "bg-amber-500",
};

export function LeaveBalanceCard({ records, company, year = new Date().getFullYear() }) {
  const { user, userDoc } = useAuth();
  const balances = getLeaveBalances({
    records,
    quotas: company?.leaveQuotas,
    year,
  });

  const handleExport = () => {
    const ics = buildICS({
      records,
      holidays: company?.holidays || [],
      owner: { uid: user?.uid, name: userDoc?.displayName },
      calendarName: `${userDoc?.displayName || "My"} · ${company?.name || "Tally"}`,
    });
    const safeName = (userDoc?.displayName || "tally")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");
    downloadICS(`${safeName}-leave-${year}.ics`, ics);
  };

  return (
    <div className="surface-elevated p-5">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-600">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold tracking-tight">Leave balance {year}</h3>
            <p className="text-xs text-[var(--text-muted)]">Days remaining by leave type</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="btn btn-ghost btn-icon"
          title="Download .ics — approved leave + workspace holidays"
          aria-label="Download calendar file"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3">
        {Object.entries(balances).map(([type, b]) => {
          const label = LEAVE_TYPE_LABELS[type];
          const pct = b.total > 0 ? (b.used / b.total) * 100 : 0;
          return (
            <div key={type}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="flex items-center gap-1.5 font-medium">
                  <span>{label.icon}</span>
                  {label.label}
                </span>
                <span className="tabular-nums">
                  <strong className="text-base">{b.remaining}</strong>
                  <span className="text-[var(--text-muted)]"> / {b.total}</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--bg-soft)] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${COLOR_BARS[label.color]}`}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
