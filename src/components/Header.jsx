import React, { useEffect, useState } from "react";
import { LogOut, Settings, LayoutDashboard, User } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../utils/firebase";

export function Header() {
  const { user, userDoc, company, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);

  // Live count of pending approvals for admin
  useEffect(() => {
    if (!isAdmin || !company?.id || !db) return;
    const q = query(
      collection(db, "attendance"),
      where("companyId", "==", company.id),
      where("state", "==", "pending"),
    );
    const unsub = onSnapshot(q, (snap) => setPendingCount(snap.size));
    return unsub;
  }, [isAdmin, company?.id]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const companyName = company?.name || "Tally";
  const companyLogo = company?.logo || null;

  const initials = (userDoc?.displayName || user?.email || "?")
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  const isDashboard = location.pathname === "/dashboard";
  const isAdminPage = location.pathname === "/admin";
  const isMe = location.pathname === "/me";

  return (
    <header className="sticky top-0 z-40 app-nav">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-3 group"
        >
          {companyLogo ? (
            <img
              src={companyLogo}
              alt="Logo"
              className="h-9 w-9 rounded-lg object-cover border border-[var(--border)]"
            />
          ) : (
            <div className="h-9 w-9 avatar-gradient rounded-lg text-sm">
              {companyName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="hidden sm:flex flex-col leading-tight text-left">
            <span className="text-sm font-semibold text-[var(--text)]">
              {companyName}
            </span>
            <span className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
              Attendance
            </span>
          </div>
        </button>

        {/* Nav pills */}
        {user && userDoc && (
          <nav className="hidden md:flex items-center gap-1 bg-[var(--bg-soft)] p-1 rounded-lg border border-[var(--border)]">
            <button
              onClick={() => navigate("/dashboard")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition flex items-center gap-1.5 ${
                isDashboard
                  ? "bg-white text-[var(--text)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text)]"
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </button>
            {!isAdmin && (
              <button
                onClick={() => navigate("/me")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition flex items-center gap-1.5 ${
                  isMe
                    ? "bg-white text-[var(--text)] shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-[var(--text)]"
                }`}
              >
                <User className="w-4 h-4" />
                My attendance
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => navigate("/admin")}
                className={`relative px-3 py-1.5 text-sm font-medium rounded-md transition flex items-center gap-1.5 ${
                  isAdminPage
                    ? "bg-white text-[var(--text)] shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-[var(--text)]"
                }`}
              >
                <Settings className="w-4 h-4" />
                Admin
                {pendingCount > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-rose-500 text-white tabular-nums">
                    {pendingCount}
                  </span>
                )}
              </button>
            )}
          </nav>
        )}

        {/* User */}
        {user && userDoc && (
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-sm font-medium text-[var(--text)]">
                {userDoc.displayName || user.email?.split("@")[0]}
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">
                {isAdmin ? "Administrator" : "Staff"}
              </span>
            </div>
            {userDoc.photo ? (
              <img
                src={userDoc.photo}
                alt={userDoc.displayName}
                className="h-9 w-9 rounded-full object-cover border border-[var(--border)]"
              />
            ) : (
              <div className="h-9 w-9 avatar-gradient rounded-full text-xs">
                {initials}
              </div>
            )}
            <button
              onClick={handleLogout}
              className="btn btn-ghost btn-icon"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
