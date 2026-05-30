import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";
import {
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth, db, createAuthUserIsolated } from "./firebase";

async function sendBrandedSignInLink(email) {
  // Save email locally so /reset-password can complete the sign-in
  try {
    window.localStorage.setItem("tally:emailForSignIn", email);
  } catch {
    // ignore
  }
  await sendSignInLinkToEmail(auth, email, {
    url: `${window.location.origin}/reset-password`,
    handleCodeInApp: true,
  });
}

/** Generate a short, friendly workspace code like K7F2-9XPL (kept for display) */
export function generateWorkspaceCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

function generateTempPassword() {
  // Random 24-char string. Staff never sees this — they reset via email link.
  const arr = new Uint8Array(18);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr)).replace(/[+/=]/g, "");
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Look up a company by workspace code (still useful for display/branding) */
export async function findCompanyByCode(workspaceCode) {
  const code = (workspaceCode || "").trim().toUpperCase();
  if (!code) return null;
  const snap = await getDocs(
    query(collection(db, "companies"), where("code", "==", code)),
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

/**
 * Admin creates a staff account by email.
 *  1) Pre-check our users collection for the email (catches own-workspace dupes early)
 *  2) Create Auth user with a random throwaway password (in a secondary app so admin stays signed in)
 *  3) Create the user profile doc
 *  4) Send Firebase password-reset email so staff can set their own password
 */
export async function createStaffByEmail({ companyId, email, displayName }) {
  const e = (email || "").trim().toLowerCase();
  const name = (displayName || "").trim();
  if (!isValidEmail(e)) throw new Error("That email looks invalid.");
  if (!name) throw new Error("Display name is required.");

  // 1) Cross-workspace duplicate check (Firestore-side)
  const existing = await getDocs(
    query(collection(db, "users"), where("email", "==", e)),
  );
  if (!existing.empty) {
    throw new Error(
      "This email is already in a workspace. Use a different address.",
    );
  }

  // 2) Create Auth account in a secondary Firebase app (admin stays signed in)
  const tempPassword = generateTempPassword();
  let uid;
  try {
    uid = await createAuthUserIsolated(e, tempPassword);
  } catch (err) {
    if (err.code === "auth/email-already-in-use") {
      throw new Error(
        "This email is already registered. Use a different address.",
      );
    }
    if (err.code === "auth/invalid-email") {
      throw new Error("That email looks invalid.");
    }
    throw err;
  }

  // 3) Create staff user doc
  await setDoc(doc(db, "users", uid), {
    email: e,
    displayName: name,
    photo: "",
    role: "staff",
    companyId,
    joinedAt: serverTimestamp(),
  });

  // 4) Send a Firebase sign-in link that points directly to our /reset-password page.
  // Staff clicks it → our branded page authenticates them via signInWithEmailLink
  // → prompts for a password → updatePassword. No Firebase generic page involved.
  await sendBrandedSignInLink(e);

  return { uid, email: e };
}

/** Admin removes a staff member (deletes the profile doc; Auth account is orphaned) */
export async function removeStaff(uid) {
  await deleteDoc(doc(db, "users", uid));
}

/** Resend the "set your password" email to a staff member */
export async function resendStaffSetupEmail(email) {
  const e = (email || "").trim().toLowerCase();
  if (!isValidEmail(e)) throw new Error("Invalid email.");
  try {
    await sendBrandedSignInLink(e);
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      throw new Error("No account with that email.");
    }
    throw err;
  }
}

export async function getCompany(companyId) {
  const snap = await getDoc(doc(db, "companies", companyId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
