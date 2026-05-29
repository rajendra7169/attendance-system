import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import {
  verifyPasswordResetCode,
  confirmPasswordReset,
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "../utils/firebase";
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Loader2,
} from "lucide-react";

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const mode = params.get("mode");
  const oobCode = params.get("oobCode");

  const [status, setStatus] = useState("verifying"); // verifying | ready | invalid | success
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const verify = async () => {
      if (!isFirebaseConfigured) {
        setStatus("invalid");
        setError("Firebase is not configured.");
        return;
      }
      if (mode !== "resetPassword" || !oobCode) {
        setStatus("invalid");
        setError("Invalid or missing reset link.");
        return;
      }
      try {
        const verifiedEmail = await verifyPasswordResetCode(auth, oobCode);
        setEmail(verifiedEmail);
        setStatus("ready");
      } catch (err) {
        setStatus("invalid");
        if (err.code === "auth/expired-action-code") {
          setError("This reset link has expired. Request a new one.");
        } else if (err.code === "auth/invalid-action-code") {
          setError("This reset link is invalid or has already been used.");
        } else {
          setError(err.message || "Could not verify reset link.");
        }
      }
    };
    verify();
  }, [mode, oobCode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setStatus("success");
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      if (err.code === "auth/weak-password") {
        setError("Password is too weak. Use at least 6 characters.");
      } else if (err.code === "auth/expired-action-code") {
        setError("Link expired. Request a new reset email.");
      } else {
        setError(err.message || "Could not reset password.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-dot opacity-50" />
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-fuchsia-200/30 rounded-full blur-3xl" />

      <div className="relative w-full max-w-md animate-slide-up">
        <Link to="/login" className="flex items-center gap-3 mb-8 group">
          <div className="h-10 w-10 avatar-gradient rounded-xl">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="font-semibold tracking-tight text-lg group-hover:opacity-80 transition">
            Tally
          </span>
        </Link>

        <div className="surface-elevated p-8">
          {status === "verifying" && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 text-[var(--brand-600)] animate-spin mx-auto mb-4" />
              <p className="text-sm text-[var(--text-secondary)]">
                Verifying your reset link...
              </p>
            </div>
          )}

          {status === "invalid" && (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6 text-rose-600" />
              </div>
              <h1 className="text-xl font-semibold tracking-tight mb-2">
                Link not valid
              </h1>
              <p className="text-sm text-[var(--text-secondary)] mb-6">
                {error}
              </p>
              <Link to="/login" className="btn btn-primary">
                Back to sign in
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {status === "success" && (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <h1 className="text-xl font-semibold tracking-tight mb-2">
                Password updated
              </h1>
              <p className="text-sm text-[var(--text-secondary)] mb-6">
                You can now sign in with your new password. Redirecting...
              </p>
              <Link to="/login" className="btn btn-primary">
                Go to sign in
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {status === "ready" && (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-semibold tracking-tight">
                  Set a new password
                </h1>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  Resetting password for{" "}
                  <span className="font-medium text-[var(--text)]">
                    {email}
                  </span>
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">New password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="input-field pl-9 pr-10"
                      autoFocus
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)] transition"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label">Confirm password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Re-enter new password"
                      className="input-field pl-9"
                      required
                    />
                  </div>
                </div>

                <PasswordStrength value={password} />

                {error && (
                  <div className="flex gap-2 p-3 rounded-lg bg-[var(--danger-bg)] border border-red-200 text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary w-full"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      Update password
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <Link
                  to="/login"
                  className="block text-center text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition pt-2"
                >
                  Back to sign in
                </Link>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PasswordStrength({ value }) {
  const score = (() => {
    let s = 0;
    if (value.length >= 6) s++;
    if (value.length >= 10) s++;
    if (/[A-Z]/.test(value) && /[a-z]/.test(value)) s++;
    if (/\d/.test(value)) s++;
    if (/[^A-Za-z0-9]/.test(value)) s++;
    return s;
  })();

  if (!value) return null;

  const labels = ["Very weak", "Weak", "Okay", "Good", "Strong", "Excellent"];
  const colors = [
    "bg-rose-500",
    "bg-rose-500",
    "bg-amber-500",
    "bg-amber-500",
    "bg-emerald-500",
    "bg-emerald-500",
  ];

  return (
    <div>
      <div className="flex gap-1 mb-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < score ? colors[score] : "bg-[var(--bg-soft)]"
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-[var(--text-muted)]">{labels[score]}</p>
    </div>
  );
}
