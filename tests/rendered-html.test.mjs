import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("builds the Starcamp authenticated application", async () => {
  const [page, layout, client] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/GameClient.tsx", root), "utf8"),
  ]);

  assert.match(layout, /星旅营地｜游戏化人生管理/);
  assert.match(page, /使用邮箱登录 \/ 注册/);
  assert.match(page, /<GameClient/);
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
