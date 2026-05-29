/**
 * Client-side helper to fire an email via our Vercel serverless function.
 * Fails silently if the backend isn't configured — emails are best-effort.
 */
export async function sendEmail({ to, subject, html, text }) {
  try {
    const res = await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, html, text }),
    });
    return await res.json();
  } catch (e) {
    console.warn("Email send failed (non-fatal):", e);
    return { ok: false, sent: false };
  }
}

/* ---------- Branded HTML email templates ---------- */
const baseTemplate = (title, bodyHTML) => `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:0;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f4f4f5;color:#0a0a0a">
  <div style="max-width:540px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
    <div style="padding:24px 28px 0;display:flex;align-items:center;gap:10px">
      <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:18px">🌳</div>
      <span style="font-weight:600;font-size:16px">Tally</span>
    </div>
    <div style="padding:20px 28px 32px">
      ${bodyHTML}
    </div>
    <div style="padding:18px 28px;background:#fafafa;border-top:1px solid #e5e7eb;font-size:12px;color:#71717a;text-align:center">
      Sent by Tally Attendance · You can manage notifications in your workspace settings
    </div>
  </div>
</body></html>`;

export function emailPendingApproval({ adminName, staffName, date, status }) {
  return baseTemplate(
    "Pending attendance approval",
    `<h2 style="margin:0 0 8px;font-size:20px">Pending attendance to review</h2>
     <p style="color:#52525b;margin:0 0 16px">Hi ${adminName || "there"},</p>
     <p style="margin:0 0 16px"><strong>${staffName}</strong> submitted a <strong>${status}</strong> entry for <strong>${date}</strong> that's awaiting your approval.</p>
     <p style="margin:0"><a href="https://tally.rajendrapandey.info.np/admin" style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:500">Review in Tally →</a></p>`,
  );
}

export function emailAttendanceApproved({ staffName, date, status, reviewerName }) {
  return baseTemplate(
    "Attendance approved",
    `<h2 style="margin:0 0 8px;font-size:20px">Your attendance was approved ✓</h2>
     <p style="color:#52525b;margin:0 0 16px">Hi ${staffName || "there"},</p>
     <p style="margin:0 0 16px">Your <strong>${status}</strong> entry for <strong>${date}</strong> was approved${reviewerName ? ` by <strong>${reviewerName}</strong>` : ""}.</p>
     <p style="margin:0"><a href="https://tally.rajendrapandey.info.np/me" style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:500">View your forest →</a></p>`,
  );
}

export function emailAttendanceRejected({ staffName, date, status, reviewerName, reviewNote }) {
  return baseTemplate(
    "Attendance rejected",
    `<h2 style="margin:0 0 8px;font-size:20px">Your attendance was rejected</h2>
     <p style="color:#52525b;margin:0 0 16px">Hi ${staffName || "there"},</p>
     <p style="margin:0 0 16px">Your <strong>${status}</strong> entry for <strong>${date}</strong> was rejected${reviewerName ? ` by <strong>${reviewerName}</strong>` : ""}.</p>
     ${reviewNote ? `<blockquote style="margin:0 0 16px;padding:12px 16px;background:#fef2f2;border-left:3px solid #ef4444;border-radius:4px;color:#7f1d1d">"${reviewNote}"</blockquote>` : ""}
     <p style="margin:0"><a href="https://tally.rajendrapandey.info.np/me" style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:500">Resubmit →</a></p>`,
  );
}
