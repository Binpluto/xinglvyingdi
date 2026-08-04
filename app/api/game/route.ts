import { env } from "cloudflare:workers";
import { assertSameOrigin, getAppUser } from "../../app-auth";
import { claimLevel100CalendarReward, getCalendarAccess } from "../../calendar-access";
import { syncGoogleCalendar } from "../../google-calendar";
import { getPremiumProgram, updatePremiumFreeSlots } from "../../premium-access";

type UserRow = {
  email: string;
  display_name: string;
  invite_code: string;
  invited_by: string | null;
  xp: number;
  coins: number;
  focus_minutes: number;
};

type CalendarEvent = {
  uid: string;
  title: string;
  description: string;
  location: string;
  dueAt: string;
};

const starterQuests = [
  ["完成晨间仪式", "喝水 · 拉伸 · 写下今日目标", "日常", 30],
  ["推进「理想工作」主线", "完成作品集首页的内容整理", "主线", 80],
  ["知识秘境：深度阅读", "专注阅读 30 分钟并记录三点收获", "支线", 45],
  ["风之小径", "户外散步 20 分钟", "日常", 25],
] as const;

type RealmRule = {
  xpRequired: number;
  taskReward: number;
  completedQuests: number;
  focusMinutes: number;
  referrals: number;
  teamMembers: number;
  previousRealmId: string | null;
};

type JourneyMetrics = {
  xp: number;
  focus_minutes: number;
  completed_quests: number;
  referral_count: number;
  team_members: number;
};

const realmOrder = ["dawn", "crown", "ember", "storm", "verdant", "coral", "polar"] as const;
const realmNames: Record<string, string> = {
  dawn: "曦华大陆",
  crown: "苍冠大陆",
  ember: "赤土大陆",
  storm: "风暴大陆",
  verdant: "森灵大陆",
  coral: "珊海群岛",
  polar: "极星大陆",
};
const realmRules: Record<string, RealmRule> = {
  dawn: { xpRequired: 0, taskReward: 30, completedQuests: 0, focusMinutes: 0, referrals: 0, teamMembers: 0, previousRealmId: null },
  crown: { xpRequired: 600, taskReward: 45, completedQuests: 8, focusMinutes: 120, referrals: 1, teamMembers: 0, previousRealmId: "dawn" },
  ember: { xpRequired: 1500, taskReward: 55, completedQuests: 18, focusMinutes: 300, referrals: 2, teamMembers: 2, previousRealmId: "crown" },
  storm: { xpRequired: 3000, taskReward: 70, completedQuests: 30, focusMinutes: 600, referrals: 3, teamMembers: 3, previousRealmId: "ember" },
  verdant: { xpRequired: 5000, taskReward: 85, completedQuests: 45, focusMinutes: 1000, referrals: 5, teamMembers: 3, previousRealmId: "storm" },
  coral: { xpRequired: 7500, taskReward: 105, completedQuests: 65, focusMinutes: 1500, referrals: 7, teamMembers: 4, previousRealmId: "verdant" },
  polar: { xpRequired: 11000, taskReward: 130, completedQuests: 90, focusMinutes: 2400, referrals: 10, teamMembers: 5, previousRealmId: "coral" },
};

const calendarHosts = [
  "calendar.google.com",
  "outlook.live.com",
  "outlook.office365.com",
  "outlook.office.com",
  "icloud.com",
];

function unescapeIcs(value = "") {
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function parseIcsDate(value = "") {
  const normalized = value.trim();
  const match = normalized.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, utc] = match;
  const allDay = !hour;
  const date = utc
    ? new Date(Date.UTC(+year, +month - 1, +day, +(hour || 0), +(minute || 0), +(second || 0)))
    : new Date(+year, +month - 1, +day, +(hour || 0), +(minute || 0), +(second || 0));
  const dueAt = allDay
    ? `${year}-${month}-${day}`
    : utc
      ? date.toISOString()
      : `${year}-${month}-${day}T${hour}:${minute}:${second || "00"}`;
  return { date, dueAt, allDay };
}

function occurrenceDueAt(date: Date, allDay: boolean, utc: boolean) {
  const pad = (value: number) => String(value).padStart(2, "0");
  if (allDay) return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  if (utc) return date.toISOString();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function parseCalendar(ics: string, rangeDays: number, requestedStartDate?: string) {
  const unfolded = ics.replace(/\r?\n[ \t]/g, "");
  const blocks = unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [];
  const now = new Date();
  const requestedParts = /^\d{4}-\d{2}-\d{2}$/.test(requestedStartDate ?? "")
    ? requestedStartDate!.split("-").map(Number)
    : null;
  const startWindow = requestedParts
    ? new Date(requestedParts[0], requestedParts[1] - 1, requestedParts[2])
    : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endWindow = new Date(startWindow);
  endWindow.setDate(endWindow.getDate() + rangeDays);
  const output: CalendarEvent[] = [];
  const weekday: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

  for (const block of blocks) {
    const properties = new Map<string, string[]>();
    for (const line of block.split(/\r?\n/)) {
      const split = line.indexOf(":");
      if (split < 0) continue;
      const key = line.slice(0, split).split(";")[0].toUpperCase();
      const values = properties.get(key) ?? [];
      values.push(line.slice(split + 1));
      properties.set(key, values);
    }
    if (properties.get("STATUS")?.[0] === "CANCELLED") continue;
    const parsedStart = parseIcsDate(properties.get("DTSTART")?.[0]);
    if (!parsedStart) continue;
    const title = unescapeIcs(properties.get("SUMMARY")?.[0]) || "未命名日程";
    const description = unescapeIcs(properties.get("DESCRIPTION")?.[0]).slice(0, 120);
    const location = unescapeIcs(properties.get("LOCATION")?.[0]).slice(0, 60);
    const uid = unescapeIcs(properties.get("UID")?.[0]) || `${title}-${parsedStart.dueAt}`;
    const recurrence = Object.fromEntries(
      (properties.get("RRULE")?.[0] ?? "")
        .split(";")
        .map((part) => part.split("="))
        .filter((part) => part.length === 2),
    );
    const exclusions = new Set(
      (properties.get("EXDATE") ?? [])
        .flatMap((value) => value.split(","))
        .map((value) => parseIcsDate(value)?.dueAt.slice(0, 10))
        .filter(Boolean),
    );
    const until = parseIcsDate(recurrence.UNTIL)?.date;
    const interval = Math.max(1, Number(recurrence.INTERVAL) || 1);
    const utc = /Z$/.test(properties.get("DTSTART")?.[0] ?? "");

    const addOccurrence = (date: Date) => {
      if (date < startWindow || date >= endWindow || (until && date > until)) return;
      const dueAt = occurrenceDueAt(date, parsedStart.allDay, utc);
      if (exclusions.has(dueAt.slice(0, 10))) return;
      output.push({ uid: `${uid}:${dueAt}`, title, description, location, dueAt });
    };

    if (!recurrence.FREQ) {
      addOccurrence(parsedStart.date);
    } else {
      for (let cursor = new Date(startWindow); cursor < endWindow; cursor.setDate(cursor.getDate() + 1)) {
        const candidate = new Date(
          cursor.getFullYear(),
          cursor.getMonth(),
          cursor.getDate(),
          parsedStart.date.getHours(),
          parsedStart.date.getMinutes(),
          parsedStart.date.getSeconds(),
        );
        if (candidate < parsedStart.date) continue;
        const days = Math.floor((candidate.getTime() - new Date(parsedStart.date.getFullYear(), parsedStart.date.getMonth(), parsedStart.date.getDate()).getTime()) / 86400000);
        const months = (candidate.getFullYear() - parsedStart.date.getFullYear()) * 12 + candidate.getMonth() - parsedStart.date.getMonth();
        const years = candidate.getFullYear() - parsedStart.date.getFullYear();
        const byDays = (recurrence.BYDAY || "").split(",").map((day) => weekday[day.slice(-2)]).filter((day) => day !== undefined);
        const byMonthDays = (recurrence.BYMONTHDAY || "").split(",").map(Number).filter(Boolean);
        const matches =
          recurrence.FREQ === "DAILY" ? days % interval === 0 :
          recurrence.FREQ === "WEEKLY" ? Math.floor(days / 7) % interval === 0 && (byDays.length ? byDays.includes(candidate.getDay()) : candidate.getDay() === parsedStart.date.getDay()) :
          recurrence.FREQ === "MONTHLY" ? months % interval === 0 && (byMonthDays.length ? byMonthDays.includes(candidate.getDate()) : candidate.getDate() === parsedStart.date.getDate()) :
          recurrence.FREQ === "YEARLY" ? years % interval === 0 && candidate.getMonth() === parsedStart.date.getMonth() && candidate.getDate() === parsedStart.date.getDate() :
          false;
        if (matches) addOccurrence(candidate);
      }
    }
    if (output.length >= 40) break;
  }
  return output.sort((a, b) => a.dueAt.localeCompare(b.dueAt)).slice(0, 40);
}

function calendarUrl(input: string) {
  const normalized = input.trim().replace(/^webcal:\/\//i, "https://");
  const url = new URL(normalized);
  if (url.protocol !== "https:") throw new Error("日历链接必须使用 HTTPS 或 webcal");
  const host = url.hostname.toLowerCase();
  if (!calendarHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) {
    throw new Error("此链接暂不支持，请下载 .ics 文件后导入");
  }
  return url;
}

function makeCode(prefix: string, value: string) {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `${prefix}${(hash >>> 0).toString(36).toUpperCase().slice(0, 7)}`;
}

async function currentUser(request: Request) {
  const identity = await getAppUser(request);
  if (!identity) return null;
  const db = env.DB;
  const inviteCode = makeCode("STAR", identity.email.toLowerCase());
  await db.prepare(`
    INSERT INTO users (email, display_name, invite_code, xp)
    VALUES (?, ?, ?, 0)
    ON CONFLICT(email) DO UPDATE SET display_name = excluded.display_name
  `).bind(identity.email, identity.displayName, inviteCode).run();
  await db.prepare(`
    UPDATE users SET xp = 0
    WHERE email = ? AND xp = 680 AND focus_minutes = 0
      AND NOT EXISTS (SELECT 1 FROM quests q WHERE q.user_email = users.email AND q.completed = 1)
      AND NOT EXISTS (SELECT 1 FROM referrals r WHERE r.referrer_email = users.email OR r.invitee_email = users.email)
      AND NOT EXISTS (SELECT 1 FROM team_members tm WHERE tm.user_email = users.email)
  `).bind(identity.email).run();
  await db.prepare(`
    INSERT OR IGNORE INTO realm_progress
      (user_email, realm_id, completed_regions, unlocked, target, unlocked_at)
    VALUES (?, 'dawn', 0, 1, 0, CURRENT_TIMESTAMP)
  `).bind(identity.email).run();

  const count = await db.prepare("SELECT COUNT(*) AS count FROM quests WHERE user_email = ?")
    .bind(identity.email).first<{ count: number }>();
  if (!count?.count) {
    await db.batch(starterQuests.map((quest) =>
      db.prepare("INSERT INTO quests (user_email, title, detail, type, reward) VALUES (?, ?, ?, ?, ?)")
        .bind(identity.email, ...quest),
    ));
  }
  return identity;
}

async function realmGateStatuses(email: string) {
  const metrics = await env.DB.prepare(`
    SELECT u.xp, u.focus_minutes,
      (SELECT COUNT(*) FROM quest_completions qc WHERE qc.user_email = u.email) AS completed_quests,
      (SELECT COUNT(*) FROM referrals r WHERE r.referrer_email = u.email) AS referral_count,
      COALESCE((
        SELECT COUNT(*) FROM team_members group_member
        WHERE group_member.team_id = (
          SELECT own_membership.team_id FROM team_members own_membership
          WHERE own_membership.user_email = u.email LIMIT 1
        )
      ), 0) AS team_members
    FROM users u WHERE u.email = ?
  `).bind(email).first<JourneyMetrics>();
  const progressRows = await env.DB.prepare(`
    SELECT realm_id, completed_regions, unlocked
    FROM realm_progress WHERE user_email = ?
  `).bind(email).all<{ realm_id: string; completed_regions: number; unlocked: number }>();
  const progress = new Map(progressRows.results.map((row) => [row.realm_id, row]));
  const values = metrics ?? { xp: 0, focus_minutes: 0, completed_quests: 0, referral_count: 0, team_members: 0 };

  return realmOrder.map((realmId, sequence) => {
    const rule = realmRules[realmId];
    const previous = rule.previousRealmId ? progress.get(rule.previousRealmId) : null;
    const requirements = rule.previousRealmId ? [
      {
        key: "previousRealm",
        label: `完成${realmNames[rule.previousRealmId]}三项试炼`,
        current: previous?.unlocked ? Math.min(3, previous.completed_regions) : 0,
        required: 3,
        unit: "项",
      },
      { key: "xp", label: "累计冒险经验", current: values.xp, required: rule.xpRequired, unit: " EXP" },
      { key: "quests", label: "完成系统任务", current: values.completed_quests, required: rule.completedQuests, unit: "项" },
      { key: "focus", label: "累计专注修行", current: values.focus_minutes, required: rule.focusMinutes, unit: "分钟" },
      { key: "referrals", label: "成功邀请好友", current: values.referral_count, required: rule.referrals, unit: "人" },
      ...(rule.teamMembers ? [{ key: "team", label: "小组同行人数", current: values.team_members, required: rule.teamMembers, unit: "人" }] : []),
    ].map((requirement) => ({ ...requirement, met: requirement.current >= requirement.required })) : [];
    return {
      realmId,
      sequence,
      unlocked: Boolean(progress.get(realmId)?.unlocked),
      eligible: realmId === "dawn" || requirements.every((requirement) => requirement.met),
      requirements,
    };
  });
}

async function syncRealmUnlock(email: string) {
  await env.DB.prepare(`
    UPDATE realm_progress SET target = 0, updated_at = CURRENT_TIMESTAMP
    WHERE user_email = ? AND target = 1
  `).bind(email).run();

  for (let attempt = 0; attempt < realmOrder.length - 1; attempt += 1) {
    const gates = await realmGateStatuses(email);
    const next = gates.find((gate) => gate.realmId !== "dawn" && !gate.unlocked);
    if (!next) return;
    await env.DB.prepare(`
      INSERT INTO realm_progress (user_email, realm_id, completed_regions, unlocked, target)
      VALUES (?, ?, 0, 0, 1)
      ON CONFLICT(user_email, realm_id) DO UPDATE SET
        target = 1,
        updated_at = CURRENT_TIMESTAMP
    `).bind(email, next.realmId).run();
    if (!next.eligible) return;
    await env.DB.prepare(`
      UPDATE realm_progress
      SET unlocked = 1, target = 0, unlocked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE user_email = ? AND realm_id = ?
    `).bind(email, next.realmId).run();
  }
}

function validClientDate(value?: string | null) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return new Date().toISOString().slice(0, 10);
  return value!;
}

async function dashboard(email: string, requestedClientDate?: string | null) {
  const db = env.DB;
  const clientDate = validClientDate(requestedClientDate);
  await syncRealmUnlock(email);
  const user = await db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<UserRow>();
  const quests = await db.prepare(`
    SELECT id, title, detail, type, reward, source, due_at AS dueAt,
      CASE WHEN instr(created_at, 'T') > 0
        THEN created_at ELSE replace(created_at, ' ', 'T') || 'Z' END AS createdAt,
      CASE WHEN completed_at IS NULL THEN NULL
        WHEN instr(completed_at, 'T') > 0 THEN completed_at
        ELSE replace(completed_at, ' ', 'T') || 'Z' END AS completedAt,
      completed AS done
    FROM quests WHERE user_email = ?
    ORDER BY CASE WHEN due_at IS NULL THEN 1 ELSE 0 END, due_at, id
  `).bind(email).all();
  const questActivity = await db.prepare(`
    SELECT completed_date AS date, COUNT(*) AS count
    FROM quest_completions WHERE user_email = ?
    GROUP BY completed_date ORDER BY completed_date
  `).bind(email).all();
  const questCompletionTotal = await db.prepare(`
    SELECT COUNT(*) AS count FROM quest_completions WHERE user_email = ?
  `).bind(email).first<{ count: number }>();
  const recentQuestCompletions = await db.prepare(`
    SELECT id, quest_title AS title, reward,
      CASE WHEN instr(completed_at, 'T') > 0
        THEN completed_at ELSE replace(completed_at, ' ', 'T') || 'Z' END AS completedAt
    FROM quest_completions WHERE user_email = ?
    ORDER BY id DESC LIMIT 5
  `).bind(email).all();
  const team = await db.prepare(`
    SELECT t.id, t.name, t.code, t.owner_email,
      (SELECT COUNT(*) FROM team_members tm2 WHERE tm2.team_id = t.id) AS member_count
    FROM teams t JOIN team_members tm ON tm.team_id = t.id
    WHERE tm.user_email = ?
  `).bind(email).first();
  const members = team ? await db.prepare(`
    SELECT u.display_name, u.email, u.xp, u.focus_minutes,
      (u.xp + u.focus_minutes * 2) AS strength
    FROM team_members tm JOIN users u ON u.email = tm.user_email
    WHERE tm.team_id = ? ORDER BY strength DESC
  `).bind(team.id).all() : { results: [] };
  const leaderboard = await db.prepare(`
    SELECT t.id, t.name, t.code, COUNT(tm.user_email) AS members,
      SUM(u.xp + u.focus_minutes * 2) AS strength,
      SUM(u.focus_minutes) AS focus_minutes
    FROM teams t
    JOIN team_members tm ON tm.team_id = t.id
    JOIN users u ON u.email = tm.user_email
    GROUP BY t.id ORDER BY strength DESC, focus_minutes DESC LIMIT 50
  `).all();
  const referralCount = await db.prepare("SELECT COUNT(*) AS count FROM referrals WHERE referrer_email = ?")
    .bind(email).first<{ count: number }>();
  const focusHistory = await db.prepare(`
    SELECT id, minutes, created_at FROM focus_sessions
    WHERE user_email = ? ORDER BY id DESC LIMIT 10
  `).bind(email).all();
  const todayFocus = await db.prepare(`
    SELECT COALESCE(SUM(minutes), 0) AS minutes
    FROM focus_sessions
    WHERE user_email = ?
      AND (completed_date = ? OR (completed_date IS NULL AND substr(created_at, 1, 10) = ?))
  `).bind(email, clientDate, clientDate).first<{ minutes: number }>();
  const inventory = await db.prepare(`
    SELECT item_key, quantity, acquired_at FROM inventory
    WHERE user_email = ? ORDER BY acquired_at DESC
  `).bind(email).all();
  const realmProgress = await db.prepare(`
    SELECT realm_id AS realmId, completed_regions AS completedRegions,
      unlocked, target, unlocked_at AS unlockedAt
    FROM realm_progress WHERE user_email = ?
    ORDER BY unlocked DESC, updated_at
  `).bind(email).all();
  const realmGates = await realmGateStatuses(email);
  const calendarAccess = await getCalendarAccess(email);
  const premiumProgram = await getPremiumProgram(email);
  const calendarConnection = await db.prepare(`
    SELECT google_email AS googleEmail, last_synced_at AS lastSyncedAt, connected_at AS connectedAt
    FROM google_calendar_connections WHERE user_email = ?
  `).bind(email).first<{ googleEmail: string | null; lastSyncedAt: string | null; connectedAt: string }>();

  return {
    user: {
      email: user?.email,
      name: user?.display_name,
      inviteCode: user?.invite_code,
      invitedBy: user?.invited_by,
      xp: user?.xp ?? 0,
      coins: user?.coins ?? 0,
      focusMinutes: user?.focus_minutes ?? 0,
      referralCount: referralCount?.count ?? 0,
    },
    quests: quests.results,
    questActivity: questActivity.results,
    questCompletionTotal: questCompletionTotal?.count ?? 0,
    recentQuestCompletions: recentQuestCompletions.results,
    focusHistory: focusHistory.results,
    todayFocusMinutes: Number(todayFocus?.minutes ?? 0),
    inventory: inventory.results,
    realmProgress: realmProgress.results,
    realmGates,
    calendarAccess,
    premiumProgram,
    calendarConnection: calendarConnection
      ? { connected: true, googleEmail: calendarConnection.googleEmail, lastSyncedAt: calendarConnection.lastSyncedAt }
      : { connected: false, googleEmail: null, lastSyncedAt: null },
    team: team ? { ...team, members: members.results } : null,
    leaderboard: leaderboard.results,
  };
}

export async function GET(request: Request) {
  try {
    const identity = await currentUser(request);
    if (!identity) return Response.json({ error: "请先登录" }, { status: 401 });
    const clientDate = new URL(request.url).searchParams.get("clientDate");
    return Response.json(await dashboard(identity.email, clientDate));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "读取失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const identity = await currentUser(request);
    if (!identity) return Response.json({ error: "请先登录" }, { status: 401 });
    const body = await request.json() as {
      action?: string;
      questId?: number;
      questIds?: number[];
      minutes?: number;
      code?: string;
      name?: string;
      title?: string;
      detail?: string;
      type?: string;
      itemKey?: string;
      price?: number;
      calendarUrl?: string;
      calendarText?: string;
      provider?: string;
      rangeDays?: number;
      realmId?: string;
      regionIndex?: number;
      criteriaConfirmed?: number[];
      clientDate?: string;
      premiumEmails?: string[];
    };
    const db = env.DB;

    if (body.action === "updatePremiumFreeSlots") {
      await updatePremiumFreeSlots(identity.email, Array.isArray(body.premiumEmails) ? body.premiumEmails : []);
    } else if (body.action === "completeRealmTask") {
      const realmId = body.realmId ?? "";
      const rule = realmRules[realmId];
      if (!rule) return Response.json({ error: "大陆不存在" }, { status: 404 });
      const criteriaConfirmed = Array.isArray(body.criteriaConfirmed)
        ? [...new Set(body.criteriaConfirmed.map(Number))].sort((left, right) => left - right)
        : [];
      if (criteriaConfirmed.join(",") !== "0,1,2") {
        return Response.json({ error: "请逐项确认三条完成标准后再提交大陆任务" }, { status: 400 });
      }
      const progress = await db.prepare(`
        SELECT completed_regions, unlocked FROM realm_progress
        WHERE user_email = ? AND realm_id = ?
      `).bind(identity.email, realmId).first<{ completed_regions: number; unlocked: number }>();
      if (!progress?.unlocked) return Response.json({ error: "该大陆尚未解锁" }, { status: 400 });
      const regionIndex = Math.max(0, Math.min(2, Number(body.regionIndex) || 0));
      if (regionIndex < progress.completed_regions) {
        return Response.json({ error: "这项大陆任务已经完成" }, { status: 400 });
      }
      if (regionIndex > progress.completed_regions) {
        return Response.json({ error: "请按顺序完成大陆任务" }, { status: 400 });
      }
      await db.batch([
        db.prepare(`
          UPDATE realm_progress
          SET completed_regions = completed_regions + 1, updated_at = CURRENT_TIMESTAMP
          WHERE user_email = ? AND realm_id = ? AND completed_regions = ?
        `).bind(identity.email, realmId, regionIndex),
        db.prepare("UPDATE users SET xp = xp + ?, coins = coins + ? WHERE email = ?")
          .bind(rule.taskReward, Math.ceil(rule.taskReward / 2), identity.email),
      ]);
    } else if (body.action === "chooseRealmTarget") {
      return Response.json({ error: "大陆按照固定远征顺序解锁，请完成当前系统门槛" }, { status: 400 });
    } else if (body.action === "completeQuest") {
      const quest = await db.prepare(
        "SELECT reward, completed FROM quests WHERE id = ? AND user_email = ?",
      ).bind(body.questId, identity.email).first<{ reward: number; completed: number }>();
      if (!quest) return Response.json({ error: "任务不存在" }, { status: 404 });
      if (!quest.completed) {
        const completedDate = /^\d{4}-\d{2}-\d{2}$/.test(body.clientDate ?? "")
          ? body.clientDate!
          : new Date().toISOString().slice(0, 10);
        await db.batch([
          db.prepare("UPDATE quests SET completed = 1, completed_at = CURRENT_TIMESTAMP WHERE id = ? AND user_email = ?").bind(body.questId, identity.email),
          db.prepare(`
            INSERT OR IGNORE INTO quest_completions
              (user_email, quest_id, quest_title, reward, source, completed_date)
            SELECT user_email, id, title, reward, source, ?
            FROM quests WHERE id = ? AND user_email = ?
          `).bind(completedDate, body.questId, identity.email),
          db.prepare("UPDATE users SET xp = xp + ?, coins = coins + ? WHERE email = ?")
            .bind(quest.reward, Math.ceil(quest.reward / 2), identity.email),
        ]);
      }
    } else if (body.action === "editQuest") {
      const title = (body.title ?? "").trim().slice(0, 80);
      const detail = (body.detail ?? "").trim().slice(0, 180);
      const type = ["主线", "日常", "支线"].includes(body.type ?? "") ? body.type! : "支线";
      if (title.length < 2) return Response.json({ error: "任务名称至少需要 2 个字" }, { status: 400 });
      const quest = await db.prepare("SELECT 1 FROM quests WHERE id = ? AND user_email = ?")
        .bind(body.questId, identity.email).first();
      if (!quest) return Response.json({ error: "任务不存在" }, { status: 404 });
      await db.prepare(`
        UPDATE quests SET title = ?, detail = ?, type = ?
        WHERE id = ? AND user_email = ?
      `).bind(title, detail || "由旅行者亲自整理的任务说明", type, body.questId, identity.email).run();
    } else if (body.action === "deleteQuest") {
      const quest = await db.prepare("SELECT 1 FROM quests WHERE id = ? AND user_email = ?")
        .bind(body.questId, identity.email).first();
      if (!quest) return Response.json({ error: "任务不存在" }, { status: 404 });
      await db.prepare("DELETE FROM quests WHERE id = ? AND user_email = ?")
        .bind(body.questId, identity.email).run();
    } else if (body.action === "batchDeleteQuests") {
      const questIds = Array.isArray(body.questIds)
        ? [...new Set(body.questIds.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))].slice(0, 100)
        : [];
      if (!questIds.length) return Response.json({ error: "请至少选择一个任务" }, { status: 400 });
      const placeholders = questIds.map(() => "?").join(",");
      const owned = await db.prepare(`
        SELECT id FROM quests WHERE user_email = ? AND id IN (${placeholders})
      `).bind(identity.email, ...questIds).all<{ id: number }>();
      if (owned.results.length !== questIds.length) {
        return Response.json({ error: "选中的任务中包含不存在或无权操作的记录" }, { status: 403 });
      }
      await db.prepare(`
        DELETE FROM quests WHERE user_email = ? AND id IN (${placeholders})
      `).bind(identity.email, ...questIds).run();
    } else if (body.action === "createQuest") {
      const title = (body.title ?? "").trim().slice(0, 40);
      const detail = (body.detail ?? "").trim().slice(0, 100);
      const type = ["主线", "日常", "支线"].includes(body.type ?? "") ? body.type : "支线";
      if (title.length < 2) return Response.json({ error: "任务名称至少需要 2 个字" }, { status: 400 });
      const reward = type === "主线" ? 80 : type === "日常" ? 30 : 45;
      await db.prepare("INSERT INTO quests (user_email, title, detail, type, reward) VALUES (?, ?, ?, ?, ?)")
        .bind(identity.email, title, detail || "由旅行者亲自制定的冒险委托", type, reward).run();
    } else if (body.action === "claimCalendarLevelReward") {
      await claimLevel100CalendarReward(identity.email);
    } else if (body.action === "syncGoogleCalendar") {
      await syncGoogleCalendar(identity.email, body.clientDate);
    } else if (body.action === "disconnectGoogleCalendar") {
      await db.prepare("DELETE FROM google_calendar_connections WHERE user_email = ?")
        .bind(identity.email).run();
    } else if (body.action === "importCalendar") {
      const provider = ["google", "outlook", "icloud", "ics"].includes(body.provider ?? "") ? body.provider! : "ics";
      const rangeDays = Math.max(1, Math.min(30, Number(body.rangeDays) || 7));
      let calendarText = (body.calendarText ?? "").trim();
      if (!calendarText && body.calendarUrl) {
        const source = calendarUrl(body.calendarUrl);
        const response = await fetch(source, {
          redirect: "follow",
          headers: { Accept: "text/calendar,text/plain;q=0.9,*/*;q=0.1" },
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) throw new Error("无法读取日历链接，请确认已经开启公开/私密订阅");
        const declaredSize = Number(response.headers.get("content-length") || 0);
        if (declaredSize > 1_500_000) throw new Error("日历文件过大，请缩短导出范围后重试");
        calendarText = await response.text();
      }
      if (calendarText.length > 1_500_000) throw new Error("日历文件过大，请缩短导出范围后重试");
      if (!calendarText.includes("BEGIN:VCALENDAR")) {
        return Response.json({ error: "没有识别到有效的 .ics 日历内容" }, { status: 400 });
      }
      const events = parseCalendar(calendarText, rangeDays, body.clientDate);
      if (!events.length) {
        return Response.json({ error: `未来 ${rangeDays} 天没有可导入的日程` }, { status: 400 });
      }
      const results = await db.batch(events.map((event) => {
        const moment = new Date(event.dueAt);
        const time = event.dueAt.length === 10
          ? "全天"
          : moment.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
        const detail = [time, event.location, event.description].filter(Boolean).join(" · ").slice(0, 180);
        return db.prepare(`
          INSERT OR IGNORE INTO quests
            (user_email, title, detail, type, reward, source, due_at, external_id)
          VALUES (?, ?, ?, '日常', 30, ?, ?, ?)
        `).bind(identity.email, event.title.slice(0, 80), detail || "来自日历的云端日程", provider, event.dueAt, event.uid);
      }));
      const imported = results.reduce((total, result) => total + Number(result.meta.changes || 0), 0);
      return Response.json({ ...(await dashboard(identity.email, body.clientDate)), lastImportCount: imported });
    } else if (body.action === "focus") {
      const minutes = Math.max(1, Math.min(180, Number(body.minutes) || 25));
      await db.batch([
        db.prepare("INSERT INTO focus_sessions (user_email, minutes, completed_date) VALUES (?, ?, ?)")
          .bind(identity.email, minutes, validClientDate(body.clientDate)),
        db.prepare("UPDATE users SET focus_minutes = focus_minutes + ?, xp = xp + ?, coins = coins + ? WHERE email = ?")
          .bind(minutes, minutes * 2, Math.ceil(minutes / 2), identity.email),
      ]);
    } else if (body.action === "buyItem") {
      const catalog: Record<string, { price: number }> = {
        "rest-pass": { price: 80 },
        "movie-night": { price: 120 },
        "wish-tea": { price: 60 },
        "adventure-day": { price: 260 },
      };
      const item = catalog[body.itemKey ?? ""];
      if (!item) return Response.json({ error: "奖励不存在" }, { status: 404 });
      const balance = await db.prepare("SELECT coins FROM users WHERE email = ?").bind(identity.email).first<{ coins: number }>();
      if ((balance?.coins ?? 0) < item.price) return Response.json({ error: "星辉不足，完成更多任务后再来吧" }, { status: 400 });
      await db.batch([
        db.prepare("UPDATE users SET coins = coins - ? WHERE email = ?").bind(item.price, identity.email),
        db.prepare(`
          INSERT INTO inventory (user_email, item_key, quantity) VALUES (?, ?, 1)
          ON CONFLICT(user_email, item_key) DO UPDATE SET quantity = quantity + 1, acquired_at = CURRENT_TIMESTAMP
        `).bind(identity.email, body.itemKey),
      ]);
    } else if (body.action === "redeemInvite") {
      const code = (body.code ?? "").trim().toUpperCase();
      const me = await db.prepare("SELECT invite_code, invited_by FROM users WHERE email = ?")
        .bind(identity.email).first<{ invite_code: string; invited_by: string | null }>();
      if (!code || code === me?.invite_code) return Response.json({ error: "不能使用自己的邀请码" }, { status: 400 });
      if (me?.invited_by) return Response.json({ error: "你已经绑定过邀请人" }, { status: 400 });
      const inviter = await db.prepare("SELECT email FROM users WHERE invite_code = ?").bind(code).first<{ email: string }>();
      if (!inviter) return Response.json({ error: "邀请码不存在" }, { status: 404 });
      await db.batch([
        db.prepare("INSERT INTO referrals (referrer_email, invitee_email) VALUES (?, ?)").bind(inviter.email, identity.email),
        db.prepare("UPDATE users SET invited_by = ?, xp = xp + 100, coins = coins + 80 WHERE email = ?").bind(inviter.email, identity.email),
        db.prepare("UPDATE users SET xp = xp + 200, coins = coins + 120 WHERE email = ?").bind(inviter.email),
      ]);
    } else if (body.action === "createTeam") {
      const name = (body.name ?? "").trim().slice(0, 16);
      if (name.length < 2) return Response.json({ error: "小组名称至少需要 2 个字" }, { status: 400 });
      const exists = await db.prepare("SELECT 1 FROM team_members WHERE user_email = ?").bind(identity.email).first();
      if (exists) return Response.json({ error: "你已经加入了一个小组" }, { status: 400 });
      const code = makeCode("TEAM", `${identity.email}-${Date.now()}`);
      const created = await db.prepare("INSERT INTO teams (name, code, owner_email) VALUES (?, ?, ?) RETURNING id")
        .bind(name, code, identity.email).first<{ id: number }>();
      await db.prepare("INSERT INTO team_members (team_id, user_email) VALUES (?, ?)").bind(created?.id, identity.email).run();
    } else if (body.action === "joinTeam") {
      const code = (body.code ?? "").trim().toUpperCase();
      const exists = await db.prepare("SELECT 1 FROM team_members WHERE user_email = ?").bind(identity.email).first();
      if (exists) return Response.json({ error: "你已经加入了一个小组" }, { status: 400 });
      const team = await db.prepare(`
        SELECT t.id, COUNT(tm.user_email) AS members FROM teams t
        LEFT JOIN team_members tm ON tm.team_id = t.id WHERE t.code = ? GROUP BY t.id
      `).bind(code).first<{ id: number; members: number }>();
      if (!team) return Response.json({ error: "小组口令不存在" }, { status: 404 });
      if (team.members >= 5) return Response.json({ error: "该小组已经满员（最多 5 人）" }, { status: 400 });
      await db.prepare("INSERT INTO team_members (team_id, user_email) VALUES (?, ?)").bind(team.id, identity.email).run();
    } else {
      return Response.json({ error: "未知操作" }, { status: 400 });
    }

    return Response.json(await dashboard(identity.email, body.clientDate));
  } catch (error) {
    const message = error instanceof Error ? error.message : "操作失败";
    return Response.json({ error: message.includes("UNIQUE") ? "该操作已经完成" : message }, { status: 500 });
  }
}
