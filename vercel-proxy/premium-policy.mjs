export const PREMIUM_MESSAGE = '时序导出与日历导入/同步为付费功能，请开通有效通行证；五个永久免费 VIP 名额无需付费。';
// Only server-fetched membership may be supplied to this decision.
export function hasPaidTools(data, now = Date.now()) {
  if (data?.premiumProgram?.isFreeMember === true) return true;
  const access = data?.calendarAccess;
  return access?.active === true && access.status === 'paid' && Number.isFinite(Date.parse(access.accessUntil)) && Date.parse(access.accessUntil) > now;
}
