import { env } from "cloudflare:workers";
import { appPublicOrigin } from "../../../app-auth";
import { requireCalendarAccess } from "../../../calendar-access";
import {
  encryptRefreshToken,
  exchangeAuthorizationCode,
  googleCalendarIdentity,
  syncGoogleCalendar,
} from "../../../google-calendar";

export async function GET(request: Request) {
  const returnUrl = new URL("/", appPublicOrigin(request));
  try {
    const url = new URL(request.url);
    const state = url.searchParams.get("state") || "";
    const code = url.searchParams.get("code") || "";
    if (!state || !code || url.searchParams.get("error")) throw new Error("授权已取消");
    const savedState = await env.DB.prepare(`
      SELECT user_email FROM google_oauth_states
      WHERE state = ? AND expires_at > ?
    `).bind(state, new Date().toISOString()).first<{ user_email: string }>();
    await env.DB.prepare("DELETE FROM google_oauth_states WHERE state = ?").bind(state).run();
    if (!savedState) throw new Error("授权请求已过期");
    await requireCalendarAccess(savedState.user_email);
    const syncFromDate = state.match(/\.(\d{4}-\d{2}-\d{2})$/)?.[1];
    const tokens = await exchangeAuthorizationCode(request, code);
    const googleEmail = await googleCalendarIdentity(tokens.access_token!);
    await env.DB.prepare(`
      INSERT INTO google_calendar_connections
        (user_email, refresh_token, google_email, sync_token, last_synced_at)
      VALUES (?, ?, ?, NULL, NULL)
      ON CONFLICT(user_email) DO UPDATE SET
        refresh_token = excluded.refresh_token,
        google_email = excluded.google_email,
        sync_token = NULL,
        last_synced_at = NULL,
        connected_at = CURRENT_TIMESTAMP
    `).bind(savedState.user_email, await encryptRefreshToken(tokens.refresh_token!, savedState.user_email), googleEmail).run();
    await syncGoogleCalendar(savedState.user_email, syncFromDate);
    returnUrl.searchParams.set("calendar", "connected");
  } catch {
    returnUrl.searchParams.set("calendar", "error");
  }
  return Response.redirect(returnUrl);
}
