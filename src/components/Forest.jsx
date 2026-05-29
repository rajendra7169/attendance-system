import React, { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight, Trees } from "lucide-react";
import {
  getDayTone,
  MONTHS,
  OFFICE_START,
  OFFICE_END,
} from "../utils/calendarUtils";

/* Deterministic seeded random — same date → same value every render */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rand01(seed) {
  return (hash(seed) % 100000) / 100000;
}

function timeToMin(t) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}
function mix(c1, c2, t) {
  const a = hexToRgb(c1);
  const b = hexToRgb(c2);
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)}, ${Math.round(a[1] + (b[1] - a[1]) * t)}, ${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}

/* Map clock time → sky state and celestial body positions */
function getSkyState(now, w, h) {
  const hours = now.getHours() + now.getMinutes() / 60;
  const dawnStart = 5.5;
  const dawnEnd = 7;
  const duskStart = 17;
  const duskEnd = 18.5;

  // Day palette
  const dayTop = "#bfdbfe";
  const dayBottom = "#fef3c7";
  // Night palette
  const nightTop = "#0b1729";
  const nightBottom = "#1e3a5f";
  // Twilight palettes
  const dawnTop = "#fda4af";
  const dawnBottom = "#fdba74";
  const duskTop = "#7c3aed";
  const duskBottom = "#fb7185";

  let phase, skyTop, skyBottom, sunOpacity, moonOpacity;

  if (hours < dawnStart || hours > duskEnd) {
    phase = "night";
    skyTop = nightTop;
    skyBottom = nightBottom;
    sunOpacity = 0;
    moonOpacity = 1;
  } else if (hours < dawnEnd) {
    const t = (hours - dawnStart) / (dawnEnd - dawnStart);
    phase = "dawn";
    // From night → dawn pink → day
    if (t < 0.5) {
      const k = t * 2;
      skyTop = mix(nightTop, dawnTop, k);
      skyBottom = mix(nightBottom, dawnBottom, k);
    } else {
      const k = (t - 0.5) * 2;
      skyTop = mix(dawnTop, dayTop, k);
      skyBottom = mix(dawnBottom, dayBottom, k);
    }
    sunOpacity = t;
    moonOpacity = 1 - t;
  } else if (hours > duskStart && hours <= duskEnd) {
    const t = (hours - duskStart) / (duskEnd - duskStart);
    phase = "dusk";
    if (t < 0.5) {
      const k = t * 2;
      skyTop = mix(dayTop, duskTop, k);
      skyBottom = mix(dayBottom, duskBottom, k);
    } else {
      const k = (t - 0.5) * 2;
      skyTop = mix(duskTop, nightTop, k);
      skyBottom = mix(duskBottom, nightBottom, k);
    }
    sunOpacity = 1 - t;
    moonOpacity = t;
  } else {
    phase = "day";
    skyTop = dayTop;
    skyBottom = dayBottom;
    sunOpacity = 1;
    moonOpacity = 0;
  }

  // Celestial body — sun arcs from east (left=0.1) to west (right=0.9)
  // Moon takes the opposite trajectory at night
  const sunProgress = Math.max(0, Math.min(1, (hours - dawnStart) / (duskEnd - dawnStart)));
  const sunX = w * (0.1 + sunProgress * 0.8);
  const sunY = h * (0.5 - Math.sin(sunProgress * Math.PI) * 0.35);

  // Moon: rises after dusk, sets at dawn
  const nightHours = ((hours - duskEnd + 24) % 24) / (24 - (duskEnd - dawnStart));
  const moonProgress = Math.max(0, Math.min(1, nightHours));
  const moonX = w * (0.1 + moonProgress * 0.8);
  const moonY = h * (0.5 - Math.sin(moonProgress * Math.PI) * 0.35);

  return {
    phase,
    skyTop,
    skyBottom,
    sun: { x: sunX, y: sunY, opacity: sunOpacity },
    moon: { x: moonX, y: moonY, opacity: moonOpacity },
  };
}

function todayDateKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function classify(record, officeStart, officeEnd, now) {
  if (!record) return null;
  if (record.state === "rejected") return null;
  if (record.status === "absent") return { kind: "dead", size: 1, pending: record.state === "pending" };
  if (record.status === "off") return { kind: "stump", size: 1, pending: record.state === "pending" };

  // Present — derive size from time worked
  const entry = timeToMin(record.entryTime);
  let exit = timeToMin(record.exitTime);
  const start = timeToMin(officeStart);
  const end = timeToMin(officeEnd);

  // If no exit yet and the record is for today, grow live using current time
  const isLiveGrowing =
    record.exitTime == null || record.exitTime === "";
  const isTodayRecord = now && record.date === todayDateKey(now);
  if (isLiveGrowing && isTodayRecord) {
    exit = now.getHours() * 60 + now.getMinutes();
  }

  let size = 1;
  if (entry != null && exit != null && start != null && end != null) {
    const standard = end - start;
    const worked = Math.max(0, exit - entry);
    size = Math.max(0.2, Math.min(1.6, worked / standard));
  }

  // For live growing, derive tone using the effective times
  const effectiveRecord = isLiveGrowing && isTodayRecord
    ? { ...record, exitTime: `${String(Math.floor(exit / 60)).padStart(2, "0")}:${String(exit % 60).padStart(2, "0")}` }
    : record;

  const tone = getDayTone(effectiveRecord, { start: officeStart, end: officeEnd });
  const kind =
    tone === "good"
      ? size > 1.05
        ? "overtime"
        : "healthy"
      : tone === "late_early"
        ? "stunted"
        : tone === "early_out"
          ? "stunted"
          : tone === "late"
            ? "late"
            : "healthy";

  return {
    kind,
    size,
    pending: record.state === "pending",
    growing: isLiveGrowing && isTodayRecord,
  };
}

function pickShape(seedKey) {
  return ["pine", "oak", "willow"][hash(seedKey) % 3];
}

/* ---------- Tree SVG variants ---------- */
function Tree({ x, y, size, kind, shape, date, pending, growing, onHover, onLeave }) {
  const baseScale = 0.7 + size * 0.6; // 0.4→0.94, 1.0→1.3, 1.5→1.6
  const props = {
    transform: `translate(${x}, ${y}) scale(${baseScale})`,
    style: {
      cursor: "pointer",
      opacity: pending && !growing ? 0.65 : 1,
      transition: "transform 0.6s ease-out",
    },
    onMouseEnter: () => onHover?.({ date, kind, size, x, y, growing }),
    onMouseLeave: () => onLeave?.(),
  };

  if (kind === "stump") {
    return (
      <g {...props}>
        <ellipse cx="0" cy="2" rx="14" ry="3" fill="#92400e" opacity="0.3" />
        <rect x="-8" y="-6" width="16" height="8" rx="2" fill="#92400e" />
        <ellipse cx="0" cy="-6" rx="8" ry="2.5" fill="#b45309" />
        <circle cx="0" cy="-6" r="2" fill="#78350f" opacity="0.6" />
      </g>
    );
  }

  if (kind === "dead") {
    return (
      <g {...props} opacity="0.7">
        <ellipse cx="0" cy="2" rx="14" ry="3" fill="#525252" opacity="0.3" />
        <rect x="-2" y="-26" width="4" height="28" fill="#57534e" />
        <line x1="0" y1="-18" x2="10" y2="-26" stroke="#57534e" strokeWidth="2" />
        <line x1="0" y1="-12" x2="-9" y2="-19" stroke="#57534e" strokeWidth="2" />
        <line x1="0" y1="-22" x2="6" y2="-32" stroke="#57534e" strokeWidth="1.5" />
        <line x1="0" y1="-22" x2="-5" y2="-30" stroke="#57534e" strokeWidth="1.5" />
      </g>
    );
  }

  if (kind === "pending") {
    return (
      <g {...props} opacity="0.5">
        <ellipse cx="0" cy="2" rx="14" ry="3" fill="#a3a3a3" opacity="0.2" />
        <rect x="-2" y="-12" width="4" height="14" fill="none" stroke="#71717a" strokeWidth="1.5" strokeDasharray="2 2" />
        <circle cx="0" cy="-20" r="14" fill="none" stroke="#71717a" strokeWidth="1.5" strokeDasharray="3 3" />
      </g>
    );
  }

  // Healthy / late / stunted / overtime variants
  const leafColor =
    kind === "overtime"
      ? "#15803d"
      : kind === "late"
        ? "#84cc16"
        : kind === "stunted"
          ? "#65a30d"
          : "#16a34a";
  const leafShade =
    kind === "overtime"
      ? "#166534"
      : kind === "late"
        ? "#65a30d"
        : kind === "stunted"
          ? "#4d7c0f"
          : "#15803d";

  // Shared growing halo — used by all tree shapes when the tree is the live one today
  const growingHalo = growing ? (
    <circle cx="0" cy="-22" r="22" fill="#bbf7d0" opacity="0.5">
      <animate
        attributeName="r"
        values="20;28;20"
        dur="2.5s"
        repeatCount="indefinite"
      />
      <animate
        attributeName="opacity"
        values="0.3;0.65;0.3"
        dur="2.5s"
        repeatCount="indefinite"
      />
    </circle>
  ) : null;

  if (shape === "pine") {
    return (
      <g {...props}>
        <ellipse cx="0" cy="2" rx="14" ry="3" fill="#000" opacity="0.15" />
        {growingHalo}
        <rect x="-2.5" y="-8" width="5" height="10" fill="#78350f" />
        <polygon points="0,-30 -14,-8 14,-8" fill={leafColor} />
        <polygon points="0,-38 -10,-20 10,-20" fill={leafShade} />
        <polygon points="0,-44 -7,-30 7,-30" fill={leafColor} />
        {kind === "overtime" && (
          <circle cx="6" cy="-32" r="1.8" fill="#fef9c3" opacity="0.9" />
        )}
      </g>
    );
  }

  if (shape === "willow") {
    return (
      <g {...props}>
        <ellipse cx="0" cy="2" rx="14" ry="3" fill="#000" opacity="0.15" />
        {growingHalo}
        <rect x="-2" y="-6" width="4" height="8" fill="#78350f" />
        <ellipse cx="0" cy="-20" rx="16" ry="14" fill={leafColor} />
        <ellipse cx="-6" cy="-14" rx="6" ry="9" fill={leafShade} opacity="0.6" />
        <ellipse cx="6" cy="-12" rx="5" ry="8" fill={leafShade} opacity="0.6" />
        {kind === "overtime" && (
          <circle cx="-4" cy="-26" r="1.8" fill="#fef9c3" opacity="0.9" />
        )}
      </g>
    );
  }

  // oak (default)
  return (
    <g {...props}>
      <ellipse cx="0" cy="2" rx="14" ry="3" fill="#000" opacity="0.15" />
      {growingHalo}
      <rect x="-2.5" y="-10" width="5" height="12" fill="#78350f" />
      <circle cx="0" cy="-22" r="14" fill={leafColor} />
      <circle cx="-8" cy="-16" r="7" fill={leafShade} opacity="0.8" />
      <circle cx="8" cy="-18" r="6" fill={leafShade} opacity="0.6" />
      <circle cx="0" cy="-28" r="5" fill={leafColor} />
      {kind === "overtime" && (
        <circle cx="5" cy="-26" r="1.8" fill="#fef9c3" opacity="0.9" />
      )}
    </g>
  );
}

/* ---------- Main Forest ---------- */
export function Forest({ records, company, title = "Your forest" }) {
  const officeStart = company?.officeStart || OFFICE_START;
  const officeEnd = company?.officeEnd || OFFICE_END;

  // "Now" ticks every 30 seconds so the live tree visibly grows
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  const [mode, setMode] = useState("month"); // "month" | "year"
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [hovered, setHovered] = useState(null);

  // Filter records to the current view
  const filtered = useMemo(() => {
    return (records || []).filter((r) => {
      if (!r.date) return false;
      const [y, m] = r.date.split("-").map(Number);
      if (y !== year) return false;
      if (mode === "month" && m - 1 !== month) return false;
      return true;
    });
  }, [records, mode, month, year]);

  // Map to tree objects with stable positions
  const trees = useMemo(() => {
    const items = [];
    filtered.forEach((r) => {
      const c = classify(r, officeStart, officeEnd, now);
      if (!c) return;
      const xPct = rand01(r.date + "x") * 0.86 + 0.07; // 7% - 93%
      const yPct = rand01(r.date + "y") * 0.55 + 0.4;  // 40% - 95%
      items.push({
        date: r.date,
        record: r,
        ...c,
        shape: pickShape(r.date + "s"),
        xPct,
        yPct,
      });
    });
    // Sort by yPct so trees in front render last (depth)
    items.sort((a, b) => a.yPct - b.yPct);
    return items;
  }, [filtered, officeStart, officeEnd, now]);

  // Stats
  const stats = useMemo(() => {
    let grown = 0,
      dead = 0,
      stumps = 0,
      overtime = 0,
      bestStreak = 0,
      curStreak = 0;

    // Sort records by date for streak calc
    const sorted = [...filtered].sort((a, b) => a.date.localeCompare(b.date));
    sorted.forEach((r) => {
      const c = classify(r, officeStart, officeEnd, now);
      if (!c) return;
      if (c.kind === "dead") {
        dead++;
        curStreak = 0;
      } else if (c.kind === "stump") {
        stumps++;
        curStreak = 0;
      } else if (c.kind === "pending") {
        // pending doesn't count
      } else {
        grown++;
        if (c.kind === "overtime") overtime++;
        curStreak++;
        bestStreak = Math.max(bestStreak, curStreak);
      }
    });

    return { grown, dead, stumps, overtime, bestStreak };
  }, [filtered, officeStart, officeEnd, now]);

  const canvas = { w: 1000, h: 500 };

  // Time-based sky (re-computes every tick from `now`)
  const sky = useMemo(
    () => getSkyState(now, canvas.w, canvas.h),
    [now, canvas.w, canvas.h],
  );
  // Darken ground a touch at night
  const groundTop = sky.phase === "night" ? "#15803d" : "#bbf7d0";
  const groundBottom = sky.phase === "night" ? "#166534" : "#86efac";

  // Deterministic decoration based on forest health
  const grownCount = stats.grown;
  const deadCount = stats.dead;
  const seasonSeed = `${year}-${month}-${mode}`;

  // Birds — base flock of 4, growing with healthy forest (max 9), trimmed by death
  const birdCount = Math.min(9, Math.max(3, 4 + Math.floor(grownCount / 4) - Math.floor(deadCount / 3)));
  const birds = useMemo(() => {
    const arr = [];
    for (let i = 0; i < birdCount; i++) {
      const seed = `${seasonSeed}-bird-${i}`;
      // Half fly left→right, half fly right→left for variety
      const reversed = i % 2 === 1;
      arr.push({
        id: seed,
        y: 30 + rand01(seed + "y") * 140,
        size: 0.6 + rand01(seed + "s") * 0.7,
        duration: 16 + rand01(seed + "d") * 18,
        delay: rand01(seed + "t") * 30,
        reversed,
      });
    }
    return arr;
  }, [birdCount, seasonSeed]);

  // Grass — clustered patches with variety (tufts, single blades, flowers)
  const grass = useMemo(() => {
    const arr = [];
    // 20 cluster centers
    for (let c = 0; c < 20; c++) {
      const seed = `${seasonSeed}-cluster-${c}`;
      const cx = rand01(seed + "x") * canvas.w;
      const cy = canvas.h * 0.58 + rand01(seed + "y") * canvas.h * 0.4;
      // 4-7 elements per cluster
      const clusterSize = 4 + Math.floor(rand01(seed + "n") * 4);
      for (let i = 0; i < clusterSize; i++) {
        const eSeed = `${seed}-${i}`;
        const offsetX = (rand01(eSeed + "dx") - 0.5) * 60;
        const offsetY = (rand01(eSeed + "dy") - 0.5) * 30;
        const typeRoll = rand01(eSeed + "t");
        let kind;
        if (typeRoll < 0.55) kind = "tuft";
        else if (typeRoll < 0.8) kind = "blade";
        else if (typeRoll < 0.95) kind = "flower";
        else kind = "mushroom";
        arr.push({
          id: eSeed,
          x: cx + offsetX,
          y: cy + offsetY,
          size: 0.6 + rand01(eSeed + "s") * 0.8,
          shade: rand01(eSeed + "c") > 0.5 ? "#16a34a" : "#22c55e",
          kind,
          flowerColor: ["#ec4899", "#fbbf24", "#a78bfa", "#f97316"][
            Math.floor(rand01(eSeed + "f") * 4)
          ],
        });
      }
    }
    // Plus 25 loose tufts for natural sparseness
    for (let i = 0; i < 25; i++) {
      const seed = `${seasonSeed}-loose-${i}`;
      arr.push({
        id: seed,
        x: rand01(seed + "x") * canvas.w,
        y: canvas.h * 0.58 + rand01(seed + "y") * canvas.h * 0.4,
        size: 0.4 + rand01(seed + "s") * 0.5,
        shade: rand01(seed + "c") > 0.5 ? "#16a34a" : "#22c55e",
        kind: rand01(seed + "k") > 0.6 ? "blade" : "tuft",
      });
    }
    return arr;
  }, [seasonSeed]);

  // Stars (only visible at night/dusk/dawn)
  const stars = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 50; i++) {
      const seed = `stars-${i}`;
      arr.push({
        id: seed,
        x: rand01(seed + "x") * canvas.w,
        y: rand01(seed + "y") * canvas.h * 0.5,
        size: 0.5 + rand01(seed + "s") * 1.2,
        twinkle: 1 + rand01(seed + "t") * 2,
      });
    }
    return arr;
  }, []);

  // Animals appear based on forest health
  const animals = useMemo(() => {
    const arr = [];
    if (grownCount >= 1) {
      arr.push({ kind: "butterfly", id: "bfly-1", x: 0.3, y: 0.45 });
    }
    if (grownCount >= 3) {
      arr.push({ kind: "rabbit", id: "rabbit-1", x: 0.18, y: 0.88 });
    }
    if (grownCount >= 7) {
      arr.push({ kind: "butterfly", id: "bfly-2", x: 0.68, y: 0.52 });
    }
    if (grownCount >= 10) {
      arr.push({ kind: "deer", id: "deer-1", x: 0.82, y: 0.86 });
    }
    if (grownCount >= 14) {
      arr.push({ kind: "rabbit", id: "rabbit-2", x: 0.55, y: 0.92 });
    }
    return arr;
  }, [grownCount]);

  const changeMonth = (delta) => {
    let m = month + delta;
    let y = year;
    if (m < 0) {
      m = 11;
      y--;
    } else if (m > 11) {
      m = 0;
      y++;
    }
    setMonth(m);
    setYear(y);
  };

  return (
    <div className="surface-elevated overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-600">
            <Trees className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold tracking-tight">{title}</h3>
            <p className="text-xs text-[var(--text-muted)]">
              Every present day plants a tree
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex gap-1 p-1 bg-[var(--bg-soft)] rounded-md border border-[var(--border)]">
            <button
              onClick={() => setMode("month")}
              className={`px-2.5 py-1 text-xs font-medium rounded transition ${
                mode === "month"
                  ? "bg-white text-[var(--text)] shadow-sm"
                  : "text-[var(--text-secondary)]"
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setMode("year")}
              className={`px-2.5 py-1 text-xs font-medium rounded transition ${
                mode === "year"
                  ? "bg-white text-[var(--text)] shadow-sm"
                  : "text-[var(--text-secondary)]"
              }`}
            >
              Year
            </button>
          </div>

          {mode === "month" ? (
            <div className="flex items-center gap-1">
              <button onClick={() => changeMonth(-1)} className="btn btn-secondary btn-icon">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-sm font-medium px-2 tabular-nums min-w-[110px] text-center">
                {MONTHS[month]} {year}
              </span>
              <button onClick={() => changeMonth(1)} className="btn btn-secondary btn-icon">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <button onClick={() => setYear(year - 1)} className="btn btn-secondary btn-icon">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-sm font-medium px-2 tabular-nums min-w-[60px] text-center">
                {year}
              </span>
              <button onClick={() => setYear(year + 1)} className="btn btn-secondary btn-icon">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Forest canvas */}
      <div className="relative">
        <svg
          viewBox={`0 0 ${canvas.w} ${canvas.h}`}
          className="w-full h-auto block"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={sky.skyTop} />
              <stop offset="100%" stopColor={sky.skyBottom} />
            </linearGradient>
            <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={groundTop} />
              <stop offset="100%" stopColor={groundBottom} />
            </linearGradient>
            <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={sky.phase === "night" ? "#1e40af" : "#7dd3fc"} />
              <stop offset="100%" stopColor={sky.phase === "night" ? "#0c1e3e" : "#3b82f6"} />
            </linearGradient>
            <linearGradient id="mountain" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={sky.phase === "night" ? "#1e3a8a" : "#a7f3d0"} />
              <stop offset="100%" stopColor={sky.phase === "night" ? "#172554" : "#6ee7b7"} />
            </linearGradient>
          </defs>

          {/* Sky */}
          <rect x="0" y="0" width={canvas.w} height={canvas.h * 0.55} fill="url(#sky)" />

          {/* Stars — visible at night & during dawn/dusk twilight */}
          {(sky.phase === "night" || sky.phase === "dawn" || sky.phase === "dusk") &&
            stars.map((s) => {
              const starOpacity =
                sky.phase === "night" ? 1 : sky.phase === "dawn" ? 1 - sky.sun.opacity : sky.moon.opacity;
              return (
                <circle
                  key={s.id}
                  cx={s.x}
                  cy={s.y}
                  r={s.size}
                  fill="white"
                  opacity={starOpacity * 0.9}
                >
                  <animate
                    attributeName="opacity"
                    values={`${starOpacity * 0.3};${starOpacity * 0.9};${starOpacity * 0.3}`}
                    dur={`${s.twinkle}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              );
            })}

          {/* Sun */}
          {sky.sun.opacity > 0.01 && (
            <g opacity={sky.sun.opacity}>
              <circle cx={sky.sun.x} cy={sky.sun.y} r="46" fill="#fde047" opacity="0.2" />
              <circle cx={sky.sun.x} cy={sky.sun.y} r="36" fill="#fde047" opacity="0.4" />
              <circle cx={sky.sun.x} cy={sky.sun.y} r="28" fill="#fbbf24" />
            </g>
          )}

          {/* Moon */}
          {sky.moon.opacity > 0.01 && (
            <g opacity={sky.moon.opacity}>
              <circle cx={sky.moon.x} cy={sky.moon.y} r="32" fill="#f1f5f9" opacity="0.25" />
              <circle cx={sky.moon.x} cy={sky.moon.y} r="22" fill="#f8fafc" />
              <circle cx={sky.moon.x - 6} cy={sky.moon.y - 4} r="3" fill="#cbd5e1" opacity="0.5" />
              <circle cx={sky.moon.x + 5} cy={sky.moon.y + 6} r="2" fill="#cbd5e1" opacity="0.4" />
            </g>
          )}

          {/* Distant rolling hills */}
          <path
            d={`M0,${canvas.h * 0.55} Q${canvas.w * 0.15},${canvas.h * 0.42} ${canvas.w * 0.32},${canvas.h * 0.5} T${canvas.w * 0.6},${canvas.h * 0.48} T${canvas.w},${canvas.h * 0.52} L${canvas.w},${canvas.h * 0.55} Z`}
            fill="url(#mountain)"
            opacity="0.7"
          />

          {/* Clouds — drift slowly across the sky, only daytime */}
          {sky.phase !== "night" && (
            <>
              <g opacity={0.85 * (1 - (sky.phase === "dusk" ? sky.moon.opacity * 0.5 : 0))} fill="white">
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  values={`0 0; ${canvas.w * 0.05} 0; 0 0`}
                  dur="80s"
                  repeatCount="indefinite"
                />
                <ellipse cx={canvas.w * 0.18} cy={canvas.h * 0.16} rx="48" ry="14" />
                <ellipse cx={canvas.w * 0.22} cy={canvas.h * 0.13} rx="32" ry="12" />
                <ellipse cx={canvas.w * 0.14} cy={canvas.h * 0.18} rx="28" ry="10" />
              </g>
              <g opacity="0.7" fill="white">
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  values={`0 0; ${-canvas.w * 0.04} 0; 0 0`}
                  dur="60s"
                  repeatCount="indefinite"
                />
                <ellipse cx={canvas.w * 0.62} cy={canvas.h * 0.12} rx="38" ry="11" />
                <ellipse cx={canvas.w * 0.66} cy={canvas.h * 0.1} rx="24" ry="9" />
              </g>
            </>
          )}

          {/* Birds — only fly during day */}
          {sky.phase === "day" &&
            birds.map((b) => (
              <Bird key={b.id} y={b.y} size={b.size} duration={b.duration} delay={b.delay} canvasW={canvas.w} />
            ))}

          {/* Ground */}
          <rect x="0" y={canvas.h * 0.55} width={canvas.w} height={canvas.h * 0.45} fill="url(#ground)" />

          {/* River — main body, varied width, naturalistic */}
          {(() => {
            const h = canvas.h;
            const w = canvas.w;

            // Define the river's top edge and bottom edge as keyed control points,
            // then derive the center line by averaging — so the shimmer path
            // genuinely runs down the middle of the water no matter the curve.
            //
            //  pt = [x, topY, bottomY]
            const pts = [
              [-30, 0.77, 0.87],
              [w * 0.32, 0.8, 0.88],
              [w * 0.66, 0.85, 0.91],
              [w + 30, 0.83, 0.91],
            ];
            const midY = pts.map(([x, t, b]) => [x, ((t + b) / 2) * h]);

            // Bank silhouette — sits just outside the water shape on both sides
            const bankPath = `M${pts[0][0]},${(pts[0][1] - 0.03) * h}
              C${w * 0.1},${(pts[0][1] - 0.06) * h} ${w * 0.18},${(pts[1][1] + 0.01) * h} ${pts[1][0]},${(pts[1][1] - 0.03) * h}
              C${w * 0.46},${(pts[1][1] - 0.04) * h} ${w * 0.52},${(pts[2][1] + 0.03) * h} ${pts[2][0]},${(pts[2][1] - 0.03) * h}
              C${w * 0.82},${(pts[2][1] - 0.04) * h} ${w * 0.88},${(pts[3][1] + 0.03) * h} ${pts[3][0]},${(pts[3][1] - 0.02) * h}
              L${pts[3][0]},${(pts[3][2] + 0.03) * h}
              C${w * 0.88},${(pts[3][2] + 0.06) * h} ${w * 0.82},${(pts[2][2] - 0.01) * h} ${pts[2][0]},${(pts[2][2] + 0.03) * h}
              C${w * 0.52},${(pts[2][2] + 0.05) * h} ${w * 0.46},${(pts[1][2] - 0.01) * h} ${pts[1][0]},${(pts[1][2] + 0.03) * h}
              C${w * 0.18},${(pts[1][2] + 0.04) * h} ${w * 0.1},${(pts[0][2] - 0.01) * h} ${pts[0][0]},${(pts[0][2] + 0.04) * h} Z`;

            // Main water body — built from the same control points
            const waterPath = `M${pts[0][0]},${pts[0][1] * h}
              C${w * 0.1},${(pts[0][1] - 0.03) * h} ${w * 0.2},${(pts[1][1] + 0.01) * h} ${pts[1][0]},${pts[1][1] * h}
              C${w * 0.46},${(pts[1][1] - 0.01) * h} ${w * 0.5},${(pts[2][1] + 0.02) * h} ${pts[2][0]},${pts[2][1] * h}
              C${w * 0.82},${(pts[2][1] - 0.04) * h} ${w * 0.86},${(pts[3][1] + 0.03) * h} ${pts[3][0]},${pts[3][1] * h}
              L${pts[3][0]},${pts[3][2] * h}
              C${w * 0.86},${(pts[3][2] + 0.02) * h} ${w * 0.82},${(pts[2][2] - 0.04) * h} ${pts[2][0]},${pts[2][2] * h}
              C${w * 0.5},${(pts[2][2] + 0.03) * h} ${w * 0.46},${(pts[1][2] - 0.06) * h} ${pts[1][0]},${pts[1][2] * h}
              C${w * 0.2},${(pts[1][2] + 0.02) * h} ${w * 0.1},${(pts[0][2] - 0.04) * h} ${pts[0][0]},${pts[0][2] * h} Z`;

            // Center-line traced through the midpoints — shimmers run along this
            const centerPath = `M${midY[0][0]},${midY[0][1]}
              C${w * 0.15},${midY[0][1] + 1} ${w * 0.22},${midY[1][1] - 1} ${midY[1][0]},${midY[1][1]}
              C${w * 0.45},${midY[1][1] + 2} ${w * 0.55},${midY[2][1] - 2} ${midY[2][0]},${midY[2][1]}
              C${w * 0.78},${midY[2][1] - 1} ${w * 0.88},${midY[3][1] + 1} ${midY[3][0]},${midY[3][1]}`;

            const isNight = sky.phase === "night";

            return (
              <>
                <defs>
                  <path id="riverFlow" d={centerPath} />
                </defs>

                {/* Sandy banks (only visible during day) */}
                <path d={bankPath} fill={isNight ? "#475569" : "#fcd34d"} opacity={isNight ? 0.3 : 0.45} />

                {/* Water body */}
                <path d={waterPath} fill="url(#water)" opacity="0.9" />

                {/* Lighter highlight strip along middle of water (depth perception) */}
                <path
                  d={waterPath}
                  fill="none"
                  stroke={isNight ? "#3b82f6" : "#bae6fd"}
                  strokeWidth="2"
                  opacity="0.4"
                  transform={`translate(0, -3)`}
                />

                {/* Shimmers — small ellipses that follow the river path */}
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <ellipse
                    key={`shimmer-${i}`}
                    cx="0"
                    cy="0"
                    rx={6 + (i % 3) * 4}
                    ry="1.2"
                    fill="white"
                    opacity={0.55}
                  >
                    <animateMotion
                      dur={`${14 + (i % 3) * 4}s`}
                      begin={`-${i * 2.8}s`}
                      repeatCount="indefinite"
                      rotate="auto"
                    >
                      <mpath href="#riverFlow" />
                    </animateMotion>
                    <animate
                      attributeName="opacity"
                      values="0; 0.55; 0.55; 0"
                      dur={`${14 + (i % 3) * 4}s`}
                      begin={`-${i * 2.8}s`}
                      repeatCount="indefinite"
                    />
                  </ellipse>
                ))}

                {/* Floating leaves that drift downstream */}
                {[0, 1].map((i) => (
                  <g key={`leaf-${i}`}>
                    <animateMotion
                      dur={`${24 + i * 8}s`}
                      begin={`-${i * 12}s`}
                      repeatCount="indefinite"
                      rotate="auto"
                    >
                      <mpath href="#riverFlow" />
                    </animateMotion>
                    <ellipse rx="3" ry="1.4" fill={isNight ? "#65a30d" : "#84cc16"} opacity="0.85">
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        values="0; 360"
                        dur="6s"
                        repeatCount="indefinite"
                      />
                    </ellipse>
                  </g>
                ))}

                {/* Subtle ripples — short arcs that travel along the river */}
                {[0, 1, 2, 3].map((i) => (
                  <g key={`ripple-${i}`} opacity="0.5">
                    <animateMotion
                      dur={`${10 + i * 2}s`}
                      begin={`-${i * 2.2}s`}
                      repeatCount="indefinite"
                      rotate="auto"
                    >
                      <mpath href="#riverFlow" />
                    </animateMotion>
                    <path
                      d="M-6,0 q3,-1.5 6,0 t6,0"
                      fill="none"
                      stroke="white"
                      strokeWidth="0.6"
                      strokeLinecap="round"
                    />
                  </g>
                ))}
              </>
            );
          })()}

          {/* Grass — clustered with variety, skip over the river band */}
          {grass.map((g) => {
            const overRiver = g.y > canvas.h * 0.76 && g.y < canvas.h * 0.88;
            if (overRiver) return null;
            return (
              <Grass
                key={g.id}
                x={g.x}
                y={g.y}
                size={g.size}
                color={g.shade}
                kind={g.kind}
                flowerColor={g.flowerColor}
              />
            );
          })}

          {/* Trees */}
          {trees.map((t) => (
            <Tree
              key={t.date}
              x={t.xPct * canvas.w}
              y={t.yPct * canvas.h}
              size={t.size}
              kind={t.kind}
              shape={t.shape}
              date={t.date}
              pending={t.pending}
              growing={t.growing}
              onHover={setHovered}
              onLeave={() => setHovered(null)}
            />
          ))}

          {/* Animals (rendered after trees so they're visible in front) */}
          {animals.map((a) => (
            <Animal
              key={a.id}
              kind={a.kind}
              x={a.x * canvas.w}
              y={a.y * canvas.h}
            />
          ))}

          {/* Empty state */}
          {trees.length === 0 && (
            <text
              x={canvas.w / 2}
              y={canvas.h * 0.7}
              textAnchor="middle"
              fontSize="20"
              fill="#525252"
              opacity="0.6"
            >
              No trees yet — plant your first by showing up today.
            </text>
          )}
        </svg>

        {/* Hover tooltip */}
        {hovered && (
          <div
            className="absolute pointer-events-none bg-[var(--text)] text-white text-xs rounded-md px-2.5 py-1.5 shadow-lg whitespace-nowrap"
            style={{
              left: `${(hovered.x / canvas.w) * 100}%`,
              top: `${(hovered.y / canvas.h) * 100}%`,
              transform: "translate(-50%, calc(-100% - 12px))",
            }}
          >
            <p className="font-semibold">
              {hovered.date}
              {hovered.growing && (
                <span className="ml-1.5 text-emerald-300">· growing now</span>
              )}
            </p>
            <p className="opacity-80">
              {hovered.growing
                ? "Checked in · tree is growing"
                : hovered.kind === "healthy"
                  ? "Full day · on time"
                  : hovered.kind === "late"
                    ? "Late entry"
                    : hovered.kind === "stunted"
                      ? "Left early — tree stopped growing"
                      : hovered.kind === "overtime"
                        ? "Overtime · extra growth"
                        : hovered.kind === "dead"
                          ? "Absent · withered"
                          : hovered.kind === "stump"
                            ? "Planned off · stump"
                            : ""}
            </p>
          </div>
        )}
      </div>

      {/* Stats footer */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-5 border-t border-[var(--border)]">
        <ForestStat label="Trees grown" value={stats.grown} icon="🌳" />
        <ForestStat label="Overtime trees" value={stats.overtime} icon="✨" />
        <ForestStat label="Withered" value={stats.dead} icon="🪵" />
        <ForestStat label="Stumps (off)" value={stats.stumps} icon="🪨" />
        <ForestStat label="Best streak" value={`${stats.bestStreak}d`} icon="🔥" />
      </div>
    </div>
  );
}

function ForestStat({ label, value, icon }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-xl" aria-hidden>{icon}</span>
      <div>
        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
          {label}
        </p>
        <p className="text-base font-semibold tabular-nums">{value}</p>
      </div>
    </div>
  );
}

/* ---------- Grass / flora variants ---------- */
function Grass({ x, y, size, color, kind, flowerColor }) {
  if (kind === "blade") {
    // Tall single blade with subtle sway
    return (
      <g transform={`translate(${x}, ${y}) scale(${size})`}>
        <path d="M0,0 Q1,-12 0,-16" stroke={color} strokeWidth="1.2" fill="none" strokeLinecap="round">
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="-3 0 0; 3 0 0; -3 0 0"
            dur="4s"
            repeatCount="indefinite"
          />
        </path>
      </g>
    );
  }
  if (kind === "flower") {
    return (
      <g transform={`translate(${x}, ${y}) scale(${size})`}>
        {/* stem */}
        <path d="M0,0 Q0.5,-6 0,-10" stroke="#15803d" strokeWidth="0.8" fill="none" strokeLinecap="round" />
        {/* leaf */}
        <ellipse cx="-1" cy="-5" rx="1.5" ry="0.8" fill="#16a34a" transform="rotate(-30 -1 -5)" />
        {/* petals */}
        <circle cx="-1.5" cy="-10" r="1.4" fill={flowerColor} />
        <circle cx="1.5" cy="-10" r="1.4" fill={flowerColor} />
        <circle cx="0" cy="-11.5" r="1.4" fill={flowerColor} />
        <circle cx="0" cy="-8.5" r="1.4" fill={flowerColor} />
        {/* center */}
        <circle cx="0" cy="-10" r="0.8" fill="#fde047" />
      </g>
    );
  }
  if (kind === "mushroom") {
    return (
      <g transform={`translate(${x}, ${y}) scale(${size})`}>
        <rect x="-1" y="-3" width="2" height="3" fill="#fef3c7" />
        <ellipse cx="0" cy="-4" rx="4" ry="3" fill="#dc2626" />
        <circle cx="-1.5" cy="-4.5" r="0.6" fill="white" />
        <circle cx="1.5" cy="-4" r="0.5" fill="white" />
        <circle cx="0" cy="-6" r="0.5" fill="white" />
      </g>
    );
  }
  // tuft (default) — denser, varied blade heights
  return (
    <g transform={`translate(${x}, ${y}) scale(${size})`}>
      <path d={`M-4,0 Q-3,${-5 - size * 2} -2,0 Z`} fill={color} />
      <path d={`M-1,0 Q0,${-8 - size * 2} 1,0 Z`} fill={color} />
      <path d={`M2,0 Q3,${-6 - size * 2} 4,0 Z`} fill={color} />
      <path d="M-2,0 Q-1.5,-3 -1,0 Z" fill={color} opacity="0.7" />
      <path d="M3,0 Q3.5,-3 4,0 Z" fill={color} opacity="0.7" />
    </g>
  );
}

/* ---------- Bird flying ---------- */
function Bird({ y, size, duration, delay, canvasW, reversed }) {
  // Bird is a small "M" shape that flaps + drifts across the sky
  const fromX = reversed ? canvasW + 60 : -60;
  const toX = reversed ? -60 : canvasW + 60;
  const scale = reversed ? -size : size; // flip horizontally if reversed
  return (
    <g opacity="0.85">
      <animateTransform
        attributeName="transform"
        type="translate"
        from={`${fromX} ${y}`}
        to={`${toX} ${y}`}
        dur={`${duration}s`}
        begin={`-${delay}s`}
        repeatCount="indefinite"
      />
      <g transform={`scale(${scale} ${size})`}>
        <path
          d="M0,0 Q5,-6 10,0 Q15,-6 20,0"
          stroke="#1f2937"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        >
          <animate
            attributeName="d"
            values="M0,0 Q5,-6 10,0 Q15,-6 20,0;M0,0 Q5,-2 10,0 Q15,-2 20,0;M0,0 Q5,-6 10,0 Q15,-6 20,0"
            dur="0.6s"
            repeatCount="indefinite"
          />
        </path>
      </g>
    </g>
  );
}

/* ---------- Animals ---------- */
function Animal({ kind, x, y }) {
  if (kind === "rabbit") {
    return (
      <g transform={`translate(${x}, ${y})`}>
        <ellipse cx="0" cy="2" rx="9" ry="2" fill="#000" opacity="0.15" />
        {/* body */}
        <ellipse cx="0" cy="-4" rx="8" ry="6" fill="#fafafa" />
        {/* head */}
        <circle cx="6" cy="-8" r="4" fill="#fafafa" />
        {/* ears */}
        <ellipse cx="5" cy="-15" rx="1.2" ry="4" fill="#fafafa" />
        <ellipse cx="8" cy="-15" rx="1.2" ry="4" fill="#fafafa" />
        <ellipse cx="5" cy="-15" rx="0.6" ry="3" fill="#fbcfe8" />
        <ellipse cx="8" cy="-15" rx="0.6" ry="3" fill="#fbcfe8" />
        {/* eye */}
        <circle cx="7.5" cy="-9" r="0.6" fill="#1f2937" />
        {/* tail */}
        <circle cx="-7" cy="-3" r="2" fill="#fafafa" />
      </g>
    );
  }

  if (kind === "deer") {
    return (
      <g transform={`translate(${x}, ${y})`}>
        <ellipse cx="0" cy="2" rx="14" ry="3" fill="#000" opacity="0.15" />
        {/* body */}
        <ellipse cx="0" cy="-8" rx="12" ry="6" fill="#b45309" />
        {/* head */}
        <ellipse cx="11" cy="-13" rx="3" ry="4" fill="#b45309" />
        {/* antlers */}
        <path d="M10,-17 L8,-22 M10,-17 L13,-22 M12,-17 L14,-21" stroke="#78350f" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        {/* legs */}
        <rect x="-8" y="-4" width="2" height="6" fill="#78350f" />
        <rect x="-3" y="-4" width="2" height="6" fill="#78350f" />
        <rect x="3" y="-4" width="2" height="6" fill="#78350f" />
        <rect x="8" y="-4" width="2" height="6" fill="#78350f" />
        {/* eye */}
        <circle cx="12.5" cy="-13.5" r="0.5" fill="#1f2937" />
        {/* spots */}
        <circle cx="-3" cy="-9" r="1.2" fill="#fef3c7" opacity="0.7" />
        <circle cx="2" cy="-7" r="1" fill="#fef3c7" opacity="0.7" />
        <circle cx="5" cy="-10" r="1" fill="#fef3c7" opacity="0.7" />
      </g>
    );
  }

  if (kind === "butterfly") {
    // Floating path — wide figure-eight around base position
    return (
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values={`${x} ${y}; ${x + 30} ${y - 18}; ${x + 50} ${y - 6}; ${x + 40} ${y + 12}; ${x + 15} ${y + 8}; ${x - 10} ${y - 12}; ${x} ${y}`}
          dur="14s"
          repeatCount="indefinite"
        />
        <g>
          {/* body — slender black */}
          <ellipse cx="0" cy="0" rx="0.7" ry="4" fill="#0f172a" />
          {/* antennae */}
          <path d="M-0.4,-3.5 Q-2,-6 -3,-7" stroke="#0f172a" strokeWidth="0.4" fill="none" />
          <path d="M0.4,-3.5 Q2,-6 3,-7" stroke="#0f172a" strokeWidth="0.4" fill="none" />
          {/* left wing pair — flaps via scaleX */}
          <g>
            <animateTransform
              attributeName="transform"
              type="scale"
              values="1 1; 0.2 1; 1 1"
              dur="0.35s"
              repeatCount="indefinite"
            />
            {/* upper wing — curved leaf shape */}
            <path
              d="M-0.5,-2 Q-7,-7 -8,-1 Q-7,2 -0.5,1 Z"
              fill="#fb923c"
            />
            {/* lower wing */}
            <path
              d="M-0.5,1 Q-5,3 -6,5 Q-3,5.5 -0.5,3 Z"
              fill="#f97316"
            />
            {/* wing spots */}
            <circle cx="-5" cy="-2" r="1" fill="#fef3c7" opacity="0.9" />
            <circle cx="-3.5" cy="3" r="0.6" fill="#fef3c7" opacity="0.7" />
            <path d="M-7.5,-1 L-4,-1" stroke="#7c2d12" strokeWidth="0.3" fill="none" opacity="0.5" />
          </g>
          {/* right wing pair — mirror */}
          <g>
            <animateTransform
              attributeName="transform"
              type="scale"
              values="1 1; 0.2 1; 1 1"
              dur="0.35s"
              repeatCount="indefinite"
            />
            <path
              d="M0.5,-2 Q7,-7 8,-1 Q7,2 0.5,1 Z"
              fill="#fb923c"
            />
            <path
              d="M0.5,1 Q5,3 6,5 Q3,5.5 0.5,3 Z"
              fill="#f97316"
            />
            <circle cx="5" cy="-2" r="1" fill="#fef3c7" opacity="0.9" />
            <circle cx="3.5" cy="3" r="0.6" fill="#fef3c7" opacity="0.7" />
            <path d="M7.5,-1 L4,-1" stroke="#7c2d12" strokeWidth="0.3" fill="none" opacity="0.5" />
          </g>
        </g>
      </g>
    );
  }

  return null;
}
