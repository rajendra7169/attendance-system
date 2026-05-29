import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addDoc, collection, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "../utils/firebase";
import { useAuth } from "../hooks/useAuth";
import { generateWorkspaceCode } from "../utils/staffUtils";
import { uploadImage } from "../utils/uploadImage";
import {
  Building2,
  User,
  Sparkles,
  ArrowRight,
  AlertCircle,
  Heart,
  LogOut,
  Upload,
  X,
} from "lucide-react";
import { signOut } from "firebase/auth";

export function Onboard() {
  const navigate = useNavigate();
  const { user, userDoc, loading } = useAuth();
  const [companyName, setCompanyName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleLogoUpload = async (file) => {
    if (!file) return;
    setUploadingLogo(true);
    setError("");
    try {
      const url = await uploadImage(file, { folder: "attendance/company" });
      setLogoUrl(url);
    } catch (err) {
      setError(err.message || "Could not upload logo.");
    } finally {
      setUploadingLogo(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/login");
      return;
    }
    if (userDoc) {
      // Already has a workspace
      navigate("/dashboard");
      return;
    }
    // Pre-fill display name from Google profile
    setDisplayName(user.displayName || user.email?.split("@")[0] || "");
  }, [user, userDoc, loading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!companyName.trim() || !displayName.trim()) {
      setError("Please fill both fields.");
      return;
    }
    if (!isFirebaseConfigured || !user) return;

    setSubmitting(true);
    try {
      // Defensive: double-check user doc didn't sneak in
      const existing = await getDoc(doc(db, "users", user.uid));
      if (existing.exists()) {
        navigate("/dashboard");
        return;
      }

      const code = generateWorkspaceCode();
      const companyRef = await addDoc(collection(db, "companies"), {
        name: companyName.trim(),
        code,
        logo: logoUrl,
        ownerId: user.uid,
        officeStart: "10:00",
        officeEnd: "17:30",
        workingDays: [0, 1, 2, 3, 4, 5],
        holidays: [],
        autoApprove: false,
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, "users", user.uid), {
        email: user.email?.toLowerCase() || "",
        displayName: displayName.trim(),
        photo: user.photoURL || "",
        role: "admin",
        companyId: companyRef.id,
        joinedAt: serverTimestamp(),
      });

      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Could not create workspace.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    navigate("/login");
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--brand-500)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-dot opacity-50" />
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-fuchsia-200/30 rounded-full blur-3xl" />

      <div className="relative w-full max-w-md animate-slide-up">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 avatar-gradient rounded-xl">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="font-semibold tracking-tight text-lg">Tally</span>
        </div>

        <div className="surface-elevated p-8">
          <div className="flex items-start gap-3 mb-6">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName}
                className="w-10 h-10 rounded-full object-cover border border-[var(--border)]"
              />
            ) : (
              <div className="w-10 h-10 avatar-gradient rounded-full text-sm">
                {(user.displayName || user.email || "?").charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[var(--text-muted)]">Signed in as</p>
              <p className="font-medium truncate">{user.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="btn btn-ghost btn-icon"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight">
              Name your workspace
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Last step — set up your company so your team can join.
            </p>
          </div>

          <div className="mb-5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
            <p className="font-medium mb-0.5">Were you invited as staff?</p>
            <p>
              Don't create a workspace here. Sign out and use the email link your admin sent you,
              or check that your admin invited <strong>{user.email}</strong> specifically.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Logo (optional)</label>
              <div className="flex items-center gap-4">
                {logoUrl ? (
                  <div className="relative">
                    <img
                      src={logoUrl}
                      alt="Logo"
                      className="w-14 h-14 rounded-xl object-cover border border-[var(--border)]"
                    />
                    <button
                      type="button"
                      onClick={() => setLogoUrl("")}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[var(--text)] text-white flex items-center justify-center hover:scale-110 transition"
                      title="Remove logo"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-xl border-2 border-dashed border-[var(--border-strong)] flex items-center justify-center text-[var(--text-muted)]">
                    <Upload className="w-4 h-4" />
                  </div>
                )}
                <label
                  className={`btn btn-secondary ${uploadingLogo ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  {uploadingLogo ? "Uploading..." : logoUrl ? "Replace" : "Upload logo"}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingLogo}
                    onChange={(e) =>
                      e.target.files?.[0] && handleLogoUpload(e.target.files[0])
                    }
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div>
              <label className="label">Company / workspace name</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Inc."
                  className="input-field pl-9"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Your name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Jane Cooper"
                  className="input-field pl-9"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex gap-2 p-3 rounded-lg bg-[var(--danger-bg)] border border-red-200 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating workspace...
                </>
              ) : (
                <>
                  Create workspace <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[var(--text-muted)] mt-10 flex items-center justify-center gap-1.5">
          Made with <Heart className="w-3 h-3 text-rose-500 fill-rose-500" /> by Rajendra Pandey
        </p>
      </div>
    </div>
  );
}
