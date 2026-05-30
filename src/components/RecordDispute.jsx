import React, { useState } from "react";
import {
  doc,
  updateDoc,
  serverTimestamp,
  deleteField,
} from "firebase/firestore";
import { db } from "../utils/firebase";
import { useAuth } from "../hooks/useAuth";
import { formatTime12 } from "../utils/calendarUtils";
import {
  AlertTriangle,
  Send,
  X,
  Check,
  RotateCcw,
  Loader2,
} from "lucide-react";

// Correction requests for already-approved attendance.
// State on the parent record:
//   dispute:        { proposedEntry?, proposedExit?, reason, requestedAt, requestedBy }
//   disputeState:   "pending" | "applied" | "declined" | undefined
//
// Visibility:
//   - Owner sees a "Request correction" button when state=approved and no
//     pending dispute. While pending, they see the proposed values and can
//     cancel. Decided disputes show as a small "applied/declined" tag.
//   - Admin sees the same pending dispute, but with Apply / Decline actions.
//     Apply rewrites entryTime/exitTime on the record; Decline just clears.
export function RecordDispute({ record, recordDocId }) {
  const { user, userDoc, isAdmin } = useAuth();
  const isOwner = record?.userId === user?.uid;
  const [showForm, setShowForm] = useState(false);
  const [proposedEntry, setProposedEntry] = useState(record?.entryTime || "");
  const [proposedExit, setProposedExit] = useState(record?.exitTime || "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (!record || !recordDocId) return null;

  const disputeState = record.disputeState;
  const dispute = record.dispute;
  const hasPending = disputeState === "pending" && dispute;
  const canRequest =
    isOwner && record.state === "approved" && !hasPending && record.status === "present";

  const submit = async (e) => {
    e?.preventDefault?.();
    const r = reason.trim();
    if (!r || busy) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, "attendance", recordDocId), {
        dispute: {
          proposedEntry: proposedEntry || record.entryTime,
          proposedExit: proposedExit || record.exitTime,
          reason: r,
          requestedAt: new Date().toISOString(),
          requestedBy: user.uid,
          requestedByName: userDoc?.displayName || user.email || "Staff",
        },
        disputeState: "pending",
      });
      setShowForm(false);
      setReason("");
    } catch (err) {
      console.error("Could not file correction:", err);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, "attendance", recordDocId), {
        dispute: deleteField(),
        disputeState: deleteField(),
      });
    } catch (err) {
      console.error("Could not cancel:", err);
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!dispute || busy) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, "attendance", recordDocId), {
        entryTime: dispute.proposedEntry || record.entryTime,
        exitTime: dispute.proposedExit || record.exitTime,
        disputeState: "applied",
        dispute: {
          ...dispute,
          resolvedAt: new Date().toISOString(),
          resolvedBy: user.uid,
        },
      });
    } catch (err) {
      console.error("Could not apply:", err);
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, "attendance", recordDocId), {
        disputeState: "declined",
        dispute: {
          ...dispute,
          resolvedAt: new Date().toISOString(),
          resolvedBy: user.uid,
        },
      });
    } catch (err) {
      console.error("Could not decline:", err);
    } finally {
      setBusy(false);
    }
  };

  // Resolved dispute — just a small tag
  if (disputeState === "applied" || disputeState === "declined") {
    return (
      <div className="mt-4 pt-4 border-t border-[var(--border)]">
        <p className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">
          <RotateCcw className="w-3.5 h-3.5" />
          Correction {disputeState === "applied" ? "applied" : "declined"}
          {dispute?.reason && (
            <span className="text-[var(--text-muted)]">— "{dispute.reason}"</span>
          )}
        </p>
      </div>
    );
  }

  // Pending dispute — visible to owner and admin alike, with different actions
  if (hasPending) {
    return (
      <div className="mt-4 pt-4 border-t border-[var(--border)]">
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-medium text-amber-900">
              Correction requested by {dispute.requestedByName}
            </p>
          </div>
          <div className="text-xs text-amber-900 space-y-1 mb-3">
            {dispute.proposedEntry !== record.entryTime && (
              <p>
                Entry:{" "}
                <span className="line-through opacity-70">
                  {formatTime12(record.entryTime)}
                </span>{" "}
                → <strong>{formatTime12(dispute.proposedEntry)}</strong>
              </p>
            )}
            {dispute.proposedExit !== record.exitTime && (
              <p>
                Exit:{" "}
                <span className="line-through opacity-70">
                  {formatTime12(record.exitTime)}
                </span>{" "}
                → <strong>{formatTime12(dispute.proposedExit)}</strong>
              </p>
            )}
            <p className="italic">"{dispute.reason}"</p>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={apply}
                  disabled={busy}
                  className="btn btn-primary text-xs"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Apply
                </button>
                <button
                  type="button"
                  onClick={decline}
                  disabled={busy}
                  className="btn btn-secondary text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                  Decline
                </button>
              </>
            )}
            {isOwner && !isAdmin && (
              <button
                type="button"
                onClick={cancel}
                disabled={busy}
                className="btn btn-secondary text-xs"
              >
                Cancel request
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Owner can request correction
  if (!canRequest) return null;

  if (!showForm) {
    return (
      <div className="mt-4 pt-4 border-t border-[var(--border)]">
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="text-xs text-[var(--text-secondary)] hover:text-[var(--text)] transition flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Request correction
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mt-4 pt-4 border-t border-[var(--border)] space-y-3"
    >
      <p className="text-sm font-medium">Propose a correction</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Entry time</label>
          <input
            type="time"
            value={proposedEntry}
            onChange={(e) => setProposedEntry(e.target.value)}
            className="input-field"
          />
        </div>
        <div>
          <label className="label">Exit time</label>
          <input
            type="time"
            value={proposedExit}
            onChange={(e) => setProposedExit(e.target.value)}
            className="input-field"
          />
        </div>
      </div>
      <div>
        <label className="label">Reason (required)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. I actually checked out at 6:30, forgot to tap the button"
          rows={2}
          className="input-field text-sm"
          required
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!reason.trim() || busy}
          className="btn btn-primary text-xs"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Submit request
        </button>
        <button
          type="button"
          onClick={() => setShowForm(false)}
          className="btn btn-secondary text-xs"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
