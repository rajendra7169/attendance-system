// Builds an iCalendar (.ics) file from approved leave / off-day records and
// optional company holidays. Designed for one-shot download — users import
// or drag the file into Google Cal / Outlook / Apple Cal manually.

function pad(n) {
  return String(n).padStart(2, "0");
}

function dateToBasic(dateStr) {
  // YYYY-MM-DD → YYYYMMDD (the all-day DATE form ICS expects)
  return dateStr.replace(/-/g, "");
}

function addDay(dateStr) {
  // YYYY-MM-DD → YYYYMMDD for the day after (ICS DTEND is exclusive for
  // all-day events).
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}`;
}

function nowStamp() {
  const d = new Date();
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function escapeText(s) {
  return String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function event({ uid, dateStr, summary, description }) {
  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${nowStamp()}`,
    `DTSTART;VALUE=DATE:${dateToBasic(dateStr)}`,
    `DTEND;VALUE=DATE:${addDay(dateStr)}`,
    `SUMMARY:${escapeText(summary)}`,
    description ? `DESCRIPTION:${escapeText(description)}` : null,
    "TRANSP:TRANSPARENT",
    "END:VEVENT",
  ]
    .filter(Boolean)
    .join("\r\n");
}

// records: attendance records (will pick approved leave + approved off)
// holidays: [{ date, name }] from company.holidays (optional)
// owner: { uid, name } for UID uniqueness and the calendar name
export function buildICS({ records = [], holidays = [], owner = {}, calendarName = "Tally" }) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tally//Attendance//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ];

  records
    .filter(
      (r) =>
        (r.status === "leave" || r.status === "off") &&
        (r.state ? r.state === "approved" : true) &&
        r.date,
    )
    .forEach((r) => {
      const title =
        r.status === "leave"
          ? `On leave${r.leaveType ? ` (${r.leaveType})` : ""}`
          : "Off-day";
      lines.push(
        event({
          uid: `att-${owner.uid || "u"}-${r.date}@tally`,
          dateStr: r.date,
          summary: title,
          description: r.reason || "",
        }),
      );
    });

  holidays.forEach((h) => {
    lines.push(
      event({
        uid: `hol-${h.date}@tally`,
        dateStr: h.date,
        summary: h.name || "Holiday",
        description: "Workspace holiday",
      }),
    );
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadICS(filename, content) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}
