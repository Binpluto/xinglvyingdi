"use client";

import { useEffect, useMemo, useState } from "react";

type Quest = {
  id: number;
  title: string;
  detail: string;
  reward: number;
  type: "主线" | "日常" | "支线";
  done: boolean;
};

const initialQuests: Quest[] = [
  { id: 1, title: "完成晨间仪式", detail: "喝水 · 拉伸 · 写下今日目标", reward: 30, type: "日常", done: true },
  { id: 2, title: "推进「理想工作」主线", detail: "完成作品集首页的内容整理", reward: 80, type: "主线", done: false },
  { id: 3, title: "知识秘境：深度阅读", detail: "专注阅读 30 分钟并记录三点收获", reward: 45, type: "支线", done: false },
  { id: 4, title: "风之小径", detail: "户外散步 20 分钟", reward: 25, type: "日常", done: false },
];

const nav = [
  ["营地", "⌂"],
  ["任务", "✦"],
  ["专注", "◷"],
  ["行囊", "◇"],
];

export default function Home() {
  const [quests, setQuests] = useState(initialQuests);
  const [tab, setTab] = useState("营地");
  const [coins, setCoins] = useState(286);
  const [xp, setXp] = useState(680);
  const [timer, setTimer] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem("starcamp-state");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setQuests(data.quests ?? initialQuests);
        setCoins(data.coins ?? 286);
        setXp(data.xp ?? 680);
      } catch {}
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("starcamp-state", JSON.stringify({ quests, coins, xp }));
  }, [quests, coins, xp]);

  useEffect(() => {
    if (!running || timer <= 0) return;
    const id = window.setInterval(() => setTimer((value) => value - 1), 1000);
    return () => window.clearInterval(id);
  }, [running, timer]);

  useEffect(() => {
    if (timer === 0 && running) {
      setRunning(false);
      setCoins((value) => value + 20);
      setXp((value) => value + 40);
      setToast("秘境挑战完成：经验 +40，星辉 +20");
      setTimeout(() => setToast(""), 2800);
    }
  }, [timer, running]);

  const done = quests.filter((q) => q.done).length;
  const progress = Math.round((done / quests.length) * 100);
  const time = useMemo(
    () => `${String(Math.floor(timer / 60)).padStart(2, "0")}:${String(timer % 60).padStart(2, "0")}`,
    [timer],
  );

  function completeQuest(id: number) {
    const quest = quests.find((item) => item.id === id);
    if (!quest || quest.done) return;
    setQuests((items) => items.map((item) => item.id === id ? { ...item, done: true } : item));
    setCoins((value) => value + Math.ceil(quest.reward / 2));
    setXp((value) => value + quest.reward);
    setToast(`任务完成：经验 +${quest.reward}，星辉 +${Math.ceil(quest.reward / 2)}`);
    setTimeout(() => setToast(""), 2800);
  }

  return (
    <main className="app-shell">
      <div className="aurora aurora-one" />
      <div className="aurora aurora-two" />

      <aside className="side-nav">
        <button className="brand-mark" aria-label="星旅营地">✧</button>
        <div className="nav-stack">
          {nav.map(([label, icon]) => (
            <button key={label} className={tab === label ? "nav-item active" : "nav-item"} onClick={() => setTab(label)}>
              <span>{icon}</span><small>{label}</small>
            </button>
          ))}
        </div>
        <button className="nav-item"><span>⚙</span><small>设置</small></button>
      </aside>

      <section className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">STARCAMP · 星旅营地</p>
            <h1>早上好，旅行者</h1>
          </div>
          <div className="top-actions">
            <div className="currency"><span>✦</span><b>{coins}</b></div>
            <button className="icon-button" aria-label="通知">♢<i /></button>
            <button className="avatar" aria-label="个人中心"><span>旅</span><em>Lv. 12</em></button>
          </div>
        </header>

        <div className="page-grid">
          <section className="hero-card">
            <div className="hero-copy">
              <span className="chapter">第二章 · 向着群星</span>
              <h2>把愿望写进<br />今日的冒险</h2>
              <p>每一次微小行动，都会成为你抵达理想世界的坐标。</p>
              <button className="gold-button" onClick={() => document.getElementById("quest-board")?.scrollIntoView({ behavior: "smooth" })}>
                查看今日委托 <span>→</span>
              </button>
            </div>
            <div className="hero-world" aria-hidden="true">
              <div className="sun-disc"><span>✦</span></div>
              <div className="mountain mountain-a" />
              <div className="mountain mountain-b" />
              <div className="floating-island island-a"><i /></div>
              <div className="floating-island island-b"><i /></div>
              <div className="cloud cloud-a" />
              <div className="cloud cloud-b" />
            </div>
            <div className="hero-progress">
              <div className="level-seal">12</div>
              <div><span>冒险阅历</span><b>{xp} / 1000</b><div className="progress-track"><i style={{ width: `${Math.min(xp / 10, 100)}%` }} /></div></div>
            </div>
          </section>

          <aside className="profile-card glass-card">
            <div className="card-heading"><div><small>旅行者档案</small><h3>今日状态</h3></div><button>•••</button></div>
            <div className="radar-wrap">
              <div className="radar">
                <i /><i /><i /><i />
                <div className="radar-fill" />
              </div>
              <span className="r-label r1">健康 72</span><span className="r-label r2">成长 84</span>
              <span className="r-label r3">关系 66</span><span className="r-label r4">心境 78</span>
            </div>
            <blockquote>“不必追赶太阳，你本身就是光。”</blockquote>
          </aside>

          <section className="quest-card glass-card" id="quest-board">
            <div className="card-heading">
              <div><small>冒险家协会</small><h3>今日委托</h3></div>
              <div className="completion"><b>{done}/{quests.length}</b><span>完成 {progress}%</span></div>
            </div>
            <div className="quest-list">
              {quests.map((quest) => (
                <article key={quest.id} className={quest.done ? "quest done" : "quest"}>
                  <button className="quest-check" onClick={() => completeQuest(quest.id)} aria-label={`完成${quest.title}`}>{quest.done ? "✓" : ""}</button>
                  <div className="quest-text"><span className={`quest-type type-${quest.type}`}>{quest.type}</span><h4>{quest.title}</h4><p>{quest.detail}</p></div>
                  <div className="reward"><span>✦</span><b>+{quest.reward}</b></div>
                </article>
              ))}
            </div>
          </section>

          <aside className="focus-card glass-card">
            <div className="card-heading"><div><small>静谧秘境</small><h3>专注沙漏</h3></div><span className="moon">☾</span></div>
            <div className={running ? "timer-orbit running" : "timer-orbit"}>
              <div className="orbit-dot" />
              <div className="timer-face"><small>{running ? "正在专注" : "准备启程"}</small><strong>{time}</strong><span>作品集 · 深度工作</span></div>
            </div>
            <div className="timer-actions">
              <button className="secondary-button" onClick={() => { setRunning(false); setTimer(25 * 60); }}>重置</button>
              <button className="primary-round" onClick={() => setRunning(!running)}>{running ? "Ⅱ" : "▶"}</button>
              <button className="secondary-button" onClick={() => setTimer((v) => v + 5 * 60)}>+5 分</button>
            </div>
          </aside>

          <section className="journey-card glass-card">
            <div className="card-heading"><div><small>本周旅程</small><h3>成长轨迹</h3></div><button className="text-button">查看手记 →</button></div>
            <div className="week-chart">
              {[48, 70, 40, 88, 62, 76, 34].map((height, index) => (
                <div className="day" key={index}><div className="bar"><i style={{ height: `${height}%` }} /></div><span>{["一","二","三","四","五","六","日"][index]}</span></div>
              ))}
            </div>
            <div className="weekly-insight"><span>✦</span><p><b>本周累计专注 8.5 小时</b><br />比上周多走了 2,340 步，坚持得很好。</p></div>
          </section>
        </div>
      </section>
      {toast && <div className="toast">✦ {toast}</div>}
    </main>
  );
}
