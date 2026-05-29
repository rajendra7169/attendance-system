import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * Append an event to the workspace audit log.
 * Best-effort — won't throw on failure (we don't want a logging issue
 * to crash a primary action).
 */
export async function logAudit({
  companyId,
  actorId,
  actorName,
  action, // e.g. "approved", "rejected", "created_staff", "marked_off"
  target, // e.g. "attendance/{id}" or "users/{uid}"
  details = {},
}) {
  if (!companyId || !actorId || !action) return;
  try {
    await addDoc(collection(db, "audit"), {
      companyId,
      actorId,
      actorName: actorName || "",
      action,
      target: target || "",
      details,
      timestamp: serverTimestamp(),
    });
  } catch (e) {
    // swallow — audit shouldn't break the app
    console.error("Audit log failed:", e);
  }
}

export async function fetchAuditLog(companyId, max = 100) {
  if (!companyId) return [];
  const snap = await getDocs(
    query(
      collection(db, "audit"),
      where("companyId", "==", companyId),
      orderBy("timestamp", "desc"),
      limit(max),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export const ACTION_LABELS = {
  approved: { verb: "approved", color: "emerald", icon: "✓" },
  rejected: { verb: "rejected", color: "rose", icon: "✗" },
  bulk_approved: { verb: "bulk approved", color: "emerald", icon: "✓✓" },
  bulk_rejected: { verb: "bulk rejected", color: "rose", icon: "✗✗" },
  created_staff: { verb: "added staff", color: "indigo", icon: "+" },
  removed_staff: { verb: "removed staff", color: "rose", icon: "−" },
  role_changed: { verb: "changed role", color: "amber", icon: "⇄" },
  marked_off: { verb: "marked off period", color: "indigo", icon: "↺" },
  edited_attendance: { verb: "edited attendance", color: "amber", icon: "✎" },
  updated_company: { verb: "updated company", color: "indigo", icon: "⚙" },
  imported_holidays: { verb: "imported holidays", color: "indigo", icon: "📅" },
  imported_staff: { verb: "bulk-added staff", color: "indigo", icon: "📥" },
};
