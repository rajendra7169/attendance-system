import React, { useMemo } from "react";
import { Users, Clock, LogOut, Plane, CalendarOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { formatTime12, formatDateKey, isCompanyHoliday, isWorkingDay } from "../utils/calendarUtils";

// Classifies today's attendance into a "where is everyone right now?" view.
// Statuses, in display order:
//   in_office   — checked in, no checkout yet
//   late        — same as in_office but entry was after officeStart
//   checked_out — completed the day
//   on_leave    — has an approved leave for today
//   absent      — working day, no record, after office start
//   pending     — record exists but state == "pending"
//   not_in_yet  — working day, before office start, no record
//   off         — non-working day for everyone
export function TodayStatusBoard({ members, attendance, company, isAdmin = false }) {
  const today = formatDateKey(new Date());
  const officeStart = company?.officeStart || "10:00";
  const now = new Date();
  const nowHHMM = now.toTimeString().slice(0, 5);
  const beforeOfficeStart = nowHHMM < officeStart;

  const dayInfo = useMemo(() => {
    const isHoliday = isCompanyHoliday(today, company);
    const isWorking = isWorkingDay(today, company);
    return { isHoliday, isWorking };
  }, [today, company]);

  const rows = useMemo(() => {
    const staff = (members || []).filter((m) => (m.role || "staff") === "staff");
    return staff.map((m) => {
      const rec = (attendance || []).find(
        (a) => a.userId === m.id && a.date === today,
      );
      let status;
      let detail = "";
      if (dayInfo.isHoliday) {
        status = "off";
        detail = "Holiday";
      } else if (!dayInfo.isWorking) {
        status = "off";
        detail = "Day off";
      } else if (rec?.status === "leave") {
        status = "on_leave";
        detail = rec.leaveType ? `On leave (${rec.leaveType})` : "On leave";
      } else if (rec?.state === "pending") {
        status = "pending";
        detail = rec.entryTime ? `Submitted at ${formatTime12(rec.entryTime)}` : "Pending review";
      } else if (rec?.entryTime && rec?.exitTime) {
        status = "checked_out";
        detail = `${formatTime12(rec.entryTime)} → ${formatTime12(rec.exitTime)}${rec.halfDay ? " · half day" : ""}`;
      } else if (rec?.entryTime) {
        const isLate = rec.entryTime > officeStart;
        status = isLate ? "late" : "in_office";
        detail = `Checked in at ${formatTime12(rec.entryTime)}${rec.halfDay ? " · half day" : ""}`;
      } else if (beforeOfficeStart) {
        status = "not_in_yet";
        detail = "Not in yet";
      } else {
        status = "absent";
        detail = "No check-in";
      }
      return { member: m, status, detail };
    });
  }, [members, attendance, today, dayInfo, officeStart, beforeOfficeStart]);

  const order = ["in_office", "late", "pending", "not_in_yet", "checked_out", "on_leave", "absent", "off"];
  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const ai = order.indexOf(a.status);
        const bi = order.indexOf(b.status);
        if (ai !== bi) return ai - bi;
        return (a.member.displayName || "").localeCompare(b.member.displayName || "");
      }),
    [rows],
  );

  const counts = useMemo(() => {
    const c = {};
    rows.forEach((r) => {
      c[r.status] = (c[r.status] || 0) + 1;
    });
    return c;
  }, [rows]);

  const summary = [
    { key: "in_office", label: "In office", icon: CheckCircle2, color: "emerald" },
    { key: "late", label: "Late", icon: Clock, color: "amber" },
    { key: "checked_out", label: "Done", icon: LogOut, color: "slate" },
    { key: "on_leave", label: "On leave", icon: Plane, color: "indigo" },
    { key: "absent", label: "Absent", icon: AlertCircle, color: "rose" },
  ];
  // Drop chips with zero count to keep summary tight.
  const summaryItems = summary.filter((s) => counts[s.key]);

  if (rows.length === 0) return null;

  return (
    <div className="surface-elevated p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              Today's status
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              {dayInfo.isHoliday
                ? "Holiday today — no one is expected"
                : !dayInfo.isWorking
                ? "Day off — no one is expected"
                : `${counts.in_office || 0} in · ${counts.late || 0} late · ${counts.absent || 0} absent`}
            </p>
          </div>
        </div>
      </div>

      {summaryItems.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {summaryItems.map((s) => (
            <StatusChip key={s.key} {...s} count={counts[s.key]} />
          ))}
        </div>
      )}

      <ul className="divide-y divide-[var(--border)]">
        {sorted.map((r) => (
          <li key={r.member.id} className="flex items-center gap-3 py-2.5">
            <Avatar member={r.member} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {r.member.displayName || "Unknown"}
              </p>
              <p className="text-xs text-[var(--text-muted)] truncate">
                {r.detail}
              </p>
            </div>
            <StatusBadge status={r.status} />
          </li>
        ))}
      </ul>

      {!isAdmin && (
        <p className="text-[11px] text-[var(--text-muted)] mt-3">
          Updates as your team checks in.
        </p>
      )}
    </div>
  );
}

function Avatar({ member }) {
  if (member.photo) {
    return (
      <img
        src={member.photo}
        alt=""
        className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-[var(--border)]"
      />
    );
  }
  const initial = (member.displayName || member.email || "?").charAt(0).toUpperCase();
  return (
    <div className="w-8 h-8 avatar-gradient rounded-full text-sm flex-shrink-0">
      {initial}
    </div>
  );
}

function StatusChip({ label, icon: Icon, color, count }) {
  const map = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    slate: "bg-slate-50 text-slate-600 border-slate-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${map[color]}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label} · {count}
    </span>
  );
}

function StatusBadge({ status }) {
  const map = {
    in_office: { label: "In", cls: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
    late: { label: "Late", cls: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
    checked_out: { label: "Done", cls: "bg-slate-100 text-slate-700", dot: "bg-slate-400" },
    on_leave: { label: "Leave", cls: "bg-indigo-100 text-indigo-700", dot: "bg-indigo-500" },
    absent: { label: "Absent", cls: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
    pending: { label: "Pending", cls: "bg-yellow-100 text-yellow-700", dot: "bg-yellow-500" },
    not_in_yet: { label: "—", cls: "bg-slate-50 text-slate-500", dot: "bg-slate-300" },
    off: { label: "Off", cls: "bg-slate-50 text-slate-500", dot: "bg-slate-300" },
  };
  const m = map[status] || map.off;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium ${m.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}
