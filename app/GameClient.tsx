"use client";

import { useEffect, useMemo, useState } from "react";

type Quest = { id: number; title: string; detail: string; reward: number; type: string; done: number };
type Member = { display_name: string; email: string; xp: number; focus_minutes: number; strength: number };
type Team = { id: number; name: string; code: string; owner_email: string; member_count: number; members: Member[] };
type RankTeam = { id: number; name: string; code: string; members: number; strength: number; focus_minutes: number };
type GameData = {
  user: { email: string; name: string; inviteCode: string; invitedBy: string | null; xp: number; coins: number; focusMinutes: number; referralCount: number };
  quests: Quest[];
  team: Team | null;
  leaderboard: RankTeam[];
};

const nav = [["营地", "⌂"], ["任务", "✦"], ["专注", "◷"], ["小组", "♙"], ["世界", "◎"]];

export default function GameClient({ identity }: { identity: { email: string; name: string } }) {
  const [data, setData] = useState<GameData | null>(null);
  const [tab, setTab] = useState("营地");
  const [timer, setTimer] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState("");
  const [inviteInput, setInviteInput] = useState("");
  const [teamInput, setTeamInput] = useState("");
  const [teamName, setTeamName] = useState("");

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!running || timer <= 0) return;
    const id = window.setInterval(() => setTimer((v) => v - 1), 1000);
    return () => window.clearInterval(id);
  }, [running, timer]);
  useEffect(() => {
    if (timer === 0 && running) {
      setRunning(false);
      void act({ action: "focus", minutes: 25 }, "秘境完成：专注记录已保存到云端");
    }
  }, [timer, running]);

  async function load() {
    const res = await fetch("/api/game");
    const json = await res.json();
    if (res.ok) setData(json); else notify(json.error ?? "云端同步失败");
  }

  async function act(payload: Record<string, unknown>, success: string) {
    const res = await fetch("/api/game", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const json = await res.json();
    if (!res.ok) return notify(json.error ?? "操作失败");
    setData(json);
    notify(success);
  }

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  }

  async function copy(value: string, message: string) {
    await navigator.clipboard.writeText(value);
    notify(message);
  }

  const time = useMemo(() => `${String(Math.floor(timer / 60)).padStart(2, "0")}:${String(timer % 60).padStart(2, "0")}`, [timer]);
  const done = data?.quests.filter((q) => Boolean(q.done)).length ?? 0;
  const displayName = data?.user.name || identity.name.split("@")[0];
  const xp = data?.user.xp ?? 0;
  const coins = data?.user.coins ?? 0;

  if (!data) {
    return <main className="loading-world"><div className="loading-seal">✧</div><p>正在连接星旅世界…</p></main>;
  }

  return (
    <main className="app-shell">
      <div className="aurora aurora-one" /><div className="aurora aurora-two" />
      <aside className="side-nav">
        <button className="brand-mark" aria-label="星旅营地">✧</button>
        <div className="nav-stack">
          {nav.map(([label, icon]) => <button key={label} className={tab === label ? "nav-item active" : "nav-item"} onClick={() => setTab(label)}><span>{icon}</span><small>{label}</small></button>)}
        </div>
        <a className="nav-item signout-link" href="/signout-with-chatgpt?return_to=%2F"><span>↪</span><small>退出</small></a>
      </aside>

      <section className="main-content">
        <header className="topbar">
          <div><p className="eyebrow">STARCAMP · 星旅营地</p><h1>{tab === "营地" ? `早上好，${displayName}` : tab}</h1></div>
          <div className="top-actions">
            <div className="cloud-state"><i /> 云端已同步</div>
            <div className="currency"><span>✦</span><b>{coins}</b></div>
            <button className="avatar" aria-label="个人中心"><span>{displayName.slice(0, 1)}</span><em>Lv. {Math.max(1, Math.floor(xp / 100))}</em></button>
          </div>
        </header>

        {tab === "营地" && <Camp data={data} done={done} setTab={setTab} act={act} />}
        {tab === "任务" && <QuestBoard data={data} done={done} act={act} />}
        {tab === "专注" && <Focus timer={time} running={running} setRunning={setRunning} setTimer={setTimer} />}
        {tab === "小组" && <TeamHall data={data} teamName={teamName} setTeamName={setTeamName} teamInput={teamInput} setTeamInput={setTeamInput} act={act} copy={copy} />}
        {tab === "世界" && <World data={data} />}
      </section>

      <button className="invite-fab" onClick={() => setTab("小组")}><span>♙</span>邀请好友</button>
      {tab === "营地" && !data.user.invitedBy && <div className="invite-banner"><div><b>来自好友的星光？</b><span>填写邀请码，你与邀请人都能获得奖励</span></div><input value={inviteInput} onChange={(e) => setInviteInput(e.target.value)} placeholder="输入好友邀请码" /><button onClick={() => void act({ action: "redeemInvite", code: inviteInput }, "邀请绑定成功，双方奖励已到账")}>领取奖励</button></div>}
      {toast && <div className="toast">✦ {toast}</div>}
    </main>
  );
}

function Camp({ data, done, setTab, act }: { data: GameData; done: number; setTab: (v: string) => void; act: (p: Record<string, unknown>, s: string) => Promise<void> }) {
  return <div className="page-grid">
    <section className="hero-card">
      <div className="hero-copy"><span className="chapter">第三章 · 与同伴共赴群星</span><h2>一个人的愿望<br />汇成世界的光</h2><p>你的每一次行动，都在为小组积累实力，也让世界版图更加明亮。</p><button className="gold-button" onClick={() => setTab("世界")}>进入星旅世界 <span>→</span></button></div>
      <div className="hero-world" aria-hidden="true"><div className="sun-disc"><span>✦</span></div><div className="mountain mountain-a" /><div className="mountain mountain-b" /><div className="floating-island island-a"><i /></div><div className="floating-island island-b"><i /></div><div className="cloud cloud-a" /></div>
      <div className="hero-progress"><div className="level-seal">{Math.max(1, Math.floor(data.user.xp / 100))}</div><div><span>冒险阅历</span><b>{data.user.xp} EXP</b><div className="progress-track"><i style={{ width: `${data.user.xp % 100}%` }} /></div></div></div>
    </section>
    <aside className="profile-card glass-card"><div className="card-heading"><div><small>旅行者档案</small><h3>云端旅程</h3></div><span className="sync-orb">✓</span></div><div className="cloud-stats"><div><b>{data.user.focusMinutes}</b><span>累计专注 / 分钟</span></div><div><b>{data.user.referralCount}</b><span>成功邀请 / 人</span></div><div><b>{data.team?.member_count ?? 0}</b><span>同行伙伴 / 人</span></div></div><blockquote>“因相遇而出发，因同行而抵达。”</blockquote></aside>
    <QuestBoard data={data} done={done} act={act} compact />
    <aside className="focus-card glass-card mini-focus"><div className="card-heading"><div><small>共同旅程</small><h3>{data.team?.name ?? "尚未加入小组"}</h3></div><span className="moon">♙</span></div>{data.team ? <><div className="team-power"><small>小组当前实力</small><strong>{data.team.members.reduce((n, m) => n + m.strength, 0).toLocaleString()}</strong><span>世界排名将实时累计每位成员的经验与专注时间</span></div><button className="wide-button" onClick={() => setTab("小组")}>查看小组营地</button></> : <div className="empty-team"><span>♙</span><p>创建或加入最多 5 人的小组，和伙伴共同成长。</p><button className="wide-button" onClick={() => setTab("小组")}>寻找同行者</button></div>}</aside>
  </div>;
}

function QuestBoard({ data, done, act, compact = false }: { data: GameData; done: number; act: (p: Record<string, unknown>, s: string) => Promise<void>; compact?: boolean }) {
  return <section className={`quest-card glass-card ${compact ? "" : "full-panel"}`}><div className="card-heading"><div><small>冒险家协会 · 云端委托</small><h3>今日任务</h3></div><div className="completion"><b>{done}/{data.quests.length}</b><span>完成 {Math.round(done / data.quests.length * 100)}%</span></div></div><div className="quest-list">{data.quests.map((q) => <article key={q.id} className={q.done ? "quest done" : "quest"}><button className="quest-check" disabled={Boolean(q.done)} onClick={() => void act({ action: "completeQuest", questId: q.id }, `任务完成：经验 +${q.reward}`)}>{q.done ? "✓" : ""}</button><div className="quest-text"><span className={`quest-type type-${q.type}`}>{q.type}</span><h4>{q.title}</h4><p>{q.detail}</p></div><div className="reward"><span>✦</span><b>+{q.reward}</b></div></article>)}</div></section>;
}

function Focus({ timer, running, setRunning, setTimer }: { timer: string; running: boolean; setRunning: (v: boolean) => void; setTimer: React.Dispatch<React.SetStateAction<number>> }) {
  return <section className="focus-stage glass-card"><div className="section-intro"><small>静谧秘境</small><h2>专注沙漏</h2><p>完成一次秘境，专注时间将计入个人档案和小组世界实力。</p></div><div className={running ? "timer-orbit giant running" : "timer-orbit giant"}><div className="orbit-dot" /><div className="timer-face"><small>{running ? "正在专注" : "准备启程"}</small><strong>{timer}</strong><span>深度工作 · 云端计时</span></div></div><div className="timer-actions"><button className="secondary-button" onClick={() => { setRunning(false); setTimer(25 * 60); }}>重置</button><button className="primary-round" onClick={() => setRunning(!running)}>{running ? "Ⅱ" : "▶"}</button><button className="secondary-button" onClick={() => setTimer((v) => v + 5 * 60)}>+5 分钟</button></div></section>;
}

function TeamHall({ data, teamName, setTeamName, teamInput, setTeamInput, act, copy }: { data: GameData; teamName: string; setTeamName: (v: string) => void; teamInput: string; setTeamInput: (v: string) => void; act: (p: Record<string, unknown>, s: string) => Promise<void>; copy: (v: string, s: string) => Promise<void> }) {
  return <section className="social-panel">
    <div className="invite-card glass-card"><div><small>好友邀请</small><h2>分享一束星光</h2><p>好友首次使用你的邀请码，你获得 <b>200 EXP + 120 星辉</b>，好友获得 <b>100 EXP + 80 星辉</b>。</p></div><div className="code-box"><span>我的邀请码</span><strong>{data.user.inviteCode}</strong><button onClick={() => void copy(data.user.inviteCode, "邀请码已复制")}>复制</button></div><div className="invite-count">已成功邀请 <b>{data.user.referralCount}</b> 位旅行者</div></div>
    <div className="team-card glass-card">{data.team ? <><div className="team-head"><div className="team-crest">♙</div><div><small>我的五人小组</small><h2>{data.team.name}</h2><p>{data.team.member_count}/5 位成员 · 小组口令 {data.team.code}</p></div><button onClick={() => void copy(data.team!.code, "小组口令已复制")}>复制口令</button></div><div className="member-list">{data.team.members.map((m, i) => <article key={m.email}><span className="member-rank">{i + 1}</span><div className="member-avatar">{m.display_name.slice(0, 1)}</div><div><b>{m.display_name}</b><small>{m.focus_minutes} 分钟专注</small></div><strong>{m.strength.toLocaleString()} <small>实力</small></strong></article>)}{Array.from({ length: 5 - data.team.member_count }).map((_, i) => <article className="empty-member" key={i}><span>＋</span><p>等待新的同行者</p></article>)}</div></> : <><div className="section-intro"><small>同行者大厅</small><h2>创建或加入小组</h2><p>每位旅行者只能加入一个小组，每组最多 5 人。</p></div><div className="team-choices"><div><h3>建立新的营地</h3><input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="输入小组名称" maxLength={16}/><button onClick={() => void act({ action: "createTeam", name: teamName }, "小组创建成功")}>创建小组</button></div><div><h3>加入好友的小组</h3><input value={teamInput} onChange={(e) => setTeamInput(e.target.value)} placeholder="输入小组口令"/><button onClick={() => void act({ action: "joinTeam", code: teamInput }, "已加入小组")}>加入小组</button></div></div></>}</div>
  </section>;
}

function World({ data }: { data: GameData }) {
  return <section className="world-panel"><div className="world-hero"><span className="chapter">星旅世界 · 实时演算</span><h2>世界实力排行榜</h2><p>实力值 = 全队累计经验 + 专注分钟 × 2。每一次认真生活，都会改变世界坐标。</p><div className="world-tabs"><button className="active">实时总榜</button><button>本周新星</button><button>专注榜</button></div></div><div className="ranking glass-card">{data.leaderboard.length ? data.leaderboard.map((team, i) => <article key={team.id} className={data.team?.id === team.id ? "my-team" : ""}><div className={`rank-number rank-${i + 1}`}>{i + 1}</div><div className="rank-crest">{i < 3 ? "✦" : "◇"}</div><div className="rank-name"><b>{team.name}</b><span>{team.members}/5 位旅行者 · 累计专注 {team.focus_minutes} 分钟</span></div><div className="rank-power"><strong>{Number(team.strength).toLocaleString()}</strong><span>世界实力</span></div></article>) : <div className="empty-ranking"><span>◎</span><h3>世界正在等待第一支队伍</h3><p>创建小组并完成任务，你们将成为榜单上的第一束星光。</p></div>}</div></section>;
}
