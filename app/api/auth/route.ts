import {
  assertSameOrigin,
  clearSessionCookie,
  deleteSession,
  getAppUser,
  loginAccount,
  registerAccount,
  sessionCookie,
} from "../../app-auth";

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const identity = await getAppUser(request);
  if (!identity) return Response.json({ user: null }, { headers: noStore });
  return Response.json({ user: { email: identity.email, name: identity.displayName } }, { headers: noStore });
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await request.json() as { action?: string; email?: string; password?: string; displayName?: string };
    if (body.action === "logout") {
      await deleteSession(request);
      return Response.json(
        { ok: true },
        { headers: { ...noStore, "Set-Cookie": clearSessionCookie(request) } },
      );
    }
    const result = body.action === "register"
      ? await registerAccount({
          email: body.email ?? "",
          password: body.password ?? "",
          displayName: body.displayName ?? "",
        })
      : body.action === "login"
        ? await loginAccount({ email: body.email ?? "", password: body.password ?? "" })
        : null;
    if (!result) return Response.json({ error: "未知操作" }, { status: 400, headers: noStore });
    return Response.json(
      { user: { email: result.identity.email, name: result.identity.displayName } },
      { headers: { ...noStore, "Set-Cookie": sessionCookie(request, result.token) } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "登录失败" },
      { status: 400, headers: noStore },
    );
  }
}
