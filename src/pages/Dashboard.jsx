import React, { useState, useEffect, useMemo } from "react";
import { Header } from "../components/Header";
import { MemberCard } from "../components/MemberCard";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  setDoc,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../utils/firebase";
import {
  Users,
  Plus,
  Search,
  TrendingUp,
  CalendarDays,
  Sparkles,
  Clock,
  ArrowRight,
  CalendarRange,
  X,
  AlertCircle,
  Loader2,
  Check,
  LogIn,
  LogOut,
} from "lucide-react";
import {
  getAttendanceStats,
  formatDateKey,
  formatTime12,
  isWorkingDay,
  isCompanyHoliday,
} from "../utils/calendarUtils";
import { Forest } from "../components/Forest";
import { AchievementsBoard } from "../components/AchievementsBoard";
import { Leaderboard } from "../components/Leaderboard";
import { GoalsCard } from "../components/GoalsCard";
import { LeaveBalanceCard } from "../components/LeaveBalanceCard";
import { YearInReview } from "../components/YearInReview";
import { OfficePresence } from "../components/OfficePresence";
import { TodayStatusBoard } from "../components/TodayStatusBoard";
import { notifyTeam } from "../utils/webhooks";
import { Gift } from "lucide-react";
import confetti from "canvas-confetti";

export function Dashboard() {
  const { user, userDoc, company, loading, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/login");
    } else if (!userDoc) {
      navigate("/onboard");
    }
  }, [user, userDoc, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--brand-500)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !userDoc) return null;

  return isAdmin ? (
    <AdminDashboard user={user} userDoc={userDoc} company={company} />
  ) : (
    <StaffDashboard user={user} userDoc={userDoc} company={company} />
  );
}

function AdminDashboard({ user, userDoc, company }) {
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [search, setSearch] = useState("");
  const [showYearReview, setShowYearReview] = useState(false);

  useEffect(() => {
    if (!company?.id) return;
    const unsubMembers = onSnapshot(
      query(collection(db, "users"), where("companyId", "==", company.id)),
      (snap) => {
        setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
    );
    return unsubMembers;
  }, [company?.id]);

  useEffect(() => {
    if (!company?.id) return;
    const fetchAtt = async () => {
      setLoadingData(true);
      try {
        const snap = await getDocs(
          query(
            collection(db, "attendance"),
            where("companyId", "==", company.id),
          ),
        );
        setAttendance(snap.docs.map((d) => d.data()));
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingData(false);
      }
    };
    fetchAtt();
  }, [company?.id]);

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  const teamStats = useMemo(() => {
    // Only count staff attendance — admins managing the workspace aren't tracked
    const staffIds = new Set(
      members.filter((m) => m.role === "staff").map((m) => m.id),
    );
    const staffAttendance = attendance.filter((a) => staffIds.has(a.userId));

    const byDate = {};
    staffAttendance.forEach((a) => {
      if (a.state === "approved") byDate[`${a.userId}_${a.date}`] = a;
    });
    const aggregate = getAttendanceStats(byDate, {
      start: company?.officeStart,
      end: company?.officeEnd,
    });
    const todayApproved = staffAttendance.filter(
      (a) =>
        a.date === today &&
        a.state === "approved" &&
        (a.status === "present" || a.status === "late"),
    ).length;
    const pendingCount = staffAttendance.filter(
      (a) => a.state === "pending",
    ).length;
    return {
      ...aggregate,
      presentToday: todayApproved,
      pendingCount,
      totalMembers: staffIds.size,
    };
  }, [attendance, members, today, company]);

  // Only staff appear in cards — admin (you) manages, doesn't get tracked here
  const staffOnly = useMemo(
    () => members.filter((m) => m.role === "staff"),
    [members],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return staffOnly;
    const q = search.toLowerCase();
    return staffOnly.filter(
      (m) =>
        m.displayName?.toLowerCase().includes(q) ||
        m.username?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q),
    );
  }, [staffOnly, search]);

  const firstName =
    userDoc.displayName?.split(" ")[0] || user.email?.split("@")[0] || "there";
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header />
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8 animate-slide-up">
          <div>
            <p className="text-sm text-[var(--text-muted)] mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              {greeting}
            </p>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              {firstName}
            </h1>
            <p className="text-[var(--text-secondary)] mt-2">
              Your team's attendance — managed from one place.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowYearReview(true)}
              className="btn btn-secondary"
              title="Year in Review"
            >
              <Gift className="w-4 h-4" />
              Year in Review
            </button>
            <button onClick={() => navigate("/admin")} className="btn btn-accent">
              <Plus className="w-4 h-4" />
              Invite staff
            </button>
          </div>
        </div>

        {teamStats.pendingCount > 0 && (
          <button
            onClick={() => navigate("/admin")}
            className="w-full mb-6 surface p-4 flex items-center gap-3 text-left hover:border-[var(--border-strong)] transition group"
          >
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-[var(--text)]">
                {teamStats.pendingCount} attendance{" "}
                {teamStats.pendingCount === 1 ? "entry" : "entries"} awaiting your review
              </p>
              <p className="text-sm text-[var(--text-muted)]">
                Approve or reject in Admin → Approvals
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:translate-x-0.5 transition" />
          </button>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <StatTile
            icon={CalendarDays}
            label="Present today"
            value={teamStats.presentToday}
            tone="success"
            sub={`of ${teamStats.totalMembers}`}
          />
          <StatTile
            icon={TrendingUp}
            label="Attendance rate"
            value={`${teamStats.rate}%`}
            tone={teamStats.rate >= 80 ? "success" : "warning"}
            sub="excl. off-days"
          />
          <StatTile
            icon={Users}
            label="Late entries"
            value={teamStats.late}
            tone="warning"
            sub={`after ${company?.officeStart || "10:00"}`}
          />
          <StatTile
            icon={Users}
            label="Absences"
            value={teamStats.absent}
            tone="danger"
            sub="all time"
          />
        </div>

        <div className="mb-8">
          <TodayStatusBoard
            members={members}
            attendance={attendance}
            company={company}
            isAdmin
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Team Members</h2>
            <p className="text-sm text-[var(--text-muted)]">
              {filtered.length} of {staffOnly.length}{" "}
              {staffOnly.length === 1 ? "person" : "people"}
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members..."
              className="input-field pl-9"
            />
          </div>
        </div>

        {loadingData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="surface p-5 h-48 skeleton" />
            ))}
          </div>
        ) : staffOnly.length === 0 ? (
          <EmptyState onAdd={() => navigate("/admin")} />
        ) : filtered.length === 0 ? (
          <div className="surface p-12 text-center">
            <p className="text-[var(--text-secondary)]">
              No members match "{search}"
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((m) => (
              <MemberCard
                key={m.id}
                member={{
                  id: m.id,
                  name: m.displayName,
                  role: m.role === "admin" ? "Admin" : "Staff",
                  photo: m.photo,
                }}
                company={company}
              />
            ))}
          </div>
        )}

        {/* Leaderboard */}
        {staffOnly.length > 1 && !loadingData && (
          <div className="mt-8">
            <Leaderboard members={members} attendance={attendance} company={company} />
          </div>
        )}

        {/* Team-wide combined forest — staff only, admin's own attendance excluded */}
        {!loadingData && staffOnly.length > 0 && (
          <div className="mt-8">
            <Forest
              records={attendance.filter((a) =>
                staffOnly.some((m) => m.id === a.userId),
              )}
              company={company}
              title="Team-wide forest"
              isAdmin
            />
          </div>
        )}
      </div>

      {showYearReview && (
        <YearInReview
          records={attendance}
          year={new Date().getFullYear()}
          displayName={userDoc.displayName}
          onClose={() => setShowYearReview(false)}
        />
      )}
    </div>
  );
}

function StaffDashboard({ user, userDoc, company }) {
  const navigate = useNavigate();
  const [attendance, setAttendance] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [showYearReview, setShowYearReview] = useState(false);
  const [toast, setToast] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamTodayAttendance, setTeamTodayAttendance] = useState([]);

  // Admin can hide individual cards via Company settings → Staff dashboard
  // visibility. Defaults to all-visible (legacy behavior) when no setting saved.
  const vis = useMemo(() => {
    const v = company?.visibility || {};
    return {
      goals: v.goals !== false,
      leaveBalance: v.leaveBalance !== false,
      achievements: v.achievements !== false,
      forest: v.forest !== false,
      yearReview: v.yearReview !== false,
      todayBoard: v.todayBoard !== false,
    };
  }, [company?.visibility]);

  // Live team feed for the Today's status board. Members list snapshot +
  // today-only attendance snapshot keeps reads small while still updating in
  // real time as coworkers check in.
  useEffect(() => {
    if (!company?.id || !vis.todayBoard) return;
    const todayStr = new Date().toISOString().split("T")[0];
    const unsubMembers = onSnapshot(
      query(collection(db, "users"), where("companyId", "==", company.id)),
      (snap) => setTeamMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    );
    const unsubAtt = onSnapshot(
      query(
        collection(db, "attendance"),
        where("companyId", "==", company.id),
        where("date", "==", todayStr),
      ),
      (snap) => setTeamTodayAttendance(snap.docs.map((d) => d.data())),
    );
    return () => {
      unsubMembers();
      unsubAtt();
    };
  }, [company?.id, vis.todayBoard]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  useEffect(() => {
    if (!user?.uid || !company?.id) return;
    const fetchAtt = async () => {
      setLoadingData(true);
      try {
        const snap = await getDocs(
          query(
            collection(db, "attendance"),
            where("companyId", "==", company.id),
            where("userId", "==", user.uid),
          ),
        );
        setAttendance(snap.docs.map((d) => d.data()));
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingData(false);
      }
    };
    fetchAtt();
  }, [user?.uid, company?.id]);

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

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const todayRecord = attendance.find((a) => a.date === today);

  const nowHHMM = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const computeDuration = (entry, exit) => {
    if (!entry || !exit) return "";
    const [eh, em] = entry.split(":").map(Number);
    const [xh, xm] = exit.split(":").map(Number);
    const min = Math.max(0, xh * 60 + xm - (eh * 60 + em));
    return `${Math.floor(min / 60)}h ${min % 60}m`;
  };

  const [actioning, setActioning] = useState(false);
  const [presence, setPresence] = useState(null);
  const [confirmOutside, setConfirmOutside] = useState(false);
  const [halfDay, setHalfDay] = useState(false);

  const doCheckIn = async () => {
    if (!company?.id || actioning) return;
    setActioning(true);
    try {
      const docId = `${user.uid}_${today}`;
      const payload = {
        userId: user.uid,
        companyId: company.id,
        date: today,
        status: "present",
        entryTime: nowHHMM(),
        exitTime: "",
        note: "",
        halfDay,
        state: company.autoApprove ? "approved" : "pending",
        submittedBy: user.uid,
        submittedAt: serverTimestamp(),
        reviewedBy: null,
        reviewedAt: null,
        reviewNote: "",
      };
      await setDoc(doc(db, "attendance", docId), payload);
      setAttendance((prev) => [
        ...prev.filter((a) => a.date !== today),
        payload,
      ]);
      // Notify the team channel only when the entry actually needs review.
      // Auto-approved check-ins are noise — skip them.
      if (payload.state === "pending") {
        const who = userDoc?.displayName || user.email || "Someone";
        notifyTeam(
          company,
          `:hourglass_flowing_sand: *${who}* submitted attendance for ${today}${halfDay ? " (half day)" : ""} — pending approval.`,
        );
      }
      showToast(
        halfDay
          ? `Half day check-in at ${formatTime12(payload.entryTime)}`
          : `Checked in at ${formatTime12(payload.entryTime)}`,
      );
      confetti({
        particleCount: 60,
        spread: 65,
        startVelocity: 30,
        origin: { y: 0.7 },
        colors: ["#16a34a", "#22c55e", "#fbbf24", "#fb923c"],
      });
    } catch (e) {
      showToast(e.message || "Could not check in", "error");
    } finally {
      setActioning(false);
    }
  };

  const handleCheckIn = () => {
    // If the workspace has an office configured AND we have a position AND
    // it's outside the radius, warn first. All other cases (no office set,
    // no position yet, or inside) go straight to check-in.
    if (presence?.hasOffice && presence?.inOffice === false) {
      setConfirmOutside(true);
      return;
    }
    doCheckIn();
  };

  const handleCheckOut = async () => {
    if (!company?.id || actioning || !todayRecord) return;
    setActioning(true);
    try {
      const docId = `${user.uid}_${today}`;
      const exitTime = nowHHMM();
      await updateDoc(doc(db, "attendance", docId), { exitTime });
      setAttendance((prev) =>
        prev.map((a) => (a.date === today ? { ...a, exitTime } : a)),
      );
      showToast(`Checked out at ${formatTime12(exitTime)}`);
    } catch (e) {
      showToast(e.message || "Could not check out", "error");
    } finally {
      setActioning(false);
    }
  };

  const firstName =
    userDoc.displayName?.split(" ")[0] || user.email?.split("@")[0] || "there";
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

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

      {confirmOutside && (
        <div
          className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setConfirmOutside(false)}
        >
          <div
            className="surface-elevated max-w-md w-full p-6 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold tracking-tight">
                  You're not in the office area
                </h3>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  {presence?.distance != null && (
                    <>
                      You're{" "}
                      <span className="font-medium">
                        {presence.distance < 1000
                          ? `${Math.round(presence.distance)}m`
                          : `${(presence.distance / 1000).toFixed(1)}km`}
                      </span>{" "}
                      from the office (radius{" "}
                      <span className="font-medium">{presence.radius}m</span>).
                      Your attendance may be rejected by the admin.
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button
                type="button"
                onClick={() => setConfirmOutside(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmOutside(false);
                  doCheckIn();
                }}
                className="btn btn-primary"
              >
                Check in anyway
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8 animate-slide-up">
          <div>
            <p className="text-sm text-[var(--text-muted)] mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              {greeting}
            </p>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              {firstName}
            </h1>
            <p className="text-[var(--text-secondary)] mt-2">
              Submit your attendance and track your record.
            </p>
          </div>
        </div>

        {/* Today's check-in / check-out card */}
        <div className="surface-elevated p-6 mb-8">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
            <div>
              <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Today
              </p>
              <h2 className="text-xl font-semibold tracking-tight">
                {new Date().toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </h2>
            </div>
            <button
              onClick={() => setLeaveOpen(true)}
              className="btn btn-secondary"
            >
              <CalendarRange className="w-4 h-4" />
              Request leave
            </button>
            {vis.yearReview && (
              <button
                onClick={() => setShowYearReview(true)}
                className="btn btn-secondary"
                title="Your year in review"
              >
                <Gift className="w-4 h-4" />
                {new Date().getFullYear()} Wrapped
              </button>
            )}
          </div>

          <OfficePresence company={company} onChange={setPresence} />

          {/* State 1 — Nothing yet today: Check in */}
          {!todayRecord && (
            <div className="space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <button
                  type="button"
                  onClick={() => setHalfDay((v) => !v)}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition ${
                    halfDay ? "bg-indigo-500" : "bg-[var(--border-strong)]"
                  }`}
                  aria-pressed={halfDay}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition mt-0.5 ${
                      halfDay ? "translate-x-4.5" : "translate-x-0.5"
                    }`}
                  />
                </button>
                <span className="text-sm text-[var(--text-secondary)]">
                  Half day{" "}
                  <span className="text-[var(--text-muted)]">
                    (counts as 0.5)
                  </span>
                </span>
              </label>
              <button
                onClick={handleCheckIn}
                disabled={actioning}
                className="btn btn-primary w-full py-4 text-base"
              >
                {actioning ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Checking in...
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    {halfDay ? "Check in (half day)" : "Check in now"}
                  </>
                )}
              </button>
            </div>
          )}

          {/* State 2 — Checked in, not checked out: green badge + Check out button */}
          {todayRecord?.status === "present" &&
            todayRecord?.entryTime &&
            !todayRecord?.exitTime && (
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
                  <span className="dot bg-emerald-500 animate-pulse" />
                  <div className="flex-1">
                    <p className="text-xs uppercase tracking-wider text-emerald-700 font-medium flex items-center gap-2">
                      Checked in at {formatTime12(todayRecord.entryTime)}
                      {todayRecord.halfDay && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-100 text-indigo-700 font-medium">
                          HALF DAY
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-emerald-900 font-medium mt-0.5">
                      Currently working · your tree is growing
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCheckOut}
                  disabled={actioning}
                  className="btn btn-primary w-full py-4 text-base"
                >
                  {actioning ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" /> Checking out...
                    </>
                  ) : (
                    <>
                      <LogOut className="w-5 h-5" />
                      Check out now ({formatTime12(nowHHMM())})
                    </>
                  )}
                </button>
              </div>
            )}

          {/* State 3 — Completed day: summary */}
          {todayRecord?.status === "present" &&
            todayRecord?.entryTime &&
            todayRecord?.exitTime && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-[var(--bg-soft)] border border-[var(--border)] text-center">
                    <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1">
                      Entry
                    </p>
                    <p className="font-semibold tabular-nums">
                      {formatTime12(todayRecord.entryTime)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--bg-soft)] border border-[var(--border)] text-center">
                    <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1">
                      Exit
                    </p>
                    <p className="font-semibold tabular-nums">
                      {formatTime12(todayRecord.exitTime)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
                    <p className="text-xs uppercase tracking-wider text-emerald-700 mb-1">
                      Worked
                    </p>
                    <p className="font-semibold tabular-nums text-emerald-900">
                      {computeDuration(
                        todayRecord.entryTime,
                        todayRecord.exitTime,
                      )}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-[var(--text-muted)] text-center">
                  Day complete. See you tomorrow!
                </p>
              </div>
            )}

          {/* State 4 — Absent */}
          {todayRecord?.status === "absent" && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
              <p className="text-xs uppercase tracking-wider text-rose-700 font-medium mb-1">
                Marked absent
              </p>
              {todayRecord.reason && (
                <p className="text-sm text-rose-900">{todayRecord.reason}</p>
              )}
            </div>
          )}

          {/* State 5 — Off (planned) */}
          {todayRecord?.status === "off" && (
            <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200">
              <p className="text-xs uppercase tracking-wider text-indigo-700 font-medium mb-1">
                Off-day
                {todayRecord.state === "pending" && " · pending approval"}
              </p>
              {todayRecord.reason && (
                <p className="text-sm text-indigo-900">{todayRecord.reason}</p>
              )}
            </div>
          )}
        </div>

        {vis.todayBoard && teamMembers.length > 0 && (
          <div className="mb-6">
            <TodayStatusBoard
              members={teamMembers}
              attendance={teamTodayAttendance}
              company={company}
            />
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatTile icon={CalendarDays} label="On time" value={stats.onTime} tone="success" />
          <StatTile icon={Clock} label="Late entries" value={stats.late} tone="warning" />
          <StatTile icon={Users} label="Absences" value={stats.absent} tone="danger" />
          <StatTile icon={TrendingUp} label="Attendance rate" value={`${stats.rate}%`} tone={stats.rate >= 80 ? "success" : "warning"} />
        </div>

        {stats.pending > 0 && (
          <div className="surface p-4 mb-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">
                {stats.pending} {stats.pending === 1 ? "entry" : "entries"} awaiting admin approval
              </p>
              <p className="text-sm text-[var(--text-muted)]">
                You'll see them counted once approved.
              </p>
            </div>
          </div>
        )}

        {/* Goal + Leave balance — admin can hide either; the row collapses
            with no blank space and the surviving card takes the full width. */}
        {(() => {
          const cards = [];
          if (vis.goals)
            cards.push(<GoalsCard key="g" userId={user.uid} attendance={attendance} />);
          if (vis.leaveBalance)
            cards.push(<LeaveBalanceCard key="lb" records={attendance} company={company} />);
          if (cards.length === 0) return null;
          return (
            <div
              className={`grid gap-4 mb-6 ${
                cards.length === 2 ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
              }`}
            >
              {cards}
            </div>
          );
        })()}

        {vis.achievements && (
          <div className="mb-6">
            <AchievementsBoard records={attendance} company={company} compact />
          </div>
        )}

        {vis.forest && (
          <div className="mb-6">
            <Forest
              records={attendance}
              company={company}
              joinedAt={userDoc.joinedAt}
            />
          </div>
        )}

        {vis.achievements && (
          <div className="mb-6">
            <AchievementsBoard records={attendance} company={company} />
          </div>
        )}

        <button
          onClick={() => navigate("/me")}
          className="w-full surface surface-hover p-5 text-left flex items-center gap-3"
        >
          <CalendarDays className="w-5 h-5 text-[var(--brand-600)]" />
          <div className="flex-1">
            <p className="font-semibold">Full attendance calendar</p>
            <p className="text-sm text-[var(--text-muted)]">
              View your history (read-only) and mark today
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-[var(--text-muted)]" />
        </button>

        {loadingData && (
          <div className="text-center py-8 text-sm text-[var(--text-muted)]">
            Loading your records...
          </div>
        )}
      </div>

      {leaveOpen && (
        <LeaveRequestModal
          user={user}
          userDoc={userDoc}
          company={company}
          onClose={() => setLeaveOpen(false)}
          onSuccess={(days) => {
            setLeaveOpen(false);
            // Refresh attendance
            (async () => {
              try {
                const snap = await getDocs(
                  query(
                    collection(db, "attendance"),
                    where("companyId", "==", company.id),
                    where("userId", "==", user.uid),
                  ),
                );
                setAttendance(snap.docs.map((d) => d.data()));
              } catch (e) {
                console.error(e);
              }
            })();
            showToast(
              `Leave requested for ${days} day${days === 1 ? "" : "s"} · pending approval`,
            );
          }}
        />
      )}

      {showYearReview && (
        <YearInReview
          records={attendance}
          year={new Date().getFullYear()}
          displayName={userDoc.displayName}
          onClose={() => setShowYearReview(false)}
        />
      )}
    </div>
  );
}

function StatTile({ icon: Icon, label, value, sub, tone = "brand" }) {
  const toneMap = {
    brand: "bg-indigo-50 text-indigo-600",
    success: "bg-emerald-50 text-emerald-600",
    warning: "bg-amber-50 text-amber-600",
    danger: "bg-rose-50 text-rose-600",
  };

  return (
    <div className="stat-card">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">
          {label}
        </span>
        <div className={`p-1.5 rounded-md ${toneMap[tone]}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight tabular-nums">
          {value}
        </span>
        {sub && <span className="text-xs text-[var(--text-muted)]">{sub}</span>}
      </div>
    </div>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div className="surface p-12 text-center">
      <div className="w-12 h-12 rounded-xl bg-[var(--bg-soft)] flex items-center justify-center mx-auto mb-4">
        <Users className="w-5 h-5 text-[var(--text-muted)]" />
      </div>
      <h3 className="font-semibold text-[var(--text)] mb-1">No staff yet</h3>
      <p className="text-sm text-[var(--text-muted)] mb-5 max-w-sm mx-auto">
        Invite your first team member to start tracking attendance.
      </p>
      <button onClick={onAdd} className="btn btn-primary">
        <Plus className="w-4 h-4" />
        Invite staff
      </button>
    </div>
  );
}

/* ------------ Leave Request Modal ------------ */

const MIN_LEAD_DAYS = 3;

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function LeaveRequestModal({
  user,
  userDoc,
  company,
  targetUserId,
  targetName,
  mode = "staff",
  onClose,
  onSuccess,
}) {
  const isAdminMode = mode === "admin";

  // Earliest allowable date: 3 days out for staff, no restriction for admin
  const minDate = useMemo(() => {
    if (isAdminMode) return undefined;
    const d = addDays(new Date(), MIN_LEAD_DAYS);
    return formatDateKey(d);
  }, [isAdminMode]);

  const today = useMemo(() => formatDateKey(new Date()), []);
  const defaultDate = minDate || today;

  const [fromDate, setFromDate] = useState(defaultDate);
  const [toDate, setToDate] = useState(defaultDate);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const workingDays = company?.workingDays || [0, 1, 2, 3, 4, 5];
  const holidays = company?.holidays || [];

  // Build the list of working days in the range, skipping weekends/holidays
  const datesInRange = useMemo(() => {
    if (!fromDate || !toDate) return [];
    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (to < from) return [];
    const out = [];
    for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
      if (isWorkingDay(d, workingDays) && !isCompanyHoliday(d, holidays)) {
        out.push(new Date(d));
      }
    }
    return out;
  }, [fromDate, toDate, workingDays, holidays]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!reason.trim()) {
      setError("Reason is required.");
      return;
    }
    if (!fromDate || !toDate) {
      setError("Pick a from and to date.");
      return;
    }
    if (!isAdminMode && minDate && fromDate < minDate) {
      setError(`Leave must start at least ${MIN_LEAD_DAYS} days from today (earliest: ${minDate}).`);
      return;
    }
    if (toDate < fromDate) {
      setError("End date must be after start date.");
      return;
    }
    if (datesInRange.length === 0) {
      setError("No working days in the selected range.");
      return;
    }

    const recordUserId = targetUserId || user.uid;
    const state = isAdminMode ? "approved" : "pending";

    setSubmitting(true);
    try {
      await Promise.all(
        datesInRange.map((d) => {
          const dateStr = formatDateKey(d);
          const docId = `${recordUserId}_${dateStr}`;
          return setDoc(doc(db, "attendance", docId), {
            userId: recordUserId,
            companyId: userDoc.companyId,
            date: dateStr,
            status: "off",
            reason: reason.trim(),
            state,
            submittedBy: user.uid,
            submittedAt: serverTimestamp(),
            ...(isAdminMode
              ? {
                  reviewedBy: user.uid,
                  reviewedAt: serverTimestamp(),
                  reviewNote: "",
                }
              : {
                  reviewedBy: null,
                  reviewedAt: null,
                  reviewNote: "",
                }),
          });
        }),
      );
      onSuccess?.(datesInRange.length);
    } catch (err) {
      setError(err.message || "Could not save leave.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="surface-elevated w-full max-w-md p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1 flex items-center gap-1.5">
              <CalendarRange className="w-3.5 h-3.5" />
              {isAdminMode ? "Mark off period" : "Planned leave"}
            </p>
            <h2 className="text-lg font-semibold tracking-tight">
              {isAdminMode
                ? `Mark off${targetName ? ` for ${targetName}` : ""}`
                : "Request time off"}
            </h2>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isAdminMode && (
            <div className="flex gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Leave must be requested at least <strong>{MIN_LEAD_DAYS} days</strong> in advance.
                Earliest available: <strong>{minDate}</strong>.
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">From</label>
              <input
                type="date"
                value={fromDate}
                min={minDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  // Keep toDate ≥ fromDate
                  if (toDate < e.target.value) setToDate(e.target.value);
                }}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="label">To</label>
              <input
                type="date"
                value={toDate}
                min={fromDate || minDate}
                onChange={(e) => setToDate(e.target.value)}
                className="input-field"
                required
              />
            </div>
          </div>

          <div>
            <label className="label">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Family vacation, doctor's appointment, personal day..."
              className="input-field resize-none"
              rows="3"
              required
            />
          </div>

          {datesInRange.length > 0 && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-soft)] border border-[var(--border)] text-sm">
              <span className="text-[var(--text-secondary)]">Working days in range</span>
              <span className="font-semibold tabular-nums">{datesInRange.length}</span>
            </div>
          )}

          {error && (
            <div className="flex gap-2 p-3 rounded-lg bg-[var(--danger-bg)] border border-red-200 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn btn-ghost flex-1">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary flex-1" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : isAdminMode ? (
                <>Mark off</>
              ) : (
                <>Submit request</>
              )}
            </button>
          </div>

          <p className="text-xs text-[var(--text-muted)] text-center">
            {isAdminMode
              ? "These days will be marked as approved off-days immediately."
              : "Your admin will review and approve each day. Pending until approved."}
          </p>
        </form>
      </div>
    </div>
  );
}
