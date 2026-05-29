import React, { useState, useMemo, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Share2 } from "lucide-react";
import confetti from "canvas-confetti";
import { getDayTone } from "../utils/calendarUtils";
import { getForestHealthScore, getHealthLabel } from "../utils/forestTheme";

/**
 * "Year in Review" — Spotify Wrapped style, 6 slides + summary.
 * Shareable as image (uses canvas toBlob).
 */
const SLIDE_GRADIENTS = [
  "from-violet-500 via-fuchsia-500 to-pink-500",
  "from-amber-400 via-orange-500 to-rose-500",
  "from-emerald-400 via-teal-500 to-cyan-500",
  "from-blue-500 via-indigo-500 to-violet-600",
  "from-rose-500 via-fuchsia-500 to-indigo-500",
  "from-emerald-500 via-emerald-600 to-emerald-700",
  "from-amber-400 via-rose-500 to-indigo-600",
];

export function YearInReview({ records, year, displayName, onClose }) {
  const [slide, setSlide] = useState(0);

  const yearRecords = useMemo(
    () => (records || []).filter((r) => r.date?.startsWith(`${year}-`)),
    [records, year],
  );

  const stats = useMemo(() => {
    const present = yearRecords.filter(
      (r) => r.status === "present" && (r.state ?? "approved") === "approved",
    );
    const absent = yearRecords.filter(
      (r) => r.status === "absent" && (r.state ?? "approved") === "approved",
    );
    const off = yearRecords.filter(
      (r) => r.status === "off" && (r.state ?? "approved") === "approved",
    );
    const overtime = present.filter(
      (r) => r.exitTime && r.exitTime > "17:30",
    ).length;
    const earlyBird = present.filter(
      (r) => r.entryTime && r.entryTime < "10:00",
    ).length;

    // Best streak
    const dates = [
      ...new Set(
        yearRecords
          .filter((r) => (r.status === "present" || r.status === "off") && (r.state ?? "approved") === "approved")
          .map((r) => r.date),
      ),
    ].sort();
    let best = 0, cur = 1;
    for (let i = 1; i < dates.length; i++) {
      const diff = (new Date(dates[i]) - new Date(dates[i - 1])) / 86400000;
      if (diff === 1) cur++;
      else cur = 1;
      best = Math.max(best, cur);
    }
    if (dates.length === 1) best = 1;

    // Best month
    const byMonth = {};
    present.forEach((r) => {
      const m = r.date.slice(0, 7);
      byMonth[m] = (byMonth[m] || 0) + 1;
    });
    const bestMonth = Object.entries(byMonth).sort((a, b) => b[1] - a[1])[0];

    // Average entry/exit
    const entryMins = present
      .filter((r) => r.entryTime)
      .map((r) => {
        const [h, m] = r.entryTime.split(":").map(Number);
        return h * 60 + m;
      });
    const avgEntryMin = entryMins.length
      ? Math.round(entryMins.reduce((a, b) => a + b, 0) / entryMins.length)
      : null;
    const avgEntry = avgEntryMin
      ? `${String(Math.floor(avgEntryMin / 60)).padStart(2, "0")}:${String(avgEntryMin % 60).padStart(2, "0")}`
      : null;

    const onTime = present.filter((r) => {
      const tone = getDayTone(r);
      return tone === "good";
    }).length;

    const health = getForestHealthScore({
      onTime, late: present.length - onTime, earlyLeave: 0, absent: absent.length,
    });

    return {
      trees: present.length,
      absent: absent.length,
      off: off.length,
      overtime,
      earlyBird,
      bestStreak: best,
      bestMonth,
      avgEntry,
      health,
    };
  }, [yearRecords]);

  useEffect(() => {
    // Confetti on mount
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
  }, []);

  const slides = [
    {
      title: `Hey ${displayName?.split(" ")[0] || "you"}!`,
      subtitle: `Your ${year} in trees`,
      big: "🌳",
      desc: "Let's look back at the forest you grew this year.",
    },
    {
      title: "Trees planted",
      big: stats.trees,
      subtitle: stats.trees > 0 ? "Days you showed up" : "Plant your first tree!",
      desc: stats.trees >= 200 ? "A whole rainforest! 🌳🌳🌳"
        : stats.trees >= 100 ? "A proper forest!"
        : stats.trees >= 50 ? "A nice grove."
        : "Every day adds up.",
    },
    {
      title: "Longest streak",
      big: `${stats.bestStreak} days`,
      subtitle: "Your unstoppable run",
      desc: stats.bestStreak >= 30 ? "Hot streak! 🔥"
        : stats.bestStreak >= 10 ? "Consistency is everything."
        : "Keep stacking days!",
    },
    {
      title: "Overtime trees",
      big: stats.overtime,
      subtitle: "Days you stayed late",
      desc: stats.overtime >= 50 ? "Dedicated! Make sure to rest too."
        : stats.overtime >= 20 ? "Going the extra mile."
        : "Work-life balance ✓",
    },
    {
      title: "Average arrival",
      big: stats.avgEntry || "—",
      subtitle: "Your usual check-in time",
      desc: stats.earlyBird > 20 ? "Early bird gets the worm 🐦"
        : "Steady arrival pattern.",
    },
    {
      title: "Best month",
      big: stats.bestMonth ? new Date(stats.bestMonth[0] + "-01").toLocaleDateString(undefined, { month: "long" }) : "—",
      subtitle: stats.bestMonth ? `${stats.bestMonth[1]} trees grown` : "",
      desc: "Your most productive month.",
    },
    {
      title: "Forest health",
      big: `${stats.health}/100`,
      subtitle: getHealthLabel(stats.health).label,
      desc: `${getHealthLabel(stats.health).emoji} Your forest is ${getHealthLabel(stats.health).label.toLowerCase()}.`,
    },
  ];

  const current = slides[slide];

  const next = () => {
    if (slide < slides.length - 1) {
      setSlide(slide + 1);
      if (slide === slides.length - 2) {
        // Final slide — confetti burst
        setTimeout(() => {
          confetti({
            particleCount: 150,
            spread: 100,
            origin: { y: 0.4 },
          });
        }, 300);
      }
    }
  };
  const prev = () => slide > 0 && setSlide(slide - 1);

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-md aspect-[9/16] sm:aspect-[3/4] rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-br ${SLIDE_GRADIENTS[slide % SLIDE_GRADIENTS.length]} transition-all duration-500`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bars at top */}
        <div className="absolute top-3 left-3 right-3 flex gap-1 z-10">
          {slides.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all"
                style={{ width: i < slide ? "100%" : i === slide ? "100%" : "0%" }}
              />
            </div>
          ))}
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-6 right-3 z-10 w-8 h-8 rounded-full bg-white/20 backdrop-blur text-white flex items-center justify-center hover:bg-white/30"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-white text-center">
          <p className="text-sm font-medium opacity-90 mb-2 uppercase tracking-wider">
            {current.subtitle}
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
            {current.title}
          </h2>
          <div className="text-6xl sm:text-8xl font-extrabold mb-6 drop-shadow-lg">
            {current.big}
          </div>
          <p className="text-base opacity-90 max-w-xs">{current.desc}</p>
        </div>

        {/* Tap zones */}
        <button
          onClick={prev}
          className="absolute left-0 top-0 bottom-0 w-1/3 cursor-pointer"
          aria-label="Previous"
          disabled={slide === 0}
        />
        <button
          onClick={next}
          className="absolute right-0 top-0 bottom-0 w-2/3 cursor-pointer"
          aria-label="Next"
          disabled={slide === slides.length - 1}
        />

        {/* Bottom controls */}
        <div className="absolute bottom-5 left-0 right-0 flex items-center justify-between px-5">
          <button
            onClick={prev}
            disabled={slide === 0}
            className="text-white/80 hover:text-white disabled:opacity-30"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <p className="text-xs text-white/70 tabular-nums">
            {slide + 1} / {slides.length}
          </p>
          {slide === slides.length - 1 ? (
            <button
              onClick={() => {
                navigator.share?.({
                  title: `My ${year} in trees`,
                  text: `I grew ${stats.trees} trees in ${year}! 🌳`,
                });
              }}
              className="text-white/80 hover:text-white"
              title="Share"
            >
              <Share2 className="w-5 h-5" />
            </button>
          ) : (
            <button onClick={next} className="text-white/80 hover:text-white">
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
