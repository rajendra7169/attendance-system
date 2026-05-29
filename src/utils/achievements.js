import { getDayTone, OFFICE_START, OFFICE_END } from "./calendarUtils";

/**
 * All achievement definitions. Each has:
 *  - id: stable key
 *  - icon: emoji shown on the badge
 *  - name + desc: display text
 *  - tier: bronze | silver | gold | platinum
 *  - check(records, opts): returns { unlocked: bool, progress?: 0-1, value?: number }
 */
export const ACHIEVEMENTS = [
  {
    id: "first_tree",
    icon: "🌱",
    name: "First Tree",
    desc: "Plant your first tree (show up once)",
    tier: "bronze",
    check: (records) => {
      const grown = records.filter(
        (r) => r.status === "present" && (r.state ?? "approved") === "approved",
      ).length;
      return { unlocked: grown >= 1, value: Math.min(grown, 1), progress: Math.min(grown, 1) };
    },
  },
  {
    id: "ten_trees",
    icon: "🌳",
    name: "Sapling Grove",
    desc: "Grow 10 trees",
    tier: "bronze",
    check: (records) => {
      const grown = records.filter(
        (r) => r.status === "present" && (r.state ?? "approved") === "approved",
      ).length;
      return { unlocked: grown >= 10, value: grown, progress: Math.min(grown / 10, 1) };
    },
  },
  {
    id: "fifty_trees",
    icon: "🌲",
    name: "Forest Builder",
    desc: "Grow 50 trees",
    tier: "silver",
    check: (records) => {
      const grown = records.filter(
        (r) => r.status === "present" && (r.state ?? "approved") === "approved",
      ).length;
      return { unlocked: grown >= 50, value: grown, progress: Math.min(grown / 50, 1) };
    },
  },
  {
    id: "hundred_trees",
    icon: "🎄",
    name: "Centurion",
    desc: "Grow 100 trees",
    tier: "gold",
    check: (records) => {
      const grown = records.filter(
        (r) => r.status === "present" && (r.state ?? "approved") === "approved",
      ).length;
      return { unlocked: grown >= 100, value: grown, progress: Math.min(grown / 100, 1) };
    },
  },
  {
    id: "early_bird",
    icon: "🐦",
    name: "Early Bird",
    desc: "Check in before office hours 5 times",
    tier: "bronze",
    check: (records, { start = OFFICE_START } = {}) => {
      const early = records.filter(
        (r) => r.entryTime && r.entryTime < start,
      ).length;
      return { unlocked: early >= 5, value: early, progress: Math.min(early / 5, 1) };
    },
  },
  {
    id: "night_owl",
    icon: "🦉",
    name: "Night Owl",
    desc: "Work overtime 10 times",
    tier: "silver",
    check: (records, { end = OFFICE_END } = {}) => {
      const ot = records.filter(
        (r) => r.exitTime && r.exitTime > end,
      ).length;
      return { unlocked: ot >= 10, value: ot, progress: Math.min(ot / 10, 1) };
    },
  },
  {
    id: "perfect_week",
    icon: "✨",
    name: "Perfect Week",
    desc: "5 on-time days in a row",
    tier: "silver",
    check: (records, { start, end } = {}) => {
      const sorted = [...records]
        .filter((r) => r.exitTime && r.entryTime)
        .sort((a, b) => a.date.localeCompare(b.date));
      let best = 0, cur = 0;
      sorted.forEach((r) => {
        const tone = getDayTone(r, { start, end });
        if (tone === "good") {
          cur++;
          best = Math.max(best, cur);
        } else {
          cur = 0;
        }
      });
      return { unlocked: best >= 5, value: best, progress: Math.min(best / 5, 1) };
    },
  },
  {
    id: "perfect_month",
    icon: "🏆",
    name: "Perfect Month",
    desc: "20 on-time days in a single month",
    tier: "gold",
    check: (records, { start, end } = {}) => {
      const byMonth = {};
      records.forEach((r) => {
        if (!r.exitTime || !r.entryTime) return;
        const tone = getDayTone(r, { start, end });
        if (tone !== "good") return;
        const month = r.date.slice(0, 7);
        byMonth[month] = (byMonth[month] || 0) + 1;
      });
      const max = Math.max(0, ...Object.values(byMonth));
      return { unlocked: max >= 20, value: max, progress: Math.min(max / 20, 1) };
    },
  },
  {
    id: "streak_30",
    icon: "🔥",
    name: "Hot Streak",
    desc: "30-day attendance streak",
    tier: "gold",
    check: (records) => {
      const dates = new Set(
        records
          .filter(
            (r) =>
              (r.status === "present" || r.status === "off") &&
              (r.state ?? "approved") === "approved",
          )
          .map((r) => r.date),
      );
      const sorted = [...dates].sort();
      let best = 0, cur = 1;
      for (let i = 1; i < sorted.length; i++) {
        const a = new Date(sorted[i - 1]);
        const b = new Date(sorted[i]);
        const diff = (b - a) / 86400000;
        if (diff === 1) cur++;
        else cur = 1;
        best = Math.max(best, cur);
      }
      if (sorted.length === 1) best = 1;
      return { unlocked: best >= 30, value: best, progress: Math.min(best / 30, 1) };
    },
  },
  {
    id: "streak_100",
    icon: "💯",
    name: "Centurion Streak",
    desc: "100-day attendance streak",
    tier: "platinum",
    check: (records) => {
      const dates = new Set(
        records
          .filter(
            (r) =>
              (r.status === "present" || r.status === "off") &&
              (r.state ?? "approved") === "approved",
          )
          .map((r) => r.date),
      );
      const sorted = [...dates].sort();
      let best = 0, cur = 1;
      for (let i = 1; i < sorted.length; i++) {
        const a = new Date(sorted[i - 1]);
        const b = new Date(sorted[i]);
        const diff = (b - a) / 86400000;
        if (diff === 1) cur++;
        else cur = 1;
        best = Math.max(best, cur);
      }
      if (sorted.length === 1) best = 1;
      return { unlocked: best >= 100, value: best, progress: Math.min(best / 100, 1) };
    },
  },
  {
    id: "no_absences",
    icon: "👑",
    name: "Untouchable",
    desc: "100 working days with zero absences",
    tier: "platinum",
    check: (records) => {
      const total = records.filter(
        (r) =>
          (r.status === "present" || r.status === "absent") &&
          (r.state ?? "approved") === "approved",
      ).length;
      const absent = records.filter(
        (r) => r.status === "absent" && (r.state ?? "approved") === "approved",
      ).length;
      const unlocked = total >= 100 && absent === 0;
      return {
        unlocked,
        value: total,
        progress: absent > 0 ? 0 : Math.min(total / 100, 1),
      };
    },
  },
];

export function evaluateAchievements(records, opts = {}) {
  return ACHIEVEMENTS.map((a) => ({
    ...a,
    state: a.check(records || [], opts),
  }));
}

export const TIER_STYLES = {
  bronze: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    ring: "ring-amber-300",
    label: "Bronze",
  },
  silver: {
    bg: "bg-slate-200",
    text: "text-slate-700",
    ring: "ring-slate-300",
    label: "Silver",
  },
  gold: {
    bg: "bg-yellow-100",
    text: "text-yellow-700",
    ring: "ring-yellow-300",
    label: "Gold",
  },
  platinum: {
    bg: "bg-indigo-100",
    text: "text-indigo-700",
    ring: "ring-indigo-300",
    label: "Platinum",
  },
};
