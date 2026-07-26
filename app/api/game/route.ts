import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

type UserRow = {
  email: string;
  display_name: string;
  invite_code: string;
  invited_by: string | null;
  xp: number;
  coins: number;
  focus_minutes: number;
};

const starterQuests = [
  ["完成晨间仪式", "喝水 · 拉伸 · 写下今日目标", "日常", 30],
  ["推进「理想工作」主线", "完成作品集首页的内容整理", "主线", 80],
  ["知识秘境：深度阅读", "专注阅读 30 分钟并记录三点收获", "支线", 45],
  ["风之小径", "户外散步 20 分钟", "日常", 25],
] as const;

function makeCode(prefix: string, value: string) {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `${prefix}${(hash >>> 0).toString(36).toUpperCase().slice(0, 7)}`;
}

async function currentUser() {
  const identity = await getChatGPTUser();
  if (!identity) return null;
  const db = env.DB;
  const inviteCode = makeCode("STAR", identity.email.toLowerCase());
  await db.prepare(`
    INSERT INTO users (email, display_name, invite_code)
    VALUES (?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET display_name = excluded.display_name
  `).bind(identity.email, identity.displayName, inviteCode).run();

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

async function dashboard(email: string) {
  const db = env.DB;
  const user = await db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<UserRow>();
  const quests = await db.prepare(`
    SELECT id, title, detail, type, reward, completed AS done
    FROM quests WHERE user_email = ? ORDER BY id
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
    team: team ? { ...team, members: members.results } : null,
    leaderboard: leaderboard.results,
  };
}

export async function GET() {
  try {
    const identity = await currentUser();
    if (!identity) return Response.json({ error: "请先登录" }, { status: 401 });
    return Response.json(await dashboard(identity.email));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "读取失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const identity = await currentUser();
    if (!identity) return Response.json({ error: "请先登录" }, { status: 401 });
    const body = await request.json() as { action?: string; questId?: number; minutes?: number; code?: string; name?: string };
    const db = env.DB;

    if (body.action === "completeQuest") {
      const quest = await db.prepare(
        "SELECT reward, completed FROM quests WHERE id = ? AND user_email = ?",
      ).bind(body.questId, identity.email).first<{ reward: number; completed: number }>();
      if (!quest) return Response.json({ error: "任务不存在" }, { status: 404 });
      if (!quest.completed) {
        await db.batch([
          db.prepare("UPDATE quests SET completed = 1 WHERE id = ? AND user_email = ?").bind(body.questId, identity.email),
          db.prepare("UPDATE users SET xp = xp + ?, coins = coins + ? WHERE email = ?")
            .bind(quest.reward, Math.ceil(quest.reward / 2), identity.email),
        ]);
      }
    } else if (body.action === "focus") {
      const minutes = Math.max(1, Math.min(180, Number(body.minutes) || 25));
      await db.batch([
        db.prepare("INSERT INTO focus_sessions (user_email, minutes) VALUES (?, ?)").bind(identity.email, minutes),
        db.prepare("UPDATE users SET focus_minutes = focus_minutes + ?, xp = xp + ?, coins = coins + ? WHERE email = ?")
          .bind(minutes, minutes * 2, Math.ceil(minutes / 2), identity.email),
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

    return Response.json(await dashboard(identity.email));
  } catch (error) {
    const message = error instanceof Error ? error.message : "操作失败";
    return Response.json({ error: message.includes("UNIQUE") ? "该操作已经完成" : message }, { status: 500 });
  }
}
