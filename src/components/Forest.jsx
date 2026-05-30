import React, { useState, useMemo, useEffect, useRef, lazy, Suspense } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Trees,
  Volume2,
  VolumeX,
  Box,
  Square,
  Maximize2,
  X,
} from "lucide-react";
import {
  getDayTone,
  getToneLabel,
  MONTHS,
  OFFICE_START,
  OFFICE_END,
  formatTime12,
} from "../utils/calendarUtils";
import {
  getSeason,
  getWeather,
  getForestHealthScore,
  getHealthLabel,
  isAnniversary,
} from "../utils/forestTheme";
import {
  startSoundscape,
  stopSoundscape,
  isSoundscapeActive,
} from "../utils/soundscape";

// Lazy-load 3D mode so it doesn't bloat the initial bundle
const Forest3D = lazy(() => import("./Forest3D"));

/* ---------- helpers ---------- */
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
function todayDateKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function classify(record, officeStart, officeEnd, now) {
  if (!record) return null;
  if (record.state === "rejected") return null;
  if (record.status === "absent") return { kind: "dead", size: 1, pending: record.state === "pending" };
  if (record.status === "off") return { kind: "stump", size: 1, pending: record.state === "pending" };

  const entry = timeToMin(record.entryTime);
  let exit = timeToMin(record.exitTime);
  const start = timeToMin(officeStart);
  const end = timeToMin(officeEnd);
  const isLiveGrowing = record.exitTime == null || record.exitTime === "";
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

/* ---------- Sky state ---------- */
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

function getSkyState(now, w, h) {
  const hours = now.getHours() + now.getMinutes() / 60;
  const dawnStart = 5.5;
  const dawnEnd = 7;
  const duskStart = 17;
  const duskEnd = 18.5;

  const dayTop = "#bfdbfe";
  const dayBottom = "#fef3c7";
  const nightTop = "#0b1729";
  const nightBottom = "#1e3a5f";
  const dawnTop = "#fda4af";
  const dawnBottom = "#fdba74";
  const duskTop = "#7c3aed";
  const duskBottom = "#fb7185";

  let phase, skyTop, skyBottom, sunOpacity, moonOpacity;
  if (hours < dawnStart || hours > duskEnd) {
    phase = "night";
    skyTop = nightTop; skyBottom = nightBottom;
    sunOpacity = 0; moonOpacity = 1;
  } else if (hours < dawnEnd) {
    const t = (hours - dawnStart) / (dawnEnd - dawnStart);
    phase = "dawn";
    if (t < 0.5) {
      const k = t * 2;
      skyTop = mix(nightTop, dawnTop, k);
      skyBottom = mix(nightBottom, dawnBottom, k);
    } else {
      const k = (t - 0.5) * 2;
      skyTop = mix(dawnTop, dayTop, k);
      skyBottom = mix(dawnBottom, dayBottom, k);
    }
    sunOpacity = t; moonOpacity = 1 - t;
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
    sunOpacity = 1 - t; moonOpacity = t;
  } else {
    phase = "day";
    skyTop = dayTop; skyBottom = dayBottom;
    sunOpacity = 1; moonOpacity = 0;
  }

  const sunProgress = Math.max(0, Math.min(1, (hours - dawnStart) / (duskEnd - dawnStart)));
  const sunX = w * (0.1 + sunProgress * 0.8);
  const sunY = h * (0.5 - Math.sin(sunProgress * Math.PI) * 0.35);
  const nightHours = ((hours - duskEnd + 24) % 24) / (24 - (duskEnd - dawnStart));
  const moonProgress = Math.max(0, Math.min(1, nightHours));
  const moonX = w * (0.1 + moonProgress * 0.8);
  const moonY = h * (0.5 - Math.sin(moonProgress * Math.PI) * 0.35);

  return {
    phase, skyTop, skyBottom,
    sun: { x: sunX, y: sunY, opacity: sunOpacity },
    moon: { x: moonX, y: moonY, opacity: moonOpacity },
  };
}

/* ---------- Tree variants ---------- */
function Tree({ x, y, size, kind, shape, date, pending, growing, isAnniv, onHover, onLeave, onClick }) {
  const baseScale = 0.7 + size * 0.6;
  const props = {
    transform: `translate(${x}, ${y}) scale(${baseScale})`,
    style: {
      cursor: "pointer",
      opacity: pending && !growing ? 0.65 : 1,
      transition: "transform 0.6s ease-out",
    },
    onMouseEnter: () => onHover?.({ date, kind, size, x, y, growing }),
    onMouseLeave: () => onLeave?.(),
    onClick: () => onClick?.(date),
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

  const leafColor =
    kind === "overtime" ? "#15803d"
    : kind === "late" ? "#84cc16"
    : kind === "stunted" ? "#65a30d"
    : "#16a34a";
  const leafShade =
    kind === "overtime" ? "#166534"
    : kind === "late" ? "#65a30d"
    : kind === "stunted" ? "#4d7c0f"
    : "#15803d";

  // Anniversary trees get a sparkle aura
  const anniv = isAnniv && (
    <g pointerEvents="none">
      <circle cx="0" cy="-22" r="22" fill="none" stroke="#fde047" strokeWidth="0.6">
        <animate attributeName="r" values="22;30;22" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.6;0.2;0.6" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="-6" cy="-30" r="1.2" fill="#fde047">
        <animate attributeName="opacity" values="0.2;1;0.2" dur="1.4s" repeatCount="indefinite" />
      </circle>
      <circle cx="8" cy="-22" r="1" fill="#fde047">
        <animate attributeName="opacity" values="0.2;1;0.2" dur="1.6s" begin="-0.5s" repeatCount="indefinite" />
      </circle>
    </g>
  );

  if (shape === "pine") {
    return (
      <g {...props}>
        <ellipse cx="0" cy="2" rx="14" ry="3" fill="#000" opacity="0.15" />
        <rect x="-2.5" y="-8" width="5" height="10" fill="#78350f" />
        <polygon points="0,-30 -14,-8 14,-8" fill={leafColor} />
        <polygon points="0,-38 -10,-20 10,-20" fill={leafShade} />
        <polygon points="0,-44 -7,-30 7,-30" fill={leafColor} />
        {kind === "overtime" && <circle cx="6" cy="-32" r="1.8" fill="#fef9c3" opacity="0.9" />}
        {anniv}
      </g>
    );
  }
  if (shape === "willow") {
    return (
      <g {...props}>
        <ellipse cx="0" cy="2" rx="14" ry="3" fill="#000" opacity="0.15" />
        <rect x="-2" y="-6" width="4" height="8" fill="#78350f" />
        <ellipse cx="0" cy="-20" rx="16" ry="14" fill={leafColor} />
        <ellipse cx="-6" cy="-14" rx="6" ry="9" fill={leafShade} opacity="0.6" />
        <ellipse cx="6" cy="-12" rx="5" ry="8" fill={leafShade} opacity="0.6" />
        {kind === "overtime" && <circle cx="-4" cy="-26" r="1.8" fill="#fef9c3" opacity="0.9" />}
        {anniv}
      </g>
    );
  }
  return (
    <g {...props}>
      <ellipse cx="0" cy="2" rx="14" ry="3" fill="#000" opacity="0.15" />
      <rect x="-2.5" y="-10" width="5" height="12" fill="#78350f" />
      {growing && (
        <circle cx="0" cy="-22" r="22" fill="#bbf7d0" opacity="0.5">
          <animate attributeName="r" values="20;26;20" dur="2.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0.6;0.3" dur="2.5s" repeatCount="indefinite" />
        </circle>
      )}
      <circle cx="0" cy="-22" r="14" fill={leafColor} />
      <circle cx="-8" cy="-16" r="7" fill={leafShade} opacity="0.8" />
      <circle cx="8" cy="-18" r="6" fill={leafShade} opacity="0.6" />
      <circle cx="0" cy="-28" r="5" fill={leafColor} />
      {kind === "overtime" && <circle cx="5" cy="-26" r="1.8" fill="#fef9c3" opacity="0.9" />}
      {anniv}
    </g>
  );
}

/* ---------- Grass / flora variants ---------- */
function Grass({ x, y, size, color, kind, flowerColor }) {
  if (kind === "blade") {
    return (
      <g transform={`translate(${x}, ${y}) scale(${size})`}>
        <path d="M0,0 Q1,-12 0,-16" stroke={color} strokeWidth="1.2" fill="none" strokeLinecap="round">
          <animateTransform attributeName="transform" type="rotate" values="-3 0 0; 3 0 0; -3 0 0" dur="4s" repeatCount="indefinite" />
        </path>
      </g>
    );
  }
  if (kind === "flower") {
    return (
      <g transform={`translate(${x}, ${y}) scale(${size})`}>
        <path d="M0,0 Q0.5,-6 0,-10" stroke="#15803d" strokeWidth="0.8" fill="none" strokeLinecap="round" />
        <ellipse cx="-1" cy="-5" rx="1.5" ry="0.8" fill="#16a34a" transform="rotate(-30 -1 -5)" />
        <circle cx="-1.5" cy="-10" r="1.4" fill={flowerColor} />
        <circle cx="1.5" cy="-10" r="1.4" fill={flowerColor} />
        <circle cx="0" cy="-11.5" r="1.4" fill={flowerColor} />
        <circle cx="0" cy="-8.5" r="1.4" fill={flowerColor} />
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

/* ---------- Animated bird ---------- */
function Bird({ y, size, duration, delay, canvasW, reversed }) {
  const fromX = reversed ? canvasW + 60 : -60;
  const toX = reversed ? -60 : canvasW + 60;
  const scale = reversed ? -size : size;
  return (
    <g opacity="0.85">
      <animateTransform attributeName="transform" type="translate"
        from={`${fromX} ${y}`} to={`${toX} ${y}`} dur={`${duration}s`}
        begin={`-${delay}s`} repeatCount="indefinite" />
      <g transform={`scale(${scale} ${size})`}>
        <path d="M0,0 Q5,-6 10,0 Q15,-6 20,0" stroke="#1f2937" strokeWidth="1.6" fill="none" strokeLinecap="round">
          <animate attributeName="d"
            values="M0,0 Q5,-6 10,0 Q15,-6 20,0;M0,0 Q5,-2 10,0 Q15,-2 20,0;M0,0 Q5,-6 10,0 Q15,-6 20,0"
            dur="0.6s" repeatCount="indefinite" />
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
        <ellipse cx="0" cy="-4" rx="8" ry="6" fill="#fafafa" />
        <circle cx="6" cy="-8" r="4" fill="#fafafa" />
        <ellipse cx="5" cy="-15" rx="1.2" ry="4" fill="#fafafa" />
        <ellipse cx="8" cy="-15" rx="1.2" ry="4" fill="#fafafa" />
        <ellipse cx="5" cy="-15" rx="0.6" ry="3" fill="#fbcfe8" />
        <ellipse cx="8" cy="-15" rx="0.6" ry="3" fill="#fbcfe8" />
        <circle cx="7.5" cy="-9" r="0.6" fill="#1f2937" />
        <circle cx="-7" cy="-3" r="2" fill="#fafafa" />
      </g>
    );
  }
  if (kind === "deer") {
    return (
      <g transform={`translate(${x}, ${y})`}>
        <ellipse cx="0" cy="2" rx="14" ry="3" fill="#000" opacity="0.15" />
        <ellipse cx="0" cy="-8" rx="12" ry="6" fill="#b45309" />
        <ellipse cx="11" cy="-13" rx="3" ry="4" fill="#b45309" />
        <path d="M10,-17 L8,-22 M10,-17 L13,-22 M12,-17 L14,-21" stroke="#78350f" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <rect x="-8" y="-4" width="2" height="6" fill="#78350f" />
        <rect x="-3" y="-4" width="2" height="6" fill="#78350f" />
        <rect x="3" y="-4" width="2" height="6" fill="#78350f" />
        <rect x="8" y="-4" width="2" height="6" fill="#78350f" />
        <circle cx="12.5" cy="-13.5" r="0.5" fill="#1f2937" />
        <circle cx="-3" cy="-9" r="1.2" fill="#fef3c7" opacity="0.7" />
        <circle cx="2" cy="-7" r="1" fill="#fef3c7" opacity="0.7" />
        <circle cx="5" cy="-10" r="1" fill="#fef3c7" opacity="0.7" />
      </g>
    );
  }
  if (kind === "butterfly") {
    return (
      <g>
        <animateTransform attributeName="transform" type="translate"
          values={`${x} ${y}; ${x + 30} ${y - 18}; ${x + 50} ${y - 6}; ${x + 40} ${y + 12}; ${x + 15} ${y + 8}; ${x - 10} ${y - 12}; ${x} ${y}`}
          dur="14s" repeatCount="indefinite" />
        <g>
          <ellipse cx="0" cy="0" rx="0.7" ry="4" fill="#0f172a" />
          <path d="M-0.4,-3.5 Q-2,-6 -3,-7" stroke="#0f172a" strokeWidth="0.4" fill="none" />
          <path d="M0.4,-3.5 Q2,-6 3,-7" stroke="#0f172a" strokeWidth="0.4" fill="none" />
          <g>
            <animateTransform attributeName="transform" type="scale" values="1 1; 0.2 1; 1 1" dur="0.35s" repeatCount="indefinite" />
            <path d="M-0.5,-2 Q-7,-7 -8,-1 Q-7,2 -0.5,1 Z" fill="#fb923c" />
            <path d="M-0.5,1 Q-5,3 -6,5 Q-3,5.5 -0.5,3 Z" fill="#f97316" />
            <circle cx="-5" cy="-2" r="1" fill="#fef3c7" opacity="0.9" />
            <circle cx="-3.5" cy="3" r="0.6" fill="#fef3c7" opacity="0.7" />
          </g>
          <g>
            <animateTransform attributeName="transform" type="scale" values="1 1; 0.2 1; 1 1" dur="0.35s" repeatCount="indefinite" />
            <path d="M0.5,-2 Q7,-7 8,-1 Q7,2 0.5,1 Z" fill="#fb923c" />
            <path d="M0.5,1 Q5,3 6,5 Q3,5.5 0.5,3 Z" fill="#f97316" />
            <circle cx="5" cy="-2" r="1" fill="#fef3c7" opacity="0.9" />
            <circle cx="3.5" cy="3" r="0.6" fill="#fef3c7" opacity="0.7" />
          </g>
        </g>
      </g>
    );
  }
  return null;
}

/* ---------- Weather overlays ---------- */
function Rain({ canvasW, canvasH, intensity = 0.4 }) {
  const drops = [];
  const count = Math.floor(40 + intensity * 80);
  for (let i = 0; i < count; i++) {
    const seed = `rain-${i}`;
    const x = rand01(seed + "x") * canvasW;
    const dur = 0.5 + rand01(seed + "d") * 0.6;
    const delay = rand01(seed + "t") * dur;
    drops.push(
      <line
        key={seed}
        x1={x} y1={-30} x2={x - 6} y2={0}
        stroke="#93c5fd" strokeWidth="1" strokeLinecap="round" opacity="0.65"
      >
        <animate attributeName="y1" values="-30;canvasH" dur={`${dur}s`} begin={`-${delay}s`} repeatCount="indefinite" />
        <animate attributeName="y2" values={`0;${canvasH + 30}`} dur={`${dur}s`} begin={`-${delay}s`} repeatCount="indefinite" />
        <animate attributeName="x1" values={`${x};${x - canvasH * 0.2}`} dur={`${dur}s`} begin={`-${delay}s`} repeatCount="indefinite" />
        <animate attributeName="x2" values={`${x - 6};${x - canvasH * 0.2 - 6}`} dur={`${dur}s`} begin={`-${delay}s`} repeatCount="indefinite" />
      </line>
    );
  }
  return <g pointerEvents="none">{drops}</g>;
}

function FallingLeaves({ canvasW, canvasH, count = 20 }) {
  const leaves = [];
  for (let i = 0; i < count; i++) {
    const seed = `leaf-${i}`;
    const startX = rand01(seed + "x") * canvasW;
    const dur = 12 + rand01(seed + "d") * 10;
    const delay = rand01(seed + "t") * dur;
    const color = ["#fb923c", "#f59e0b", "#dc2626", "#b45309"][hash(seed) % 4];
    leaves.push(
      <g key={seed} pointerEvents="none">
        <ellipse cx="0" cy="0" rx="3" ry="1.5" fill={color} opacity="0.85">
          <animateMotion
            dur={`${dur}s`}
            begin={`-${delay}s`}
            repeatCount="indefinite"
            path={`M${startX},-20 Q${startX + 40},${canvasH * 0.3} ${startX - 30},${canvasH * 0.5} T${startX + 20},${canvasH + 30}`}
          />
          <animateTransform attributeName="transform" type="rotate" values="0;360" dur="3s" repeatCount="indefinite" />
        </ellipse>
      </g>
    );
  }
  return <g>{leaves}</g>;
}

function Blossoms({ canvasW, canvasH, count = 25 }) {
  const flowers = [];
  for (let i = 0; i < count; i++) {
    const seed = `blossom-${i}`;
    const startX = rand01(seed + "x") * canvasW;
    const dur = 14 + rand01(seed + "d") * 12;
    const delay = rand01(seed + "t") * dur;
    flowers.push(
      <g key={seed} pointerEvents="none">
        <g>
          <animateMotion
            dur={`${dur}s`}
            begin={`-${delay}s`}
            repeatCount="indefinite"
            path={`M${startX},-20 Q${startX + 30},${canvasH * 0.3} ${startX - 20},${canvasH * 0.5} T${startX + 10},${canvasH + 30}`}
          />
          <circle cx="-1" cy="0" r="1.2" fill="#fbcfe8" />
          <circle cx="1" cy="0" r="1.2" fill="#fbcfe8" />
          <circle cx="0" cy="-1" r="1.2" fill="#f9a8d4" />
          <circle cx="0" cy="1" r="1.2" fill="#f9a8d4" />
          <circle cx="0" cy="0" r="0.6" fill="#fde047" />
        </g>
      </g>
    );
  }
  return <g>{flowers}</g>;
}

function SnowAccumulation({ canvasW, canvasH, count = 80 }) {
  // Falling flakes + snow on the ground
  const flakes = [];
  for (let i = 0; i < count; i++) {
    const seed = `snow-${i}`;
    const startX = rand01(seed + "x") * canvasW;
    const dur = 10 + rand01(seed + "d") * 14;
    const delay = rand01(seed + "t") * dur;
    const size = 1 + rand01(seed + "s") * 2;
    flakes.push(
      <circle
        key={seed}
        cx={startX} cy={-10} r={size}
        fill="white" opacity="0.9"
      >
        <animate
          attributeName="cy"
          values={`-10;${canvasH + 10}`}
          dur={`${dur}s`}
          begin={`-${delay}s`}
          repeatCount="indefinite"
        />
        <animate
          attributeName="cx"
          values={`${startX};${startX + 30};${startX - 30};${startX}`}
          dur={`${dur}s`}
          begin={`-${delay}s`}
          repeatCount="indefinite"
        />
      </circle>
    );
  }
  // Snow blanket on the ground
  return (
    <g pointerEvents="none">
      <path
        d={`M0,${canvasH * 0.58} Q${canvasW * 0.2},${canvasH * 0.55} ${canvasW * 0.4},${canvasH * 0.58} T${canvasW * 0.7},${canvasH * 0.58} T${canvasW},${canvasH * 0.58} L${canvasW},${canvasH * 0.6} L0,${canvasH * 0.6} Z`}
        fill="white"
        opacity="0.92"
      />
      {flakes}
    </g>
  );
}

function Mascot({ x, y, healthScore }) {
  // A cute fox that grows with health. Small=struggling, big+happy=thriving.
  const scale = 0.5 + (healthScore / 100) * 0.8;
  const happy = healthScore >= 60;
  return (
    <g transform={`translate(${x}, ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="2" rx="14" ry="3" fill="#000" opacity="0.15" />
      {/* body */}
      <ellipse cx="0" cy="-5" rx="10" ry="7" fill="#ea580c" />
      {/* head */}
      <circle cx="0" cy="-13" r="6" fill="#ea580c" />
      {/* ears */}
      <polygon points="-5,-19 -3,-13 -7,-14" fill="#ea580c" />
      <polygon points="5,-19 3,-13 7,-14" fill="#ea580c" />
      <polygon points="-5,-19 -4,-15 -6,-15" fill="#fbcfe8" />
      <polygon points="5,-19 4,-15 6,-15" fill="#fbcfe8" />
      {/* tail */}
      <ellipse cx="-11" cy="-4" rx="3" ry="6" fill="#ea580c">
        <animateTransform attributeName="transform" type="rotate" values="-10 -11 -4;10 -11 -4;-10 -11 -4" dur="2s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx="-13" cy="-7" rx="2" ry="2.5" fill="white" />
      {/* face */}
      <circle cx="-2" cy="-13" r="0.8" fill="#0f172a" />
      <circle cx="2" cy="-13" r="0.8" fill="#0f172a" />
      <ellipse cx="0" cy="-10" rx="0.8" ry="0.6" fill="#0f172a" />
      {happy ? (
        <path d="M-2,-9 Q0,-7 2,-9" stroke="#0f172a" strokeWidth="0.5" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M-2,-8 Q0,-9.5 2,-8" stroke="#0f172a" strokeWidth="0.5" fill="none" strokeLinecap="round" />
      )}
      {/* chest fluff */}
      <ellipse cx="0" cy="-3" rx="4" ry="4" fill="white" opacity="0.9" />
      {/* happy bounce */}
      {happy && (
        <animateTransform attributeName="transform" type="translate" values="0 0;0 -2;0 0" dur="1.5s" repeatCount="indefinite" additive="sum" />
      )}
    </g>
  );
}

/* ---------- Main Forest ---------- */
export function Forest({ records, company, title = "Your forest", joinedAt, isAdmin }) {
  const officeStart = company?.officeStart || OFFICE_START;
  const officeEnd = company?.officeEnd || OFFICE_END;

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  const [mode, setMode] = useState("month");
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [hovered, setHovered] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [soundsOn, setSoundsOn] = useState(false);
  const [is3D, setIs3D] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [panX, setPanX] = useState(0);
  const dragging = useRef(null);

  const season = useMemo(() => getSeason(now), [now]);

  // Soundscape lifecycle
  useEffect(() => () => stopSoundscape(), []);
  const toggleSound = () => {
    if (soundsOn) {
      stopSoundscape();
      setSoundsOn(false);
    } else {
      startSoundscape();
      setSoundsOn(isSoundscapeActive());
    }
  };

  const filtered = useMemo(() => {
    return (records || []).filter((r) => {
      if (!r.date) return false;
      const [y, m] = r.date.split("-").map(Number);
      if (y !== year) return false;
      if (mode === "month" && m - 1 !== month) return false;
      return true;
    });
  }, [records, mode, month, year]);

  const trees = useMemo(() => {
    const items = [];
    filtered.forEach((r) => {
      const c = classify(r, officeStart, officeEnd, now);
      if (!c) return;
      // Use userId+date so trees for different staff don't stack at the same spot
      const seed = `${r.userId || "self"}_${r.date}`;
      const xPct = rand01(seed + "x") * 0.86 + 0.07;
      // Trees grow on the GROUND only (y range 0.6 - 0.95), never in the sky.
      const yPct = rand01(seed + "y") * 0.35 + 0.6;
      const recordDate = new Date(r.date);
      const anniv = joinedAt && isAnniversary(joinedAt, recordDate);
      items.push({
        id: seed,
        date: r.date,
        record: r,
        ...c,
        shape: pickShape(seed + "s"),
        xPct, yPct, isAnniv: anniv,
      });
    });
    items.sort((a, b) => a.yPct - b.yPct);
    return items;
  }, [filtered, officeStart, officeEnd, now, joinedAt]);

  // Recent records for weather
  const recentRecords = useMemo(() => {
    const sorted = [...(records || [])].sort((a, b) => a.date.localeCompare(b.date));
    return sorted.slice(-14);
  }, [records]);
  const weather = useMemo(() => getWeather(recentRecords), [recentRecords]);

  // Stats
  const stats = useMemo(() => {
    let grown = 0, dead = 0, stumps = 0, overtime = 0, bestStreak = 0, curStreak = 0;
    let onTime = 0, late = 0, earlyLeave = 0, absent = 0, off = 0;
    const sorted = [...filtered].sort((a, b) => a.date.localeCompare(b.date));
    sorted.forEach((r) => {
      const c = classify(r, officeStart, officeEnd, now);
      if (!c) return;
      if (c.kind === "dead") { dead++; absent++; curStreak = 0; }
      else if (c.kind === "stump") { stumps++; off++; curStreak = 0; }
      else if (c.kind !== "pending") {
        grown++;
        if (c.kind === "overtime") overtime++;
        if (c.kind === "healthy" || c.kind === "overtime") onTime++;
        else if (c.kind === "late") late++;
        else if (c.kind === "stunted") earlyLeave++;
        curStreak++;
        bestStreak = Math.max(bestStreak, curStreak);
      }
    });
    return { grown, dead, stumps, overtime, bestStreak, onTime, late, earlyLeave, absent, off };
  }, [filtered, officeStart, officeEnd, now]);

  const healthScore = getForestHealthScore(stats);
  const healthInfo = getHealthLabel(healthScore);

  const sky = useMemo(() => getSkyState(now, 1000, 500), [now]);
  const groundTop = sky.phase === "night" ? "#15803d" : season.palette.groundTop;
  const groundBottom = sky.phase === "night" ? "#166534" : season.palette.groundBottom;

  const canvas = { w: 1000, h: 500 };
  const grownCount = stats.grown;
  const deadCount = stats.dead;
  const seasonSeed = `${year}-${month}-${mode}`;

  const birdCount = Math.min(9, Math.max(3, 4 + Math.floor(grownCount / 4) - Math.floor(deadCount / 3)));
  const birds = useMemo(() => {
    const arr = [];
    for (let i = 0; i < birdCount; i++) {
      const seed = `${seasonSeed}-bird-${i}`;
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

  const grass = useMemo(() => {
    const arr = [];
    for (let c = 0; c < 20; c++) {
      const seed = `${seasonSeed}-cluster-${c}`;
      const cx = rand01(seed + "x") * canvas.w;
      const cy = canvas.h * 0.58 + rand01(seed + "y") * canvas.h * 0.4;
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
          flowerColor: ["#ec4899", "#fbbf24", "#a78bfa", "#f97316"][Math.floor(rand01(eSeed + "f") * 4)],
        });
      }
    }
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

  const animals = useMemo(() => {
    const arr = [];
    if (grownCount >= 1) arr.push({ kind: "butterfly", id: "bfly-1", x: 0.3, y: 0.45 });
    if (grownCount >= 3) arr.push({ kind: "rabbit", id: "rabbit-1", x: 0.18, y: 0.88 });
    if (grownCount >= 7) arr.push({ kind: "butterfly", id: "bfly-2", x: 0.68, y: 0.52 });
    if (grownCount >= 10) arr.push({ kind: "deer", id: "deer-1", x: 0.82, y: 0.86 });
    if (grownCount >= 14) arr.push({ kind: "rabbit", id: "rabbit-2", x: 0.55, y: 0.92 });
    return arr;
  }, [grownCount]);

  const changeMonth = (delta) => {
    let m = month + delta, y = year;
    if (m < 0) { m = 11; y--; }
    else if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y);
  };

  // Drag-to-pan handlers
  const handleMouseDown = (e) => {
    dragging.current = { startX: e.clientX, startPan: panX };
  };
  const handleMouseMove = (e) => {
    if (!dragging.current) return;
    const delta = e.clientX - dragging.current.startX;
    setPanX(Math.max(-200, Math.min(200, dragging.current.startPan + delta)));
  };
  const handleMouseUp = () => { dragging.current = null; };
  useEffect(() => {
    if (!dragging.current) return;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // Click tree → popup
  const selectedRecord = useMemo(() => {
    if (!selectedDate) return null;
    return filtered.find((r) => r.date === selectedDate);
  }, [selectedDate, filtered]);

  const handleTreeClick = (date) => {
    setSelectedDate(date === selectedDate ? null : date);
  };

  return (
    <div
      className={`surface-elevated overflow-hidden ${fullscreen ? "fixed inset-0 z-50 rounded-none" : ""}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-600">
            <Trees className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold tracking-tight flex items-center gap-2">
              {title}
              <span className="badge badge-neutral text-[10px]">{season.name}</span>
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              {healthInfo.emoji} {healthInfo.label} · {healthScore}/100 health
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Sound toggle */}
          <button
            onClick={toggleSound}
            className="btn btn-secondary btn-icon"
            title={soundsOn ? "Mute forest sounds" : "Play forest sounds"}
          >
            {soundsOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
          {/* 3D toggle */}
          <button
            onClick={() => setIs3D(!is3D)}
            className={`btn btn-icon ${is3D ? "btn-accent" : "btn-secondary"}`}
            title={is3D ? "Switch to 2D" : "Try 3D view"}
          >
            {is3D ? <Square className="w-3.5 h-3.5" /> : <Box className="w-3.5 h-3.5" />}
          </button>
          {/* Fullscreen */}
          <button
            onClick={() => setFullscreen(!fullscreen)}
            className="btn btn-secondary btn-icon"
            title="Toggle fullscreen"
          >
            {fullscreen ? <X className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <div className="flex gap-1 p-1 bg-[var(--bg-soft)] rounded-md border border-[var(--border)]">
            <button
              onClick={() => setMode("month")}
              className={`px-2.5 py-1 text-xs font-medium rounded transition ${
                mode === "month" ? "bg-white text-[var(--text)] shadow-sm" : "text-[var(--text-secondary)]"
              }`}
            >Month</button>
            <button
              onClick={() => setMode("year")}
              className={`px-2.5 py-1 text-xs font-medium rounded transition ${
                mode === "year" ? "bg-white text-[var(--text)] shadow-sm" : "text-[var(--text-secondary)]"
              }`}
            >Year</button>
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
              <span className="text-sm font-medium px-2 tabular-nums min-w-[60px] text-center">{year}</span>
              <button onClick={() => setYear(year + 1)} className="btn btn-secondary btn-icon">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div
        className={`relative ${fullscreen ? "h-[calc(100vh-200px)]" : ""}`}
        onMouseDown={handleMouseDown}
      >
        {is3D ? (
          <Suspense
            fallback={
              <div className="aspect-[2/1] flex items-center justify-center bg-slate-900 text-white">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm opacity-80">Loading 3D forest...</p>
                </div>
              </div>
            }
          >
            <Forest3D trees={trees} sky={sky} season={season} weather={weather} canvasW={canvas.w} canvasH={canvas.h} />
          </Suspense>
        ) : (
          <svg
            viewBox={`${-panX} 0 ${canvas.w} ${canvas.h}`}
            className="w-full h-auto block select-none"
            preserveAspectRatio="xMidYMid slice"
            style={{ cursor: dragging.current ? "grabbing" : "grab" }}
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
              <linearGradient id="mountainBack" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={sky.phase === "night" ? "#1e3a8a" : "#bbf7d0"} />
                <stop offset="100%" stopColor={sky.phase === "night" ? "#1e293b" : "#86efac"} />
              </linearGradient>
              <linearGradient id="mountainFront" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={sky.phase === "night" ? "#0f172a" : "#4ade80"} />
                <stop offset="100%" stopColor={sky.phase === "night" ? "#020617" : "#16a34a"} />
              </linearGradient>
            </defs>

            <rect x="0" y="0" width={canvas.w} height={canvas.h * 0.55} fill="url(#sky)" />

            {(sky.phase === "night" || sky.phase === "dawn" || sky.phase === "dusk") &&
              stars.map((s) => {
                const starOpacity =
                  sky.phase === "night" ? 1 : sky.phase === "dawn" ? 1 - sky.sun.opacity : sky.moon.opacity;
                return (
                  <circle key={s.id} cx={s.x} cy={s.y} r={s.size} fill="white" opacity={starOpacity * 0.9}>
                    <animate attributeName="opacity"
                      values={`${starOpacity * 0.3};${starOpacity * 0.9};${starOpacity * 0.3}`}
                      dur={`${s.twinkle}s`} repeatCount="indefinite" />
                  </circle>
                );
              })}

            {sky.sun.opacity > 0.01 && (
              <g opacity={sky.sun.opacity}>
                <circle cx={sky.sun.x} cy={sky.sun.y} r="46" fill="#fde047" opacity="0.2" />
                <circle cx={sky.sun.x} cy={sky.sun.y} r="36" fill="#fde047" opacity="0.4" />
                <circle cx={sky.sun.x} cy={sky.sun.y} r="28" fill="#fbbf24" />
              </g>
            )}
            {sky.moon.opacity > 0.01 && (
              <g opacity={sky.moon.opacity}>
                <circle cx={sky.moon.x} cy={sky.moon.y} r="32" fill="#f1f5f9" opacity="0.25" />
                <circle cx={sky.moon.x} cy={sky.moon.y} r="22" fill="#f8fafc" />
                <circle cx={sky.moon.x - 6} cy={sky.moon.y - 4} r="3" fill="#cbd5e1" opacity="0.5" />
                <circle cx={sky.moon.x + 5} cy={sky.moon.y + 6} r="2" fill="#cbd5e1" opacity="0.4" />
              </g>
            )}

            {/* Back hills — opaque, covers sun/moon when they're low */}
            <path
              d={`M0,${canvas.h * 0.55} Q${canvas.w * 0.18},${canvas.h * 0.4} ${canvas.w * 0.35},${canvas.h * 0.48} T${canvas.w * 0.65},${canvas.h * 0.46} T${canvas.w},${canvas.h * 0.5} L${canvas.w},${canvas.h * 0.56} L0,${canvas.h * 0.56} Z`}
              fill="url(#mountainBack)"
            />
            {/* Front hills — closer, darker, more dramatic peaks */}
            <path
              d={`M0,${canvas.h * 0.58} Q${canvas.w * 0.1},${canvas.h * 0.47} ${canvas.w * 0.22},${canvas.h * 0.53} T${canvas.w * 0.45},${canvas.h * 0.5} T${canvas.w * 0.7},${canvas.h * 0.54} T${canvas.w},${canvas.h * 0.55} L${canvas.w},${canvas.h * 0.6} L0,${canvas.h * 0.6} Z`}
              fill="url(#mountainFront)"
            />

            {/* Weather-driven clouds */}
            {sky.phase !== "night" && (weather !== "rainy" && weather !== "stormy") && (
              <>
                <g opacity={0.85} fill="white">
                  <animateTransform attributeName="transform" type="translate" values={`0 0; ${canvas.w * 0.05} 0; 0 0`} dur="80s" repeatCount="indefinite" />
                  <ellipse cx={canvas.w * 0.18} cy={canvas.h * 0.16} rx="48" ry="14" />
                  <ellipse cx={canvas.w * 0.22} cy={canvas.h * 0.13} rx="32" ry="12" />
                  <ellipse cx={canvas.w * 0.14} cy={canvas.h * 0.18} rx="28" ry="10" />
                </g>
                <g opacity="0.7" fill="white">
                  <animateTransform attributeName="transform" type="translate" values={`0 0; ${-canvas.w * 0.04} 0; 0 0`} dur="60s" repeatCount="indefinite" />
                  <ellipse cx={canvas.w * 0.62} cy={canvas.h * 0.12} rx="38" ry="11" />
                  <ellipse cx={canvas.w * 0.66} cy={canvas.h * 0.1} rx="24" ry="9" />
                </g>
              </>
            )}
            {/* Rain clouds — heavier, darker, lower */}
            {(weather === "rainy" || weather === "stormy") && sky.phase !== "night" && (
              <g opacity="0.85" fill="#64748b">
                <ellipse cx={canvas.w * 0.3} cy={canvas.h * 0.2} rx="80" ry="18" />
                <ellipse cx={canvas.w * 0.55} cy={canvas.h * 0.16} rx="100" ry="22" />
                <ellipse cx={canvas.w * 0.75} cy={canvas.h * 0.22} rx="70" ry="16" />
              </g>
            )}

            {sky.phase === "day" && weather === "sunny" &&
              birds.map((b) => (
                <Bird key={b.id} y={b.y} size={b.size} duration={b.duration} delay={b.delay} canvasW={canvas.w} reversed={b.reversed} />
              ))}

            <rect x="0" y={canvas.h * 0.55} width={canvas.w} height={canvas.h * 0.45} fill="url(#ground)" />

            {/* River with downstream flow */}
            {(() => {
              const h = canvas.h, w = canvas.w;
              const pts = [
                [-30, 0.77, 0.87],
                [w * 0.32, 0.8, 0.88],
                [w * 0.66, 0.85, 0.91],
                [w + 30, 0.83, 0.91],
              ];
              const midY = pts.map(([x, t, b]) => [x, ((t + b) / 2) * h]);
              const bankPath = `M${pts[0][0]},${(pts[0][1] - 0.03) * h}
                C${w * 0.1},${(pts[0][1] - 0.06) * h} ${w * 0.18},${(pts[1][1] + 0.01) * h} ${pts[1][0]},${(pts[1][1] - 0.03) * h}
                C${w * 0.46},${(pts[1][1] - 0.04) * h} ${w * 0.52},${(pts[2][1] + 0.03) * h} ${pts[2][0]},${(pts[2][1] - 0.03) * h}
                C${w * 0.82},${(pts[2][1] - 0.04) * h} ${w * 0.88},${(pts[3][1] + 0.03) * h} ${pts[3][0]},${(pts[3][1] - 0.02) * h}
                L${pts[3][0]},${(pts[3][2] + 0.03) * h}
                C${w * 0.88},${(pts[3][2] + 0.06) * h} ${w * 0.82},${(pts[2][2] - 0.01) * h} ${pts[2][0]},${(pts[2][2] + 0.03) * h}
                C${w * 0.52},${(pts[2][2] + 0.05) * h} ${w * 0.46},${(pts[1][2] - 0.01) * h} ${pts[1][0]},${(pts[1][2] + 0.03) * h}
                C${w * 0.18},${(pts[1][2] + 0.04) * h} ${w * 0.1},${(pts[0][2] - 0.01) * h} ${pts[0][0]},${(pts[0][2] + 0.04) * h} Z`;
              const waterPath = `M${pts[0][0]},${pts[0][1] * h}
                C${w * 0.1},${(pts[0][1] - 0.03) * h} ${w * 0.2},${(pts[1][1] + 0.01) * h} ${pts[1][0]},${pts[1][1] * h}
                C${w * 0.46},${(pts[1][1] - 0.01) * h} ${w * 0.5},${(pts[2][1] + 0.02) * h} ${pts[2][0]},${pts[2][1] * h}
                C${w * 0.82},${(pts[2][1] - 0.04) * h} ${w * 0.86},${(pts[3][1] + 0.03) * h} ${pts[3][0]},${pts[3][1] * h}
                L${pts[3][0]},${pts[3][2] * h}
                C${w * 0.86},${(pts[3][2] + 0.02) * h} ${w * 0.82},${(pts[2][2] - 0.04) * h} ${pts[2][0]},${pts[2][2] * h}
                C${w * 0.5},${(pts[2][2] + 0.03) * h} ${w * 0.46},${(pts[1][2] - 0.06) * h} ${pts[1][0]},${pts[1][2] * h}
                C${w * 0.2},${(pts[1][2] + 0.02) * h} ${w * 0.1},${(pts[0][2] - 0.04) * h} ${pts[0][0]},${pts[0][2] * h} Z`;
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
                  <path d={bankPath} fill={isNight ? "#475569" : "#fcd34d"} opacity={isNight ? 0.3 : 0.45} />
                  <path d={waterPath} fill="url(#water)" opacity="0.9" />
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <ellipse key={`shimmer-${i}`} cx="0" cy="0" rx={6 + (i % 3) * 4} ry="1.2" fill="white" opacity={0.55}>
                      <animateMotion dur={`${14 + (i % 3) * 4}s`} begin={`-${i * 2.8}s`} repeatCount="indefinite" rotate="auto">
                        <mpath href="#riverFlow" />
                      </animateMotion>
                      <animate attributeName="opacity" values="0; 0.55; 0.55; 0" dur={`${14 + (i % 3) * 4}s`} begin={`-${i * 2.8}s`} repeatCount="indefinite" />
                    </ellipse>
                  ))}
                  {[0, 1].map((i) => (
                    <g key={`leaf-${i}`}>
                      <animateMotion dur={`${24 + i * 8}s`} begin={`-${i * 12}s`} repeatCount="indefinite" rotate="auto">
                        <mpath href="#riverFlow" />
                      </animateMotion>
                      <ellipse rx="3" ry="1.4" fill={isNight ? "#65a30d" : "#84cc16"} opacity="0.85">
                        <animateTransform attributeName="transform" type="rotate" values="0; 360" dur="6s" repeatCount="indefinite" />
                      </ellipse>
                    </g>
                  ))}
                </>
              );
            })()}

            {grass.map((g) => {
              const overRiver = g.y > canvas.h * 0.76 && g.y < canvas.h * 0.88;
              if (overRiver) return null;
              return <Grass key={g.id} x={g.x} y={g.y} size={g.size} color={g.shade} kind={g.kind} flowerColor={g.flowerColor} />;
            })}

            {trees.map((t) => (
              <Tree
                key={t.id}
                x={t.xPct * canvas.w} y={t.yPct * canvas.h}
                size={t.size} kind={t.kind} shape={t.shape} date={t.date}
                pending={t.pending} growing={t.growing} isAnniv={t.isAnniv}
                onHover={setHovered} onLeave={() => setHovered(null)} onClick={handleTreeClick}
              />
            ))}

            {animals.map((a) => (
              <Animal key={a.id} kind={a.kind} x={a.x * canvas.w} y={a.y * canvas.h} />
            ))}

            {/* Mascot — bottom-right */}
            <Mascot x={canvas.w * 0.92} y={canvas.h * 0.93} healthScore={healthScore} />

            {/* Weather overlays */}
            {(weather === "rainy" || weather === "stormy") && (
              <Rain canvasW={canvas.w} canvasH={canvas.h} intensity={weather === "stormy" ? 1 : 0.5} />
            )}
            {/* Seasonal effects */}
            {season.palette.effect === "leaves" && <FallingLeaves canvasW={canvas.w} canvasH={canvas.h} />}
            {season.palette.effect === "snow" && <SnowAccumulation canvasW={canvas.w} canvasH={canvas.h} />}
            {season.palette.effect === "blossom" && <Blossoms canvasW={canvas.w} canvasH={canvas.h} />}

            {trees.length === 0 && (
              <text x={canvas.w / 2} y={canvas.h * 0.7} textAnchor="middle" fontSize="20" fill="#525252" opacity="0.6">
                No trees yet — plant your first by showing up today.
              </text>
            )}
          </svg>
        )}

        {/* Tree popup */}
        {selectedRecord && !is3D && (
          <div className="absolute top-3 left-3 surface-elevated p-3 shadow-xl animate-slide-up max-w-xs">
            <button
              onClick={() => setSelectedDate(null)}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[var(--text)] text-white flex items-center justify-center"
            >
              <X className="w-3 h-3" />
            </button>
            <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1">
              {new Date(selectedRecord.date).toLocaleDateString(undefined, {
                weekday: "long", month: "short", day: "numeric",
              })}
            </p>
            <p className="font-semibold capitalize mb-1">
              {selectedRecord.status}
              {selectedRecord.state === "pending" && <span className="ml-1 badge badge-warning text-[10px]">Pending</span>}
            </p>
            {selectedRecord.entryTime && (
              <p className="text-sm text-[var(--text-secondary)] tabular-nums">
                {formatTime12(selectedRecord.entryTime)}
                {selectedRecord.exitTime && ` – ${formatTime12(selectedRecord.exitTime)}`}
              </p>
            )}
            {selectedRecord.note && <p className="text-sm mt-1">{selectedRecord.note}</p>}
            {selectedRecord.reason && <p className="text-sm mt-1 italic">{selectedRecord.reason}</p>}
          </div>
        )}

        {/* Hover tooltip */}
        {hovered && !selectedRecord && !is3D && (
          <div
            className="absolute pointer-events-none bg-[var(--text)] text-white text-xs rounded-md px-2.5 py-1.5 shadow-lg whitespace-nowrap z-10"
            style={{
              left: `${(hovered.x / canvas.w) * 100}%`,
              top: `${(hovered.y / canvas.h) * 100}%`,
              transform: "translate(-50%, calc(-100% - 12px))",
            }}
          >
            <p className="font-semibold">
              {hovered.date}
              {hovered.growing && <span className="ml-1.5 text-emerald-300">· growing now</span>}
            </p>
            <p className="opacity-80">{getToneLabel({
              healthy: "good", late: "late", stunted: "early_out", overtime: "good",
              dead: "absent", stump: "off",
            }[hovered.kind])}</p>
          </div>
        )}
      </div>

      {/* Stats footer */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-5 border-t border-[var(--border)]">
        <ForestStat label="Trees grown" value={stats.grown} icon="🌳" />
        <ForestStat label="Overtime" value={stats.overtime} icon="✨" />
        <ForestStat label="Withered" value={stats.dead} icon="🪵" />
        <ForestStat label="Stumps" value={stats.stumps} icon="🪨" />
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
        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">{label}</p>
        <p className="text-base font-semibold tabular-nums">{value}</p>
      </div>
    </div>
  );
}
