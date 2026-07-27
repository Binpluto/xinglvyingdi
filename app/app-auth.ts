import { env } from "cloudflare:workers";

const SESSION_COOKIE = "starcamp_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;
// Cloudflare Workers caps a single PBKDF2 operation at 100,000 iterations.
const PBKDF2_ITERATIONS = 100_000;
const encoder = new TextEncoder();

type AccountRow = {
  email: string;
  display_name: string;
  password_hash: string;
  password_salt: string;
  failed_attempts: number;
  locked_until: string | null;
};

export type AppIdentity = { email: string; displayName: string };

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function digest(value: string) {
  return encodeBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

async function passwordHash(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const result = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS },
    key,
    256,
  );
  return encodeBase64Url(new Uint8Array(result));
}

function constantTimeEqual(left: string, right: string) {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) mismatch |= a[index] ^ b[index];
  return mismatch === 0;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase().slice(0, 254);
}

function validateAccount(email: string, password: string, displayName?: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("请输入有效的邮箱地址");
  if (password.length < 8 || password.length > 72) throw new Error("密码需要 8–72 个字符");
  if (displayName !== undefined && (displayName.trim().length < 2 || displayName.trim().length > 24)) {
    throw new Error("昵称需要 2–24 个字符");
  }
}

function makeInviteCode(email: string) {
  let hash = 2166136261;
  for (const char of email) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `STAR${(hash >>> 0).toString(36).toUpperCase().slice(0, 7)}`;
}

function randomToken(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
}

async function createSession(email: string) {
  const token = randomToken(32);
  const tokenHash = await digest(token);
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM auth_sessions WHERE expires_at <= ?").bind(new Date().toISOString()),
    env.DB.prepare("INSERT INTO auth_sessions (token_hash, user_email, expires_at) VALUES (?, ?, ?)")
      .bind(tokenHash, email, expiresAt),
  ]);
  return token;
}

export async function registerAccount(input: { email: string; password: string; displayName: string }) {
  const email = normalizeEmail(input.email);
  const displayName = input.displayName.trim().slice(0, 24);
  validateAccount(email, input.password, displayName);
  const exists = await env.DB.prepare("SELECT 1 FROM auth_accounts WHERE email = ?").bind(email).first();
  if (exists) throw new Error("这个邮箱已经注册，请直接登录");
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const hash = await passwordHash(input.password, salt);
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO users (email, display_name, invite_code)
      VALUES (?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET display_name = excluded.display_name
    `).bind(email, displayName, makeInviteCode(email)),
    env.DB.prepare(`
      INSERT INTO auth_accounts (email, password_hash, password_salt)
      VALUES (?, ?, ?)
    `).bind(email, hash, encodeBase64Url(salt)),
  ]);
  return { identity: { email, displayName }, token: await createSession(email) };
}

export async function loginAccount(input: { email: string; password: string }) {
  const email = normalizeEmail(input.email);
  validateAccount(email, input.password);
  const account = await env.DB.prepare(`
    SELECT a.email, u.display_name, a.password_hash, a.password_salt, a.failed_attempts, a.locked_until
    FROM auth_accounts a JOIN users u ON u.email = a.email
    WHERE a.email = ?
  `).bind(email).first<AccountRow>();
  if (!account) throw new Error("邮箱或密码不正确");
  if (account.locked_until && new Date(account.locked_until) > new Date()) {
    throw new Error("尝试次数过多，请 15 分钟后再试");
  }
  const candidate = await passwordHash(input.password, decodeBase64Url(account.password_salt));
  if (!constantTimeEqual(candidate, account.password_hash)) {
    const attempts = account.failed_attempts + 1;
    const lockedUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
    await env.DB.prepare("UPDATE auth_accounts SET failed_attempts = ?, locked_until = ? WHERE email = ?")
      .bind(attempts >= 5 ? 0 : attempts, lockedUntil, email).run();
    throw new Error("邮箱或密码不正确");
  }
  await env.DB.prepare("UPDATE auth_accounts SET failed_attempts = 0, locked_until = NULL WHERE email = ?")
    .bind(email).run();
  return { identity: { email, displayName: account.display_name }, token: await createSession(email) };
}

function cookieToken(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function getAppUser(request: Request): Promise<AppIdentity | null> {
  const token = cookieToken(request);
  if (!token) return null;
  const row = await env.DB.prepare(`
    SELECT s.user_email AS email, u.display_name
    FROM auth_sessions s JOIN users u ON u.email = s.user_email
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).bind(await digest(token), new Date().toISOString()).first<{ email: string; display_name: string }>();
  return row ? { email: row.email, displayName: row.display_name } : null;
}

export async function deleteSession(request: Request) {
  const token = cookieToken(request);
  if (token) await env.DB.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").bind(await digest(token)).run();
}

export function sessionCookie(request: Request, token: string) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}${secure}`;
}

export function clearSessionCookie(request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new Error("请求来源无效");
}
