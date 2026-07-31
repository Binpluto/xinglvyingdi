import { env } from "cloudflare:workers";
import { requireCalendarAccess } from "./calendar-access";

type RuntimeEnv = {
  DB: D1Database;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_TOKEN_KEY?: string;
};

type ConnectionRow = {
  user_email: string;
  refresh_token: string;
  google_email: string | null;
  sync_token: string | null;
  last_synced_at: string | null;
};

type GoogleEvent = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
};

type GoogleEventsResponse = {
  items?: GoogleEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
  error?: { message?: string };
};

const encoder = new TextEncoder();

function runtime() {
  return env as unknown as RuntimeEnv;
}

function config() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_TOKEN_KEY } = runtime();
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_TOKEN_KEY) {
    throw new Error("Google 日历连接尚未完成配置");
  }
  return { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET, tokenKey: GOOGLE_TOKEN_KEY };
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function encryptionKey() {
  const raw = fromBase64Url(config().tokenKey);
  if (raw.length !== 32) throw new Error("Google 日历加密密钥配置无效");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptRefreshToken(token: string, email: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(email) },
    await encryptionKey(),
    encoder.encode(token),
  );
  return `${base64Url(iv)}.${base64Url(new Uint8Array(encrypted))}`;
}

async function decryptRefreshToken(value: string, email: string) {
  const [iv, encrypted] = value.split(".");
  if (!iv || !encrypted) throw new Error("Google 日历授权信息无效，请重新连接");
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(iv), additionalData: encoder.encode(email) },
    await encryptionKey(),
    fromBase64Url(encrypted),
  );
  return new TextDecoder().decode(decrypted);
}

export function googleRedirectUri(request: Request) {
  return `${new URL(request.url).origin}/api/google-calendar/callback`;
}

export function googleAuthorizationUrl(request: Request, state: string, loginHint: string) {
  const { clientId } = config();
  const query = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(request),
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: "https://www.googleapis.com/auth/calendar.readonly",
    state,
    login_hint: loginHint,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${query}`;
}

export async function exchangeAuthorizationCode(request: Request, code: string) {
  const { clientId, clientSecret } = config();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: googleRedirectUri(request),
    }),
  });
  const result = await response.json() as { refresh_token?: string; access_token?: string; error_description?: string };
  if (!response.ok || !result.refresh_token || !result.access_token) {
    throw new Error(result.error_description || "Google 授权未完成，请重试");
  }
  return result;
}

async function accessToken(refreshToken: string) {
  const { clientId, clientSecret } = config();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const result = await response.json() as { access_token?: string; error_description?: string };
  if (!response.ok || !result.access_token) {
    throw new Error(result.error_description || "Google 授权已失效，请重新连接");
  }
  return result.access_token;
}

export async function googleCalendarIdentity(token: string) {
  const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = await response.json() as { id?: string; summary?: string; error?: { message?: string } };
  if (!response.ok) throw new Error(result.error?.message || "无法读取 Google 主日历");
  return result.id || result.summary || "Google Calendar";
}

function eventDueAt(event: GoogleEvent) {
  return event.start?.dateTime || event.start?.date || "";
}

function eventDetail(event: GoogleEvent) {
  const dueAt = eventDueAt(event);
  const moment = dueAt && dueAt.length > 10 ? new Date(dueAt) : null;
  const time = dueAt.length === 10
    ? "全天"
    : moment && !Number.isNaN(moment.getTime())
      ? moment.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
      : "";
  return [time, event.location, event.description].filter(Boolean).join(" · ").slice(0, 180) || "来自 Google 日历的同步日程";
}

async function applyEvents(email: string, events: GoogleEvent[]) {
  const statements = events.flatMap((event) => {
    if (!event.id) return [];
    if (event.status === "cancelled") {
      return [runtime().DB.prepare(`
        DELETE FROM quests WHERE user_email = ? AND source = 'google-sync' AND external_id = ?
      `).bind(email, event.id)];
    }
    const dueAt = eventDueAt(event);
    if (!dueAt) return [];
    return [runtime().DB.prepare(`
      INSERT INTO quests (user_email, title, detail, type, reward, source, due_at, external_id)
      VALUES (?, ?, ?, '日常', 30, 'google-sync', ?, ?)
      ON CONFLICT(user_email, source, external_id) DO UPDATE SET
        title = excluded.title,
        detail = excluded.detail,
        due_at = excluded.due_at
    `).bind(email, (event.summary || "未命名日程").slice(0, 80), eventDetail(event), dueAt, event.id)];
  });
  for (let index = 0; index < statements.length; index += 75) {
    await runtime().DB.batch(statements.slice(index, index + 75));
  }
}

async function fetchChanges(token: string, syncToken: string | null) {
  const events: GoogleEvent[] = [];
  let pageToken = "";
  let nextSyncToken = "";
  do {
    const query = new URLSearchParams({
      singleEvents: "true",
      showDeleted: "true",
      maxResults: "2500",
    });
    if (syncToken) query.set("syncToken", syncToken);
    else {
      query.set("timeMin", new Date(Date.now() - 30 * 86400000).toISOString());
      query.set("timeMax", new Date(Date.now() + 180 * 86400000).toISOString());
    }
    if (pageToken) query.set("pageToken", pageToken);
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 410) return { invalidSyncToken: true, events: [], nextSyncToken: "" };
    const result = await response.json() as GoogleEventsResponse;
    if (!response.ok) throw new Error(result.error?.message || "读取 Google 日历失败");
    events.push(...(result.items || []));
    pageToken = result.nextPageToken || "";
    nextSyncToken = result.nextSyncToken || nextSyncToken;
  } while (pageToken);
  return { invalidSyncToken: false, events, nextSyncToken };
}

export async function syncGoogleCalendar(email: string) {
  await requireCalendarAccess(email);
  const connection = await runtime().DB.prepare(`
    SELECT user_email, refresh_token, google_email, sync_token, last_synced_at
    FROM google_calendar_connections WHERE user_email = ?
  `).bind(email).first<ConnectionRow>();
  if (!connection) throw new Error("请先连接 Google 日历");
  const token = await accessToken(await decryptRefreshToken(connection.refresh_token, email));
  let changes = await fetchChanges(token, connection.sync_token);
  if (changes.invalidSyncToken) {
    await runtime().DB.prepare(`
      DELETE FROM quests WHERE user_email = ? AND source = 'google-sync' AND completed = 0
    `).bind(email).run();
    changes = await fetchChanges(token, null);
  }
  await applyEvents(email, changes.events);
  await runtime().DB.prepare(`
    UPDATE google_calendar_connections
    SET sync_token = ?, last_synced_at = CURRENT_TIMESTAMP
    WHERE user_email = ?
  `).bind(changes.nextSyncToken || connection.sync_token, email).run();
  return changes.events.length;
}
