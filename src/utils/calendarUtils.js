import {
  eachDayOfInterval,
  format,
  isSaturday,
  isSunday,
} from "date-fns";

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Office hours — entries after start = late, exits before end = early
export const OFFICE_START = "10:00";
export const OFFICE_END = "17:30";

/**
 * Convert a 24h "HH:MM" string to a 12h display like "5:30 PM".
 */
export function formatTime12(time24) {
  if (!time24) return "";
  const [hStr, mStr] = time24.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return time24;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}

export function isHoliday(date) {
  return isSaturday(date);
}

export function isSaturdayOrSunday(date) {
  return isSaturday(date) || isSunday(date);
}

export function getCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());

  const endDate = new Date(lastDay);
  endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));

  return eachDayOfInterval({ start: startDate, end: endDate });
}

export function formatDateKey(date) {
  return format(date, "yyyy-MM-dd");
}

export function formatDateDisplay(date) {
  return format(date, "MMM dd, yyyy");
}

export function getMonthYear(year, month) {
  return `${MONTHS[month]} ${year}`;
}

export function isCurrentMonth(date, year, month) {
  return date.getFullYear() === year && date.getMonth() === month;
}

/**
 * Derive a UI tone from an attendance record.
 * Tones: good | late | early_out | late_early | absent | off | null
 * Pass per-company hours via opts to override defaults.
 */
export function getDayTone(record, { start = OFFICE_START, end = OFFICE_END } = {}) {
  if (!record) return null;
  if (record.status === "absent") return "absent";
  if (record.status === "off") return "off";

  const lateEntry = record.entryTime && record.entryTime > start;
  const leftEarly = record.exitTime && record.exitTime < end;

  if (lateEntry && leftEarly) return "late_early";
  if (lateEntry) return "late";
  if (leftEarly) return "early_out";
  return "good";
}

export function getToneLabel(tone) {
  switch (tone) {
    case "good": return "On time";
    case "late": return "Late entry";
    case "early_out": return "Left early";
    case "late_early": return "Late & left early";
    case "absent": return "Absent";
    case "off": return "Off (planned)";
    default: return "";
  }
}

// Short labels for compact UI like calendar tiles
export function getToneShortLabel(tone) {
  switch (tone) {
    case "good": return "On time";
    case "late": return "Late";
    case "early_out": return "Early out";
    case "late_early": return "Late+";
    case "absent": return "Absent";
    case "off": return "Off";
    default: return "";
  }
}

export function getAttendanceStats(attendanceData, { start = OFFICE_START, end = OFFICE_END } = {}) {
  let present = 0;
  let absent = 0;
  let off = 0;
  let pending = 0;
  let late = 0;
  let earlyEntry = 0;
  let earlyLeave = 0;
  let onTime = 0;

  Object.values(attendanceData).forEach((record) => {
    if (record.state === "pending") pending++;
    // Only count approved (or undefined state for legacy data) toward stats
    if (record.state && record.state !== "approved") return;

    if (record.status === "absent") {
      absent++;
      return;
    }
    if (record.status === "off") {
      off++;
      return;
    }
    present++;

    if (record.entryTime) {
      if (record.entryTime > start) late++;
      else if (record.entryTime < start) earlyEntry++;
    }
    if (record.exitTime && record.exitTime < end) earlyLeave++;

    const entryOk = record.entryTime && record.entryTime <= start;
    const exitOk = record.exitTime && record.exitTime >= end;
    if (entryOk && exitOk) onTime++;
  });

  // Attendance rate excludes off-days (planned leave)
  const accountable = present + absent;
  const rate = accountable > 0 ? Math.round((present / accountable) * 100) : 0;

  return {
    present,
    absent,
    off,
    pending,
    late,
    earlyEntry,
    earlyLeave,
    earlyOut: earlyLeave,
    onTime,
    rate,
  };
}

export function isWorkingDay(date, workingDays = [0, 1, 2, 3, 4, 5]) {
  return workingDays.includes(date.getDay());
}

export function isCompanyHoliday(date, holidays = []) {
  const key = format(date, "yyyy-MM-dd");
  return holidays.some((h) => h.date === key);
}

export function getYearDays(year) {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  return eachDayOfInterval({ start: startDate, end: endDate });
}
