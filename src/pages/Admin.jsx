import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "../components/Header";
import { useAuth } from "../hooks/useAuth";
import { db } from "../utils/firebase";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { uploadImage } from "../utils/uploadImage";
import { createStaffByEmail, resendStaffSetupEmail } from "../utils/staffUtils";
import { formatTime12, getDayTone, getToneLabel } from "../utils/calendarUtils";
import { exportAttendanceCSV, exportAttendancePDF, parseStaffCSV } from "../utils/exportUtils";
import { fetchHolidays, COUNTRY_OPTIONS } from "../utils/holidayApi";
import { logAudit } from "../utils/auditUtils";
import { sendEmail, emailAttendanceApproved, emailAttendanceRejected } from "../utils/notify";
import { DEFAULT_QUOTAS } from "../utils/leaveUtils";
import { AuditLogPanel } from "../components/AuditLogPanel";
import {
  Building2,
  Plus,
  Trash2,
  Edit2,
  X,
  Upload,
  Users,
  Check,
  Clock,
  CheckCircle2,
  XCircle,
  Calendar as CalendarIcon,
  UserPlus,
  Mail,
  FileDown,
  FileText,
  Search,
  Download,
  History,
  Globe,
  Crown,
  Shield,
} from "lucide-react";

const TABS = [
  { id: "company", label: "Company", icon: Building2 },
  { id: "staff", label: "Staff", icon: Users },
  { id: "approvals", label: "Approvals", icon: Clock },
  { id: "reports", label: "Reports", icon: FileDown },
  { id: "activity", label: "Activity", icon: History },
];

export function Admin() {
  const navigate = useNavigate();
  const { user, userDoc, company, loading, isAdmin } = useAuth();
  const [tab, setTab] = useState("company");
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate("/dashboard");
  }, [loading, user, isAdmin, navigate]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2400);
  };

  if (loading || !user || !userDoc || !company) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--brand-500)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header />

      {toast && (
        <div
          className={`fixed top-20 right-6 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg animate-slide-up flex items-center gap-2 ${
            toast.type === "error"
              ? "bg-rose-500 text-white"
              : "bg-[var(--text)] text-white"
          }`}
        >
          {toast.type !== "error" && <Check className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Workspace settings</h1>
          <p className="text-[var(--text-secondary)] mt-1">
            Manage {company.name} and your team.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-[var(--bg-soft)] rounded-lg border border-[var(--border)] mb-6 w-fit">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition flex items-center gap-1.5 ${
                  active
                    ? "bg-white text-[var(--text)] shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-[var(--text)]"
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "company" && (
          <CompanySection company={company} onToast={showToast} />
        )}
        {tab === "staff" && (
          <StaffSection company={company} adminId={user.uid} onToast={showToast} />
        )}
        {tab === "approvals" && (
          <ApprovalsSection
            company={company}
            adminId={user.uid}
            adminName={userDoc?.displayName}
            onToast={showToast}
          />
        )}
        {tab === "reports" && (
          <ReportsSection company={company} onToast={showToast} />
        )}
        {tab === "activity" && (
          <AuditLogPanel companyId={company.id} />
        )}
      </div>
    </div>
  );
}

/* ------------ Company Settings ------------ */

function CompanySection({ company, onToast }) {
  const [name, setName] = useState(company.name);
  const [logoUrl, setLogoUrl] = useState(company.logo || "");
  const [officeStart, setOfficeStart] = useState(company.officeStart || "10:00");
  const [officeEnd, setOfficeEnd] = useState(company.officeEnd || "17:30");
  const [workingDays, setWorkingDays] = useState(
    company.workingDays || [0, 1, 2, 3, 4, 5],
  );
  const [autoApprove, setAutoApprove] = useState(!!company.autoApprove);
  const [holidays, setHolidays] = useState(company.holidays || []);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importCountry, setImportCountry] = useState("NP");
  const [importYear, setImportYear] = useState(new Date().getFullYear());
  const [importing, setImporting] = useState(false);
  const [leaveQuotas, setLeaveQuotas] = useState({
    annual: company.leaveQuotas?.annual ?? 18,
    sick: company.leaveQuotas?.sick ?? 10,
    casual: company.leaveQuotas?.casual ?? 5,
  });

  const handleHolidayImport = async () => {
    setImporting(true);
    try {
      const fetched = await fetchHolidays(importYear, importCountry);
      // De-dupe by date
      const existing = new Set(holidays.map((h) => h.date));
      const fresh = fetched.filter((h) => !existing.has(h.date));
      setHolidays((prev) => [...prev, ...fresh]);
      onToast(`Imported ${fresh.length} holiday${fresh.length === 1 ? "" : "s"}`);
    } catch (e) {
      onToast(e.message || "Could not import holidays", "error");
    } finally {
      setImporting(false);
    }
  };

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const toggleDay = (i) =>
    setWorkingDays((prev) =>
      prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i].sort(),
    );

  const handleUpload = async (file) => {
    setUploading(true);
    try {
      const url = await uploadImage(file, { folder: "attendance/company" });
      setLogoUrl(url);
    } catch (e) {
      onToast(e.message || "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  };

  const addHoliday = () => {
    if (!newHolidayDate) return;
    setHolidays((prev) => [
      ...prev,
      { date: newHolidayDate, name: newHolidayName.trim() || "Holiday" },
    ]);
    setNewHolidayDate("");
    setNewHolidayName("");
  };

  const removeHoliday = (idx) =>
    setHolidays((prev) => prev.filter((_, i) => i !== idx));

  const save = async () => {
    if (!name.trim()) {
      onToast("Company name is required", "error");
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, "companies", company.id), {
        name: name.trim(),
        logo: logoUrl,
        officeStart,
        officeEnd,
        workingDays,
        holidays,
        leaveQuotas,
        autoApprove,
        updatedAt: serverTimestamp(),
      });
      onToast("Settings saved");
    } catch (e) {
      onToast(e.message || "Could not save", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="surface-elevated p-6 sm:p-8">
        <h2 className="text-lg font-semibold tracking-tight mb-5">Company profile</h2>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo"
                className="w-14 h-14 rounded-xl object-cover border border-[var(--border)]"
              />
            ) : (
              <div className="w-14 h-14 avatar-gradient rounded-xl text-xl">
                {name.charAt(0).toUpperCase() || "C"}
              </div>
            )}
            <label
              className={`btn btn-secondary ${uploading ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
            >
              <Upload className="w-3.5 h-3.5" />
              {uploading ? "Uploading..." : "Change logo"}
              <input
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                className="hidden"
              />
            </label>
          </div>

          <div>
            <label className="label">Workspace name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
            />
          </div>
        </div>
      </section>

      <section className="surface-elevated p-6 sm:p-8">
        <h2 className="text-lg font-semibold tracking-tight mb-5 flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-600" />
          Office hours
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Start time</label>
            <input
              type="time"
              value={officeStart}
              onChange={(e) => setOfficeStart(e.target.value)}
              className="input-field"
            />
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Entries after this = late ({formatTime12(officeStart)})
            </p>
          </div>
          <div>
            <label className="label">End time</label>
            <input
              type="time"
              value={officeEnd}
              onChange={(e) => setOfficeEnd(e.target.value)}
              className="input-field"
            />
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Exits before this = left early ({formatTime12(officeEnd)})
            </p>
          </div>
        </div>

        <div className="mt-6">
          <label className="label">Working days</label>
          <div className="flex gap-1.5 flex-wrap">
            {dayNames.map((d, i) => {
              const active = workingDays.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`px-3 py-1.5 text-sm rounded-md border transition ${
                    active
                      ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                      : "bg-[var(--bg-elev)] text-[var(--text-secondary)] border-[var(--border)]"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex items-start gap-3 p-3 rounded-lg bg-[var(--bg-soft)] border border-[var(--border)]">
          <button
            type="button"
            onClick={() => setAutoApprove(!autoApprove)}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition ${
              autoApprove ? "bg-emerald-500" : "bg-[var(--border-strong)]"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition mt-0.5 ${
                autoApprove ? "translate-x-4.5" : "translate-x-0.5"
              }`}
            />
          </button>
          <div className="flex-1">
            <p className="text-sm font-medium">Auto-approve staff submissions</p>
            <p className="text-xs text-[var(--text-muted)]">
              When ON, staff entries count immediately. When OFF, you must approve each one.
            </p>
          </div>
        </div>
      </section>

      <section className="surface-elevated p-6 sm:p-8">
        <h2 className="text-lg font-semibold tracking-tight mb-5 flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-indigo-600" />
          Holidays
        </h2>

        {/* Country import */}
        <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-200 mb-5">
          <p className="text-sm font-medium text-indigo-900 mb-3 flex items-center gap-1.5">
            <Globe className="w-4 h-4" />
            Auto-import national holidays
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={importCountry}
              onChange={(e) => setImportCountry(e.target.value)}
              className="input-field sm:max-w-[200px]"
            >
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
            <input
              type="number"
              value={importYear}
              onChange={(e) => setImportYear(parseInt(e.target.value) || new Date().getFullYear())}
              min="2020"
              max="2100"
              className="input-field sm:max-w-[100px]"
            />
            <button
              type="button"
              onClick={handleHolidayImport}
              className="btn btn-accent"
              disabled={importing}
            >
              {importing ? "Importing..." : "Import"}
            </button>
          </div>
          <p className="text-xs text-indigo-700/70 mt-2">
            Adds the country's official holidays for the selected year. Duplicates are skipped.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            type="date"
            value={newHolidayDate}
            onChange={(e) => setNewHolidayDate(e.target.value)}
            className="input-field sm:max-w-[200px]"
          />
          <input
            type="text"
            value={newHolidayName}
            onChange={(e) => setNewHolidayName(e.target.value)}
            placeholder="Holiday name (optional)"
            className="input-field flex-1"
          />
          <button
            type="button"
            onClick={addHoliday}
            className="btn btn-secondary"
            disabled={!newHolidayDate}
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>

        {holidays.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] text-center py-4">
            No holidays added yet.
          </p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {holidays
              .slice()
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((h, idx) => (
                <div
                  key={`${h.date}-${idx}`}
                  className="flex items-center justify-between py-2.5"
                >
                  <div>
                    <p className="font-medium text-sm">{h.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">{h.date}</p>
                  </div>
                  <button
                    onClick={() => removeHoliday(idx)}
                    className="btn btn-ghost btn-icon text-rose-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
          </div>
        )}
      </section>

      <section className="surface-elevated p-6 sm:p-8">
        <h2 className="text-lg font-semibold tracking-tight mb-1 flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-indigo-600" />
          Leave quotas
        </h2>
        <p className="text-sm text-[var(--text-muted)] mb-4">
          Default annual entitlements per staff member. Approved off-days deduct from these.
        </p>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="label">🏖️ Annual leave (days)</label>
            <input
              type="number"
              min="0"
              max="365"
              value={leaveQuotas.annual}
              onChange={(e) => setLeaveQuotas((p) => ({ ...p, annual: parseInt(e.target.value) || 0 }))}
              className="input-field"
            />
          </div>
          <div>
            <label className="label">🤒 Sick leave (days)</label>
            <input
              type="number"
              min="0"
              max="365"
              value={leaveQuotas.sick}
              onChange={(e) => setLeaveQuotas((p) => ({ ...p, sick: parseInt(e.target.value) || 0 }))}
              className="input-field"
            />
          </div>
          <div>
            <label className="label">📅 Casual leave (days)</label>
            <input
              type="number"
              min="0"
              max="365"
              value={leaveQuotas.casual}
              onChange={(e) => setLeaveQuotas((p) => ({ ...p, casual: parseInt(e.target.value) || 0 }))}
              className="input-field"
            />
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="btn btn-primary">
          {saving ? "Saving..." : "Save all changes"}
        </button>
      </div>
    </div>
  );
}

/* ------------ Staff Section ------------ */

function StaffSection({ company, adminId, onToast }) {
  const [members, setMembers] = useState([]);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdInfo, setCreatedInfo] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("staff");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState([]);
  const [bulkErrors, setBulkErrors] = useState([]);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    if (!company?.id) return;
    const unsub = onSnapshot(
      query(collection(db, "users"), where("companyId", "==", company.id)),
      (snap) => setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    );
    return unsub;
  }, [company?.id]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreatedInfo(null);
    if (!newDisplayName.trim() || !newEmail.trim()) {
      onToast("Fill all fields", "error");
      return;
    }
    setCreating(true);
    try {
      const { email } = await createStaffByEmail({
        companyId: company.id,
        email: newEmail,
        displayName: newDisplayName,
      });
      setCreatedInfo({
        displayName: newDisplayName.trim(),
        email,
      });
      setNewDisplayName("");
      setNewEmail("");
      onToast(`Invite email sent to ${email}`);
    } catch (e) {
      onToast(e.message || "Could not create staff", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleCsvFile = async (file) => {
    setBulkErrors([]);
    setBulkRows([]);
    try {
      const text = await file.text();
      const { rows, errors } = parseStaffCSV(text);
      setBulkRows(rows);
      setBulkErrors(errors);
      if (rows.length === 0 && errors.length > 0) {
        onToast("No valid rows in CSV", "error");
      } else {
        onToast(`Parsed ${rows.length} row${rows.length === 1 ? "" : "s"}${errors.length ? ` (${errors.length} errors)` : ""}`);
      }
    } catch (e) {
      onToast(e.message || "Could not read file", "error");
    }
  };

  const handleBulkImport = async () => {
    if (bulkRows.length === 0) return;
    setBulkImporting(true);
    setBulkProgress({ done: 0, total: bulkRows.length });
    const created = [];
    const failed = [];
    for (let i = 0; i < bulkRows.length; i++) {
      const row = bulkRows[i];
      try {
        await createStaffByEmail({
          companyId: company.id,
          email: row.email,
          displayName: row.displayName,
        });
        created.push(row.email);
      } catch (e) {
        failed.push({ email: row.email, error: e.message });
      }
      setBulkProgress({ done: i + 1, total: bulkRows.length });
    }
    setBulkImporting(false);
    setBulkOpen(false);
    setBulkRows([]);
    await logAudit({
      companyId: company.id,
      actorId: adminId,
      action: "imported_staff",
      details: { summary: `${created.length} created, ${failed.length} failed` },
    });
    if (failed.length === 0) {
      onToast(`Imported ${created.length} staff members`);
    } else {
      onToast(
        `Imported ${created.length}, failed ${failed.length}. Check console for details.`,
        failed.length > created.length ? "error" : "success",
      );
      console.warn("Bulk import failures:", failed);
    }
  };

  const toggleRole = async (m) => {
    if (m.id === adminId) {
      onToast("You can't change your own role", "error");
      return;
    }
    const newRole = m.role === "admin" ? "staff" : "admin";
    if (!confirm(`${newRole === "admin" ? "Promote" : "Demote"} ${m.displayName} to ${newRole}?`)) return;
    try {
      await updateDoc(doc(db, "users", m.id), { role: newRole });
      await logAudit({
        companyId: company.id,
        actorId: adminId,
        action: "role_changed",
        details: {
          targetName: m.displayName,
          summary: `${m.role} → ${newRole}`,
        },
      });
      onToast(`${m.displayName} is now ${newRole}`);
    } catch (e) {
      onToast(e.message || "Could not change role", "error");
    }
  };

  const startEdit = (m) => {
    setEditingId(m.id);
    setEditName(m.displayName || "");
    setEditRole(m.role || "staff");
  };

  const saveEdit = async (m) => {
    try {
      await updateDoc(doc(db, "users", m.id), {
        displayName: editName.trim() || m.displayName,
        role: editRole,
      });
      setEditingId(null);
      onToast("Member updated");
    } catch (e) {
      onToast(e.message || "Could not update", "error");
    }
  };

  const removeMember = async (m) => {
    if (m.id === adminId) {
      onToast("You can't remove yourself", "error");
      return;
    }
    if (!confirm(`Remove ${m.displayName} from workspace?`)) return;
    try {
      await deleteDoc(doc(db, "users", m.id));
      onToast("Member removed");
    } catch (e) {
      onToast(e.message || "Could not remove", "error");
    }
  };

  const resendInvite = async (m) => {
    if (!m.email || m.email.endsWith(".pulse.local")) {
      onToast("This member has no real email on file.", "error");
      return;
    }
    try {
      await resendStaffSetupEmail(m.email);
      onToast(`Setup email resent to ${m.email}`);
    } catch (e) {
      onToast(e.message || "Could not resend", "error");
    }
  };

  return (
    <div className="space-y-6">
      <section className="surface-elevated p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-600" />
            Add staff member
          </h2>
          <button
            onClick={() => setBulkOpen(!bulkOpen)}
            className="btn btn-secondary"
          >
            <FileText className="w-3.5 h-3.5" />
            {bulkOpen ? "Single mode" : "Bulk import CSV"}
          </button>
        </div>
        <p className="text-sm text-[var(--text-muted)] mb-4">
          {bulkOpen
            ? "Upload a CSV with name, email, and (optional) department columns. We'll email each one a link to set their password."
            : "Enter their name and email. We'll email them a link to set their own password."}
        </p>

        {bulkOpen && (
          <div className="space-y-4 mb-4">
            <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-200">
              <p className="text-sm font-medium text-indigo-900 mb-2">CSV format</p>
              <pre className="text-xs font-mono text-indigo-900/80 overflow-x-auto">
{`name,email,department
John Doe,john@company.com,Engineering
Jane Smith,jane@company.com,Sales`}
              </pre>
            </div>

            <label className="block">
              <span className="label block">Select CSV file</span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => e.target.files?.[0] && handleCsvFile(e.target.files[0])}
                className="input-field"
                disabled={bulkImporting}
              />
            </label>

            {bulkErrors.length > 0 && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-800">
                <p className="font-medium mb-1">{bulkErrors.length} issues:</p>
                <ul className="text-xs space-y-0.5 list-disc list-inside">
                  {bulkErrors.slice(0, 6).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {bulkErrors.length > 6 && <li>...and {bulkErrors.length - 6} more</li>}
                </ul>
              </div>
            )}

            {bulkRows.length > 0 && (
              <div className="surface p-3">
                <p className="text-sm font-medium mb-2">
                  Ready to import {bulkRows.length} staff:
                </p>
                <div className="max-h-40 overflow-y-auto space-y-1 mb-3">
                  {bulkRows.slice(0, 10).map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="font-medium">{r.displayName}</span>
                      <span className="text-[var(--text-muted)]">·</span>
                      <code className="font-mono">{r.email}</code>
                      {r.department && (
                        <>
                          <span className="text-[var(--text-muted)]">·</span>
                          <span className="badge badge-neutral">{r.department}</span>
                        </>
                      )}
                    </div>
                  ))}
                  {bulkRows.length > 10 && (
                    <p className="text-xs text-[var(--text-muted)]">...and {bulkRows.length - 10} more</p>
                  )}
                </div>
                {bulkImporting ? (
                  <div>
                    <div className="h-1.5 bg-[var(--bg-soft)] rounded-full overflow-hidden mb-1">
                      <div
                        className="h-full bg-indigo-500 transition-all"
                        style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-[var(--text-muted)] text-center">
                      Importing {bulkProgress.done} / {bulkProgress.total}...
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={handleBulkImport}
                    className="btn btn-accent w-full"
                  >
                    Import {bulkRows.length} staff
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {!bulkOpen && (
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Display name</label>
              <input
                type="text"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder="John Doe"
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value.toLowerCase())}
                placeholder="john@company.com"
                className="input-field"
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-accent" disabled={creating}>
            {creating ? "Sending invite..." : "Create staff account"}
          </button>
        </form>
        )}

        {createdInfo && (
          <div className="mt-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <p className="text-sm font-semibold text-emerald-900 mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              Invite sent to {createdInfo.displayName}
            </p>
            <p className="text-sm text-emerald-800 mb-1">
              We emailed <code className="font-mono">{createdInfo.email}</code> a link to set their password.
            </p>
            <p className="text-xs text-emerald-700/80">
              They click it → set password → sign in normally with their email.
              The link expires in 1 hour. If it expires before they use it,
              click the <Mail className="w-3 h-3 inline -mt-0.5" /> icon next to
              their name below to resend.
            </p>
            <button
              onClick={() => setCreatedInfo(null)}
              className="btn btn-ghost text-xs mt-3"
            >
              Dismiss
            </button>
          </div>
        )}
      </section>

      <section className="surface-elevated p-6 sm:p-8">
        <h2 className="text-lg font-semibold tracking-tight mb-5">
          Workspace members ({members.length})
        </h2>
        {members.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] text-center py-6">
            No members yet.
          </p>
        ) : (
          <div className="divide-y divide-[var(--border)] -mx-2">
            {members
              .slice()
              .sort((a, b) => (a.role === "admin" ? -1 : 1))
              .map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 px-2 py-3 group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {m.photo ? (
                      <img
                        src={m.photo}
                        alt={m.displayName}
                        className="w-10 h-10 rounded-full object-cover border border-[var(--border)]"
                      />
                    ) : (
                      <div className="w-10 h-10 avatar-gradient rounded-full text-sm">
                        {(m.displayName || "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      {editingId === m.id ? (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="input-field"
                          />
                          <select
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value)}
                            className="input-field sm:max-w-[140px]"
                          >
                            <option value="staff">Staff</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                      ) : (
                        <>
                          <p className="font-medium truncate">
                            {m.displayName}
                            {m.id === adminId && (
                              <span className="ml-2 badge badge-brand">You</span>
                            )}
                          </p>
                          <p className="text-sm text-[var(--text-muted)] truncate">
                            {m.email && !m.email.endsWith(".pulse.local") && (
                              <>{m.email} · </>
                            )}
                            <span className="capitalize">{m.role}</span>
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {editingId === m.id ? (
                      <>
                        <button
                          onClick={() => saveEdit(m)}
                          className="btn btn-primary btn-icon"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="btn btn-ghost btn-icon"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        {m.role === "staff" && m.email && !m.email.endsWith(".pulse.local") && (
                          <button
                            onClick={() => resendInvite(m)}
                            className="btn btn-ghost btn-icon"
                            title="Resend setup email"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => toggleRole(m)}
                          className="btn btn-ghost btn-icon"
                          title={m.role === "admin" ? "Demote to staff" : "Promote to admin"}
                          disabled={m.id === adminId}
                        >
                          {m.role === "admin" ? (
                            <Shield className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Crown className="w-4 h-4 text-amber-500" />
                          )}
                        </button>
                        <button
                          onClick={() => startEdit(m)}
                          className="btn btn-ghost btn-icon"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeMember(m)}
                          className="btn btn-ghost btn-icon text-rose-600 hover:bg-rose-50"
                          title="Remove"
                          disabled={m.id === adminId}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------ Approvals Section ------------ */

function ApprovalsSection({ company, adminId, adminName, onToast }) {
  const [pending, setPending] = useState([]);
  const [members, setMembers] = useState({});
  const [loading, setLoading] = useState(true);
  const [reviewNote, setReviewNote] = useState({});
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [search, setSearch] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    if (!company?.id) return;
    const unsub = onSnapshot(
      query(
        collection(db, "attendance"),
        where("companyId", "==", company.id),
        where("state", "==", "pending"),
      ),
      (snap) => {
        setPending(
          snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) =>
            b.date.localeCompare(a.date),
          ),
        );
        setLoading(false);
      },
    );
    return unsub;
  }, [company?.id]);

  useEffect(() => {
    if (!company?.id) return;
    const fetchMembers = async () => {
      const snap = await getDocs(
        query(collection(db, "users"), where("companyId", "==", company.id)),
      );
      const map = {};
      snap.docs.forEach((d) => (map[d.id] = d.data()));
      setMembers(map);
    };
    fetchMembers();
  }, [company?.id]);

  // Filter by search
  const filteredPending = pending.filter((entry) => {
    if (!search.trim()) return true;
    const member = members[entry.userId];
    const q = search.toLowerCase();
    return (
      entry.date.includes(q) ||
      entry.status?.toLowerCase().includes(q) ||
      member?.displayName?.toLowerCase().includes(q) ||
      member?.email?.toLowerCase().includes(q)
    );
  });

  const allFilteredSelected =
    filteredPending.length > 0 &&
    filteredPending.every((p) => selectedIds.has(p.id));

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPending.map((p) => p.id)));
    }
  };

  const toggleOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const review = async (entry, decision) => {
    try {
      await updateDoc(doc(db, "attendance", entry.id), {
        state: decision,
        reviewedBy: adminId,
        reviewedAt: serverTimestamp(),
        reviewNote: reviewNote[entry.id] || "",
      });
      // Audit + email
      const member = members[entry.userId];
      await logAudit({
        companyId: company.id,
        actorId: adminId,
        actorName: adminName,
        action: decision === "approved" ? "approved" : "rejected",
        target: `attendance/${entry.id}`,
        details: {
          targetName: member?.displayName,
          summary: `${entry.status} on ${entry.date}`,
        },
      });
      if (member?.email && !member.email.endsWith(".pulse.local")) {
        const html = (decision === "approved"
          ? emailAttendanceApproved
          : emailAttendanceRejected)({
          staffName: member.displayName,
          date: entry.date,
          status: entry.status,
          reviewerName: adminName,
          reviewNote: reviewNote[entry.id] || "",
        });
        sendEmail({
          to: member.email,
          subject:
            decision === "approved"
              ? "Your attendance was approved ✓"
              : "Your attendance was rejected",
          html,
        });
      }
      onToast(`Marked as ${decision}`);
    } catch (e) {
      onToast(e.message || "Could not review", "error");
    }
  };

  const bulkReview = async (decision) => {
    if (selectedIds.size === 0) return;
    if (!confirm(`${decision === "approved" ? "Approve" : "Reject"} ${selectedIds.size} entries?`)) return;
    setBulkBusy(true);
    try {
      const ids = [...selectedIds];
      await Promise.all(
        ids.map((id) =>
          updateDoc(doc(db, "attendance", id), {
            state: decision,
            reviewedBy: adminId,
            reviewedAt: serverTimestamp(),
            reviewNote: "Bulk " + decision,
          }),
        ),
      );
      await logAudit({
        companyId: company.id,
        actorId: adminId,
        actorName: adminName,
        action: decision === "approved" ? "bulk_approved" : "bulk_rejected",
        details: { summary: `${ids.length} entries` },
      });
      // Fire emails (best-effort)
      ids.forEach((id) => {
        const entry = pending.find((p) => p.id === id);
        const member = members[entry?.userId];
        if (entry && member?.email && !member.email.endsWith(".pulse.local")) {
          const html = (decision === "approved"
            ? emailAttendanceApproved
            : emailAttendanceRejected)({
            staffName: member.displayName,
            date: entry.date,
            status: entry.status,
            reviewerName: adminName,
          });
          sendEmail({
            to: member.email,
            subject:
              decision === "approved"
                ? "Your attendance was approved ✓"
                : "Your attendance was rejected",
            html,
          });
        }
      });
      setSelectedIds(new Set());
      onToast(`${decision === "approved" ? "Approved" : "Rejected"} ${ids.length} entries`);
    } catch (e) {
      onToast(e.message || "Bulk action failed", "error");
    } finally {
      setBulkBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="surface p-8 text-center">
        <p className="text-sm text-[var(--text-muted)]">Loading pending entries...</p>
      </div>
    );
  }

  if (pending.length === 0) {
    return (
      <div className="surface-elevated p-12 text-center">
        <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
        </div>
        <h3 className="font-semibold mb-1">All caught up</h3>
        <p className="text-sm text-[var(--text-muted)]">
          No pending entries waiting for review.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search + bulk toolbar */}
      <div className="surface-elevated p-4 flex flex-wrap items-center gap-3 sticky top-16 z-30">
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input
            type="checkbox"
            checked={allFilteredSelected}
            onChange={toggleAll}
            className="w-4 h-4"
          />
          {selectedIds.size > 0
            ? `${selectedIds.size} selected`
            : `Select all (${filteredPending.length})`}
        </label>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, date, status..."
            className="input-field pl-9"
          />
        </div>

        {selectedIds.size > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => bulkReview("approved")}
              className="btn btn-primary"
              disabled={bulkBusy}
            >
              <CheckCircle2 className="w-4 h-4" />
              Approve {selectedIds.size}
            </button>
            <button
              onClick={() => bulkReview("rejected")}
              className="btn btn-danger"
              disabled={bulkBusy}
            >
              <XCircle className="w-4 h-4" />
              Reject {selectedIds.size}
            </button>
          </div>
        )}
      </div>

      {filteredPending.length === 0 && (
        <div className="surface p-8 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            No matches for "{search}"
          </p>
        </div>
      )}

      {filteredPending.map((entry) => {
        const member = members[entry.userId];
        const tone = getDayTone(entry, {
          start: company.officeStart,
          end: company.officeEnd,
        });
        return (
          <div
            key={entry.id}
            className={`surface-elevated p-5 transition ${
              selectedIds.has(entry.id) ? "ring-2 ring-indigo-300" : ""
            }`}
          >
            <div className="flex items-start gap-3 mb-4">
              <input
                type="checkbox"
                checked={selectedIds.has(entry.id)}
                onChange={() => toggleOne(entry.id)}
                className="w-4 h-4 mt-3 flex-shrink-0"
              />
              {member?.photo ? (
                <img
                  src={member.photo}
                  alt={member.displayName}
                  className="w-10 h-10 rounded-full object-cover border border-[var(--border)]"
                />
              ) : (
                <div className="w-10 h-10 avatar-gradient rounded-full text-sm">
                  {(member?.displayName || "?").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold">
                  {member?.displayName || "Unknown"}
                </p>
                <p className="text-sm text-[var(--text-muted)]">
                  {new Date(entry.date).toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              <span className={`badge ${
                entry.status === "absent"
                  ? "badge-danger"
                  : entry.status === "off"
                    ? "badge-brand"
                    : "badge-success"
              } capitalize`}>
                {entry.status}
              </span>
            </div>

            {entry.status === "present" ? (
              <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-[var(--bg-soft)] mb-3 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Entry</p>
                  <p className="font-medium tabular-nums">{formatTime12(entry.entryTime)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Exit</p>
                  <p className="font-medium tabular-nums">{formatTime12(entry.exitTime)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Result</p>
                  <p className="font-medium">{getToneLabel(tone)}</p>
                </div>
              </div>
            ) : (
              entry.reason && (
                <div className="p-3 rounded-lg bg-[var(--bg-soft)] mb-3 text-sm">
                  <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1">
                    Reason
                  </p>
                  <p>{entry.reason}</p>
                </div>
              )
            )}

            {entry.note && (
              <div className="p-3 rounded-lg bg-[var(--bg-soft)] mb-3 text-sm">
                <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1">
                  Staff note
                </p>
                <p>{entry.note}</p>
              </div>
            )}

            <input
              type="text"
              value={reviewNote[entry.id] || ""}
              onChange={(e) =>
                setReviewNote((p) => ({ ...p, [entry.id]: e.target.value }))
              }
              placeholder="Optional review note..."
              className="input-field mb-3 text-sm"
            />

            <div className="flex gap-2">
              <button
                onClick={() => review(entry, "approved")}
                className="btn btn-primary flex-1"
              >
                <CheckCircle2 className="w-4 h-4" />
                Approve
              </button>
              <button
                onClick={() => review(entry, "rejected")}
                className="btn btn-danger flex-1"
              >
                <XCircle className="w-4 h-4" />
                Reject
              </button>
            </div>
            {entry.status === "present" &&
              (tone === "late" || tone === "early_out" || tone === "late_early") && (
                <p className="text-xs text-[var(--text-muted)] mt-2">
                  Tip: to fix a late entry, edit the time directly in the calendar instead of approving as-is.
                </p>
              )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------ Reports Section ------------ */

function ReportsSection({ company, onToast }) {
  const [members, setMembers] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [period, setPeriod] = useState("month"); // month | quarter | year | all
  const [memberFilter, setMemberFilter] = useState("all");

  useEffect(() => {
    if (!company?.id) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const mSnap = await getDocs(
          query(collection(db, "users"), where("companyId", "==", company.id)),
        );
        const aSnap = await getDocs(
          query(collection(db, "attendance"), where("companyId", "==", company.id)),
        );
        setMembers(mSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setAttendance(aSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [company?.id]);

  const filtered = useMemo(() => {
    const now = new Date();
    return attendance.filter((r) => {
      if (memberFilter !== "all" && r.userId !== memberFilter) return false;
      if (period === "all") return true;
      const recordDate = new Date(r.date);
      const days =
        period === "month" ? 30
        : period === "quarter" ? 90
        : 365;
      return (now - recordDate) / 86400000 <= days;
    });
  }, [attendance, period, memberFilter]);

  const handleCSV = async () => {
    setExporting(true);
    try {
      exportAttendanceCSV({ records: filtered, members, company, dateRange: period });
      onToast("CSV downloaded");
    } catch (e) {
      onToast(e.message || "Export failed", "error");
    } finally {
      setExporting(false);
    }
  };

  const handlePDF = async () => {
    setExporting(true);
    try {
      const labels = {
        month: "Last 30 days",
        quarter: "Last 90 days",
        year: "Last 12 months",
        all: "All time",
      };
      await exportAttendancePDF({
        records: filtered,
        members,
        company,
        periodLabel: labels[period],
      });
      onToast("PDF downloaded");
    } catch (e) {
      onToast(e.message || "Export failed", "error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="surface-elevated p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Export attendance
            </h2>
            <p className="text-sm text-[var(--text-muted)]">
              Download for payroll, reporting, or back-up
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="label">Period</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="input-field"
            >
              <option value="month">Last 30 days</option>
              <option value="quarter">Last 90 days</option>
              <option value="year">Last 12 months</option>
              <option value="all">All time</option>
            </select>
          </div>
          <div>
            <label className="label">Members</label>
            <select
              value={memberFilter}
              onChange={(e) => setMemberFilter(e.target.value)}
              className="input-field"
            >
              <option value="all">All members</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-sm text-[var(--text-secondary)] mb-4">
          <strong className="tabular-nums">{filtered.length}</strong> record{filtered.length === 1 ? "" : "s"} match your filters.
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleCSV}
            className="btn btn-accent"
            disabled={loading || exporting || filtered.length === 0}
          >
            <FileText className="w-4 h-4" />
            Download CSV
          </button>
          <button
            onClick={handlePDF}
            className="btn btn-secondary"
            disabled={loading || exporting || filtered.length === 0}
          >
            <FileDown className="w-4 h-4" />
            {exporting ? "Generating..." : "Download PDF report"}
          </button>
        </div>
      </section>

      <section className="surface-elevated p-6 sm:p-8">
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          <strong>CSV</strong> — a flat sheet of every record, openable in Excel / Google Sheets / your payroll tool.
          <br />
          <strong>PDF</strong> — a formatted multi-page report with per-member summaries and detailed logs, ready for printing or filing.
        </p>
      </section>
    </div>
  );
}
