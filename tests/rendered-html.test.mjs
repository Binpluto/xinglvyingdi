import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("builds the Starcamp email-authenticated application", async () => {
  const [page, layout, client, authClient, authRoute, authServer] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/GameClient.tsx", root), "utf8"),
    readFile(new URL("app/AuthClient.tsx", root), "utf8"),
    readFile(new URL("app/api/auth/route.ts", root), "utf8"),
    readFile(new URL("app/app-auth.ts", root), "utf8"),
  ]);

  assert.match(layout, /星旅营地｜游戏化人生管理/);
  assert.match(page, /<AuthClient/);
  assert.doesNotMatch(page + client + authClient, /signin-with-chatgpt|signout-with-chatgpt/);
  assert.match(authClient, /邮箱登录/);
  assert.match(authClient, /注册账号/);
  assert.match(authRoute, /registerAccount/);
  assert.match(authServer, /PBKDF2/);
  assert.match(authServer, /PBKDF2_ITERATIONS = 100_000/);
  assert.match(authRoute, /注册暂时未完成，请稍后重试/);
  assert.match(authClient, /使用 8–72 个字符/);
  assert.match(authServer, /HttpOnly; SameSite=Lax/);
  assert.match(client, /云端已同步/);
  assert.match(client, /五人小组/);
  assert.match(client, /世界地图/);
  assert.match(client, /XP_PER_LEVEL = 100/);
  assert.match(client, /从 Lv\.1、0 EXP 开始/);
  assert.match(authServer, /const startingXp = hasExistingJourney \? existingProgress!\.xp : 0/);
  assert.match(client, /levelFromXp/);
  assert.match(await readFile(new URL("app/api/game/route.ts", root), "utf8"), /UPDATE users SET xp = 0/);
  assert.doesNotMatch(client, /Math\.max\(1, Math\.floor\([^)]*xp[^)]*\/ 100\)\)/);
  await access(new URL("dist/server/index.js", root));
});

test("supports secure calendar-to-task imports", async () => {
  const [client, route, schema, migration] = await Promise.all([
    readFile(new URL("app/GameClient.tsx", root), "utf8"),
    readFile(new URL("app/api/game/route.ts", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("drizzle/0002_puzzling_snowbird.sql", root), "utf8"),
  ]);

  assert.match(client, /Google Calendar/);
  assert.match(client, /Outlook \/ Microsoft 365/);
  assert.match(client, /Apple iCloud/);
  assert.match(client, /通用 ICS 文件/);
  assert.match(route, /BEGIN:VCALENDAR/);
  assert.match(route, /INSERT OR IGNORE INTO quests/);
  assert.match(route, /订阅链接不会被保存|calendarUrl/);
  assert.match(schema, /quests_calendar_event_idx/);
  assert.match(migration, /ADD `due_at`/);
  assert.match(migration, /CREATE UNIQUE INDEX `quests_calendar_event_idx`/);
});

test("orders today's unfinished quests first and completed quests last", async () => {
  const client = await readFile(new URL("app/GameClient.tsx", root), "utf8");

  assert.match(client, /const sortQuests/);
  assert.match(client, /questDateKey\(quest\) === today \? 0/);
  assert.match(client, /quest\.done \? 3/);
  assert.match(client, /const visible = sortQuests/);
  assert.match(client, /const calendarAgenda = sortQuests/);
});

test("supports encrypted direct Google Calendar synchronization", async () => {
  const [client, helper, connectRoute, callbackRoute, gameRoute, migration] = await Promise.all([
    readFile(new URL("app/GameClient.tsx", root), "utf8"),
    readFile(new URL("app/google-calendar.ts", root), "utf8"),
    readFile(new URL("app/api/google-calendar/connect/route.ts", root), "utf8"),
    readFile(new URL("app/api/google-calendar/callback/route.ts", root), "utf8"),
    readFile(new URL("app/api/game/route.ts", root), "utf8"),
    readFile(new URL("drizzle/0005_dark_stephen_strange.sql", root), "utf8"),
  ]);

  assert.match(client, /连接 Google 日历/);
  assert.match(client, /每两分钟检查一次变化/);
  assert.match(helper, /calendar\.readonly/);
  assert.match(helper, /AES-GCM/);
  assert.match(helper, /syncToken/);
  assert.match(helper, /google-sync/);
  assert.match(helper, /event\.status === "cancelled"/);
  assert.match(connectRoute, /google_oauth_states/);
  assert.match(callbackRoute, /encryptRefreshToken/);
  assert.match(callbackRoute, /syncGoogleCalendar/);
  assert.match(gameRoute, /disconnectGoogleCalendar/);
  assert.match(migration, /google_calendar_connections/);
  assert.match(migration, /google_oauth_states/);
});

test("applies a distinct full-site theme for every continent", async () => {
  const [client, css] = await Promise.all([
    readFile(new URL("app/GameClient.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);

  for (const realm of ["jade", "blue", "ember", "storm", "forest", "coral", "polar"]) {
    assert.match(client, new RegExp(`style:"${realm}"`));
    assert.match(css, new RegExp(`\\.app-shell\\.realm-${realm}`));
  }
  assert.match(client, /starcamp-active-realm/);
  assert.match(client, /全站环境已切换/);
  assert.match(client, /当前驻扎/);
  assert.match(css, /\.realm-status/);
});

test("renders every continent with a unique silhouette, scale and terrain identity", async () => {
  const [client, css] = await Promise.all([
    readFile(new URL("app/GameClient.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);

  assert.match(client, /terrain terrain-one/);
  assert.match(client, /land-identity/);
  for (const realm of ["dawn", "crown", "ember", "storm", "verdant", "coral", "polar"]) {
    assert.match(css, new RegExp(`\\.continent-${realm}\\{--land-width:`));
    assert.match(css, new RegExp(`\\.continent-${realm} \\.land-shape\\{[^}]*clip-path:`));
  }
  assert.match(css, /\.continent-coral \.land-shape::before/);
  assert.match(css, /\.continent-storm \.terrain-two/);
  assert.match(css, /\.continent-polar \.terrain-three/);
  assert.match(client, /神秘大陆/);
  assert.match(client, /未知领域 · 星雾封锁/);
  assert.match(client, /拓展中/);
  assert.match(css, /\.continent-mystery\{--land-width:/);
  assert.match(css, /@keyframes mystery-drift/);
  assert.match(css, /Harmonized geographic atlas composition/);
  assert.match(css, /\.continent-storm\{left:1%;top:25%\}/);
  assert.match(css, /\.continent-dawn\{right:1%;top:26%\}/);
  assert.match(css, /\.continent-polar\{left:33%;bottom:2%\}/);
  assert.match(css, /@media\(max-width:720px\)\{\.world-map\{min-height:780px\}/);
});

test("persists branching continent progression", async () => {
  const [client, route, schema, migration] = await Promise.all([
    readFile(new URL("app/GameClient.tsx", root), "utf8"),
    readFile(new URL("app/api/game/route.ts", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("drizzle/0004_misty_mystique.sql", root), "utf8"),
  ]);

  assert.match(client, /初始大陆 · 默认解锁/);
  assert.match(client, /选择为下一大陆/);
  assert.match(client, /xpRequired:3300/);
  assert.match(client, /完成当前大陆的 3 项任务后/);
  assert.match(route, /completeRealmTask/);
  assert.match(client, /确认全部达成并领取/);
  assert.match(client, /完成标准必须真实完成并逐项确认|必须真实完成并逐项确认/);
  assert.match(client, /criteriaConfirmed/);
  assert.match(route, /criteriaConfirmed\.join\(","\) !== "0,1,2"/);
  assert.match(route, /请逐项确认三条完成标准/);
  assert.match(route, /chooseRealmTarget/);
  assert.match(route, /INSERT OR IGNORE INTO realm_progress/);
  assert.match(schema, /realmProgress/);
  assert.match(migration, /CREATE TABLE `realm_progress`/);
});

test("allows every daily quest to be edited and deleted securely", async () => {
  const [client, route] = await Promise.all([
    readFile(new URL("app/GameClient.tsx", root), "utf8"),
    readFile(new URL("app/api/game/route.ts", root), "utf8"),
  ]);

  assert.match(client, /编辑任务：/);
  assert.match(client, /保存修改/);
  assert.match(client, /任务内容已更新并保存到云端/);
  assert.match(client, /删除任务/);
  assert.match(client, /window\.confirm/);
  assert.match(route, /body\.action === "editQuest"/);
  assert.match(route, /body\.action === "deleteQuest"/);
  assert.match(route, /DELETE FROM quests WHERE id = \? AND user_email = \?/);
  assert.match(route, /WHERE id = \? AND user_email = \?/);
});
