/**
 * Vercel serverless endpoint that generates a Firebase password-reset link
 * pointing to OUR domain (bypassing the broken Firebase Console action URL setting),
 * then sends a branded email via Resend.
 *
 * Required env vars on Vercel (Settings → Environment Variables):
 *  - FIREBASE_PROJECT_ID
 *  - FIREBASE_CLIENT_EMAIL
 *  - FIREBASE_PRIVATE_KEY  (paste the full key including BEGIN/END lines and \n line breaks)
 *  - RESEND_API_KEY        (from https://resend.com)
 *  - RESEND_FROM_EMAIL     (optional, defaults to onboarding@resend.dev)
 *  - APP_URL               (optional, defaults to https://tally.rajendrapandey.info.np)
 *
 * If FIREBASE_* env vars are missing, the endpoint returns 503 with a clear error.
 * If RESEND_API_KEY is missing, returns the link in the response so you can paste it manually.
 */

import admin from "firebase-admin";

function initAdmin() {
  if (admin.apps.length) return admin.app();
  if (
    !process.env.FIREBASE_PROJECT_ID ||
    !process.env.FIREBASE_CLIENT_EMAIL ||
    !process.env.FIREBASE_PRIVATE_KEY
  ) {
    throw new Error("Firebase Admin env vars not set");
  }
  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

const APP_URL = process.env.APP_URL || "https://tally.rajendrapandey.info.np";

function emailSetPassword({ displayName, link, workspaceName }) {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f4f4f5;color:#0a0a0a">
  <div style="max-width:540px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
    <div style="padding:24px 28px;border-bottom:1px solid #f4f4f5;display:flex;align-items:center;gap:10px">
      <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:18px">🌳</div>
      <span style="font-weight:600;font-size:16px">Tally</span>
    </div>
    <div style="padding:24px 28px 32px">
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700">Welcome${displayName ? ` ${displayName}` : ""}! 👋</h1>
      <p style="color:#52525b;margin:0 0 20px;line-height:1.55">
        You've been added to <strong>${workspaceName || "a Tally workspace"}</strong> as a staff member.
        Click the button below to set your password and start tracking attendance.
      </p>
      <p style="margin:0 0 24px;text-align:center">
        <a href="${link}" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:600;font-size:15px">
          Set my password →
        </a>
      </p>
      <p style="margin:0 0 8px;color:#71717a;font-size:13px">Or copy and paste this link into your browser:</p>
      <p style="margin:0 0 24px;color:#525252;font-size:12px;word-break:break-all;background:#fafafa;padding:10px;border-radius:6px;border:1px solid #f4f4f5">${link}</p>
      <p style="margin:0;color:#a1a1aa;font-size:12px;line-height:1.5">
        This link expires in 1 hour. If you didn't expect this email, you can ignore it.
      </p>
    </div>
    <div style="padding:18px 28px;background:#fafafa;border-top:1px solid #e5e7eb;font-size:12px;color:#71717a;text-align:center">
      Tally — A modern, gamified attendance manager · <a href="${APP_URL}" style="color:#10b981">Visit Tally</a>
    </div>
  </div>
</body></html>`;
}

function emailResetPassword({ displayName, link }) {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f4f4f5;color:#0a0a0a">
  <div style="max-width:540px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
    <div style="padding:24px 28px;border-bottom:1px solid #f4f4f5;display:flex;align-items:center;gap:10px">
      <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:18px">🌳</div>
      <span style="font-weight:600;font-size:16px">Tally</span>
    </div>
    <div style="padding:24px 28px 32px">
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700">Password reset</h1>
      <p style="color:#52525b;margin:0 0 20px;line-height:1.55">
        Hi${displayName ? ` ${displayName}` : ""}, we received a request to reset your password. Click the button below to choose a new one.
      </p>
      <p style="margin:0 0 24px;text-align:center">
        <a href="${link}" style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:600;font-size:15px">
          Reset password →
        </a>
      </p>
      <p style="margin:0 0 8px;color:#71717a;font-size:13px">Or copy and paste this link into your browser:</p>
      <p style="margin:0 0 24px;color:#525252;font-size:12px;word-break:break-all;background:#fafafa;padding:10px;border-radius:6px;border:1px solid #f4f4f5">${link}</p>
      <p style="margin:0;color:#a1a1aa;font-size:12px;line-height:1.5">
        This link expires in 1 hour. If you didn't request this, you can safely ignore it.
      </p>
    </div>
    <div style="padding:18px 28px;background:#fafafa;border-top:1px solid #e5e7eb;font-size:12px;color:#71717a;text-align:center">
      Tally — A modern, gamified attendance manager · <a href="${APP_URL}" style="color:#10b981">Visit Tally</a>
    </div>
  </div>
</body></html>`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { email, type, displayName, workspaceName } = req.body || {};
  if (!email || !type) {
    res.status(400).json({ error: "email and type required" });
    return;
  }

  // 1. Generate the Firebase reset link via Admin SDK
  let link;
  try {
    initAdmin();
    link = await admin.auth().generatePasswordResetLink(email, {
      url: `${APP_URL}/reset-password`,
      handleCodeInApp: false,
    });
  } catch (e) {
    if (e.message?.includes("env vars not set")) {
      res.status(503).json({
        ok: false,
        error: "Server not configured. Add Firebase Admin env vars to Vercel.",
      });
      return;
    }
    if (e.code === "auth/user-not-found") {
      res.status(404).json({ ok: false, error: "No account with that email." });
      return;
    }
    res.status(500).json({ ok: false, error: e.message });
    return;
  }

  // 2. Send via Resend (or return the link if Resend not configured)
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    res.status(200).json({
      ok: true,
      sent: false,
      link,
      reason: "Resend not configured — link returned for manual delivery",
    });
    return;
  }

  const subject =
    type === "set-password"
      ? `Set your password for ${workspaceName || "Tally"}`
      : "Reset your Tally password";

  const html =
    type === "set-password"
      ? emailSetPassword({ displayName, link, workspaceName })
      : emailResetPassword({ displayName, link });

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "Tally <onboarding@resend.dev>",
        to: email,
        subject,
        html,
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      res.status(r.status).json({ ok: false, sent: false, link, error: data });
      return;
    }
    res.status(200).json({ ok: true, sent: true, id: data.id });
  } catch (e) {
    res.status(500).json({ ok: false, sent: false, link, error: e.message });
  }
}
