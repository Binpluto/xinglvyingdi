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

test("calendar synchronization imports only the sync date and future tasks", async () => {
  const [client, helper, connectRoute, callbackRoute, gameRoute] = await Promise.all([
    readFile(new URL("app/GameClient.tsx", root), "utf8"),
    readFile(new URL("app/google-calendar.ts", root), "utf8"),
    readFile(new URL("app/api/google-calendar/connect/route.ts", root), "utf8"),
    readFile(new URL("app/api/google-calendar/callback/route.ts", root), "utf8"),
    readFile(new URL("app/api/game/route.ts", root), "utf8"),
  ]);

  assert.match(client, /\/api\/google-calendar\/connect\?from=/);
  assert.match(client, /只同步当天及未来日程/);
  assert.match(helper, /isOnOrAfterSyncDate/);
  assert.match(helper, /googleQueryStart\(syncFromDate\)/);
  assert.match(helper, /applyEvents\(email, changes\.events, syncFromDate\)/);
  assert.doesNotMatch(helper, /Date\.now\(\) - 30 \* 86400000/);
  assert.match(connectRoute, /stateToken\(syncFromDate\)/);
  assert.match(callbackRoute, /syncGoogleCalendar\(identity\.email, syncFromDate\)/);
  assert.match(gameRoute, /parseCalendar\(calendarText, rangeDays, body\.clientDate\)/);
});

test("gates live calendar binding behind a seven-day trial and paid passes", async () => {
  const [client, access, connectRoute, checkoutRoute, webhookRoute, googleHelper, gameRoute, schema, migration, billingMigration] = await Promise.all([
    readFile(new URL("app/GameClient.tsx", root), "utf8"),
    readFile(new URL("app/calendar-access.ts", root), "utf8"),
    readFile(new URL("app/api/google-calendar/connect/route.ts", root), "utf8"),
    readFile(new URL("app/api/billing/calendar-checkout/route.ts", root), "utf8"),
    readFile(new URL("app/api/billing/waffo-webhook/route.ts", root), "utf8"),
    readFile(new URL("app/google-calendar.ts", root), "utf8"),
    readFile(new URL("app/api/game/route.ts", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("drizzle/0008_rapid_arachne.sql", root), "utf8"),
    readFile(new URL("drizzle/0009_amusing_ender_wiggin.sql", root), "utf8"),
  ]);

  assert.match(client, /先免费体验 7 天/);
  assert.match(client, /price: "HK\$8"/);
  assert.match(client, /price: "HK\$20"/);
  assert.match(client, /price: "HK\$160"/);
  assert.match(client, /由 Waffo 提供安全收款/);
  assert.match(client, /领取 Lv\.100 一年奖励/);
  assert.match(client, /手动上传 ICS 永久免费/);
  assert.match(access, /days: 7/);
  assert.match(access, /days: 30/);
  assert.match(access, /days: 365/);
  assert.match(access, /365 \* DAY_MS/);
  assert.match(access, /levelFromXp\(row\?\.xp \?\? 0\) >= 100/);
  assert.match(connectRoute, /startTrial: true/);
  assert.match(googleHelper, /requireCalendarAccess\(email\)/);
  assert.match(gameRoute, /claimCalendarLevelReward/);
  assert.match(checkoutRoute, /api\.waffo\.ai\/v1\/actions\/checkout\/create-session/);
  assert.match(checkoutRoute, /productType: "onetime"/);
  assert.match(checkoutRoute, /INSERT INTO calendar_checkout_orders/);
  assert.match(webhookRoute, /order\.completed/);
  assert.match(webhookRoute, /x-waffo-signature/);
  assert.match(webhookRoute, /RSASSA-PKCS1-v1_5/);
  assert.match(webhookRoute, /activatePaidCalendarPlan/);
  assert.match(schema, /calendarEntitlements = sqliteTable\("calendar_entitlements"/);
  assert.match(schema, /calendarPayments = sqliteTable\("calendar_payments"/);
  assert.match(schema, /calendarCheckoutOrders = sqliteTable\("calendar_checkout_orders"/);
  assert.match(migration, /CREATE TABLE `calendar_entitlements`/);
  assert.match(migration, /CREATE TABLE `calendar_payments`/);
  assert.match(billingMigration, /CREATE TABLE `calendar_checkout_orders`/);
  assert.match(billingMigration, /calendar_checkout_orders_event_idx/);
});

test("grants and securely manages five founder complimentary premium slots", async () => {
  const [client, access, premium, checkoutRoute, gameRoute, schema, migration, envExample] = await Promise.all([
    readFile(new URL("app/GameClient.tsx", root), "utf8"),
    readFile(new URL("app/calendar-access.ts", root), "utf8"),
    readFile(new URL("app/premium-access.ts", root), "utf8"),
    readFile(new URL("app/api/billing/calendar-checkout/route.ts", root), "utf8"),
    readFile(new URL("app/api/game/route.ts", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("drizzle/0010_long_the_order.sql", root), "utf8"),
    readFile(new URL(".env.example", root), "utf8"),
  ]);

  assert.match(client, /创始免费名额 · 全部付费功能已解锁/);
  assert.match(client, /管理 5 个永久免费名额/);
  assert.match(client, /updatePremiumFreeSlots/);
  assert.match(access, /status: "founder"/);
  assert.match(access, /getPremiumProgram/);
  assert.match(premium, /const MAX_FREE_SLOTS = 5/);
  assert.match(premium, /只有管理员可以管理创始免费名额/);
  assert.match(premium, /同一个邮箱不能重复占用多个免费名额/);
  assert.match(gameRoute, /premiumProgram/);
  assert.match(gameRoute, /updatePremiumFreeSlots/);
  assert.match(checkoutRoute, /创始免费账户已解锁全部付费功能，无需购买/);
  assert.match(schema, /premiumFreeSlots = sqliteTable\("premium_free_slots"/);
  assert.match(migration, /CREATE TABLE `premium_free_slots`/);
  assert.match(migration, /premium_free_slots_email_idx/);
  assert.match(envExample, /PREMIUM_ADMIN_EMAIL=/);
  assert.match(envExample, /PREMIUM_FREE_EMAILS=/);
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
  assert.match(client, /createBuffer\(2,/);
  assert.match(client, /transientTone/);
  assert.match(client, /emberRumble/);
  assert.match(client, /wavePeriod/);
  assert.match(client, /createDynamicsCompressor/);
  assert.match(client, /星雨/);
  assert.match(client, /近窗细雨 · 偶有雨滴/);
  assert.match(client, /篝火/);
  assert.match(client, /木柴爆裂 · 炉火低鸣/);
  assert.match(client, /潮汐/);
  assert.match(client, /远近浪涌 · 泡沫回落/);
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
  const [client, css, route, schema, migration, activityMigration] = await Promise.all([
    readFile(new URL("app/GameClient.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("app/api/game/route.ts", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("drizzle/0006_dusty_zarek.sql", root), "utf8"),
    readFile(new URL("drizzle/0007_wooden_zombie.sql", root), "utf8"),
  ]);

  assert.match(client, /TaskCompletionMap/);
  assert.match(client, /完成任务量/);
  assert.match(client, /累计完成/);
  assert.match(client, /活跃天数/);
  assert.match(client, /连续天数/);
  assert.match(client, /weekCount = 18/);
  assert.match(client, /activity-cell level-/);
  assert.match(client, /taskActivityLevel/);
  assert.match(client, /完成任务越多，格子颜色越深/);
  assert.match(client, /\["0","1","2","3","4\+"\]/);
  assert.match(client, /data-intensity/);
  assert.match(client, /data-date=\{day\.key\}/);
  assert.match(client, /activity-day-tooltip/);
  assert.match(client, /onMouseEnter=\{\(event\) => showActivityTooltip/);
  assert.match(client, /完成 \{activityTooltip\.count\} 项任务/);
  assert.match(client, /role="tooltip"/);
  assert.match(client, /day\.key\.endsWith\("-01"\)/);
  assert.match(client, /firstDayOfMonth \?\? \(weekIndex === 0 \? days\[0\] : null\)/);
  assert.doesNotMatch(client, /Number\(day\.key\.slice\(8, 10\)\) <= 7/);
  assert.match(client, /云端永久记录/);
  assert.match(client, /最近留下的足迹/);
  assert.match(client, /scrollLeft = scroller\.scrollWidth/);
  assert.match(css, /\.task-activity/);
  assert.match(css, /\.activity-weeks/);
  assert.match(css, /\.activity-legend-step/);
  assert.match(css, /\.activity-legend i\.level-4/);
  assert.match(css, /\.activity-day-tooltip/);
  assert.match(css, /\.recent-footprints/);
  assert.match(css, /\.activity-weeks\{display:grid;grid-template-columns:repeat\(18,14px\)/);
  assert.match(css, /\.activity-cell\{display:block;width:14px;height:14px/);
  assert.match(css, /\.activity-months\{grid-column:2;display:grid;grid-template-columns:repeat\(18,14px\)/);
  assert.match(css, /\.activity-chart\{width:max-content;min-width:0/);
  assert.match(route, /completed_at = CURRENT_TIMESTAMP/);
  assert.match(route, /AS completedAt/);
  assert.match(route, /INSERT OR IGNORE INTO quest_completions/);
  assert.match(route, /completed_date AS date/);
  assert.match(route, /questCompletionTotal/);
  assert.match(schema, /completedAt: text\("completed_at"\)/);
  assert.match(schema, /questCompletions = sqliteTable\("quest_completions"/);
  assert.match(migration, /ADD `completed_at`/);
  assert.match(migration, /UPDATE `quests` SET `completed_at` = `created_at`/);
  assert.match(activityMigration, /CREATE TABLE `quest_completions`/);
  assert.match(activityMigration, /INSERT OR IGNORE INTO `quest_completions`/);
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

test("camp energy changes with today's focus time and completed task types", async () => {
  const [client, route, schema, styles] = await Promise.all([
    readFile(new URL("app/GameClient.tsx", root), "utf8"),
    readFile(new URL("app/api/game/route.ts", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);

  assert.match(client, /const QUEST_ENERGY: Record<string, number> = \{ "主线": 20, "支线": 14, "日常": 10 \}/);
  assert.match(client, /Math\.min\(40, Math\.floor\(data\.todayFocusMinutes \/ 2\)\)/);
  assert.match(client, /weather-\$\{energy\.tone\}/);
  assert.match(client, /专注 \{data\.todayFocusMinutes\} 分钟/);
  assert.match(client, /完成 \{energy\.completedToday\} 项任务/);
  assert.match(client, /--energy/);
  assert.match(route, /SUM\(minutes\)/);
  assert.match(route, /completed_date = \?/);
  assert.match(route, /validClientDate\(body\.clientDate\)/);
  assert.match(schema, /focus_sessions_daily_idx/);
  assert.match(styles, /Dynamic camp energy weather/);
  assert.match(styles, /conic-gradient\(var\(--energy-color\) var\(--energy\)/);
});
