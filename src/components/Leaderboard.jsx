import React, { useMemo } from "react";
import { Trophy, Flame, Clock, Crown } from "lucide-react";
import { getDayTone } from "../utils/calendarUtils";

/**
 * Leaderboard — admin-only.
 * Pulls all staff + their attendance and ranks them.
 */
export function Leaderboard({ members, attendance, company }) {
  const officeStart = company?.officeStart;
  const officeEnd = company?.officeEnd;

  const standings = useMemo(() => {
    const staffOnly = members.filter((m) => m.role === "staff");
    return staffOnly
      .map((m) => {
        const myRecords = attendance.filter((a) => a.userId === m.id);
        const present = myRecords.filter(
          (a) => a.status === "present" && (a.state ?? "approved") === "approved",
        );

        // On-time count
        const onTime = present.filter((r) => {
          const tone = getDayTone(r, { start: officeStart, end: officeEnd });
          return tone === "good";
        }).length;

        // Punctuality % = on-time / present
        const punctuality = present.length > 0
          ? Math.round((onTime / present.length) * 100)
          : 0;

        // Best streak
        const sortedDates = [
          ...new Set(
            myRecords
              .filter((r) => (r.status === "present" || r.status === "off") && (r.state ?? "approved") === "approved")
              .map((r) => r.date),
          ),
        ].sort();
        let best = 0, cur = 1;
        for (let i = 1; i < sortedDates.length; i++) {
          const diff = (new Date(sortedDates[i]) - new Date(sortedDates[i - 1])) / 86400000;
          if (diff === 1) cur++;
          else cur = 1;
          best = Math.max(best, cur);
        }
        if (sortedDates.length === 1) best = 1;

        // Overtime
        const overtime = present.filter(
          (r) => r.exitTime && officeEnd && r.exitTime > officeEnd,
        ).length;

        return {
          id: m.id,
          name: m.displayName,
          photo: m.photo,
          trees: present.length,
          punctuality,
          streak: best,
          overtime,
        };
      });
  }, [members, attendance, officeStart, officeEnd]);

  if (standings.length === 0) {
    return null;
  }

  // Build podiums for each category
  const podiums = [
    {
      title: "Most punctual",
      icon: Crown,
      iconColor: "text-amber-500 bg-amber-50",
      sortKey: "punctuality",
      suffix: "%",
      data: [...standings].sort((a, b) => b.punctuality - a.punctuality).slice(0, 3),
    },
    {
      title: "Longest streak",
      icon: Flame,
      iconColor: "text-rose-500 bg-rose-50",
      sortKey: "streak",
      suffix: " days",
      data: [...standings].sort((a, b) => b.streak - a.streak).slice(0, 3),
    },
    {
      title: "Most trees grown",
      icon: Trophy,
      iconColor: "text-emerald-500 bg-emerald-50",
      sortKey: "trees",
      suffix: " 🌳",
      data: [...standings].sort((a, b) => b.trees - a.trees).slice(0, 3),
    },
    {
      title: "Overtime hero",
      icon: Clock,
      iconColor: "text-indigo-500 bg-indigo-50",
      sortKey: "overtime",
      suffix: " days",
      data: [...standings].sort((a, b) => b.overtime - a.overtime).slice(0, 3),
    },
  ];

  return (
    <div className="surface-elevated p-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="p-1.5 rounded-md bg-amber-50 text-amber-600">
          <Trophy className="w-4 h-4" />
        </div>
        <div>
          <h3 className="font-semibold tracking-tight">Team leaderboard</h3>
          <p className="text-xs text-[var(--text-muted)]">Friendly competition across the team</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {podiums.map((p) => {
          const Icon = p.icon;
          return (
            <div key={p.title} className="surface p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className={`p-1 rounded-md ${p.iconColor}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider">{p.title}</p>
              </div>
              <div className="space-y-2">
                {p.data.map((s, idx) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <span className={`text-xs font-bold w-5 ${
                      idx === 0 ? "text-amber-500"
                      : idx === 1 ? "text-slate-400"
                      : "text-amber-700"
                    }`}>
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}
                    </span>
                    {s.photo ? (
                      <img src={s.photo} alt={s.name} className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded-full avatar-gradient text-[10px]">
                        {s.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="flex-1 text-sm truncate">{s.name}</span>
                    <span className="text-sm font-semibold tabular-nums text-[var(--text-secondary)]">
                      {s[p.sortKey]}{p.suffix}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
