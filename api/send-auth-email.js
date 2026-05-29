/**
 * Unified endpoint for sending custom-branded auth emails (staff invite + forgot password).
 *
 * Required env vars (set in Vercel):
 *   - FIREBASE_SERVICE_ACCOUNT  →  the entire JSON of your Firebase service account key (as a string)
 *   - RESEND_API_KEY            →  your Resend API key (re_...)
 *   - RESEND_FROM_EMAIL         →  e.g. "Tally <hello@yourdomain.com>" (defaults to onboarding@resend.dev for testing)
 *
 * If either env var is missing, the endpoint returns { useFallback: true } and the
 * client falls back to Firebase's default sendPasswordResetEmail.
 *
 * Request:
 *   POST { kind: "invite"|"reset", email, displayName?, companyName?, adminName? }
 */

import admin from "firebase-admin";

let initialized = false;
function getAdmin() {
  if (initialized) return admin;
  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountRaw) return null;
  try {
    const serviceAccount = JSON.parse(serviceAccountRaw);
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
    initialized = true;
    return admin;
  } catch (e) {
    console.error("Failed to init Firebase admin:", e.message);
    return null;
  }
}

const APP_URL = "https://tally.rajendrapandey.info.np";

function inviteHtml({ displayName, link, companyName, adminName }) {
  const greeting = displayName ? `Hi ${displayName.split(" ")[0]},` : "Hello!";
  const intro = adminName
    ? `<strong>${adminName}</strong> just added you to ${companyName ? `<strong>${companyName}</strong>'s` : "a"} Tally workspace.`
    : `You've been added to ${companyName ? `<strong>${companyName}</strong>'s` : "a"} Tally workspace.`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f4f4f5;color:#0a0a0a">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
    <div style="background:linear-gradient(135deg,#10b981,#059669);padding:36px 32px 24px;color:white;text-align:center">
      <div style="font-size:48px;margin-bottom:8px">🌳</div>
      <h1 style="margin:0;font-size:24px;font-weight:600">Welcome to Tally</h1>
      <p style="margin:6px 0 0;opacity:0.9;font-size:14px">A modern attendance experience</p>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 12px;font-size:16px">${greeting}</p>
      <p style="margin:0 0 20px;color:#52525b;line-height:1.5">${intro}</p>
      <p style="margin:0 0 24px;color:#52525b;line-height:1.5">
        Click the button below to set your password and start checking in. The link expires in 1 hour for security.
      </p>
      <div style="text-align:center;margin:32px 0">
        <a href="${link}" style="display:inline-block;background:#10b981;color:white;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:15px">
          Set your password →
        </a>
      </div>
      <p style="margin:0;color:#71717a;font-size:13px;line-height:1.5">
        Or copy and paste this link into your browser:<br>
        <a href="${link}" style="color:#6366f1;word-break:break-all">${link}</a>
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0">
      <p style="margin:0;color:#71717a;font-size:13px;line-height:1.5">
        <strong>What's next?</strong><br>
        Once you set your password, sign in at <a href="${APP_URL}" style="color:#6366f1">${APP_URL.replace("https://", "")}</a>. Mark your attendance daily by checking in when you arrive and out when you leave. Your forest grows with you. 🌱
      </p>
    </div>
    <div style="padding:18px 32px;background:#fafafa;border-top:1px solid #e5e7eb;font-size:12px;color:#71717a;text-align:center">
      If you weren't expecting this email, you can safely ignore it.
    </div>
  </div>
</body></html>`;
}

function resetHtml({ link }) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f4f4f5;color:#0a0a0a">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
    <div style="padding:32px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px">
        <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#10b981,#059669);color:white;display:inline-flex;align-items:center;justify-content:center;font-size:18px">🌳</div>
        <strong style="font-size:16px">Tally</strong>
      </div>
      <h2 style="margin:0 0 12px;font-size:20px">Reset your password</h2>
      <p style="margin:0 0 24px;color:#52525b;line-height:1.5">
        Someone (hopefully you) requested a password reset for your Tally account.
        Click the button below to choose a new password. The link expires in 1 hour.
      </p>
      <div style="text-align:center;margin:28px 0">
        <a href="${link}" style="display:inline-block;background:#0a0a0a;color:white;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:15px">
          Reset password →
        </a>
      </div>
      <p style="margin:0;color:#71717a;font-size:13px;line-height:1.5">
        Or copy this link:<br>
        <a href="${link}" style="color:#6366f1;word-break:break-all">${link}</a>
      </p>
    </div>
    <div style="padding:18px 32px;background:#fafafa;border-top:1px solid #e5e7eb;font-size:12px;color:#71717a;text-align:center">
      If you didn't request this, you can safely ignore this email — your password won't change.
    </div>
  </div>
</body></html>`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { kind, email, displayName, companyName, adminName } = req.body || {};
  if (!email || !kind) {
    res.status(400).json({ error: "Missing kind or email" });
    return;
  }

  const resendKey = process.env.RESEND_API_KEY;
  const adminInstance = getAdmin();

  // If either piece of infra isn't ready, signal client to fall back
  if (!resendKey || !adminInstance) {
    res.status(200).json({
      ok: true,
      useFallback: true,
      reason: !resendKey ? "RESEND_API_KEY missing" : "FIREBASE_SERVICE_ACCOUNT missing",
    });
    return;
  }

  try {
    // Generate a password-set/reset link via Firebase Admin SDK
    const actionCodeSettings = {
      url: `${APP_URL}/reset-password`,
      handleCodeInApp: false,
    };
    const link = await adminInstance
      .auth()
      .generatePasswordResetLink(email, actionCodeSettings);

    // Build email body
    const html =
      kind === "invite"
        ? inviteHtml({ displayName, link, companyName, adminName })
        : resetHtml({ link });
    const subject =
      kind === "invite"
        ? `Welcome to ${companyName || "Tally"} 🌳`
        : "Reset your Tally password";

    const sendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "Tally <onboarding@resend.dev>",
        to: [email],
        subject,
        html,
      }),
    });

    const data = await sendRes.json();
    if (!sendRes.ok) {
      res.status(sendRes.status).json({ ok: false, error: data });
      return;
    }
    res.status(200).json({ ok: true, sent: true, id: data.id });
  } catch (e) {
    console.error("send-auth-email error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
}
