import React, { useMemo } from "react";
import { Trophy, Lock } from "lucide-react";
import { evaluateAchievements, TIER_STYLES } from "../utils/achievements";

export function AchievementsBoard({ records, company, compact = false }) {
  const achievements = useMemo(
    () =>
      evaluateAchievements(records, {
        start: company?.officeStart,
        end: company?.officeEnd,
      }),
    [records, company],
  );

  const unlockedCount = achievements.filter((a) => a.state.unlocked).length;

  if (compact) {
    // Compact version: just unlocked badges in a row
    const unlocked = achievements.filter((a) => a.state.unlocked);
    if (unlocked.length === 0) return null;
    return (
      <div className="surface p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            Achievements
          </p>
          <span className="text-xs text-[var(--text-muted)] tabular-nums">
            {unlockedCount} / {achievements.length}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {unlocked.map((a) => (
            <div
              key={a.id}
              className={`relative w-12 h-12 rounded-xl ${TIER_STYLES[a.tier].bg} ring-2 ring-offset-2 ring-offset-white ${TIER_STYLES[a.tier].ring} flex items-center justify-center text-2xl`}
              title={`${a.name}: ${a.desc}`}
            >
              {a.icon}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="surface-elevated p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-amber-50 text-amber-600">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold tracking-tight">Achievements</h3>
            <p className="text-xs text-[var(--text-muted)]">
              {unlockedCount} of {achievements.length} unlocked
            </p>
          </div>
        </div>
        <div className="flex-1 max-w-[200px] ml-4">
          <div className="h-1.5 bg-[var(--bg-soft)] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all"
              style={{ width: `${(unlockedCount / achievements.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {achievements.map((a) => {
          const tier = TIER_STYLES[a.tier];
          const locked = !a.state.unlocked;
          return (
            <div
              key={a.id}
              className={`relative group p-3 rounded-xl text-center transition-all ${
                locked
                  ? "bg-[var(--bg-soft)] grayscale opacity-60 hover:opacity-100 hover:grayscale-0"
                  : `${tier.bg} ring-1 ${tier.ring}`
              }`}
              title={a.desc}
            >
              <div className="text-3xl mb-1">{a.icon}</div>
              <p className={`text-xs font-semibold leading-tight ${locked ? "text-[var(--text-muted)]" : tier.text}`}>
                {a.name}
              </p>
              {locked && a.state.progress > 0 && (
                <div className="mt-2 h-1 bg-white/60 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--text-secondary)] transition-all"
                    style={{ width: `${a.state.progress * 100}%` }}
                  />
                </div>
              )}
              {locked && (
                <Lock className="absolute top-1 right-1 w-3 h-3 text-[var(--text-muted)] opacity-60" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
