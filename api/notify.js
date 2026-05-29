/**
 * Vercel serverless function for sending email notifications via Resend.
 *
 * Setup (one-time):
 *  1. Sign up free at https://resend.com (3,000 emails/month free)
 *  2. Verify a sending domain (or use the free onboarding domain for testing)
 *  3. Get an API key, add it to Vercel env vars as RESEND_API_KEY
 *  4. (Optional) Set RESEND_FROM_EMAIL=notifications@yourdomain.com — defaults to
 *     onboarding@resend.dev for testing
 *
 * Without these env vars set, the endpoint quietly returns 200 (no-op),
 * so the app keeps working in environments without Resend configured.
 */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // No-op fallback so the app doesn't error
    res.status(200).json({ ok: true, sent: false, reason: "Resend not configured" });
    return;
  }

  const { to, subject, html, text } = req.body || {};
  if (!to || !subject || (!html && !text)) {
    res.status(400).json({ error: "Missing to / subject / body" });
    return;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "Tally <onboarding@resend.dev>",
        to: Array.isArray(to) ? to : [to],
        subject,
        html: html || undefined,
        text: text || undefined,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      res.status(response.status).json({ ok: false, error: data });
      return;
    }
    res.status(200).json({ ok: true, sent: true, id: data.id });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
