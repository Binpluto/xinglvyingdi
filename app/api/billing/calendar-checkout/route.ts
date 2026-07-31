import { env } from "cloudflare:workers";
import { assertSameOrigin, getAppUser } from "../../../app-auth";
import { calendarPlans, type CalendarPlanKey } from "../../../calendar-access";

type BillingEnv = {
  STRIPE_SECRET_KEY?: string;
  STRIPE_CALENDAR_WEEK_PRICE_ID?: string;
  STRIPE_CALENDAR_MONTH_PRICE_ID?: string;
  STRIPE_CALENDAR_YEAR_PRICE_ID?: string;
};

function priceId(plan: CalendarPlanKey) {
  const billing = env as unknown as BillingEnv;
  return {
    week: billing.STRIPE_CALENDAR_WEEK_PRICE_ID,
    month: billing.STRIPE_CALENDAR_MONTH_PRICE_ID,
    year: billing.STRIPE_CALENDAR_YEAR_PRICE_ID,
  }[plan];
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const identity = await getAppUser(request);
    if (!identity) return Response.json({ error: "请先登录" }, { status: 401 });
    const { plan } = await request.json() as { plan?: CalendarPlanKey };
    if (!plan || !calendarPlans[plan]) return Response.json({ error: "请选择有效套餐" }, { status: 400 });
    const billing = env as unknown as BillingEnv;
    const stripePriceId = priceId(plan);
    if (!billing.STRIPE_SECRET_KEY || !stripePriceId) {
      return Response.json({ error: "支付通道正在配置中，7 天试用与 Lv.100 奖励可正常使用" }, { status: 503 });
    }
    const origin = new URL(request.url).origin;
    const form = new URLSearchParams({
      mode: "payment",
      "line_items[0][price]": stripePriceId,
      "line_items[0][quantity]": "1",
      customer_email: identity.email,
      client_reference_id: identity.email,
      "metadata[user_email]": identity.email,
      "metadata[calendar_plan]": plan,
      success_url: `${origin}/?calendar=payment-success`,
      cancel_url: `${origin}/?calendar=payment-cancelled`,
      allow_promotion_codes: "true",
    });
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${billing.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });
    const result = await response.json() as { url?: string; error?: { message?: string } };
    if (!response.ok || !result.url) throw new Error(result.error?.message || "暂时无法创建支付页面");
    return Response.json({ checkoutUrl: result.url });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "暂时无法创建支付页面" }, { status: 500 });
  }
}
