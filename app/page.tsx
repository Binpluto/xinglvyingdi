import { getChatGPTUser } from "./chatgpt-auth";
import GameClient from "./GameClient";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();

  if (!user) {
    return (
      <main className="auth-page">
        <div className="auth-stars" />
        <section className="auth-card">
          <div className="auth-seal">✧</div>
          <p className="eyebrow">STARCAMP · 星旅营地</p>
          <h1>欢迎来到<br />共同生长的世界</h1>
          <p className="auth-copy">
            使用邮箱登录或注册。你的任务、专注记录、队伍与世界排名都会安全保存在云端。
          </p>
          <a className="auth-button" href="/signin-with-chatgpt?return_to=%2F">
            使用邮箱登录 / 注册 <span>→</span>
          </a>
          <small>首次登录将自动创建旅行者档案</small>
        </section>
        <div className="auth-landscape"><i /><i /><i /></div>
      </main>
    );
  }

  return <GameClient identity={{ email: user.email, name: user.displayName }} />;
}
