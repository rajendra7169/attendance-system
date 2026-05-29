/**
 * Compute the visual theme for the forest + app based on:
 * - Current month (season)
 * - Time of day (phase)
 * - Recent attendance health (weather)
 */

export const SEASONS = {
  spring: {
    name: "Spring",
    months: [2, 3, 4], // Mar–May
    palette: {
      groundTop: "#bbf7d0",
      groundBottom: "#86efac",
      accent: "#f9a8d4",
      effect: "blossom",
    },
  },
  summer: {
    name: "Summer",
    months: [5, 6, 7], // Jun–Aug
    palette: {
      groundTop: "#a7f3d0",
      groundBottom: "#6ee7b7",
      accent: "#fcd34d",
      effect: null,
    },
  },
  autumn: {
    name: "Autumn",
    months: [8, 9, 10], // Sep–Nov
    palette: {
      groundTop: "#fde68a",
      groundBottom: "#fbbf24",
      accent: "#f97316",
      effect: "leaves",
    },
  },
  winter: {
    name: "Winter",
    months: [11, 0, 1], // Dec–Feb
    palette: {
      groundTop: "#e2e8f0",
      groundBottom: "#cbd5e1",
      accent: "#bfdbfe",
      effect: "snow",
    },
  },
};

export function getSeason(date = new Date()) {
  const month = date.getMonth();
  for (const [key, season] of Object.entries(SEASONS)) {
    if (season.months.includes(month)) return { key, ...season };
  }
  return { key: "summer", ...SEASONS.summer };
}

/**
 * Weather is derived from recent attendance health:
 *  - sunny: rate >= 85%
 *  - cloudy: rate 65-84%
 *  - rainy: rate < 65%
 *  - stormy: lots of absences in last 7 days
 */
export function getWeather(recentRecords = []) {
  if (!recentRecords.length) return "sunny";
  const last7 = recentRecords.slice(-7);
  const accountable = last7.filter(
    (r) => r.status === "present" || r.status === "absent",
  );
  const absent = last7.filter((r) => r.status === "absent").length;
  if (!accountable.length) return "sunny";
  const rate = (accountable.length - absent) / accountable.length;
  if (absent >= 3) return "stormy";
  if (rate >= 0.85) return "sunny";
  if (rate >= 0.65) return "cloudy";
  return "rainy";
}

export function getForestHealthScore(stats) {
  if (!stats) return 0;
  const { onTime = 0, late = 0, earlyLeave = 0, absent = 0, off = 0 } = stats;
  const totalAccountable = onTime + late + earlyLeave + absent;
  if (totalAccountable === 0) return 0;

  // Weighted score: onTime fully counts, late/early half, absent zero
  const weighted = onTime + 0.6 * late + 0.4 * earlyLeave;
  const score = Math.round((weighted / totalAccountable) * 100);
  return Math.max(0, Math.min(100, score));
}

export function getHealthLabel(score) {
  if (score >= 90) return { label: "Thriving", emoji: "🌟", color: "emerald" };
  if (score >= 75) return { label: "Healthy", emoji: "🌱", color: "green" };
  if (score >= 60) return { label: "Steady", emoji: "🌳", color: "lime" };
  if (score >= 40) return { label: "Struggling", emoji: "🍂", color: "amber" };
  return { label: "Declining", emoji: "🥀", color: "rose" };
}

/** Detect if a date is the user's work-anniversary or join-anniversary */
export function isAnniversary(joinedAt, today = new Date()) {
  if (!joinedAt) return false;
  const joined = joinedAt.toDate ? joinedAt.toDate() : new Date(joinedAt);
  return (
    joined.getMonth() === today.getMonth() &&
    joined.getDate() === today.getDate() &&
    joined.getFullYear() !== today.getFullYear()
  );
}
