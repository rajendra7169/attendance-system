import React, { createContext, useState, useEffect } from "react";
import { auth, db } from "../utils/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userDoc, setUserDoc] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  // Subscribe to auth state
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setUserDoc(null);
        setCompany(null);
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  // Subscribe to the user's profile doc whenever user changes — lives forever, picks up creates
  useEffect(() => {
    if (!user || !db) {
      setUserDoc(null);
      return;
    }
    const unsub = onSnapshot(
      doc(db, "users", user.uid),
      (snap) => {
        if (snap.exists()) {
          setUserDoc({ id: snap.id, ...snap.data() });
        } else {
          setUserDoc(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error("User doc subscription error:", err);
        setLoading(false);
      },
    );
    return unsub;
  }, [user]);

  // Subscribe to the company doc whenever userDoc.companyId changes
  useEffect(() => {
    if (!userDoc?.companyId || !db) {
      setCompany(null);
      return;
    }
    const unsub = onSnapshot(
      doc(db, "companies", userDoc.companyId),
      (snap) => {
        if (snap.exists()) {
          setCompany({ id: snap.id, ...snap.data() });
        } else {
          setCompany(null);
        }
      },
      (err) => console.error("Company subscription error:", err),
    );
    return unsub;
  }, [userDoc?.companyId]);

  const logout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      setUser(null);
      setUserDoc(null);
      setCompany(null);
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const isAdmin = userDoc?.role === "admin";
  const isStaff = userDoc?.role === "staff";

  return (
    <AuthContext.Provider
      value={{ user, userDoc, company, loading, isAdmin, isStaff, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
