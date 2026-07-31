import { env } from "cloudflare:workers";
import { getAppUser } from "../../../app-auth";
import { requireCalendarAccess } from "../../../calendar-access";
import { googleAuthorizationUrl } from "../../../google-calendar";

function stateToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function GET(request: Request) {
  try {
    const identity = await getAppUser(request);
    if (!identity) return Response.redirect(new URL("/", request.url));
    const state = stateToken();
    const authorizationUrl = googleAuthorizationUrl(request, state, identity.email);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM google_oauth_states WHERE expires_at <= ?").bind(new Date().toISOString()),
      env.DB.prepare(`
        INSERT INTO google_oauth_states (state, user_email, expires_at)
        VALUES (?, ?, ?)
      `).bind(state, identity.email, new Date(Date.now() + 10 * 60 * 1000).toISOString()),
    ]);
    await requireCalendarAccess(identity.email, { startTrial: true });
    return Response.redirect(authorizationUrl);
  } catch {
    return Response.redirect(new URL("/?calendar=configuration-error", request.url));
  }
}
