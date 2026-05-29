import { formatTime12, getDayTone, getToneLabel } from "./calendarUtils";

/* ---------- CSV ---------- */
function escapeCSV(value) {
  if (value == null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportAttendanceCSV({ records, members, company, dateRange }) {
  const headers = [
    "Date",
    "Day",
    "Member",
    "Email",
    "Status",
    "State",
    "Entry Time",
    "Exit Time",
    "Result",
    "Worked Hours",
    "Note",
    "Reason",
    "Submitted By",
    "Reviewed By",
  ];

  const memberMap = {};
  (members || []).forEach((m) => { memberMap[m.id] = m; });

  const sorted = [...records].sort((a, b) => {
    const c = a.date.localeCompare(b.date);
    if (c !== 0) return c;
    const an = memberMap[a.userId]?.displayName || "";
    const bn = memberMap[b.userId]?.displayName || "";
    return an.localeCompare(bn);
  });

  const rows = sorted.map((r) => {
    const member = memberMap[r.userId] || {};
    const dateObj = new Date(r.date);
    const tone = getDayTone(r, { start: company?.officeStart, end: company?.officeEnd });
    let workedHours = "";
    if (r.entryTime && r.exitTime) {
      const [eh, em] = r.entryTime.split(":").map(Number);
      const [xh, xm] = r.exitTime.split(":").map(Number);
      const min = Math.max(0, xh * 60 + xm - (eh * 60 + em));
      workedHours = (min / 60).toFixed(2);
    }
    return [
      r.date,
      dateObj.toLocaleDateString(undefined, { weekday: "long" }),
      member.displayName || r.userId,
      member.email || "",
      r.status || "",
      r.state || "approved",
      r.entryTime ? formatTime12(r.entryTime) : "",
      r.exitTime ? formatTime12(r.exitTime) : "",
      getToneLabel(tone),
      workedHours,
      r.note || "",
      r.reason || "",
      r.submittedBy || "",
      r.reviewedBy || "",
    ].map(escapeCSV).join(",");
  });

  const csv = [headers.map(escapeCSV).join(","), ...rows].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const filename = `attendance-${company?.name?.replace(/\s+/g, "-").toLowerCase() || "export"}-${dateRange || new Date().toISOString().slice(0, 10)}.csv`;
  downloadBlob(blob, filename);
}

/* ---------- PDF (lazy-loaded jsPDF) ---------- */
export async function exportAttendancePDF({ records, members, company, periodLabel }) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = 50;

  // Header
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(company?.name || "Workspace", 40, y);
  y += 24;
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Attendance report · ${periodLabel || "All time"}`, 40, y);
  y += 16;
  doc.text(`Generated ${new Date().toLocaleDateString()}`, 40, y);
  y += 24;
  doc.setTextColor(0);

  const memberMap = {};
  (members || []).forEach((m) => { memberMap[m.id] = m; });

  // Group records by member
  const byMember = {};
  records.forEach((r) => {
    if (!byMember[r.userId]) byMember[r.userId] = [];
    byMember[r.userId].push(r);
  });

  // Summary table per member
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Summary", 40, y);
  y += 18;

  const tableHeaders = ["Member", "Present", "Absent", "Off", "Late", "Hours"];
  const colWidths = [180, 60, 60, 60, 60, 80];
  let x = 40;
  doc.setFontSize(10);
  doc.setFillColor(240);
  doc.rect(40, y - 12, pageW - 80, 18, "F");
  tableHeaders.forEach((h, i) => {
    doc.text(h, x + 4, y);
    x += colWidths[i];
  });
  y += 14;

  doc.setFont("helvetica", "normal");
  Object.entries(byMember).forEach(([uid, recs]) => {
    if (y > pageH - 60) {
      doc.addPage();
      y = 50;
    }
    const name = memberMap[uid]?.displayName || uid;
    const present = recs.filter((r) => r.status === "present" && (r.state ?? "approved") === "approved").length;
    const absent = recs.filter((r) => r.status === "absent" && (r.state ?? "approved") === "approved").length;
    const off = recs.filter((r) => r.status === "off" && (r.state ?? "approved") === "approved").length;
    const late = recs.filter((r) => {
      const tone = getDayTone(r, { start: company?.officeStart, end: company?.officeEnd });
      return tone === "late" || tone === "late_early";
    }).length;
    let totalMin = 0;
    recs.forEach((r) => {
      if (r.entryTime && r.exitTime) {
        const [eh, em] = r.entryTime.split(":").map(Number);
        const [xh, xm] = r.exitTime.split(":").map(Number);
        totalMin += Math.max(0, xh * 60 + xm - (eh * 60 + em));
      }
    });
    const hours = (totalMin / 60).toFixed(1);
    const vals = [name, present, absent, off, late, `${hours}h`];
    x = 40;
    vals.forEach((v, i) => {
      doc.text(String(v).slice(0, i === 0 ? 28 : 10), x + 4, y);
      x += colWidths[i];
    });
    y += 16;
  });

  y += 20;

  // Detail per member, paginated
  const sortedMembers = Object.keys(byMember).sort((a, b) =>
    (memberMap[a]?.displayName || "").localeCompare(memberMap[b]?.displayName || ""),
  );

  sortedMembers.forEach((uid) => {
    if (y > pageH - 100) {
      doc.addPage();
      y = 50;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(memberMap[uid]?.displayName || uid, 40, y);
    y += 14;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(memberMap[uid]?.email || "", 40, y);
    y += 16;
    doc.setTextColor(0);

    const recs = byMember[uid].sort((a, b) => a.date.localeCompare(b.date));
    const detailHeaders = ["Date", "Status", "Entry", "Exit", "Result"];
    const detailWidths = [80, 60, 70, 70, 100];
    x = 40;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(248);
    doc.rect(40, y - 10, pageW - 80, 14, "F");
    detailHeaders.forEach((h, i) => {
      doc.text(h, x + 4, y);
      x += detailWidths[i];
    });
    y += 12;
    doc.setFont("helvetica", "normal");

    recs.forEach((r) => {
      if (y > pageH - 40) {
        doc.addPage();
        y = 50;
      }
      const tone = getDayTone(r, { start: company?.officeStart, end: company?.officeEnd });
      const vals = [
        r.date,
        r.status,
        r.entryTime ? formatTime12(r.entryTime) : "—",
        r.exitTime ? formatTime12(r.exitTime) : "—",
        getToneLabel(tone) || (r.state === "pending" ? "Pending" : ""),
      ];
      x = 40;
      vals.forEach((v, i) => {
        doc.text(String(v || ""), x + 4, y);
        x += detailWidths[i];
      });
      y += 12;
    });

    y += 16;
  });

  // Footer with page numbers
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Tally Attendance · Page ${i} of ${totalPages}`,
      pageW / 2,
      pageH - 20,
      { align: "center" },
    );
  }

  const filename = `attendance-${company?.name?.replace(/\s+/g, "-").toLowerCase() || "export"}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

/* ---------- Bulk staff CSV import parser ---------- */
export function parseStaffCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { rows: [], errors: ["Empty CSV file"] };

  const header = lines[0].toLowerCase().split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const nameIdx = header.findIndex((h) => h.includes("name") && !h.includes("user"));
  const emailIdx = header.findIndex((h) => h.includes("email"));
  const deptIdx = header.findIndex((h) => h.includes("dept") || h.includes("department") || h.includes("team"));

  if (nameIdx < 0 || emailIdx < 0) {
    return {
      rows: [],
      errors: ["CSV must have 'name' and 'email' columns. Optional: 'department'."],
    };
  }

  const rows = [];
  const errors = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    // Simple split — doesn't handle quoted commas, but CSV header validates schema
    const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const displayName = cols[nameIdx];
    const email = cols[emailIdx]?.toLowerCase();
    const department = deptIdx >= 0 ? cols[deptIdx] : "";

    if (!displayName) { errors.push(`Row ${i + 1}: missing name`); continue; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push(`Row ${i + 1}: invalid email "${email}"`);
      continue;
    }
    rows.push({ displayName, email, department });
  }

  return { rows, errors };
}
