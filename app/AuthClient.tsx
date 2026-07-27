"use client";

import { FormEvent, useEffect, useState } from "react";
import GameClient from "./GameClient";

type Identity = { email: string; name: string };

export default function AuthClient() {
  const [user, setUser] = useState<Identity | null>(null);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void fetch("/api/auth", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setUser(data.user ?? null))
      .finally(() => setChecking(false));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: mode, email, password, displayName }),
      });
      const data = await response.json() as { user?: Identity; error?: string };
      if (!response.ok || !data.user) {
        setError(data.error ?? (mode === "register" ? "注册失败，请稍后重试" : "登录失败，请稍后重试"));
        return;
      }
      setUser(data.user);
      setPassword("");
    } catch {
      setError("无法连接云端，请检查网络后重试");
    } finally {
      setSubmitting(false);
    }
  }

  async function logout() {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    setUser(null);
  }

  if (checking) {
    return <main className="loading-world"><div className="loading-seal">✧</div><p>正在确认旅行者身份…</p></main>;
  }

  if (user) return <GameClient identity={user} onLogout={logout} />;

  return (
    <main className="auth-page">
      <div className="auth-stars" />
      <section className="auth-card email-auth-card">
        <div className="auth-seal">✧</div>
        <p className="eyebrow">STARCAMP · 星旅营地</p>
        <h1>{mode === "login" ? "欢迎回到营地" : "创建旅行者档案"}</h1>
        <p className="auth-copy">
          直接使用邮箱和密码进入。你的任务、专注记录、队伍与世界排名都会保存在云端。
        </p>
        <div className="auth-tabs" role="tablist" aria-label="登录或注册">
          <button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>邮箱登录</button>
          <button className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>注册账号</button>
        </div>
        <form className="email-auth-form" onSubmit={submit}>
          {mode === "register" && <label><span>旅行者昵称</span><input autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="例如：星野" required minLength={2} maxLength={24} /></label>}
          <label><span>邮箱地址</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></label>
          <label><span>密码</span><input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 个字符" required minLength={8} maxLength={72} />{mode === "register" && <small className="password-hint">使用 8–72 个字符，可包含字母、数字和符号</small>}</label>
          {error && <div className="auth-error" role="alert">! {error}</div>}
          <button className="auth-button" type="submit" disabled={submitting}>
            {submitting ? "正在开启星门…" : mode === "login" ? "邮箱登录" : "注册并开始旅程"} <span>→</span>
          </button>
        </form>
        <small>登录即表示你同意妥善保管账号密码</small>
      </section>
      <div className="auth-landscape"><i /><i /><i /></div>
    </main>
  );
}
