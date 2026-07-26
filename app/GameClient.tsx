"use client";

import { useEffect, useMemo, useState } from "react";

type Quest = { id: number; title: string; detail: string; reward: number; type: string; done: number };
type Member = { display_name: string; email: string; xp: number; focus_minutes: number; strength: number };
type Team = { id: number; name: string; code: string; owner_email: string; member_count: number; members: Member[] };
type RankTeam = { id: number; name: string; code: string; members: number; strength: number; focus_minutes: number };
type FocusRecord = { id: number; minutes: number; created_at: string };
type InventoryItem = { item_key: string; quantity: number; acquired_at: string };
type GameData = {
  user: { email: string; name: string; inviteCode: string; invitedBy: string | null; xp: number; coins: number; focusMinutes: number; referralCount: number };
  quests: Quest[];
  focusHistory: FocusRecord[];
  inventory: InventoryItem[];
  team: Team | null;
  leaderboard: RankTeam[];
};

const nav = [["营地", "⌂"], ["任务", "✦"], ["专注", "◷"], ["行囊", "◇"], ["小组", "♙"], ["世界", "◎"]];

export default function GameClient({ identity }: { identity: { email: string; name: string } }) {
  const [data, setData] = useState<GameData | null>(null);
  const [tab, setTab] = useState("营地");
  const [timer, setTimer] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState("");
  const [inviteInput, setInviteInput] = useState("");
  const [teamInput, setTeamInput] = useState("");
  const [teamName, setTeamName] = useState("");
  const [focusMinutes, setFocusMinutes] = useState(25);

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!running || timer <= 0) return;
    const id = window.setInterval(() => setTimer((v) => v - 1), 1000);
    return () => window.clearInterval(id);
  }, [running, timer]);
  useEffect(() => {
    if (timer === 0 && running) {
      setRunning(false);
      void act({ action: "focus", minutes: focusMinutes }, "秘境完成：专注记录已保存到云端");
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
        {tab === "专注" && <Focus data={data} timer={time} running={running} setRunning={setRunning} setTimer={setTimer} focusMinutes={focusMinutes} setFocusMinutes={setFocusMinutes} act={act} />}
        {tab === "行囊" && <Bag data={data} act={act} />}
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
  return <><div className="page-grid">
    <section className="hero-card">
      <div className="hero-copy"><span className="chapter">第三章 · 与同伴共赴群星</span><h2>一个人的愿望<br />汇成世界的光</h2><p>你的每一次行动，都在为小组积累实力，也让世界版图更加明亮。</p><button className="gold-button" onClick={() => setTab("世界")}>进入星旅世界 <span>→</span></button></div>
      <div className="hero-world" aria-hidden="true"><div className="sun-disc"><span>✦</span></div><div className="mountain mountain-a" /><div className="mountain mountain-b" /><div className="floating-island island-a"><i /></div><div className="floating-island island-b"><i /></div><div className="cloud cloud-a" /></div>
      <div className="hero-progress"><div className="level-seal">{Math.max(1, Math.floor(data.user.xp / 100))}</div><div><span>冒险阅历</span><b>{data.user.xp} EXP</b><div className="progress-track"><i style={{ width: `${data.user.xp % 100}%` }} /></div></div></div>
    </section>
    <aside className="profile-card glass-card"><div className="card-heading"><div><small>旅行者档案</small><h3>云端旅程</h3></div><span className="sync-orb">✓</span></div><div className="cloud-stats"><div><b>{data.user.focusMinutes}</b><span>累计专注 / 分钟</span></div><div><b>{data.user.referralCount}</b><span>成功邀请 / 人</span></div><div><b>{data.team?.member_count ?? 0}</b><span>同行伙伴 / 人</span></div></div><blockquote>“因相遇而出发，因同行而抵达。”</blockquote></aside>
    <QuestBoard data={data} done={done} act={act} compact />
    <aside className="focus-card glass-card mini-focus"><div className="card-heading"><div><small>共同旅程</small><h3>{data.team?.name ?? "尚未加入小组"}</h3></div><span className="moon">♙</span></div>{data.team ? <><div className="team-power"><small>小组当前实力</small><strong>{data.team.members.reduce((n, m) => n + m.strength, 0).toLocaleString()}</strong><span>世界排名将实时累计每位成员的经验与专注时间</span></div><button className="wide-button" onClick={() => setTab("小组")}>查看小组营地</button></> : <div className="empty-team"><span>♙</span><p>创建或加入最多 5 人的小组，和伙伴共同成长。</p><button className="wide-button" onClick={() => setTab("小组")}>寻找同行者</button></div>}</aside>
  </div><div className="camp-bottom-grid">
    <section className="glass-card camp-agenda"><div className="card-heading"><div><small>今日旅程</small><h3>冒险日程</h3></div><button className="text-button" onClick={() => setTab("任务")}>管理任务 →</button></div><div className="agenda-line"><i /><span>08:30</span><div><b>晨间仪式</b><small>补充能量，确定今日航向</small></div><em>已完成</em></div><div className="agenda-line"><i /><span>14:00</span><div><b>知识秘境</b><small>30 分钟无干扰阅读</small></div><em>待出发</em></div><div className="agenda-line"><i /><span>20:30</span><div><b>篝火复盘</b><small>记录今天的三个闪光点</small></div><em>未开始</em></div></section>
    <section className="glass-card camp-weather"><div className="card-heading"><div><small>营地天气</small><h3>今日能量</h3></div><span>☀</span></div><div className="energy-ring"><strong>{Math.min(100, 58 + done * 9)}%</strong><small>状态晴朗</small></div><p>今日已经获得 <b>{data.quests.filter(q => q.done).reduce((n,q) => n + q.reward, 0)}</b> 点历练。完成下一项委托，可点亮连续行动星。</p></section>
    <section className="glass-card camp-achievement"><div className="card-heading"><div><small>最近获得</small><h3>冒险回响</h3></div><button className="text-button" onClick={() => setTab("行囊")}>打开行囊 →</button></div><div className="mini-badges"><div><span>✦</span><b>初心者</b><small>完成首个任务</small></div><div><span>◷</span><b>静心者</b><small>累计专注 60 分钟</small></div><div className={data.user.referralCount ? "" : "locked"}><span>♙</span><b>引路人</b><small>邀请一位好友</small></div></div></section>
  </div></>;
}

function QuestBoard({ data, done, act, compact = false }: { data: GameData; done: number; act: (p: Record<string, unknown>, s: string) => Promise<void>; compact?: boolean }) {
  const [filter, setFilter] = useState("全部");
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [type, setType] = useState("日常");
  const visible = data.quests.filter(q => filter === "全部" || q.type === filter);
  async function create() {
    await act({ action: "createQuest", title, detail, type }, "新委托已加入任务卷轴");
    setTitle(""); setDetail(""); setCreating(false);
  }
  return <section className={`quest-card glass-card ${compact ? "" : "full-panel enriched-quests"}`}><div className="card-heading"><div><small>冒险家协会 · 云端委托</small><h3>今日任务</h3></div><div className="completion"><b>{done}/{data.quests.length}</b><span>完成 {Math.round(done / Math.max(data.quests.length, 1) * 100)}%</span></div></div>{!compact && <><div className="quest-toolbar"><div>{["全部","主线","日常","支线"].map(v => <button key={v} className={filter === v ? "active" : ""} onClick={() => setFilter(v)}>{v}</button>)}</div><button className="new-quest-button" onClick={() => setCreating(!creating)}>＋ 发布新委托</button></div>{creating && <div className="quest-composer"><input value={title} onChange={e => setTitle(e.target.value)} placeholder="任务名称，例如：完成作品集第二页" /><input value={detail} onChange={e => setDetail(e.target.value)} placeholder="写下清晰的完成标准" /><select value={type} onChange={e => setType(e.target.value)}><option>日常</option><option>支线</option><option>主线</option></select><button onClick={() => void create()}>加入卷轴</button></div>}<div className="quest-summary-row"><div><span>✦</span><b>{data.quests.reduce((n,q) => n + (q.done ? q.reward : 0),0)}</b><small>今日已获经验</small></div><div><span>◇</span><b>{data.quests.filter(q => !q.done).length}</b><small>待完成委托</small></div><div><span>☼</span><b>{done >= 3 ? "连续" : `${3-done} 项`}</b><small>距离今日宝箱</small></div></div></>}<div className="quest-list">{visible.map((q) => <article key={q.id} className={q.done ? "quest done" : "quest"}><button className="quest-check" disabled={Boolean(q.done)} onClick={() => void act({ action: "completeQuest", questId: q.id }, `任务完成：经验 +${q.reward}`)}>{q.done ? "✓" : ""}</button><div className="quest-text"><span className={`quest-type type-${q.type}`}>{q.type}</span><h4>{q.title}</h4><p>{q.detail}</p></div><div className="reward"><span>✦</span><b>+{q.reward}</b></div></article>)}</div></section>;
}

function Focus({ data, timer, running, setRunning, setTimer, focusMinutes, setFocusMinutes, act }: { data: GameData; timer: string; running: boolean; setRunning: (v: boolean) => void; setTimer: React.Dispatch<React.SetStateAction<number>>; focusMinutes: number; setFocusMinutes: (v: number) => void; act: (p: Record<string, unknown>, s: string) => Promise<void> }) {
  function choose(minutes: number) { if (running) return; setFocusMinutes(minutes); setTimer(minutes * 60); }
  return <section className="focus-layout"><div className="focus-stage glass-card"><div className="section-intro"><small>静谧秘境</small><h2>专注沙漏</h2><p>隔绝干扰、积累阅历，完成后自动同步到小组实力。</p></div><div className="focus-modes">{[["轻旅",15],["标准",25],["深潜",45],["长征",60]].map(([name,minutes]) => <button key={name} className={focusMinutes === minutes ? "active" : ""} onClick={() => choose(Number(minutes))}><b>{minutes}</b><span>{name}</span></button>)}</div><div className={running ? "timer-orbit giant running" : "timer-orbit giant"}><div className="orbit-dot" /><div className="timer-face"><small>{running ? "正在专注" : "准备启程"}</small><strong>{timer}</strong><span>{focusMinutes >= 45 ? "深度工作" : "专注修行"} · 云端计时</span></div></div><div className="timer-actions"><button className="secondary-button" onClick={() => { setRunning(false); setTimer(focusMinutes * 60); }}>重置</button><button className="primary-round" onClick={() => setRunning(!running)}>{running ? "Ⅱ" : "▶"}</button><button className="secondary-button" onClick={() => setTimer((v) => v + 5 * 60)}>+5 分钟</button></div></div><aside className="focus-insights"><div className="glass-card focus-stat"><small>专注总览</small><h3>{data.user.focusMinutes}<em> 分钟</em></h3><div className="focus-bars">{[35,62,45,80,55,72,40].map((v,i)=><i key={i} style={{height:`${v}%`}} />)}</div><p>坚持完成一次专注秘境，小组实力将增加 <b>{focusMinutes * 2}</b>。</p></div><div className="glass-card focus-history"><div className="card-heading"><div><small>历练手记</small><h3>最近专注</h3></div><span>◷</span></div>{data.focusHistory.length ? data.focusHistory.map(r => <article key={r.id}><span>静谧秘境</span><b>{r.minutes} 分钟</b><small>{new Date(r.created_at).toLocaleDateString("zh-CN")}</small></article>) : <div className="no-history">完成第一次专注后，记录会出现在这里。</div>}</div><button className="quick-finish" onClick={() => void act({action:"focus",minutes:focusMinutes},`已记录 ${focusMinutes} 分钟专注`)}>直接记录已完成专注</button></aside></section>;
}

const catalog = [
  { key:"rest-pass", icon:"☕", name:"悠闲下午券", note:"允许自己无负担地休息半天", price:80, tone:"jade" },
  { key:"movie-night", icon:"✧", name:"星空电影夜", note:"挑一部想看的电影认真享受", price:120, tone:"blue" },
  { key:"wish-tea", icon:"♨", name:"心愿甜品", note:"兑换一份期待已久的小奖励", price:60, tone:"gold" },
  { key:"adventure-day", icon:"⌁", name:"远方冒险日", note:"安排一场城市探索或近郊旅行", price:260, tone:"violet" },
];

function Bag({ data, act }: { data: GameData; act: (p: Record<string, unknown>, s: string) => Promise<void> }) {
  const owned = new Map(data.inventory.map(i => [i.item_key, i.quantity]));
  const achievements = [
    { icon:"✦", name:"初见之章", note:"完成第一个任务", unlocked:data.quests.some(q=>q.done) },
    { icon:"◷", name:"静心之证", note:"累计专注 60 分钟", unlocked:data.user.focusMinutes>=60 },
    { icon:"♙", name:"同行契约", note:"加入一个五人小组", unlocked:Boolean(data.team) },
    { icon:"☼", name:"引路星辉", note:"成功邀请一位好友", unlocked:data.user.referralCount>0 },
  ];
  return <section className="bag-panel"><div className="bag-hero"><div><span className="chapter">旅行者行囊</span><h2>收藏每一段认真生活</h2><p>任务获得的星辉，可以兑换你为自己设定的现实奖励。</p></div><div className="bag-balance"><span>当前星辉</span><strong>✦ {data.user.coins}</strong><small>完成任务与邀请好友均可获得</small></div></div><div className="bag-grid"><section className="glass-card reward-shop"><div className="card-heading"><div><small>心愿商店</small><h3>现实奖励</h3></div><span>每一次兑换，都是对努力的回应</span></div><div className="reward-grid">{catalog.map(item => <article key={item.key} className={`reward-item ${item.tone}`}><div className="reward-icon">{item.icon}</div><div><h4>{item.name}</h4><p>{item.note}</p><span>✦ {item.price}</span></div><button disabled={data.user.coins<item.price} onClick={() => void act({action:"buyItem",itemKey:item.key},`已兑换「${item.name}」`)}>{owned.get(item.key) ? `再兑换 · 已有 ${owned.get(item.key)}` : "兑换"}</button></article>)}</div></section><aside className="glass-card inventory-card"><div className="card-heading"><div><small>我的收藏</small><h3>行囊物品</h3></div><span>◇</span></div>{data.inventory.length ? <div className="owned-list">{data.inventory.map(i => { const item=catalog.find(x=>x.key===i.item_key); return <article key={i.item_key}><span>{item?.icon}</span><div><b>{item?.name}</b><small>可随时兑现给自己</small></div><em>× {i.quantity}</em></article>})}</div> : <div className="empty-bag"><span>◇</span><p>行囊还是空的<br/>去心愿商店兑换第一份奖励吧。</p></div>}</aside><section className="glass-card achievement-card"><div className="card-heading"><div><small>星旅成就</small><h3>冒险徽章</h3></div><b>{achievements.filter(a=>a.unlocked).length}/{achievements.length} 已解锁</b></div><div className="achievement-grid">{achievements.map(a=><article key={a.name} className={a.unlocked ? "" : "locked"}><span>{a.icon}</span><b>{a.name}</b><small>{a.note}</small><em>{a.unlocked ? "已获得" : "未解锁"}</em></article>)}</div></section></div></section>;
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
