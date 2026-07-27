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
  assert.match(authServer, /HttpOnly; SameSite=Lax/);
  assert.match(client, /云端已同步/);
  assert.match(client, /五人小组/);
  assert.match(client, /世界地图/);
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
