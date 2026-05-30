import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, X, Trash2, Check, Clock, LogIn, LogOut } from "lucide-react";
import { format, isToday } from "date-fns";
import {
  getCalendarDays,
  isCurrentMonth,
  isWorkingDay,
  isCompanyHoliday,
  getDayTone,
  getToneLabel,
  getToneShortLabel,
  getAttendanceStats,
  formatTime12,
  OFFICE_START,
  OFFICE_END,
  WEEKDAYS,
  MONTHS,
} from "../utils/calendarUtils";
import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  doc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../utils/firebase";
import { useAuth } from "../hooks/useAuth";
import { RecordComments } from "./RecordComments";
import { RecordDispute } from "./RecordDispute";

const STATUS_OPTIONS_ADMIN = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "off", label: "Off" },
];

const STATUS_OPTIONS_STAFF_TODAY = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
];

export const TONE_STYLES = {
  good: {
    soft: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    swatch: "bg-emerald-500",
  },
  late: {
    soft: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
    swatch: "bg-amber-500",
  },
  early_out: {
    soft: "bg-yellow-50 text-yellow-700 border-yellow-200",
    dot: "bg-yellow-500",
    swatch: "bg-yellow-500",
  },
  late_early: {
    soft: "bg-orange-50 text-orange-700 border-orange-200",
    dot: "bg-orange-500",
    swatch: "bg-orange-500",
  },
  absent: {
    soft: "bg-rose-50 text-rose-700 border-rose-200",
    dot: "bg-rose-500",
    swatch: "bg-rose-500",
  },
  off: {
    soft: "bg-indigo-50 text-indigo-700 border-indigo-200",
    dot: "bg-indigo-500",
    swatch: "bg-indigo-500",
  },
};

function AttendanceModal({
  isOpen,
  onClose,
  date,
  onSave,
  onDelete,
  canEdit,
  existingRecord,
  recordDocId,
  officeStart,
  officeEnd,
  isAdmin,
  isSelf,
  autoApprove,
}) {
  const [status, setStatus] = useState(existingRecord?.status || "present");
  const [entryTime, setEntryTime] = useState(
    existingRecord?.entryTime || officeStart,
  );
  // Exit defaults to existing OR empty — never auto-fills office end, so admin
  // doesn't accidentally check staff out before they've actually checked out.
  const [exitTime, setExitTime] = useState(existingRecord?.exitTime || "");
  const [note, setNote] = useState(existingRecord?.note || "");
  const [reason, setReason] = useState(existingRecord?.reason || "");

  useEffect(() => {
    const s = existingRecord?.status || "present";
    setStatus(s === "late" ? "present" : s);
    setEntryTime(existingRecord?.entryTime || officeStart);
    setExitTime(existingRecord?.exitTime || "");
    setNote(existingRecord?.note || "");
    setReason(existingRecord?.reason || "");
  }, [existingRecord, isOpen, officeStart, officeEnd]);

  // Staff check-in/out state — must be declared BEFORE any early return (Rules of Hooks)
  const [staffMode, setStaffMode] = useState("default"); // default | absent
  const [absentReason, setAbsentReason] = useState(existingRecord?.reason || "");
  useEffect(() => {
    setStaffMode(existingRecord?.status === "absent" ? "absent" : "default");
    setAbsentReason(existingRecord?.reason || "");
  }, [existingRecord, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const payload = { status };
    if (status === "present") {
      payload.entryTime = entryTime;
      // Preserve empty exit so staff's "currently working" state isn't broken
      payload.exitTime = exitTime || "";
      payload.note = note;
    } else {
      payload.reason = reason;
    }
    onSave(payload);
    onClose();
  };

  const nowHHMM = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const isStaffEditingToday = canEdit && !isAdmin && isToday(date);

  // Compute worked duration for completed days
  const computeDuration = (entry, exit) => {
    if (!entry || !exit) return "";
    const [eh, em] = entry.split(":").map(Number);
    const [xh, xm] = exit.split(":").map(Number);
    const min = Math.max(0, xh * 60 + xm - (eh * 60 + em));
    return `${Math.floor(min / 60)}h ${min % 60}m`;
  };

  const handleCheckIn = () => {
    onSave({ status: "present", entryTime: nowHHMM(), exitTime: "", note: "" });
    onClose();
  };

  const handleCheckOut = () => {
    onSave({
      status: "present",
      entryTime: existingRecord?.entryTime || nowHHMM(),
      exitTime: nowHHMM(),
      note: existingRecord?.note || "",
    });
    onClose();
  };

  const handleSubmitAbsent = () => {
    onSave({ status: "absent", reason: absentReason.trim() });
    onClose();
  };

  const hasCheckedIn =
    existingRecord?.status === "present" && existingRecord?.entryTime;
  const hasCheckedOut = hasCheckedIn && existingRecord?.exitTime;
  const isAbsentRecord = existingRecord?.status === "absent";

  const isPending = existingRecord?.state === "pending";
  const isRejected = existingRecord?.state === "rejected";

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="surface-elevated w-full max-w-md p-6 animate-scale-in max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1">
              {isToday(date) ? "Today" : format(date, "EEEE")}
            </p>
            <h2 className="text-lg font-semibold tracking-tight">
              {format(date, "MMMM d, yyyy")}
            </h2>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* State banners */}
        {isPending && (
          <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
            <Clock className="w-4 h-4" />
            <span>Awaiting admin approval</span>
          </div>
        )}
        {isRejected && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-800">
            <p className="font-medium">Rejected by admin</p>
            {existingRecord.reviewNote && (
              <p className="text-xs mt-0.5 opacity-90">"{existingRecord.reviewNote}"</p>
            )}
          </div>
        )}

        {isStaffEditingToday ? (
          <div className="flex flex-col gap-4 min-h-[280px]">
            {/* No record yet — Check in or Mark absent */}
            {!existingRecord && staffMode === "default" && (
              <>
                <p className="text-sm text-[var(--text-secondary)] mb-1">
                  Welcome! Mark your attendance for today.
                </p>
                <button onClick={handleCheckIn} className="btn btn-primary w-full py-3">
                  <LogIn className="w-4 h-4" />
                  Check in now
                </button>
                <button
                  onClick={() => setStaffMode("absent")}
                  className="btn btn-secondary w-full"
                >
                  Mark today as absent
                </button>
                <p className="text-xs text-[var(--text-muted)] text-center mt-auto">
                  Need planned leave? Use "Request leave" instead.
                </p>
              </>
            )}

            {/* Absent flow — reason required */}
            {staffMode === "absent" && !hasCheckedIn && (
              <>
                <label className="label">Reason for absence</label>
                <textarea
                  value={absentReason}
                  onChange={(e) => setAbsentReason(e.target.value)}
                  placeholder="Sick, emergency, no-show..."
                  className="input-field resize-none flex-1 min-h-[120px]"
                />
                <div className="flex gap-2">
                  {!existingRecord && (
                    <button
                      onClick={() => setStaffMode("default")}
                      className="btn btn-ghost"
                    >
                      Back
                    </button>
                  )}
                  <button
                    onClick={handleSubmitAbsent}
                    disabled={!absentReason.trim()}
                    className="btn btn-primary flex-1"
                  >
                    {isAbsentRecord ? "Update reason" : "Submit absence"}
                  </button>
                </div>
              </>
            )}

            {/* Currently checked in, no checkout yet */}
            {hasCheckedIn && !hasCheckedOut && (
              <>
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                  <p className="text-xs uppercase tracking-wider text-emerald-700 font-medium mb-1">
                    Checked in
                  </p>
                  <p className="text-2xl font-semibold tabular-nums text-emerald-900">
                    {formatTime12(existingRecord.entryTime)}
                  </p>
                  <p className="text-xs text-emerald-700/70 mt-1.5 flex items-center gap-1.5">
                    <span className="dot bg-emerald-500 animate-pulse" />
                    Currently working · your tree is growing
                  </p>
                </div>
                <button onClick={handleCheckOut} className="btn btn-primary w-full py-3 mt-auto">
                  <LogOut className="w-4 h-4" />
                  Check out now ({formatTime12(nowHHMM())})
                </button>
              </>
            )}

            {/* Completed day */}
            {hasCheckedOut && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-[var(--bg-soft)] border border-[var(--border)]">
                    <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1">
                      Entry
                    </p>
                    <p className="font-semibold tabular-nums">
                      {formatTime12(existingRecord.entryTime)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--bg-soft)] border border-[var(--border)]">
                    <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1">
                      Exit
                    </p>
                    <p className="font-semibold tabular-nums">
                      {formatTime12(existingRecord.exitTime)}
                    </p>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
                  <p className="text-xs uppercase tracking-wider text-emerald-700 mb-0.5">
                    Worked
                  </p>
                  <p className="text-xl font-semibold tabular-nums text-emerald-900">
                    {computeDuration(existingRecord.entryTime, existingRecord.exitTime)}
                  </p>
                </div>
                <p className="text-xs text-[var(--text-muted)] text-center">
                  Day complete. See you tomorrow!
                </p>
              </>
            )}

            {/* Already absent */}
            {isAbsentRecord && staffMode === "default" && (
              <>
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
                  <p className="text-xs uppercase tracking-wider text-rose-700 font-medium mb-1">
                    Marked absent
                  </p>
                  {existingRecord.reason && (
                    <p className="text-sm text-rose-900 mt-1">{existingRecord.reason}</p>
                  )}
                </div>
                <button
                  onClick={() => setStaffMode("absent")}
                  className="btn btn-ghost mt-auto"
                >
                  Edit reason
                </button>
              </>
            )}
          </div>
        ) : canEdit ? (
          <div className="flex flex-col gap-5">
            <div>
              <label className="label">Status</label>
              <div className={`grid gap-2 ${isAdmin ? "grid-cols-3" : "grid-cols-2"}`}>
                {(isAdmin ? STATUS_OPTIONS_ADMIN : STATUS_OPTIONS_STAFF_TODAY).map((opt) => {
                  const active = status === opt.value;
                  const baseTone =
                    opt.value === "present"
                      ? "good"
                      : opt.value === "absent"
                        ? "absent"
                        : "off";
                  const styles = TONE_STYLES[baseTone];
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setStatus(opt.value)}
                      className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition-all flex items-center justify-center gap-1.5 ${
                        active
                          ? `${styles.swatch} text-white border-transparent shadow-sm`
                          : "bg-[var(--bg-elev)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--border-strong)]"
                      }`}
                    >
                      {active && <Check className="w-3.5 h-3.5" />}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {status === "present" ? (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Entry time</label>
                    <input
                      type="time"
                      value={entryTime}
                      onChange={(e) => setEntryTime(e.target.value)}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="label">Exit time</label>
                    <input
                      type="time"
                      value={exitTime}
                      onChange={(e) => setExitTime(e.target.value)}
                      className="input-field"
                    />
                  </div>
                </div>

                {/* "Currently working" badge when no exit yet */}
                {!exitTime && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
                    <span className="dot bg-emerald-500 animate-pulse" />
                    <span className="font-medium">Currently working</span>
                    <span className="ml-auto text-xs opacity-70">
                      No checkout yet — leave blank to let staff check out
                    </span>
                  </div>
                )}

                {/* Tone preview pill */}
                {(() => {
                  const previewTone = getDayTone(
                    { status, entryTime, exitTime },
                    { start: officeStart, end: officeEnd },
                  );
                  return (
                    <div
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${TONE_STYLES[previewTone].soft}`}
                    >
                      <span className={`dot ${TONE_STYLES[previewTone].dot}`} />
                      <span className="font-medium">{getToneLabel(previewTone)}</span>
                      <span className="ml-auto text-xs opacity-70">
                        {formatTime12(officeStart)} – {formatTime12(officeEnd)}
                      </span>
                    </div>
                  );
                })()}

                <div>
                  <label className="label">Note (optional)</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Add a note..."
                    className="input-field resize-none w-full"
                    rows="3"
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col">
                <label className="label">
                  {status === "absent" ? "Reason for absence" : "Reason for off-day"}
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={
                    status === "absent"
                      ? "Why was this day missed? (sick, no-show, etc.)"
                      : "Planned leave, doctor's appointment, vacation, etc."
                  }
                  className="input-field resize-none w-full"
                  rows="5"
                />
              </div>
            )}

            {/* Submission hint for staff */}
            {isSelf && !isAdmin && !autoApprove && (
              <p className="text-xs text-[var(--text-muted)] -mt-2">
                Your submission will be marked <strong>pending</strong> until an admin approves it.
              </p>
            )}

            <div className="flex gap-2 pt-2">
              <button onClick={handleSave} className="btn btn-primary flex-1">
                {existingRecord ? "Update" : "Submit"}
              </button>
              {existingRecord && (
                <button
                  onClick={() => {
                    onDelete();
                    onClose();
                  }}
                  className="btn btn-danger btn-icon"
                  aria-label="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ) : (
          <ViewerView record={existingRecord} officeStart={officeStart} officeEnd={officeEnd} />
        )}

        {existingRecord && recordDocId && (
          <RecordDispute record={existingRecord} recordDocId={recordDocId} />
        )}

        {existingRecord && recordDocId && (
          <RecordComments recordDocId={recordDocId} />
        )}
      </div>
    </div>
  );
}

function ViewerView({ record, officeStart, officeEnd }) {
  if (!record) {
    return (
      <p className="text-sm text-[var(--text-muted)] text-center py-4">
        No attendance recorded for this day.
      </p>
    );
  }
  const tone = getDayTone(record, { start: officeStart, end: officeEnd });
  const styles = TONE_STYLES[tone];

  return (
    <div className="space-y-4">
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${styles.soft}`}>
        <span className={`dot ${styles.dot}`} />
        <span className="font-semibold capitalize">{record.status}</span>
        <span className="ml-auto text-xs opacity-80">{getToneLabel(tone)}</span>
      </div>

      {record.status === "present" && (
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[var(--border)]">
          <div>
            <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1">Entry</p>
            <p className="font-medium tabular-nums">{formatTime12(record.entryTime)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1">Exit</p>
            <p className="font-medium tabular-nums">{formatTime12(record.exitTime)}</p>
          </div>
        </div>
      )}

      {record.note && (
        <div className="pt-2 border-t border-[var(--border)]">
          <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1">Note</p>
          <p className="text-sm">{record.note}</p>
        </div>
      )}
      {record.reason && (
        <div className="pt-2 border-t border-[var(--border)]">
          <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1">Reason</p>
          <p className="text-sm">{record.reason}</p>
        </div>
      )}
    </div>
  );
}

export function Calendar({ memberId, year, company, canEdit, isSelf }) {
  const { user, userDoc, isAdmin } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [attendance, setAttendance] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const officeStart = company?.officeStart || OFFICE_START;
  const officeEnd = company?.officeEnd || OFFICE_END;
  const workingDays = company?.workingDays || [0, 1, 2, 3, 4, 5];
  const holidays = company?.holidays || [];
  const autoApprove = !!company?.autoApprove;

  useEffect(() => {
    if (!memberId || !userDoc?.companyId) return;
    const fetchAttendance = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(
          query(
            collection(db, "attendance"),
            where("companyId", "==", userDoc.companyId),
            where("userId", "==", memberId),
          ),
        );
        const data = {};
        snap.forEach((d) => {
          const r = d.data();
          data[r.date] = r;
        });
        setAttendance(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchAttendance();
  }, [memberId, userDoc?.companyId]);

  const days = getCalendarDays(year, currentMonth);
  const dateKey = (date) => format(date, "yyyy-MM-dd");

  const handleSave = async (data) => {
    if (!selectedDate || !memberId || !userDoc?.companyId) return;
    try {
      const docId = `${memberId}_${dateKey(selectedDate)}`;
      // Determine approval state:
      // - admin always = approved
      // - staff self-submit = pending unless autoApprove
      const state = isAdmin ? "approved" : autoApprove ? "approved" : "pending";

      const payload = {
        userId: memberId,
        companyId: userDoc.companyId,
        date: dateKey(selectedDate),
        ...data,
        state,
        submittedBy: user.uid,
        submittedAt: serverTimestamp(),
        // Clear any previous review when re-submitting
        ...(isAdmin
          ? { reviewedBy: user.uid, reviewedAt: serverTimestamp() }
          : { reviewedBy: null, reviewedAt: null, reviewNote: "" }),
      };

      await setDoc(doc(db, "attendance", docId), payload);
      setAttendance((prev) => ({ ...prev, [dateKey(selectedDate)]: payload }));
    } catch (e) {
      console.error(e);
      alert(e.message || "Could not save");
    }
  };

  const handleDelete = async () => {
    if (!selectedDate || !memberId) return;
    try {
      const key = dateKey(selectedDate);
      await deleteDoc(doc(db, "attendance", `${memberId}_${key}`));
      setAttendance((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDateClick = (date) => {
    setSelectedDate(date);
    setModalOpen(true);
  };

  const monthlyStats = (() => {
    const monthData = {};
    days.forEach((d) => {
      if (!isCurrentMonth(d, year, currentMonth)) return;
      const r = attendance[dateKey(d)];
      if (r) monthData[dateKey(d)] = r;
    });
    return getAttendanceStats(monthData, { start: officeStart, end: officeEnd });
  })();

  return (
    <div className="surface-elevated p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {MONTHS[currentMonth]}{" "}
            <span className="text-[var(--text-muted)] font-normal">{year}</span>
          </h2>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
            <SummaryPill dot="bg-emerald-500" label="on time" value={monthlyStats.onTime} />
            <SummaryPill dot="bg-amber-500" label="late" value={monthlyStats.late} />
            <SummaryPill dot="bg-yellow-500" label="early out" value={monthlyStats.earlyLeave} />
            <SummaryPill dot="bg-rose-500" label="absent" value={monthlyStats.absent} />
            <SummaryPill dot="bg-indigo-500" label="off" value={monthlyStats.off} />
            {monthlyStats.pending > 0 && (
              <SummaryPill dot="bg-orange-400" label="pending" value={monthlyStats.pending} />
            )}
          </div>
        </div>
        <div className="flex gap-1 items-center">
          <button
            onClick={() => setCurrentMonth((p) => (p === 0 ? 11 : p - 1))}
            className="btn btn-secondary btn-icon"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentMonth(new Date().getMonth())}
            className="btn btn-secondary"
          >
            Today
          </button>
          <button
            onClick={() => setCurrentMonth((p) => (p === 11 ? 0 : p + 1))}
            className="btn btn-secondary btn-icon"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 mb-2">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-center text-[10px] tracking-wider font-medium text-[var(--text-muted)] uppercase py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-7 gap-1.5">
          {[...Array(35)].map((_, i) => (
            <div key={i} className="min-h-[64px] sm:min-h-[78px] skeleton rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((day, index) => {
            const key = dateKey(day);
            const record = attendance[key];
            const inMonth = isCurrentMonth(day, year, currentMonth);
            const offDay = !isWorkingDay(day, workingDays) || isCompanyHoliday(day, holidays);
            const today = isToday(day);
            const tone = record ? getDayTone(record, { start: officeStart, end: officeEnd }) : null;
            const styles = tone ? TONE_STYLES[tone] : null;
            const isPending = record?.state === "pending";
            const isRejected = record?.state === "rejected";
            // Staff can only edit today. Past = locked. Future = use "Request leave" instead.
            const restrictedForStaff = !isAdmin && !today;

            return (
              <button
                key={index}
                onClick={() => handleDateClick(day)}
                disabled={offDay || !canEdit || restrictedForStaff}
                className={`
                  group relative rounded-lg text-sm font-medium transition-all
                  flex flex-col items-stretch justify-between p-1.5 min-h-[64px] sm:min-h-[78px]
                  ${!inMonth ? "opacity-30" : ""}
                  ${
                    offDay
                      ? "bg-[var(--bg-soft)] text-[var(--text-muted)] cursor-not-allowed"
                      : styles
                        ? `${styles.soft} border ${isPending ? "border-dashed" : ""} ${isRejected ? "ring-1 ring-rose-300" : ""} hover:shadow-sm cursor-pointer`
                        : "bg-[var(--bg-elev)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--text)] hover:text-[var(--text)] cursor-pointer"
                  }
                  ${today ? "ring-2 ring-[var(--brand-500)] ring-offset-2 ring-offset-[var(--bg-elev)]" : ""}
                  ${!canEdit && !record ? "cursor-default hover:border-[var(--border)]" : ""}
                `}
                title={
                  offDay
                    ? "Off day"
                    : restrictedForStaff
                      ? record
                        ? `${getToneLabel(tone)} (view only)`
                        : "Only today can be marked. Use Request leave for future days."
                      : record
                        ? `${getToneLabel(tone)}${isPending ? " (pending)" : isRejected ? " (rejected)" : ""}${record.entryTime ? ` · ${formatTime12(record.entryTime)} – ${formatTime12(record.exitTime)}` : ""}`
                        : format(day, "MMM d")
                }
              >
                <span className="tabular-nums leading-none text-left">{format(day, "d")}</span>
                {styles ? (
                  <div className="flex flex-col items-center gap-0.5 leading-none">
                    <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider truncate w-full text-center">
                      {isPending ? "Pending" : isRejected ? "Rejected" : getToneShortLabel(tone)}
                    </span>
                    {record.entryTime && record.status !== "absent" && record.status !== "off" && (
                      <span className="text-[8px] sm:text-[9px] tabular-nums opacity-70 hidden sm:block">
                        {formatTime12(record.entryTime)}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] text-center opacity-0 group-hover:opacity-100 transition">
                    {!offDay && canEdit ? "mark" : ""}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mt-6 pt-5 border-t border-[var(--border)]">
        <LegendItem color="bg-emerald-500" label="On time" />
        <LegendItem color="bg-amber-500" label="Late" />
        <LegendItem color="bg-yellow-500" label="Early out" />
        <LegendItem color="bg-rose-500" label="Absent" />
        <LegendItem color="bg-indigo-500" label="Off" />
        <LegendItem color="bg-slate-300" label="Holiday" />
        <span className="text-xs text-[var(--text-muted)] ml-auto">
          Dashed = pending approval
        </span>
      </div>

      <AttendanceModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        date={selectedDate}
        onSave={handleSave}
        onDelete={handleDelete}
        canEdit={canEdit}
        existingRecord={selectedDate ? attendance[dateKey(selectedDate)] : null}
        recordDocId={selectedDate ? `${memberId}_${dateKey(selectedDate)}` : null}
        officeStart={officeStart}
        officeEnd={officeEnd}
        isAdmin={isAdmin}
        isSelf={isSelf}
        autoApprove={autoApprove}
      />
    </div>
  );
}

function SummaryPill({ dot, label, value }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`dot ${dot}`} />
      <span className="text-[var(--text-secondary)] tabular-nums">
        {value} {label}
      </span>
    </div>
  );
}

function LegendItem({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`dot ${color}`} />
      <span className="text-xs text-[var(--text-secondary)]">{label}</span>
    </div>
  );
}
