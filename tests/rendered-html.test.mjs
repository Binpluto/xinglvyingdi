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
  const [client, route] = await Promise.all([
    readFile(new URL("app/GameClient.tsx", root), "utf8"),
    readFile(new URL("app/api/game/route.ts", root), "utf8"),
  ]);

  assert.match(route, /replace\(created_at, ' ', 'T'\) \|\| 'Z' END AS createdAt/);
  assert.match(client, /const todayRelevantQuests/);
  assert.match(client, /taskDate === today \|\| \(taskDate < today && !quest\.done\)/);
  assert.match(client, /const sortQuests/);
  assert.match(client, /questTaskDateKey\(quest\) === today \? 0/);
  assert.match(client, /quest\.done \? 3/);
  assert.match(client, /data = \{ \.\.\.data, quests: boardQuests \}/);
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

test("enforces sequential high-difficulty continent promotion gates", async () => {
  const [client, route, schema, migration] = await Promise.all([
    readFile(new URL("app/GameClient.tsx", root), "utf8"),
    readFile(new URL("app/api/game/route.ts", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("drizzle/0004_misty_mystique.sql", root), "utf8"),
  ]);

  assert.match(client, /初始大陆 · 默认解锁/);
  assert.doesNotMatch(client, /选择为下一大陆/);
  assert.match(client, /xpRequired: 11000/);
  assert.match(client, /逐境完成高阶解锁门槛/);
  assert.match(client, /仅有 EXP 达标不会解锁/);
  assert.match(client, /realmGates/);
  assert.match(route, /completeRealmTask/);
  assert.match(client, /确认全部达成并领取/);
  assert.match(client, /完成标准必须真实完成并逐项确认|必须真实完成并逐项确认/);
  assert.match(client, /criteriaConfirmed/);
  assert.match(route, /criteriaConfirmed\.join\(","\) !== "0,1,2"/);
  assert.match(route, /请逐项确认三条完成标准/);
  assert.match(route, /const realmOrder = \["dawn", "crown", "ember", "storm", "verdant", "coral", "polar"\]/);
  assert.match(route, /completedQuests: 90/);
  assert.match(route, /referrals: 10/);
  assert.match(route, /teamMembers: 5/);
  assert.match(route, /成功邀请好友/);
  assert.match(route, /大陆按照固定远征顺序解锁/);
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

test("offers focus completion alerts and three generated white-noise scenes", async () => {
  const [client, css] = await Promise.all([
    readFile(new URL("app/GameClient.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);

  assert.match(client, /new AudioContext\(\)/);
  assert.match(client, /createAmbientSession/);
  assert.match(client, /星雨/);
  assert.match(client, /篝火/);
  assert.match(client, /潮汐/);
  assert.match(client, /弹窗 \+ 提示音/);
  assert.match(client, /仅弹窗/);
  assert.match(client, /仅提示音/);
  assert.match(client, /静默结束/);
  assert.match(client, /starcamp-focus-alert/);
  assert.match(client, /starcamp-focus-ambient/);
  assert.match(client, /focus-complete-dialog/);
  assert.match(css, /\.ambient-options/);
  assert.match(css, /\.focus-complete-backdrop/);
});

test("tracks durable task completions in a calendar activity map", async () => {
  const [client, css, route, schema, migration] = await Promise.all([
    readFile(new URL("app/GameClient.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("app/api/game/route.ts", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("drizzle/0006_dusty_zarek.sql", root), "utf8"),
  ]);

  assert.match(client, /TaskCompletionMap/);
  assert.match(client, /完成任务量/);
  assert.match(client, /累计完成/);
  assert.match(client, /活跃天数/);
  assert.match(client, /连续天数/);
  assert.match(client, /weekCount = 18/);
  assert.match(client, /activity-cell level-/);
  assert.match(css, /\.task-activity/);
  assert.match(css, /\.activity-weeks/);
  assert.match(route, /completed_at = CURRENT_TIMESTAMP/);
  assert.match(route, /AS completedAt/);
  assert.match(schema, /completedAt: text\("completed_at"\)/);
  assert.match(migration, /ADD `completed_at`/);
  assert.match(migration, /UPDATE `quests` SET `completed_at` = `created_at`/);
});

test("supports secure batch selection and deletion of quests", async () => {
  const [client, css, route] = await Promise.all([
    readFile(new URL("app/GameClient.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("app/api/game/route.ts", root), "utf8"),
  ]);

  assert.match(client, /批量管理/);
  assert.match(client, /全选当前/);
  assert.match(client, /删除选中/);
  assert.match(client, /selectedQuestIds/);
  assert.match(client, /batchDeleteQuests/);
  assert.match(client, /确定删除选中的/);
  assert.match(css, /\.quest-bulk-bar/);
  assert.match(css, /\.quest-select\.selected/);
  assert.match(route, /body\.action === "batchDeleteQuests"/);
  assert.match(route, /\.slice\(0, 100\)/);
  assert.match(route, /owned\.results\.length !== questIds\.length/);
  assert.match(route, /DELETE FROM quests WHERE user_email = \? AND id IN/);
});

test("celebrates every 50-level milestone without repeating dismissed popups", async () => {
  const [client, css] = await Promise.all([
    readFile(new URL("app/GameClient.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);

  assert.match(client, /milestoneCopy/);
  assert.match(client, /Math\.floor\(currentLevel \/ 50\) \* 50/);
  assert.match(client, /reachedMilestone < 50/);
  assert.match(client, /reachedMilestone > lastCelebrated/);
  assert.match(client, /starcamp-level-milestone:/);
  assert.match(client, /等级里程碑/);
  assert.match(client, /下一里程碑/);
  assert.match(client, /继续远征/);
  assert.match(client, /level-milestone-backdrop/);
  assert.match(css, /\.level-milestone-card/);
  assert.match(css, /milestone-arrive/);
  assert.match(css, /prefers-reduced-motion/);
});
