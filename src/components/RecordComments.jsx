import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { MessageSquare, Send, Loader2, Trash2 } from "lucide-react";
import { db } from "../utils/firebase";
import { useAuth } from "../hooks/useAuth";

// Comments thread for a single attendance record. Stored at
// attendance/{recordDocId}/comments/{commentId}.
// Both the record owner and admins can post. Anyone can delete their own
// comment; admins can delete any.
export function RecordComments({ recordDocId }) {
  const { user, userDoc, isAdmin } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!recordDocId) return;
    setLoading(true);
    const unsub = onSnapshot(
      query(
        collection(db, "attendance", recordDocId, "comments"),
        orderBy("createdAt", "asc"),
      ),
      (snap) => {
        setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [recordDocId]);

  const post = async (e) => {
    e?.preventDefault?.();
    const body = text.trim();
    if (!body || posting || !user) return;
    setPosting(true);
    try {
      await addDoc(collection(db, "attendance", recordDocId, "comments"), {
        text: body,
        authorId: user.uid,
        authorName: userDoc?.displayName || user.email || "Unknown",
        authorPhoto: userDoc?.photo || "",
        authorRole: userDoc?.role || "staff",
        createdAt: serverTimestamp(),
      });
      setText("");
    } catch (err) {
      console.error("Could not post comment:", err);
    } finally {
      setPosting(false);
    }
  };

  const remove = async (commentId) => {
    try {
      await deleteDoc(doc(db, "attendance", recordDocId, "comments", commentId));
    } catch (err) {
      console.error("Could not delete comment:", err);
    }
  };

  return (
    <div className="mt-5 pt-5 border-t border-[var(--border)]">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4 text-[var(--text-muted)]" />
        <h3 className="text-sm font-semibold tracking-tight">
          Comments {comments.length > 0 && <span className="text-[var(--text-muted)] font-normal">· {comments.length}</span>}
        </h3>
      </div>

      {loading ? (
        <p className="text-xs text-[var(--text-muted)] py-2">Loading...</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)] py-2">
          No comments yet. Start the conversation about this entry.
        </p>
      ) : (
        <ul className="space-y-3 mb-3 max-h-48 overflow-y-auto pr-1">
          {comments.map((c) => {
            const canDelete = c.authorId === user?.uid || isAdmin;
            return (
              <li key={c.id} className="flex gap-2.5">
                {c.authorPhoto ? (
                  <img
                    src={c.authorPhoto}
                    alt=""
                    className="w-7 h-7 rounded-full object-cover flex-shrink-0 border border-[var(--border)] mt-0.5"
                  />
                ) : (
                  <div className="w-7 h-7 avatar-gradient rounded-full text-xs flex-shrink-0 mt-0.5">
                    {(c.authorName || "?").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium truncate">
                      {c.authorName}
                      {c.authorRole === "admin" && (
                        <span className="ml-1.5 px-1 py-0.5 rounded text-[9px] bg-indigo-100 text-indigo-700 font-medium">
                          ADMIN
                        </span>
                      )}
                    </p>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {formatRelative(c.createdAt)}
                    </span>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => remove(c.id)}
                        className="ml-auto text-[var(--text-muted)] hover:text-rose-600 transition"
                        aria-label="Delete comment"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-[var(--text)] whitespace-pre-wrap break-words mt-0.5">
                    {c.text}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={post} className="flex gap-2 items-end">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment..."
          rows={1}
          className="input-field text-sm resize-none flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              post();
            }
          }}
        />
        <button
          type="submit"
          disabled={!text.trim() || posting}
          className="btn btn-primary btn-icon"
          aria-label="Post comment"
        >
          {posting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>
    </div>
  );
}

function formatRelative(ts) {
  if (!ts) return "just now";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString();
}
