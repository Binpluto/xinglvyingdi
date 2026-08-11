import {
  assertSameOrigin,
  clearSessionCookie,
  deleteAccount,
  deleteSession,
  getAppUser,
  loginAccount,
  registerAccount,
  sessionCookie,
} from "../../app-auth";

const noStore = { "Cache-Control": "no-store" };
const publicErrors = new Set([
  "请输入有效的邮箱地址",
  "密码需要 8–72 个字符",
  "昵称需要 2–24 个字符",
  "这个邮箱已经注册，请直接登录",
  "邮箱或密码不正确",
  "尝试次数过多，请 15 分钟后再试",
  "请求来源无效",
  "请先登录后再删除账号",
  "账号不存在或已经删除",
  "密码不正确，账号未删除",
  "未知操作",
]);

function safeAuthError(error: unknown, action?: string) {
  const message = error instanceof Error ? error.message : "";
  if (publicErrors.has(message)) return message;
  if (/UNIQUE constraint failed: auth_accounts\.email/i.test(message)) {
    return "这个邮箱已经注册，请直接登录";
  }
  return action === "register"
    ? "注册暂时未完成，请稍后重试"
    : "登录暂时未完成，请稍后重试";
}

export async function GET(request: Request) {
  const identity = await getAppUser(request);
  if (!identity) return Response.json({ user: null }, { headers: noStore });
  return Response.json({ user: { email: identity.email, name: identity.displayName } }, { headers: noStore });
}

export async function POST(request: Request) {
  let action: string | undefined;
  try {
    assertSameOrigin(request);
    const body = await request.json() as { action?: string; email?: string; password?: string; displayName?: string };
    action = body.action;
    if (action === "logout") {
      await deleteSession(request);
      return Response.json(
        { ok: true },
        { headers: { ...noStore, "Set-Cookie": clearSessionCookie(request) } },
      );
    }
    if (action === "delete-account") {
      await deleteAccount(request, body.password ?? "");
      return Response.json(
        { ok: true },
        { headers: { ...noStore, "Set-Cookie": clearSessionCookie(request) } },
      );
    }
    const result = action === "register"
      ? await registerAccount({
          email: body.email ?? "",
          password: body.password ?? "",
          displayName: body.displayName ?? "",
        })
      : action === "login"
        ? await loginAccount({ email: body.email ?? "", password: body.password ?? "" })
        : null;
    if (!result) return Response.json({ error: "未知操作" }, { status: 400, headers: noStore });
    return Response.json(
      { user: { email: result.identity.email, name: result.identity.displayName } },
      { headers: { ...noStore, "Set-Cookie": sessionCookie(request, result.token) } },
    );
  } catch (error) {
    return Response.json(
      { error: safeAuthError(error, action) },
      { status: 400, headers: noStore },
    );
  }
}
