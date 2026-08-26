import { env } from "cloudflare:workers";

const MAX_FREE_SLOTS = 5;

type PremiumRuntimeEnv = {
  DB: D1Database;
  PREMIUM_ADMIN_EMAIL?: string;
  PREMIUM_FREE_EMAILS?: string;
};

type PremiumSlotRow = {
  slot_number: number;
  user_email: string | null;
};

export type PremiumProgramStatus = {
  isAdmin: boolean;
  isFreeMember: boolean;
  maxSlots: number;
  occupiedSlots: number;
  slots: Array<{ slot: number; email: string | null }>;
};

function runtime() {
  return env as unknown as PremiumRuntimeEnv;
}

function normalizeEmail(value = "") {
  return value.trim().toLowerCase().slice(0, 254);
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function configuredAdminEmail() {
  return normalizeEmail(runtime().PREMIUM_ADMIN_EMAIL);
}

function configuredInitialEmails() {
  const admin = configuredAdminEmail();
  const configured = (runtime().PREMIUM_FREE_EMAILS || "")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean);
  return [...new Set([admin, ...configured].filter(Boolean))].slice(0, MAX_FREE_SLOTS);
}

async function ensurePremiumSlots() {
  const initial = configuredInitialEmails();
  if (!initial.length) return;
  const count = await runtime().DB.prepare("SELECT COUNT(*) AS count FROM premium_free_slots")
    .first<{ count: number }>();
  if (Number(count?.count || 0) > 0) return;
  await runtime().DB.batch(Array.from({ length: MAX_FREE_SLOTS }, (_, index) => runtime().DB.prepare(`
    INSERT OR IGNORE INTO premium_free_slots (slot_number, user_email, assigned_at)
    VALUES (?, ?, CASE WHEN ? IS NULL THEN NULL ELSE CURRENT_TIMESTAMP END)
  `).bind(index + 1, initial[index] || null, initial[index] || null)));
}

async function premiumSlots() {
  await ensurePremiumSlots();
  const rows = await runtime().DB.prepare(`
    SELECT slot_number, user_email
    FROM premium_free_slots
    ORDER BY slot_number
  `).all<PremiumSlotRow>();
  return rows.results;
}

export async function getPremiumProgram(email: string): Promise<PremiumProgramStatus> {
  const normalized = normalizeEmail(email);
  const admin = configuredAdminEmail();
  const rows = await premiumSlots();
  const slots = Array.from({ length: MAX_FREE_SLOTS }, (_, index) => {
    const row = rows.find((item) => item.slot_number === index + 1);
    return { slot: index + 1, email: row?.user_email || null };
  });
  return {
    isAdmin: Boolean(admin) && normalized === admin,
    isFreeMember: slots.some((slot) => slot.email === normalized),
    maxSlots: MAX_FREE_SLOTS,
    occupiedSlots: slots.filter((slot) => Boolean(slot.email)).length,
    slots: Boolean(admin) && normalized === admin ? slots : [],
  };
}

export async function updatePremiumFreeSlots(actorEmail: string, requestedEmails: string[]) {
  const admin = configuredAdminEmail();
  if (!admin || normalizeEmail(actorEmail) !== admin) throw new Error("只有管理员可以管理创始免费名额");
  await ensurePremiumSlots();
  const emails = Array.from({ length: MAX_FREE_SLOTS }, (_, index) => {
    if (index === 0) return admin;
    return normalizeEmail(requestedEmails[index] || "");
  });
  for (const email of emails.filter(Boolean)) {
    if (!validEmail(email)) throw new Error(`邮箱格式无效：${email}`);
  }
  if (new Set(emails.filter(Boolean)).size !== emails.filter(Boolean).length) {
    throw new Error("同一个邮箱不能重复占用多个免费名额");
  }
  await runtime().DB.prepare(`
    UPDATE premium_free_slots
    SET user_email = NULL, assigned_at = NULL
    WHERE slot_number BETWEEN 2 AND 5
  `).run();
  await runtime().DB.batch(emails.map((email, index) => runtime().DB.prepare(`
    INSERT INTO premium_free_slots (slot_number, user_email, assigned_at)
    VALUES (?, ?, CASE WHEN ? IS NULL THEN NULL ELSE CURRENT_TIMESTAMP END)
    ON CONFLICT(slot_number) DO UPDATE SET
      user_email = excluded.user_email,
      assigned_at = excluded.assigned_at,
      updated_at = CURRENT_TIMESTAMP
  `).bind(index + 1, email || null, email || null)));
  return getPremiumProgram(actorEmail);
}
