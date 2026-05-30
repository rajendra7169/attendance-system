// Fire-and-forget notifier for Slack and Discord incoming webhooks.
// Both providers' webhook endpoints permit cross-origin POSTs from browsers,
// so no backend is needed. Failures are swallowed — a missed notification
// must never block the user-facing action that triggered it.

async function postWebhook(url, payload) {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      mode: "no-cors",
    });
  } catch (err) {
    console.warn("Webhook failed:", err);
  }
}

function looksLikeSlack(url) {
  return /hooks\.slack\.com/i.test(url || "");
}

function looksLikeDiscord(url) {
  return /discord(app)?\.com\/api\/webhooks/i.test(url || "");
}

// company.slackWebhook and company.discordWebhook can be set independently.
// Notifies whichever is configured (or both).
export function notifyTeam(company, message) {
  if (!company) return;
  if (company.slackWebhook && looksLikeSlack(company.slackWebhook)) {
    postWebhook(company.slackWebhook, { text: message });
  }
  if (company.discordWebhook && looksLikeDiscord(company.discordWebhook)) {
    postWebhook(company.discordWebhook, { content: message });
  }
}
