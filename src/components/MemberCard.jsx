import React, { useState, useEffect } from "react";
import { ArrowUpRight, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../utils/firebase";
import { getAttendanceStats } from "../utils/calendarUtils";

export function MemberCard({ member, company }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    present: 0,
    absent: 0,
    off: 0,
    pending: 0,
    late: 0,
    earlyEntry: 0,
    earlyLeave: 0,
    onTime: 0,
    rate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!company?.id) return;
    const fetchAttendance = async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db, "attendance"),
            where("companyId", "==", company.id),
            where("userId", "==", member.id),
          ),
        );
        const attendanceData = {};
        snap.forEach((d) => {
          const data = d.data();
          attendanceData[data.date] = data;
        });
        setStats(
          getAttendanceStats(attendanceData, {
            start: company?.officeStart,
            end: company?.officeEnd,
          }),
        );
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchAttendance();
  }, [member.id, company?.id, company?.officeStart, company?.officeEnd]);

  const { rate } = stats;
  const rateColor =
    rate >= 90
      ? "text-emerald-600"
      : rate >= 70
        ? "text-amber-600"
        : rate > 0
          ? "text-rose-600"
          : "text-[var(--text-muted)]";

  const barColor =
    rate >= 90
      ? "bg-emerald-500"
      : rate >= 70
        ? "bg-amber-500"
        : rate > 0
          ? "bg-rose-500"
          : "bg-transparent";

  return (
    <button
      onClick={() => navigate(`/member/${member.id}`)}
      className="surface surface-hover text-left p-5 group animate-fade-in"
    >
      <div className="flex items-start gap-3 mb-5">
        {member.photo ? (
          <img
            src={member.photo}
            alt={member.name}
            className="w-11 h-11 rounded-full object-cover border border-[var(--border)]"
          />
        ) : (
          <div className="w-11 h-11 avatar-gradient rounded-full text-sm">
            {(member.name || "?").charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[var(--text)] truncate">
            {member.name}
          </h3>
          <p className="text-sm text-[var(--text-muted)] truncate">
            {member.role}
          </p>
        </div>
        <ArrowUpRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition" />
      </div>

      <div className="mb-4">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
            Attendance
          </span>
          <span className={`text-lg font-semibold tabular-nums ${rateColor}`}>
            {loading ? "—" : `${rate}%`}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-[var(--bg-soft)] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${rate}%` }}
          />
        </div>
      </div>

      {stats.pending > 0 && (
        <div className="mb-3 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md">
          <Clock className="w-3 h-3" />
          {stats.pending} pending
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 pt-4 border-t border-[var(--border)]">
        <StatPill label="On time" value={stats.onTime} color="emerald" />
        <StatPill label="Late" value={stats.late} color="amber" />
        <StatPill label="Early in" value={stats.earlyEntry} color="teal" />
        <StatPill label="Early out" value={stats.earlyLeave} color="yellow" />
        <StatPill label="Absent" value={stats.absent} color="rose" />
        <StatPill label="Off" value={stats.off} color="indigo" />
      </div>
    </button>
  );
}

function StatPill({ label, value, color }) {
  const dotColor = {
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    teal: "bg-teal-500",
    yellow: "bg-yellow-500",
    rose: "bg-rose-500",
    indigo: "bg-indigo-500",
  }[color];

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-[var(--bg-soft)]">
      <span className={`dot ${dotColor}`} />
      <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] flex-1 truncate">
        {label}
      </span>
      <span className="text-sm font-semibold text-[var(--text)] tabular-nums">
        {value}
      </span>
    </div>
  );
}
