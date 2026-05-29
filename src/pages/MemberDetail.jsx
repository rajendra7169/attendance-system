import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Header } from "../components/Header";
import { Calendar } from "../components/Calendar";
import { useAuth } from "../hooks/useAuth";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  updateDoc,
} from "firebase/firestore";
import { db } from "../utils/firebase";
import { uploadImage } from "../utils/uploadImage";
import {
  ArrowLeft,
  Mail,
  Briefcase,
  CalendarDays,
  Upload,
  Camera,
  CalendarRange,
  Check,
} from "lucide-react";
import { getAttendanceStats } from "../utils/calendarUtils";
import { LeaveRequestModal } from "./Dashboard";
import { Forest } from "../components/Forest";

export function MemberDetail() {
  const { memberId: paramId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userDoc, company, loading, isAdmin } = useAuth();

  // /me uses my own UID; /member/:id uses the param
  const isSelfRoute = location.pathname === "/me";
  const memberId = isSelfRoute ? user?.uid : paramId;
  const isSelf = memberId === user?.uid;

  const [member, setMember] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [memberLoading, setMemberLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!memberId || !userDoc?.companyId) return;
    const fetchData = async () => {
      setMemberLoading(true);
      try {
        const mDoc = await getDoc(doc(db, "users", memberId));
        if (mDoc.exists()) setMember({ id: mDoc.id, ...mDoc.data() });

        const aSnap = await getDocs(
          query(
            collection(db, "attendance"),
            where("companyId", "==", userDoc.companyId),
            where("userId", "==", memberId),
          ),
        );
        setAttendance(aSnap.docs.map((d) => d.data()));
      } catch (e) {
        console.error(e);
      } finally {
        setMemberLoading(false);
      }
    };
    fetchData();
  }, [memberId, userDoc?.companyId]);

  const stats = useMemo(() => {
    const byDate = {};
    attendance.forEach((a) => {
      byDate[a.date] = a;
    });
    return getAttendanceStats(byDate, {
      start: company?.officeStart,
      end: company?.officeEnd,
    });
  }, [attendance, company]);

  const handlePhotoUpload = async (file) => {
    setUploading(true);
    try {
      const url = await uploadImage(file, { folder: "attendance/members" });
      await updateDoc(doc(db, "users", memberId), { photo: url });
      setMember((prev) => (prev ? { ...prev, photo: url } : prev));
      showToast("Photo updated");
    } catch (e) {
      showToast(e.message || "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  };

  if (loading || memberLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--brand-500)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="max-w-7xl mx-auto px-6 py-16 text-center">
          <p className="text-[var(--text-secondary)] mb-4">Member not found</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="btn btn-primary"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  // Permission gate: staff can only view themselves
  if (!isAdmin && !isSelf) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="max-w-7xl mx-auto px-6 py-16 text-center">
          <p className="text-[var(--text-secondary)] mb-4">
            You don't have permission to view this profile.
          </p>
          <button onClick={() => navigate("/me")} className="btn btn-primary">
            Go to my attendance
          </button>
        </div>
      </div>
    );
  }

  // Cross-company guard
  if (member.companyId !== userDoc?.companyId) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="max-w-7xl mx-auto px-6 py-16 text-center">
          <p className="text-[var(--text-secondary)] mb-4">
            That member isn't in your workspace.
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="btn btn-primary"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header />

      {toast && (
        <div
          className={`fixed top-20 right-6 z-[60] px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg animate-slide-up flex items-center gap-2 ${
            toast.type === "error"
              ? "bg-rose-500 text-white"
              : "bg-[var(--text)] text-white"
          }`}
        >
          {toast.type !== "error" && <Check className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-8">
        {!isSelf && (
          <button
            onClick={() => navigate("/dashboard")}
            className="btn btn-ghost mb-6 -ml-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </button>
        )}

        <div className="surface-elevated p-6 sm:p-8 mb-6 animate-slide-up">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="relative">
              {member.photo ? (
                <img
                  src={member.photo}
                  alt={member.displayName}
                  className="w-20 h-20 rounded-2xl object-cover border border-[var(--border)]"
                />
              ) : (
                <div className="w-20 h-20 avatar-gradient rounded-2xl text-2xl">
                  {(member.displayName || "?").charAt(0).toUpperCase()}
                </div>
              )}
              {isSelf && (
                <label
                  className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[var(--text)] text-white flex items-center justify-center cursor-pointer shadow-md hover:scale-105 transition ${
                    uploading ? "opacity-60 cursor-wait" : ""
                  }`}
                  title="Change photo"
                >
                  {uploading ? (
                    <Upload className="w-3.5 h-3.5 animate-pulse" />
                  ) : (
                    <Camera className="w-3.5 h-3.5" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploading}
                    className="hidden"
                    onChange={(e) =>
                      e.target.files?.[0] && handlePhotoUpload(e.target.files[0])
                    }
                  />
                </label>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-semibold tracking-tight">
                {member.displayName}
                {isSelf && (
                  <span className="ml-3 badge badge-brand align-middle">You</span>
                )}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-[var(--text-secondary)]">
                <span className="flex items-center gap-1.5 capitalize">
                  <Briefcase className="w-3.5 h-3.5" />
                  {member.role || "Staff"}
                </span>
                {member.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" />
                    {member.email}
                  </span>
                )}
                {member.joinedAt && (
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5" />
                    Joined{" "}
                    {member.joinedAt.toDate
                      ? member.joinedAt.toDate().toLocaleDateString()
                      : new Date(member.joinedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
              <span className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
                Attendance
              </span>
              <span
                className={`text-3xl font-semibold tabular-nums ${
                  stats.rate >= 90
                    ? "text-emerald-600"
                    : stats.rate >= 70
                      ? "text-amber-600"
                      : stats.rate > 0
                        ? "text-rose-600"
                        : "text-[var(--text-muted)]"
                }`}
              >
                {stats.rate}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-6 pt-6 border-t border-[var(--border)]">
            <MiniStat label="On time" value={stats.onTime} dot="bg-emerald-500" />
            <MiniStat label="Late" value={stats.late} dot="bg-amber-500" />
            <MiniStat label="Early in" value={stats.earlyEntry} dot="bg-teal-500" />
            <MiniStat label="Early out" value={stats.earlyLeave} dot="bg-yellow-500" />
            <MiniStat label="Absent" value={stats.absent} dot="bg-rose-500" />
            <MiniStat label="Off" value={stats.off} dot="bg-indigo-500" />
          </div>
          {stats.pending > 0 && (
            <div className="mt-4 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-center gap-2">
              <span className="dot bg-amber-500" />
              {stats.pending} {stats.pending === 1 ? "entry" : "entries"} awaiting admin approval
            </div>
          )}
        </div>

        {isAdmin && !isSelf && (
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 px-1">
            <p className="text-sm text-[var(--text-muted)]">
              Need to mark multiple days as off? Use the date-range picker.
            </p>
            <button
              onClick={() => setLeaveOpen(true)}
              className="btn btn-accent"
            >
              <CalendarRange className="w-4 h-4" />
              Mark off period
            </button>
          </div>
        )}

        <Calendar
          key={calendarRefreshKey}
          memberId={memberId}
          year={year}
          company={company}
          canEdit={isAdmin || isSelf}
          isSelf={isSelf}
        />

        <div className="mt-6">
          <Forest
            records={attendance}
            company={company}
            title={isSelf ? "Your forest" : `${member.displayName}'s forest`}
          />
        </div>
      </div>

      {leaveOpen && (
        <LeaveRequestModal
          user={user}
          userDoc={userDoc}
          company={company}
          targetUserId={memberId}
          targetName={member.displayName}
          mode="admin"
          onClose={() => setLeaveOpen(false)}
          onSuccess={(days) => {
            setLeaveOpen(false);
            setCalendarRefreshKey((k) => k + 1);
            showToast(
              `Marked ${days} day${days === 1 ? "" : "s"} off for ${member.displayName}`,
            );
          }}
        />
      )}
    </div>
  );
}

function MiniStat({ label, value, dot }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`dot ${dot}`} />
        <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium">
          {label}
        </span>
      </div>
      <span className="text-xl font-semibold tabular-nums">{value}</span>
    </div>
  );
}
