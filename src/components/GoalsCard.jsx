import React, { useState, useMemo, useEffect } from "react";
import { Target, Edit2, Check } from "lucide-react";

const STORAGE_KEY = "tally:goals";

function loadGoals(userId) {
  try {
    return JSON.parse(localStorage.getItem(`${STORAGE_KEY}:${userId}`)) || {};
  } catch {
    return {};
  }
}
function saveGoals(userId, goals) {
  localStorage.setItem(`${STORAGE_KEY}:${userId}`, JSON.stringify(goals));
}

export function GoalsCard({ userId, attendance }) {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [goal, setGoal] = useState(20);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const goals = loadGoals(userId);
    setGoal(goals[monthKey] || 20);
  }, [userId, monthKey]);

  const saveGoal = (n) => {
    const goals = loadGoals(userId);
    goals[monthKey] = n;
    saveGoals(userId, goals);
    setGoal(n);
    setEditing(false);
  };

  // Progress this month
  const progress = useMemo(() => {
    const monthRecords = (attendance || []).filter((a) =>
      a.date?.startsWith(monthKey),
    );
    const present = monthRecords.filter(
      (a) =>
        (a.status === "present" || a.status === "late") &&
        (a.state ?? "approved") === "approved",
    ).length;
    return present;
  }, [attendance, monthKey]);

  const pct = Math.min(100, Math.round((progress / goal) * 100));
  const onTrack = pct >= 70;

  return (
    <div className="surface-elevated p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-indigo-50 text-indigo-600">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold tracking-tight">This month's goal</h3>
            <p className="text-xs text-[var(--text-muted)]">
              {now.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </p>
          </div>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="btn btn-ghost btn-icon"
            title="Edit goal"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex items-center gap-2">
          <p className="text-sm">Aim for</p>
          <input
            type="number"
            value={goal}
            onChange={(e) => setGoal(parseInt(e.target.value) || 0)}
            min="1"
            max="31"
            className="input-field w-16 text-center"
          />
          <p className="text-sm">present days</p>
          <button
            onClick={() => saveGoal(goal)}
            className="btn btn-primary btn-icon ml-auto"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-3xl font-bold tabular-nums">{progress}</span>
            <span className="text-sm text-[var(--text-muted)]">of {goal} days</span>
            <span
              className={`ml-auto text-sm font-semibold tabular-nums ${
                onTrack ? "text-emerald-600" : "text-amber-600"
              }`}
            >
              {pct}%
            </span>
          </div>
          <div className="h-2 bg-[var(--bg-soft)] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                pct >= 100
                  ? "bg-emerald-500"
                  : onTrack
                    ? "bg-emerald-400"
                    : "bg-amber-400"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-2">
            {pct >= 100
              ? "🎉 Goal reached! Keep going."
              : onTrack
                ? "On track — keep it up!"
                : `${Math.max(0, goal - progress)} more days to reach your goal`}
          </p>
        </>
      )}
    </div>
  );
}
