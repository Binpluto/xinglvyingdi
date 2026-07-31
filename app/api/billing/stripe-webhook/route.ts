import { env } from "cloudflare:workers";
import { activatePaidCalendarPlan, calendarPlans, type CalendarPlanKey } from "../../../calendar-access";

type BillingEnv = { STRIPE_WEBHOOK_SECRET?: string };
type CheckoutSession = {
  payment_status?: string;
  client_reference_id?: string;
  metadata?: { user_email?: string; calendar_plan?: CalendarPlanKey };
};

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

async function hmacHex(secret: string, payload: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
  return [...signature].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  const secret = (env as unknown as BillingEnv).STRIPE_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "Webhook 未配置" }, { status: 503 });
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") || "";
  const parts = Object.fromEntries(signature.split(",").map((part) => part.split("=", 2)));
  const timestamp = Number(parts.t || 0);
  if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > 300) return Response.json({ error: "签名已过期" }, { status: 400 });
  const expected = await hmacHex(secret, `${timestamp}.${payload}`);
  if (!parts.v1 || !constantTimeEqual(expected, parts.v1)) return Response.json({ error: "签名无效" }, { status: 400 });

  const event = JSON.parse(payload) as { id?: string; type?: string; data?: { object?: CheckoutSession } };
  if (event.type !== "checkout.session.completed") return Response.json({ received: true });
  const session = event.data?.object;
  const email = session?.metadata?.user_email || session?.client_reference_id || "";
  const plan = session?.metadata?.calendar_plan;
  if (!event.id || !email || !plan || !calendarPlans[plan] || session?.payment_status !== "paid") {
    return Response.json({ error: "支付事件信息不完整" }, { status: 400 });
  }
  const inserted = await env.DB.prepare(`
    INSERT OR IGNORE INTO calendar_payments
      (stripe_event_id, user_email, plan, amount_cny_fen)
    VALUES (?, ?, ?, ?)
  `).bind(event.id, email, plan, Math.round(calendarPlans[plan].priceCny * 100)).run();
  if (inserted.meta.changes) await activatePaidCalendarPlan(email, plan);
  return Response.json({ received: true });
}
