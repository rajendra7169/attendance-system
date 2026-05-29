/**
 * Computes leave balances per staff per year.
 *
 * Quotas live on the company doc:
 *   leaveQuotas: { annual: 18, sick: 10, casual: 5 }  (defaults)
 *
 * Each "off" attendance record can have:
 *   leaveType: "annual" | "sick" | "casual"  (defaults to "annual" if missing)
 *
 * Only approved off-days count against the balance.
 */

export const DEFAULT_QUOTAS = {
  annual: 18,
  sick: 10,
  casual: 5,
};

export const LEAVE_TYPE_LABELS = {
  annual: { label: "Annual", color: "indigo", icon: "🏖️" },
  sick: { label: "Sick", color: "rose", icon: "🤒" },
  casual: { label: "Casual", color: "amber", icon: "📅" },
};

export function getLeaveBalances({ records, quotas, year = new Date().getFullYear() }) {
  const q = { ...DEFAULT_QUOTAS, ...(quotas || {}) };
  const yearRecords = (records || []).filter(
    (r) =>
      r.date?.startsWith(`${year}-`) &&
      r.status === "off" &&
      (r.state ?? "approved") === "approved",
  );

  const used = { annual: 0, sick: 0, casual: 0 };
  yearRecords.forEach((r) => {
    const t = r.leaveType || "annual";
    used[t] = (used[t] || 0) + 1;
  });

  return {
    annual: { used: used.annual, total: q.annual, remaining: q.annual - used.annual },
    sick: { used: used.sick, total: q.sick, remaining: q.sick - used.sick },
    casual: { used: used.casual, total: q.casual, remaining: q.casual - used.casual },
  };
}
