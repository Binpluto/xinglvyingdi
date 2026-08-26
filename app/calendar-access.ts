import { env } from "cloudflare:workers";
import { getPremiumProgram } from "./premium-access";

const DAY_MS = 86_400_000;
const XP_PER_LEVEL = 100;

export const calendarPlans = {
  week: { name: "周卡", priceHkd: 8, days: 7 },
  month: { name: "月卡", priceHkd: 20, days: 30 },
  year: { name: "年卡", priceHkd: 160, days: 365 },
} as const;

export type CalendarPlanKey = keyof typeof calendarPlans;

type AccessRow = {
  xp: number;
  trial_started_at: string | null;
  access_until: string | null;
  source: string | null;
  level_reward_claimed_at: string | null;
};

export type CalendarAccessStatus = {
  active: boolean;
  status: "free" | "founder" | "trial" | "paid" | "level_reward" | "expired";
  accessUntil: string | null;
  trialStartedAt: string | null;
  trialAvailable: boolean;
  daysRemaining: number;
  levelRewardEligible: boolean;
  levelRewardClaimed: boolean;
};

function levelFromXp(xp: number) {
  return Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1;
}

async function accessRow(email: string) {
  return env.DB.prepare(`
    SELECT u.xp, e.trial_started_at, e.access_until, e.source, e.level_reward_claimed_at
    FROM users u
    LEFT JOIN calendar_entitlements e ON e.user_email = u.email
    WHERE u.email = ?
  `).bind(email).first<AccessRow>();
}

export async function getCalendarAccess(email: string): Promise<CalendarAccessStatus> {
  const premium = await getPremiumProgram(email);
  const row = await accessRow(email);
  if (premium.isFreeMember) {
    return {
      active: true,
      status: "founder",
      accessUntil: null,
      trialStartedAt: row?.trial_started_at ?? null,
      trialAvailable: false,
      daysRemaining: 0,
      levelRewardEligible: false,
      levelRewardClaimed: Boolean(row?.level_reward_claimed_at),
    };
  }
  const now = Date.now();
  const accessUntilMs = row?.access_until ? Date.parse(row.access_until) : 0;
  const active = Number.isFinite(accessUntilMs) && accessUntilMs > now;
  const source = row?.source || "";
  const status = active
    ? source === "trial" ? "trial" : source === "level100" ? "level_reward" : "paid"
    : row?.trial_started_at ? "expired" : "free";
  return {
    active,
    status,
    accessUntil: row?.access_until ?? null,
    trialStartedAt: row?.trial_started_at ?? null,
    trialAvailable: !row?.trial_started_at,
    daysRemaining: active ? Math.max(1, Math.ceil((accessUntilMs - now) / DAY_MS)) : 0,
    levelRewardEligible: levelFromXp(row?.xp ?? 0) >= 100 && !row?.level_reward_claimed_at,
    levelRewardClaimed: Boolean(row?.level_reward_claimed_at),
  };
}

export async function startCalendarTrial(email: string) {
  const current = await getCalendarAccess(email);
  if (current.active) return current;
  if (!current.trialAvailable) throw new Error("7 天免费试用已经结束，请选择星历通行证");
  const startedAt = new Date().toISOString();
  const accessUntil = new Date(Date.now() + 7 * DAY_MS).toISOString();
  await env.DB.prepare(`
    INSERT OR IGNORE INTO calendar_entitlements
      (user_email, trial_started_at, access_until, source)
    VALUES (?, ?, ?, 'trial')
  `).bind(email, startedAt, accessUntil).run();
  return getCalendarAccess(email);
}

export async function requireCalendarAccess(email: string, options: { startTrial?: boolean } = {}) {
  const access = options.startTrial ? await startCalendarTrial(email) : await getCalendarAccess(email);
  if (!access.active) throw new Error("星历通行证已到期，请续费后继续同步日历");
  return access;
}

export async function claimLevel100CalendarReward(email: string) {
  const row = await accessRow(email);
  if (levelFromXp(row?.xp ?? 0) < 100) throw new Error("达到 Lv.100 后可领取一年星历通行证");
  if (row?.level_reward_claimed_at) throw new Error("Lv.100 一年奖励已经领取");
  const now = Date.now();
  const existingUntil = row?.access_until ? Date.parse(row.access_until) : 0;
  const rewardUntil = new Date(Math.max(now, Number.isFinite(existingUntil) ? existingUntil : 0) + 365 * DAY_MS).toISOString();
  const claimedAt = new Date(now).toISOString();
  const result = await env.DB.prepare(`
    INSERT INTO calendar_entitlements
      (user_email, access_until, source, level_reward_claimed_at)
    VALUES (?, ?, 'level100', ?)
    ON CONFLICT(user_email) DO UPDATE SET
      access_until = excluded.access_until,
      source = 'level100',
      level_reward_claimed_at = excluded.level_reward_claimed_at,
      updated_at = CURRENT_TIMESTAMP
    WHERE calendar_entitlements.level_reward_claimed_at IS NULL
  `).bind(email, rewardUntil, claimedAt).run();
  if (!result.meta.changes) throw new Error("Lv.100 一年奖励已经领取");
  return getCalendarAccess(email);
}

export async function activatePaidCalendarPlan(email: string, plan: CalendarPlanKey) {
  const definition = calendarPlans[plan];
  if (!definition) throw new Error("未知的星历通行证套餐");
  const current = await getCalendarAccess(email);
  const currentUntil = current.accessUntil ? Date.parse(current.accessUntil) : 0;
  const accessUntil = new Date(Math.max(Date.now(), Number.isFinite(currentUntil) ? currentUntil : 0) + definition.days * DAY_MS).toISOString();
  await env.DB.prepare(`
    INSERT INTO calendar_entitlements (user_email, access_until, source)
    VALUES (?, ?, ?)
    ON CONFLICT(user_email) DO UPDATE SET
      access_until = excluded.access_until,
      source = excluded.source,
      updated_at = CURRENT_TIMESTAMP
  `).bind(email, accessUntil, `paid-${plan}`).run();
  return getCalendarAccess(email);
}
