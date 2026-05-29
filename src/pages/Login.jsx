import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth, db, isFirebaseConfigured } from "../utils/firebase";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  CalendarCheck,
  Users,
  ShieldCheck,
  Activity,
  AlertCircle,
  CheckCircle2,
  Heart,
} from "lucide-react";

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleForgotPassword = async () => {
    setError("");
    setInfo("");
    if (!email.trim()) {
      setError("Enter your email above first, then click Forgot.");
      return;
    }
    if (!isFirebaseConfigured) {
      setError("Firebase is not configured.");
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim(), {
        url: `${window.location.origin}/reset-password`,
        handleCodeInApp: false,
      });
      setInfo(`Reset link sent to ${email}. Check your inbox (and spam).`);
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        setError("No account with that email.");
      } else if (err.code === "auth/invalid-email") {
        setError("That email address looks invalid.");
      } else {
        setError(err.message || "Could not send reset email.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!isFirebaseConfigured) {
      setError("Firebase is not configured.");
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigate("/dashboard");
    } catch (err) {
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        setError("Wrong email or password.");
      } else if (err.code === "auth/user-not-found") {
        setError("No account with that email.");
      } else {
        setError(err.message || "Could not sign in.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignin = async () => {
    setError("");
    setInfo("");
    if (!isFirebaseConfigured) {
      setError("Firebase is not configured.");
      return;
    }
    setGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const { user } = await signInWithPopup(auth, provider);
      const existing = await getDoc(doc(db, "users", user.uid));
      navigate(existing.exists() ? "/dashboard" : "/onboard");
    } catch (err) {
      if (err.code === "auth/popup-closed-by-user") {
        setError("");
      } else {
        setError(err.message || "Google sign-in failed.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const features = [
    { icon: CalendarCheck, title: "Smart Calendar", desc: "Full-year attendance at a glance" },
    { icon: Users, title: "Team Management", desc: "Add staff by email in seconds" },
    { icon: ShieldCheck, title: "Admin Approval", desc: "Verify each entry before counting" },
    { icon: Activity, title: "Real-time Sync", desc: "Instant updates across devices" },
  ];

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
          <span className="font-semibold tracking-tight text-lg">Tally</span>
        </div>

        <div className="relative z-10 space-y-10">
          <div>
            <h1 className="text-5xl font-semibold tracking-tight leading-[1.05]">
              Attendance,
              <br />
              <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
                made effortless.
              </span>
            </h1>
            <p className="mt-5 text-white/60 text-base max-w-md leading-relaxed">
              A private workspace for your team. Staff submit, admin approves, everyone stays in sync.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 max-w-lg">
            {features.map((f, i) => (
              <div
                key={i}
                className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur hover:bg-white/10 transition"
              >
                <f.icon className="w-5 h-5 text-indigo-300 mb-2" />
                <p className="text-sm font-medium">{f.title}</p>
                <p className="text-xs text-white/50 mt-0.5">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2 text-xs text-white/40">
          <div className="dot bg-emerald-400 animate-pulse" />
          All systems operational
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12 relative">
        <div className="absolute inset-0 bg-dot opacity-50 lg:hidden" />
        <div className="w-full max-w-md relative animate-slide-up">
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <div className="h-10 w-10 avatar-gradient rounded-xl">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="font-semibold tracking-tight text-lg">Tally</span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-semibold tracking-tight">Welcome back</h2>
            <p className="text-[var(--text-secondary)] mt-2 text-sm">
              Sign in to your workspace.
            </p>
          </div>

          {!isFirebaseConfigured && (
            <div className="mb-4 flex gap-3 p-3 rounded-lg bg-[var(--warning-bg)] border border-amber-200 text-sm text-amber-800">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-medium">Setup required.</span> Add Firebase keys in{" "}
                <code className="px-1 py-0.5 bg-amber-100 rounded text-xs">.env.local</code>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="input-field pl-9"
                  autoComplete="off"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0">Password</label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="text-xs text-[var(--brand-600)] hover:underline disabled:opacity-50"
                >
                  Forgot?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pl-9 pr-10"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
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

            {info && (
              <div className="flex gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{info}</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary w-full" disabled={loading || googleLoading}>
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in <ArrowRight className="w-4 h-4" />
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
              onClick={handleGoogleSignin}
              disabled={loading || googleLoading}
              className="btn btn-secondary w-full"
            >
              <GoogleIcon />
              {googleLoading ? "Connecting..." : "Continue with Google"}
            </button>
          </form>

          <p className="text-center text-sm text-[var(--text-secondary)] mt-8">
            Need a workspace?{" "}
            <Link to="/signup" className="text-[var(--brand-600)] font-medium hover:underline">
              Create one
            </Link>
          </p>
          <p className="text-center text-xs text-[var(--text-muted)] mt-2">
            Staff: your admin sent you a "Set your password" email — use that link first.
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
