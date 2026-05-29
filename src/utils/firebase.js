import { initializeApp, getApps, getApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);

let app = null;
let auth = null;
let db = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} else {
  console.warn(
    "Firebase is not configured. Add VITE_FIREBASE_* variables to .env.local",
  );
}

/**
 * Create a new auth user in an isolated Firebase app instance,
 * so the currently-signed-in admin is NOT signed out.
 * Returns the new user's UID.
 */
export async function createAuthUserIsolated(email, password) {
  if (!isFirebaseConfigured) throw new Error("Firebase not configured");

  const tmpName = `secondary-${Date.now()}`;
  const tmpApp = initializeApp(firebaseConfig, tmpName);
  try {
    const tmpAuth = getAuth(tmpApp);
    const cred = await createUserWithEmailAndPassword(tmpAuth, email, password);
    const uid = cred.user.uid;
    await signOut(tmpAuth);
    return uid;
  } finally {
    // Clean up secondary instance
    try {
      const ref = getApp(tmpName);
      await deleteApp(ref);
    } catch {
      // ignore if already deleted
    }
  }
}

export { auth, db };
export default app;
