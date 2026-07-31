import { env } from "cloudflare:workers";
import { activatePaidCalendarPlan, calendarPlans, type CalendarPlanKey } from "../../../calendar-access";

type BillingEnv = {
  WAFFO_ENVIRONMENT?: string;
  WAFFO_WEBHOOK_TEST_PUBLIC_KEY?: string;
  WAFFO_WEBHOOK_PROD_PUBLIC_KEY?: string;
};

type WaffoEventData = {
  orderMerchantExternalId?: string;
  merchantProvidedBuyerIdentity?: string;
  buyerEmail?: string;
  currency?: string;
  amount?: string;
  paymentStatus?: string;
};

type WaffoEvent = {
  id?: string;
  eventId?: string;
  eventType?: string;
  mode?: string;
  data?: WaffoEventData;
};

type PendingOrder = {
  user_email: string;
  plan: CalendarPlanKey;
  expected_currency: string;
  expected_amount_minor: number;
  completed_at: string | null;
};

const BUILTIN_TEST_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxnmRY6yMMA3lVqmAU6ZG
b1sjL/+r/z6E+ZjkXaDAKiqOhk9rpazni0bNsGXwmftTPk9jy2wn+j6JHODD/WH/
SCnSfvKkLIjy4Hk7BuCgB174C0ydan7J+KgXLkOwgCAxxB68t2tezldwo74ZpXgn
F49opzMvQ9prEwIAWOE+kV9iK6gx/AckSMtHIHpUesoPDkldpmFHlB2qpf1vsFTZ
5kD6DmGl+2GIVK01aChy2lk8pLv0yUMu18v44sLkO5M44TkGPJD9qG09wrvVG2wp
OTVCn1n5pP8P+HRLcgzbUB3OlZVfdFurn6EZwtyL4ZD9kdkQ4EZE/9inKcp3c1h4
xwIDAQAB
-----END PUBLIC KEY-----`;

const BUILTIN_PROD_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAz+xApdTIb4ua+DgZKQ54
iBsD82ybyhGCLRETONW4Jgbb3A8DUM1LqBk6r/CmTOCHqLalTQHNigvP3R5zkDNX
iRJz6gA4MJ/+8K0+mnEE2RISQzN+Qu65TNd6svb+INm/kMaftY4uIXr6y6kchtTJ
dwnQhcKdAL2v7h7IFnkVelQsKxDdb2PqX8xX/qwd01iXvMcpCCaXovUwZsxH2QN5
ZKBTseJivbhUeyJCco4fdUyxOMHe2ybCVhyvim2uxAl1nkvL5L8RCWMCAV55LLo0
9OhmLahz/DYNu13YLVP6dvIT09ZFBYU6Owj1NxdinTynlJCFS9VYwBgmftosSE1U
dwIDAQAB
-----END PUBLIC KEY-----`;

function signatureParts(header: string) {
  const parts = Object.fromEntries(header.split(",").map((part) => part.trim().split("=", 2)));
  if (!parts.t || !parts.v1) throw new Error("Waffo 签名格式无效");
  return { timestamp: parts.t, signature: parts.v1 };
}

function pemBytes(pem: string) {
  const base64 = pem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g, "");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

function signatureBytes(base64: string) {
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

async function verifySignature(payload: string, header: string, publicKey: string) {
  const { timestamp, signature } = signatureParts(header);
  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
    throw new Error("Waffo 签名已过期");
  }
  const key = await crypto.subtle.importKey(
    "spki",
    pemBytes(publicKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    signatureBytes(signature),
    new TextEncoder().encode(`${timestamp}.${payload}`),
  );
  if (!valid) throw new Error("Waffo 签名无效");
}

export async function POST(request: Request) {
  try {
    const billing = env as unknown as BillingEnv;
    const environment = billing.WAFFO_ENVIRONMENT === "prod" ? "prod" : "test";
    const publicKey = environment === "prod"
      ? billing.WAFFO_WEBHOOK_PROD_PUBLIC_KEY || BUILTIN_PROD_PUBLIC_KEY
      : billing.WAFFO_WEBHOOK_TEST_PUBLIC_KEY || BUILTIN_TEST_PUBLIC_KEY;
    const payload = await request.text();
    await verifySignature(payload, request.headers.get("x-waffo-signature") || "", publicKey);

    const event = JSON.parse(payload) as WaffoEvent;
    if (event.eventType !== "order.completed") return Response.json({ received: true });
    if (event.mode && event.mode !== environment) return Response.json({ error: "支付环境不匹配" }, { status: 400 });

    const externalId = event.data?.orderMerchantExternalId || "";
    const eventId = event.eventId || event.id || "";
    if (!externalId || !eventId) return Response.json({ error: "支付事件信息不完整" }, { status: 400 });

    const order = await env.DB.prepare(`
      SELECT user_email, plan, expected_currency, expected_amount_minor, completed_at
      FROM calendar_checkout_orders WHERE external_id = ?
    `).bind(externalId).first<PendingOrder>();
    if (!order || !calendarPlans[order.plan]) return Response.json({ error: "未找到对应订单" }, { status: 404 });
    if (order.completed_at) return Response.json({ received: true });

    const paidMinor = Math.round(Number(event.data?.amount || "") * 100);
    if (event.data?.currency !== order.expected_currency || paidMinor !== order.expected_amount_minor) {
      return Response.json({ error: "支付金额或币种不匹配" }, { status: 400 });
    }

    const claimed = await env.DB.prepare(`
      UPDATE calendar_checkout_orders
      SET provider_event_id = ?, completed_at = CURRENT_TIMESTAMP
      WHERE external_id = ? AND completed_at IS NULL
    `).bind(eventId, externalId).run();
    if (claimed.meta.changes) {
      try {
        await activatePaidCalendarPlan(order.user_email, order.plan);
      } catch (error) {
        await env.DB.prepare(`
          UPDATE calendar_checkout_orders
          SET provider_event_id = NULL, completed_at = NULL
          WHERE external_id = ? AND provider_event_id = ?
        `).bind(externalId, eventId).run();
        throw error;
      }
    }
    return Response.json({ received: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Webhook 处理失败" }, { status: 400 });
  }
}
