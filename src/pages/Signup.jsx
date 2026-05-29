import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "../utils/firebase";
import { generateWorkspaceCode } from "../utils/staffUtils";
import {
  Building2,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Sparkles,
  Heart,
} from "lucide-react";

export function Signup() {
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const createWorkspaceFor = async (user, providedDisplayName) => {
    const code = generateWorkspaceCode();
    const finalDisplayName =
      providedDisplayName?.trim() ||
      user.displayName ||
      user.email?.split("@")[0];

    const companyRef = await addDoc(collection(db, "companies"), {
      name: companyName.trim(),
      code,
      logo: "",
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
      displayName: finalDisplayName,
      photo: user.photoURL || "",
      role: "admin",
      companyId: companyRef.id,
      joinedAt: serverTimestamp(),
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!companyName.trim() || !displayName.trim() || !email.trim() || !password) {
      setError("Please fill all fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (!isFirebaseConfigured) {
      setError("Firebase is not configured.");
      return;
    }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(cred.user, { displayName: displayName.trim() });
      await createWorkspaceFor(cred.user, displayName);
      navigate("/dashboard");
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setError("This email is already in use. Try signing in instead.");
      } else if (err.code === "auth/weak-password") {
        setError("Password is too weak. Use at least 6 characters.");
      } else if (err.code === "auth/invalid-email") {
        setError("That email address looks invalid.");
      } else {
        setError(err.message || "Could not create account.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError("");
    if (!isFirebaseConfigured) {
      setError("Firebase is not configured.");
      return;
    }
    setGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const { user } = await signInWithPopup(auth, provider);
      // Did this Google account already have a workspace? Then go straight to dashboard.
      const existing = await getDoc(doc(db, "users", user.uid));
      if (existing.exists()) {
        navigate("/dashboard");
      } else {
        // Brand new account — collect workspace details
        navigate("/onboard");
      }
    } catch (err) {
      if (err.code === "auth/popup-closed-by-user") {
        setError("");
      } else {
        setError(err.message || "Google sign-up failed.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[var(--bg)]">
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden bg-gradient-to-br from-[#0a0a0a] via-[#1a1a2e] to-[#1e1b4b] text-white">
        <div className="absolute inset-0 bg-grid opacity-[0.06]" />
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-indigo-500/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-fuchsia-500/20 rounded-full blur-3xl" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/20 backdrop-blur flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="font-semibold tracking-tight text-lg">Pulse</span>
        </div>

        <div className="relative z-10 space-y-6">
          <h1 className="text-5xl font-semibold tracking-tight leading-[1.05]">
            Start your
            <br />
            <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
              workspace.
            </span>
          </h1>
          <p className="text-white/60 text-base max-w-md leading-relaxed">
            Create a private workspace. Give your team a unique workspace code, then create their usernames.
          </p>

          <div className="space-y-3 pt-4 max-w-md">
            {[
              "Private workspace with a unique code",
              "Create staff accounts with username + password",
              "Approve attendance with one click",
              "Forever free for small teams",
            ].map((t) => (
              <div key={t} className="flex items-center gap-3 text-sm text-white/80">
                <span className="dot bg-emerald-400" />
                {t}
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10" />
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md animate-slide-up">
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <div className="h-10 w-10 avatar-gradient rounded-xl">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="font-semibold tracking-tight text-lg">Pulse</span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-semibold tracking-tight">Create workspace</h2>
            <p className="text-[var(--text-secondary)] mt-2 text-sm">
              You'll be the admin. Add staff after setup.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                  autoComplete="name"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@company.com"
                  className="input-field pl-9"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="input-field pl-9 pr-10"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)] transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex gap-2 p-3 rounded-lg bg-[var(--danger-bg)] border border-red-200 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary w-full" disabled={loading || googleLoading}>
              {loading ? (
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

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--border)]" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-3 bg-[var(--bg)] text-xs text-[var(--text-muted)]">or</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignup}
              disabled={loading || googleLoading}
              className="btn btn-secondary w-full"
            >
              <GoogleIcon />
              {googleLoading ? "Connecting..." : "Continue with Google"}
            </button>
            <p className="text-center text-xs text-[var(--text-muted)] -mt-1">
              You'll name your workspace after signing in
            </p>
          </form>

          <p className="text-center text-sm text-[var(--text-secondary)] mt-8">
            Already have an account?{" "}
            <Link to="/login" className="text-[var(--brand-600)] font-medium hover:underline">
              Sign in
            </Link>
          </p>

          <p className="text-center text-xs text-[var(--text-muted)] mt-10 flex items-center justify-center gap-1.5">
            Made with <Heart className="w-3 h-3 text-rose-500 fill-rose-500" /> by Rajendra Pandey
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.3 14.7 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" />
      <path fill="#34A853" d="M3.9 7.6l3.2 2.3c.9-2.1 2.8-3.5 4.9-3.5 1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.3 14.7 2.4 12 2.4 8 2.4 4.6 4.6 3.9 7.6z" />
      <path fill="#FBBC05" d="M12 21.6c2.6 0 4.8-.9 6.4-2.3l-3-2.4c-.8.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.2l-3.2 2.5c1.6 3.1 4.8 5.4 8.8 5.4z" />
      <path fill="#4285F4" d="M21.2 12c0-.6-.1-1.1-.2-1.6H12v3.9h5.5c-.3 1.3-1.1 2.4-2.1 3.1l3 2.4c1.8-1.6 2.8-4.1 2.8-7.8z" />
    </svg>
  );
}
