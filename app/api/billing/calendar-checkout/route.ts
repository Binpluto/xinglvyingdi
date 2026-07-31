import { env } from "cloudflare:workers";
import { assertSameOrigin, getAppUser } from "../../../app-auth";
import { calendarPlans, type CalendarPlanKey } from "../../../calendar-access";

type BillingEnv = {
  WAFFO_STORE_SLUG?: string;
  WAFFO_ENVIRONMENT?: string;
  WAFFO_CALENDAR_WEEK_PRODUCT_ID?: string;
  WAFFO_CALENDAR_MONTH_PRODUCT_ID?: string;
  WAFFO_CALENDAR_YEAR_PRODUCT_ID?: string;
};

function productId(plan: CalendarPlanKey) {
  const billing = env as unknown as BillingEnv;
  return {
    week: billing.WAFFO_CALENDAR_WEEK_PRODUCT_ID,
    month: billing.WAFFO_CALENDAR_MONTH_PRODUCT_ID,
    year: billing.WAFFO_CALENDAR_YEAR_PRODUCT_ID,
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
    const waffoProductId = productId(plan);
    if (!billing.WAFFO_STORE_SLUG || !waffoProductId) {
      return Response.json({ error: "Waffo 支付通道正在配置中，7 天试用与 Lv.100 奖励可正常使用" }, { status: 503 });
    }
    const origin = new URL(request.url).origin;
    const externalId = `calendar_${crypto.randomUUID()}`;
    const expectedAmountMinor = Math.round(calendarPlans[plan].priceHkd * 100);
    await env.DB.prepare(`
      INSERT INTO calendar_checkout_orders
        (external_id, user_email, plan, expected_currency, expected_amount_minor)
      VALUES (?, ?, ?, 'HKD', ?)
    `).bind(externalId, identity.email, plan, expectedAmountMinor).run();

    const response = await fetch("https://api.waffo.ai/v1/actions/checkout/create-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Store-Slug": billing.WAFFO_STORE_SLUG,
        "X-Environment": billing.WAFFO_ENVIRONMENT === "prod" ? "prod" : "test",
      },
      body: JSON.stringify({
        productId: waffoProductId,
        productType: "onetime",
        currency: "HKD",
        buyerEmail: identity.email,
        successUrl: `${origin}/?calendar=payment-success`,
        language: "zh-Hans",
        metadata: { calendarPlan: plan },
        orderMerchantExternalId: externalId,
      }),
    });
    const result = await response.json() as {
      checkoutUrl?: string;
      sessionId?: string;
      data?: { checkoutUrl?: string; sessionId?: string };
      errors?: Array<{ message?: string }>;
      message?: string;
    };
    const checkoutUrl = result.checkoutUrl || result.data?.checkoutUrl;
    const sessionId = result.sessionId || result.data?.sessionId || null;
    if (!response.ok || !checkoutUrl) throw new Error(result.errors?.[0]?.message || result.message || "暂时无法创建 Waffo 支付页面");
    await env.DB.prepare(`
      UPDATE calendar_checkout_orders SET provider_session_id = ? WHERE external_id = ?
    `).bind(sessionId, externalId).run();
    return Response.json({ checkoutUrl });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "暂时无法创建支付页面" }, { status: 500 });
  }
}
