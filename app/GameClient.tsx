"use client";

import { useEffect, useMemo, useState } from "react";

type Quest = { id: number; title: string; detail: string; reward: number; type: string; source: string; dueAt: string | null; done: number };
type Member = { display_name: string; email: string; xp: number; focus_minutes: number; strength: number };
type Team = { id: number; name: string; code: string; owner_email: string; member_count: number; members: Member[] };
type RankTeam = { id: number; name: string; code: string; members: number; strength: number; focus_minutes: number };
type FocusRecord = { id: number; minutes: number; created_at: string };
type InventoryItem = { item_key: string; quantity: number; acquired_at: string };
type RealmProgress = { realmId: string; completedRegions: number; unlocked: number; target: number; unlockedAt: string | null };
type GameData = {
  user: { email: string; name: string; inviteCode: string; invitedBy: string | null; xp: number; coins: number; focusMinutes: number; referralCount: number };
  quests: Quest[];
  focusHistory: FocusRecord[];
  inventory: InventoryItem[];
  realmProgress: RealmProgress[];
  team: Team | null;
  leaderboard: RankTeam[];
};

type Realm = {
  id: string;
  name: string;
  real: string;
  xpRequired: number;
  difficulty: string;
  taskReward: number;
  icon: string;
  style: string;
  title: string;
  story: string;
  quests: string[];
  boss: string;
  reward: string;
  hero: [string, string];
  campStory: string;
  trait: string;
};

const continents: Realm[] = [
  { id:"dawn", name:"曦华大陆", real:"亚洲", xpRequired:0, difficulty:"启程", taskReward:30, icon:"☼", style:"jade", title:"千城与古卷之地", story:"古老智慧与未来都市共存，完成学习、规划和长期成长任务。", quests:["知识古塔","习惯茶庭","千阶书院"], boss:"时间之龙", reward:"曦华罗盘", hero:["晨光落在古卷","新的知识正在苏醒"], campStory:"玉色山岚环绕营地，适合学习、规划与建立稳定习惯。", trait:"智慧 · 秩序 · 长期成长" },
  { id:"crown", name:"苍冠大陆", real:"欧洲", xpRequired:300, difficulty:"容易", taskReward:45, icon:"♜", style:"blue", title:"城堡与创造之地", story:"穿行艺术工坊与雾中古堡，挑战表达、创造和审美修行。", quests:["灵感画廊","工匠长街","诗人钟楼"], boss:"完美主义者", reward:"苍银羽笔", hero:["越过雾中古堡","让灵感成为作品"], campStory:"银蓝穹顶与古典拱窗守护创造，适合艺术、表达和精细打磨。", trait:"创造 · 审美 · 表达" },
  { id:"ember", name:"赤土大陆", real:"非洲", xpRequired:650, difficulty:"普通", taskReward:55, icon:"☀", style:"ember", title:"烈阳与生命之地", story:"辽阔草原回响着生命鼓点，锻炼健康、勇气与行动能力。", quests:["晨曦草原","勇气峡谷","生命绿洲"], boss:"倦怠巨兽", reward:"赤阳护符", hero:["烈阳点燃旷野","用行动回应生命"], campStory:"赤金阳光照亮辽阔草原，适合运动、健康与需要勇气的挑战。", trait:"生命 · 勇气 · 行动力" },
  { id:"storm", name:"风暴大陆", real:"北美洲", xpRequired:1100, difficulty:"进阶", taskReward:70, icon:"↯", style:"storm", title:"峡谷与革新之地", story:"从自由港驶向雷霆峡谷，完成事业、创新与突破类挑战。", quests:["创业者港","雷霆工坊","自由之路"], boss:"拖延风暴", reward:"先驱徽记", hero:["驾驭雷霆风暴","向未知发起突破"], campStory:"电光穿过峡谷与高塔，适合事业冲刺、创新实验与快速决策。", trait:"革新 · 突破 · 事业" },
  { id:"verdant", name:"森灵大陆", real:"南美洲", xpRequired:1700, difficulty:"困难", taskReward:85, icon:"❧", style:"forest", title:"雨林与心灵之地", story:"在繁茂雨林中理解情绪、关系和内在成长的神秘连接。", quests:["回声雨林","关系藤桥","心流瀑布"], boss:"迷惘之影", reward:"森灵种子", hero:["听见雨林回声","与内心重新连接"], campStory:"藤蔓、雨雾与萤火构成柔软庇护，适合情绪、关系和心灵成长。", trait:"关系 · 情绪 · 内在成长" },
  { id:"coral", name:"珊海群岛", real:"大洋洲", xpRequired:2400, difficulty:"艰深", taskReward:105, icon:"≈", style:"coral", title:"海风与平衡之地", story:"星罗岛屿守护生活的平衡，探索协作、休息与自在创造。", quests:["珊瑚学宫","月湾营地","群岛协作"], boss:"失衡海兽", reward:"潮汐贝冠", hero:["跟随温柔潮汐","找回生活的平衡"], campStory:"珊瑚海湾与月光潮汐舒展身心，适合休息、协作与自由创造。", trait:"平衡 · 协作 · 松弛" },
  { id:"polar", name:"极星大陆", real:"南极洲", xpRequired:3300, difficulty:"传说", taskReward:130, icon:"✦", style:"polar", title:"冰原与终章之地", story:"世界尽头的纯净冰原，只向真正理解自己的旅行者开放。", quests:["寂静冰原","极光神殿","世界之心"], boss:"旧日的自己", reward:"极星之证", hero:["在极光之下","看见真正的自己"], campStory:"冰晶与极光洗去噪音，适合深度反思、长期愿景与自我超越。", trait:"纯粹 · 反思 · 自我超越" },
];

const nav = [["营地", "⌂"], ["任务", "✦"], ["专注", "◷"], ["行囊", "◇"], ["小组", "♙"], ["世界", "◎"]];
const XP_PER_LEVEL = 100;
const levelFromXp = (xp: number) => Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1;

export default function GameClient({ identity, onLogout }: { identity: { email: string; name: string }; onLogout: () => Promise<void> }) {
  const [data, setData] = useState<GameData | null>(null);
  const [tab, setTab] = useState("营地");
  const [timer, setTimer] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState("");
  const [inviteInput, setInviteInput] = useState("");
  const [teamInput, setTeamInput] = useState("");
  const [teamName, setTeamName] = useState("");
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [activeRealmId, setActiveRealmId] = useState<string | null>(null);
  const [showLevelGuide, setShowLevelGuide] = useState(false);

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
  useEffect(() => {
    if (!data) return;
    const saved = window.localStorage.getItem("starcamp-active-realm");
    const realm = continents.find((continent) => continent.id === saved);
    const progress = data.realmProgress.find((item) => item.realmId === realm?.id);
    if (realm && progress?.unlocked) setActiveRealmId(realm.id);
    else if (saved) window.localStorage.removeItem("starcamp-active-realm");
  }, [data?.realmProgress]);

  async function load() {
    const res = await fetch("/api/game");
    const json = await res.json();
    if (res.status === 401) {
      await onLogout();
      return;
    }
    if (res.ok) setData(json); else notify(json.error ?? "云端同步失败");
  }

  async function act(payload: Record<string, unknown>, success: string) {
    const res = await fetch("/api/game", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const json = await res.json();
    if (res.status === 401) {
      await onLogout();
      return false;
    }
    if (!res.ok) {
      notify(json.error ?? "操作失败");
      return false;
    }
    setData(json);
    notify(success);
    return true;
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
  const level = levelFromXp(xp);
  const levelXp = xp % XP_PER_LEVEL;
  const activeRealm = continents.find((continent) => continent.id === activeRealmId) ?? null;

  if (!data) {
    return <main className="loading-world"><div className="loading-seal">✧</div><p>正在连接星旅世界…</p></main>;
  }

  return (
    <main className={`app-shell realm-${activeRealm?.style ?? "base"}`} data-realm={activeRealm?.id ?? "base"}>
      <div className="aurora aurora-one" /><div className="aurora aurora-two" />
      <aside className="side-nav">
        <button className="brand-mark" aria-label="星旅营地">{activeRealm?.icon ?? "✧"}</button>
        <div className="nav-stack">
          {nav.map(([label, icon]) => <button key={label} className={tab === label ? "nav-item active" : "nav-item"} onClick={() => setTab(label)}><span>{icon}</span><small>{label}</small></button>)}
        </div>
        <button className="nav-item signout-link" onClick={() => void onLogout()}><span>↪</span><small>退出</small></button>
      </aside>

      <section className="main-content">
        <header className="topbar">
          <div><p className="eyebrow">{activeRealm ? `${activeRealm.real.toUpperCase()} REALM · ${activeRealm.trait}` : "STARCAMP · 星旅营地"}</p><h1>{tab === "营地" ? `早上好，${displayName}` : tab}</h1></div>
          <div className="top-actions">
            {activeRealm && <div className="realm-status"><span>{activeRealm.icon}</span><div><small>当前驻扎</small><b>{activeRealm.name}</b></div><button onClick={() => setTab("世界")}>切换</button><button aria-label="离开当前大陆" onClick={() => { setActiveRealmId(null); window.localStorage.removeItem("starcamp-active-realm"); }}>×</button></div>}
            <div className="cloud-state"><i /> 云端已同步</div>
            <div className="currency"><span>✦</span><b>{coins}</b></div>
            <div className="level-menu">
              <button className="avatar" aria-label="查看升级规则" aria-expanded={showLevelGuide} onClick={() => setShowLevelGuide((visible) => !visible)}><span>{displayName.slice(0, 1)}</span><em>Lv. {level}</em></button>
              {showLevelGuide && <aside className="level-guide">
                <div className="level-guide-head"><span>Lv.{level}</span><div><small>距离 Lv.{level + 1}</small><b>{levelXp} / {XP_PER_LEVEL} EXP</b></div><button aria-label="关闭升级说明" onClick={() => setShowLevelGuide(false)}>×</button></div>
                <div className="level-guide-progress"><i style={{ width: `${levelXp}%` }} /></div>
                <h4>旅行者升级规则</h4>
                <p>从 Lv.1、0 EXP 开始，每累计 100 EXP 提升 1 级。</p>
                <ul><li><span>完成任务</span><b>+25～80 EXP</b></li><li><span>专注修行</span><b>每分钟 +2 EXP</b></li><li><span>邀请好友</span><b>双方 +100 / +200 EXP</b></li></ul>
                <div className="continent-level-rules"><b>大陆解锁门槛</b>{continents.map((realm) => <span key={realm.id}><i>{realm.icon}</i>{realm.name}<em>{realm.id === "dawn" ? "默认解锁" : `${realm.xpRequired} EXP · ${realm.difficulty}`}</em></span>)}</div>
                <small className="level-world-note">曦华大陆默认开放。完成当前大陆的 3 项任务后，可自由选择下一大陆；累计 EXP 达到该大陆门槛时正式解锁。</small>
              </aside>}
            </div>
          </div>
        </header>

        {tab === "营地" && <Camp data={data} done={done} setTab={setTab} act={act} realm={activeRealm} />}
        {tab === "任务" && <QuestBoard data={data} done={done} act={act} />}
        {tab === "专注" && <Focus data={data} timer={time} running={running} setRunning={setRunning} setTimer={setTimer} focusMinutes={focusMinutes} setFocusMinutes={setFocusMinutes} act={act} />}
        {tab === "行囊" && <Bag data={data} act={act} />}
        {tab === "小组" && <TeamHall data={data} teamName={teamName} setTeamName={setTeamName} teamInput={teamInput} setTeamInput={setTeamInput} act={act} copy={copy} />}
        {tab === "世界" && <World data={data} act={act} activeRealmId={activeRealmId} onEnter={(realm) => { setActiveRealmId(realm.id); window.localStorage.setItem("starcamp-active-realm", realm.id); setTab("营地"); notify(`已进入${realm.name}：全站环境已切换`); }} onLeave={() => { setActiveRealmId(null); window.localStorage.removeItem("starcamp-active-realm"); }} />}
      </section>

      <button className="invite-fab" onClick={() => setTab("小组")}><span>♙</span>邀请好友</button>
      {tab === "营地" && !data.user.invitedBy && <div className="invite-banner"><div><b>来自好友的星光？</b><span>填写邀请码，你与邀请人都能获得奖励</span></div><input value={inviteInput} onChange={(e) => setInviteInput(e.target.value)} placeholder="输入好友邀请码" /><button onClick={() => void act({ action: "redeemInvite", code: inviteInput }, "邀请绑定成功，双方奖励已到账")}>领取奖励</button></div>}
      {toast && <div className="toast">✦ {toast}</div>}
    </main>
  );
}

function Camp({ data, done, setTab, act, realm }: { data: GameData; done: number; setTab: (v: string) => void; act: (p: Record<string, unknown>, s: string) => Promise<boolean>; realm: Realm | null }) {
  const calendarAgenda = data.quests.filter((quest) => quest.dueAt && !quest.done).slice(0, 3);
  const agenda = calendarAgenda.length ? calendarAgenda.map((quest) => ({
    time: quest.dueAt?.length === 10 ? "全天" : new Date(quest.dueAt!).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }),
    title: quest.title,
    detail: quest.detail,
    state: quest.source === "google" ? "Google" : quest.source === "outlook" ? "Outlook" : quest.source === "icloud" ? "iCloud" : "日历",
  })) : [
    { time: "08:30", title: "晨间仪式", detail: "补充能量，确定今日航向", state: "已完成" },
    { time: "14:00", title: "知识秘境", detail: "30 分钟无干扰阅读", state: "待出发" },
    { time: "20:30", title: "篝火复盘", detail: "记录今天的三个闪光点", state: "未开始" },
  ];
  return <><div className="page-grid">
    <section className="hero-card">
      <div className="hero-copy"><span className="chapter">{realm ? `${realm.name} · ${realm.trait}` : "第三章 · 与同伴共赴群星"}</span><h2>{realm ? realm.hero[0] : "一个人的愿望"}<br />{realm ? realm.hero[1] : "汇成世界的光"}</h2><p>{realm ? realm.campStory : "你的每一次行动，都在为小组积累实力，也让世界版图更加明亮。"}</p><button className="gold-button" onClick={() => setTab("世界")}>{realm ? "查看大陆版图" : "进入星旅世界"} <span>→</span></button></div>
      <div className="hero-world" aria-hidden="true"><div className="sun-disc"><span>✦</span></div><div className="mountain mountain-a" /><div className="mountain mountain-b" /><div className="floating-island island-a"><i /></div><div className="floating-island island-b"><i /></div><div className="cloud cloud-a" /></div>
      <div className="hero-progress"><div className="level-seal">{levelFromXp(data.user.xp)}</div><div><span>冒险阅历 · Lv.{levelFromXp(data.user.xp)}</span><b>{data.user.xp} EXP</b><div className="progress-track"><i style={{ width: `${data.user.xp % XP_PER_LEVEL}%` }} /></div></div></div>
    </section>
    <aside className="profile-card glass-card"><div className="card-heading"><div><small>旅行者档案</small><h3>云端旅程</h3></div><span className="sync-orb">✓</span></div><div className="cloud-stats"><div><b>{data.user.focusMinutes}</b><span>累计专注 / 分钟</span></div><div><b>{data.user.referralCount}</b><span>成功邀请 / 人</span></div><div><b>{data.team?.member_count ?? 0}</b><span>同行伙伴 / 人</span></div></div><blockquote>“因相遇而出发，因同行而抵达。”</blockquote></aside>
    <QuestBoard data={data} done={done} act={act} compact />
    <aside className="focus-card glass-card mini-focus"><div className="card-heading"><div><small>共同旅程</small><h3>{data.team?.name ?? "尚未加入小组"}</h3></div><span className="moon">♙</span></div>{data.team ? <><div className="team-power"><small>小组当前实力</small><strong>{data.team.members.reduce((n, m) => n + m.strength, 0).toLocaleString()}</strong><span>世界排名将实时累计每位成员的经验与专注时间</span></div><button className="wide-button" onClick={() => setTab("小组")}>查看小组营地</button></> : <div className="empty-team"><span>♙</span><p>创建或加入最多 5 人的小组，和伙伴共同成长。</p><button className="wide-button" onClick={() => setTab("小组")}>寻找同行者</button></div>}</aside>
  </div><div className="camp-bottom-grid">
    <section className="glass-card camp-agenda"><div className="card-heading"><div><small>今日旅程</small><h3>冒险日程</h3></div><button className="text-button" onClick={() => setTab("任务")}>管理任务 →</button></div>{agenda.map((item, index) => <div className="agenda-line" key={`${item.title}-${index}`}><i /><span>{item.time}</span><div><b>{item.title}</b><small>{item.detail}</small></div><em>{item.state}</em></div>)}</section>
    <section className="glass-card camp-weather"><div className="card-heading"><div><small>营地天气</small><h3>今日能量</h3></div><span>☀</span></div><div className="energy-ring"><strong>{Math.min(100, 58 + done * 9)}%</strong><small>状态晴朗</small></div><p>今日已经获得 <b>{data.quests.filter(q => q.done).reduce((n,q) => n + q.reward, 0)}</b> 点历练。完成下一项委托，可点亮连续行动星。</p></section>
    <section className="glass-card camp-achievement"><div className="card-heading"><div><small>最近获得</small><h3>冒险回响</h3></div><button className="text-button" onClick={() => setTab("行囊")}>打开行囊 →</button></div><div className="mini-badges"><div><span>✦</span><b>初心者</b><small>完成首个任务</small></div><div><span>◷</span><b>静心者</b><small>累计专注 60 分钟</small></div><div className={data.user.referralCount ? "" : "locked"}><span>♙</span><b>引路人</b><small>邀请一位好友</small></div></div></section>
  </div></>;
}

function QuestBoard({ data, done, act, compact = false }: { data: GameData; done: number; act: (p: Record<string, unknown>, s: string) => Promise<boolean>; compact?: boolean }) {
  const [filter, setFilter] = useState("全部");
  const [creating, setCreating] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarUrl, setCalendarUrl] = useState("");
  const [calendarText, setCalendarText] = useState("");
  const [calendarFile, setCalendarFile] = useState("");
  const [provider, setProvider] = useState("google");
  const [rangeDays, setRangeDays] = useState(7);
  const [importing, setImporting] = useState(false);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [type, setType] = useState("日常");
  const [editingQuestId, setEditingQuestId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDetail, setEditDetail] = useState("");
  const [editType, setEditType] = useState("日常");
  const [savingQuest, setSavingQuest] = useState(false);
  const visible = data.quests.filter(q => filter === "全部" || (filter === "日历" ? q.source !== "manual" : q.type === filter));
  async function create() {
    await act({ action: "createQuest", title, detail, type }, "新委托已加入任务卷轴");
    setTitle(""); setDetail(""); setCreating(false);
  }
  async function importCalendar() {
    if (!calendarUrl.trim() && !calendarText) return;
    setImporting(true);
    const imported = await act({ action: "importCalendar", calendarUrl: calendarUrl.trim(), calendarText, provider: calendarText ? "ics" : provider, rangeDays }, "日历日程已转换为云端任务");
    setImporting(false);
    if (!imported) return;
    setCalendarUrl("");
    setCalendarText("");
    setCalendarFile("");
    setFilter("日历");
  }
  async function chooseCalendarFile(file?: File) {
    if (!file) return;
    setCalendarFile(file.name);
    setCalendarText(await file.text());
    setProvider("ics");
  }
  function beginEdit(quest: Quest) {
    setEditingQuestId(quest.id);
    setEditTitle(quest.title);
    setEditDetail(quest.detail);
    setEditType(quest.type);
  }
  async function saveEdit() {
    if (editingQuestId === null) return;
    setSavingQuest(true);
    const saved = await act(
      { action: "editQuest", questId: editingQuestId, title: editTitle, detail: editDetail, type: editType },
      "任务内容已更新并保存到云端",
    );
    setSavingQuest(false);
    if (saved) setEditingQuestId(null);
  }
  const sourceLabel = (source: string) => source === "google" ? "Google" : source === "outlook" ? "Outlook" : source === "icloud" ? "iCloud" : source === "ics" ? "ICS" : "";
  return <section className={`quest-card glass-card ${compact ? "" : "full-panel enriched-quests"}`}><div className="card-heading"><div><small>冒险家协会 · 云端委托</small><h3>今日任务</h3></div><div className="completion"><b>{done}/{data.quests.length}</b><span>完成 {Math.round(done / Math.max(data.quests.length, 1) * 100)}%</span></div></div>{!compact && <><div className="quest-toolbar"><div>{["全部","主线","日常","支线","日历"].map(v => <button key={v} className={filter === v ? "active" : ""} onClick={() => setFilter(v)}>{v}</button>)}</div><div className="quest-toolbar-actions"><button className="calendar-button" onClick={() => setCalendarOpen(!calendarOpen)}>▦ 同步日历</button><button className="new-quest-button" onClick={() => setCreating(!creating)}>＋ 发布新委托</button></div></div>{calendarOpen && <section className="calendar-portal"><div className="calendar-heading"><div><small>星历传送门</small><h3>从常用日历导入每日任务</h3><p>选择未来范围，日程会自动去重并保存到你的云端任务。订阅链接不会被保存。</p></div><span>◫</span></div><div className="provider-grid">{[
    ["google","G","Google Calendar","使用“日历设置 → 集成日历 → iCal 格式的私密网址”"],
    ["outlook","O","Outlook / Microsoft 365","使用“设置 → 共享日历 → 发布日历 → ICS”"],
    ["icloud","◆","Apple iCloud","将日历设为公开并复制 webcal 订阅链接"],
    ["ics","↓","通用 ICS 文件","适用于飞书、钉钉、Notion Calendar 等导出的 .ics 文件"],
  ].map(([key,icon,name,note]) => <button key={key} className={provider === key ? `provider-card ${key} active` : `provider-card ${key}`} onClick={() => setProvider(key)}><span>{icon}</span><div><b>{name}</b><small>{note}</small></div><em>{provider === key ? "已选择" : "选择"}</em></button>)}</div><div className="calendar-import-row"><label className="calendar-link-field"><span>订阅链接</span><input value={calendarUrl} disabled={provider === "ics" && Boolean(calendarText)} onChange={(event) => setCalendarUrl(event.target.value)} placeholder="粘贴 https:// 或 webcal:// 开头的 ICS 链接" /></label><label className="calendar-range"><span>导入范围</span><select value={rangeDays} onChange={(event) => setRangeDays(Number(event.target.value))}><option value={1}>今天</option><option value={7}>未来 7 天</option><option value={14}>未来 14 天</option><option value={30}>未来 30 天</option></select></label><label className="ics-upload"><input type="file" accept=".ics,text/calendar" onChange={(event) => void chooseCalendarFile(event.target.files?.[0])} /><span>{calendarFile ? `✓ ${calendarFile}` : "上传 .ics 文件"}</span></label><button className="calendar-import-button" disabled={importing || (!calendarUrl.trim() && !calendarText)} onClick={() => void importCalendar()}>{importing ? "正在穿越星门…" : "导入任务"}</button></div><p className="calendar-privacy">安全提示：请勿分享日历订阅链接；系统只读取日程并保存任务，不保存链接或邮箱密码。</p></section>}{creating && <div className="quest-composer"><input value={title} onChange={e => setTitle(e.target.value)} placeholder="任务名称，例如：完成作品集第二页" /><input value={detail} onChange={e => setDetail(e.target.value)} placeholder="写下清晰的完成标准" /><select value={type} onChange={e => setType(e.target.value)}><option>日常</option><option>支线</option><option>主线</option></select><button onClick={() => void create()}>加入卷轴</button></div>}<div className="quest-summary-row"><div><span>✦</span><b>{data.quests.reduce((n,q) => n + (q.done ? q.reward : 0),0)}</b><small>今日已获经验</small></div><div><span>◇</span><b>{data.quests.filter(q => !q.done).length}</b><small>待完成委托</small></div><div><span>▦</span><b>{data.quests.filter(q => q.source !== "manual").length}</b><small>日历导入任务</small></div></div></>}<div className="quest-list">{visible.map((q) => <article key={q.id} className={q.done ? "quest done" : "quest"}>{editingQuestId === q.id ? <div className="quest-edit-form"><div className="quest-edit-fields"><label><span>任务名称</span><input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} maxLength={80} autoFocus /></label><label className="quest-edit-detail"><span>任务说明</span><textarea value={editDetail} onChange={(event) => setEditDetail(event.target.value)} maxLength={180} rows={2} /></label><label><span>任务类型</span><select value={editType} onChange={(event) => setEditType(event.target.value)}><option>主线</option><option>日常</option><option>支线</option></select></label></div><div className="quest-edit-actions"><button onClick={() => setEditingQuestId(null)} disabled={savingQuest}>取消</button><button className="save" onClick={() => void saveEdit()} disabled={savingQuest || editTitle.trim().length < 2}>{savingQuest ? "保存中…" : "保存修改"}</button></div></div> : <><button className="quest-check" disabled={Boolean(q.done)} onClick={() => void act({ action: "completeQuest", questId: q.id }, `任务完成：经验 +${q.reward}`)}>{q.done ? "✓" : ""}</button><div className="quest-text"><div className="quest-badges"><span className={`quest-type type-${q.type}`}>{q.type}</span>{q.source !== "manual" && <span className={`calendar-source source-${q.source}`}>▦ {sourceLabel(q.source)}</span>}{q.dueAt && <time>{q.dueAt.length === 10 ? new Date(`${q.dueAt}T12:00:00`).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }) : new Date(q.dueAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}</time>}</div><h4>{q.title}</h4><p>{q.detail}</p></div><button className="quest-edit-button" aria-label={`编辑任务：${q.title}`} onClick={() => beginEdit(q)}>✎<span>编辑</span></button><div className="reward"><span>✦</span><b>+{q.reward}</b></div></>}</article>)}</div></section>;
}

function Focus({ data, timer, running, setRunning, setTimer, focusMinutes, setFocusMinutes, act }: { data: GameData; timer: string; running: boolean; setRunning: (v: boolean) => void; setTimer: React.Dispatch<React.SetStateAction<number>>; focusMinutes: number; setFocusMinutes: (v: number) => void; act: (p: Record<string, unknown>, s: string) => Promise<boolean> }) {
  function choose(minutes: number) { if (running) return; setFocusMinutes(minutes); setTimer(minutes * 60); }
  return <section className="focus-layout"><div className="focus-stage glass-card"><div className="section-intro"><small>静谧秘境</small><h2>专注沙漏</h2><p>隔绝干扰、积累阅历，完成后自动同步到小组实力。</p></div><div className="focus-modes">{[["轻旅",15],["标准",25],["深潜",45],["长征",60]].map(([name,minutes]) => <button key={name} className={focusMinutes === minutes ? "active" : ""} onClick={() => choose(Number(minutes))}><b>{minutes}</b><span>{name}</span></button>)}</div><div className={running ? "timer-orbit giant running" : "timer-orbit giant"}><div className="orbit-dot" /><div className="timer-face"><small>{running ? "正在专注" : "准备启程"}</small><strong>{timer}</strong><span>{focusMinutes >= 45 ? "深度工作" : "专注修行"} · 云端计时</span></div></div><div className="timer-actions"><button className="secondary-button" onClick={() => { setRunning(false); setTimer(focusMinutes * 60); }}>重置</button><button className="primary-round" onClick={() => setRunning(!running)}>{running ? "Ⅱ" : "▶"}</button><button className="secondary-button" onClick={() => setTimer((v) => v + 5 * 60)}>+5 分钟</button></div></div><aside className="focus-insights"><div className="glass-card focus-stat"><small>专注总览</small><h3>{data.user.focusMinutes}<em> 分钟</em></h3><div className="focus-bars">{[35,62,45,80,55,72,40].map((v,i)=><i key={i} style={{height:`${v}%`}} />)}</div><p>坚持完成一次专注秘境，小组实力将增加 <b>{focusMinutes * 2}</b>。</p></div><div className="glass-card focus-history"><div className="card-heading"><div><small>历练手记</small><h3>最近专注</h3></div><span>◷</span></div>{data.focusHistory.length ? data.focusHistory.map(r => <article key={r.id}><span>静谧秘境</span><b>{r.minutes} 分钟</b><small>{new Date(r.created_at).toLocaleDateString("zh-CN")}</small></article>) : <div className="no-history">完成第一次专注后，记录会出现在这里。</div>}</div><button className="quick-finish" onClick={() => void act({action:"focus",minutes:focusMinutes},`已记录 ${focusMinutes} 分钟专注`)}>直接记录已完成专注</button></aside></section>;
}

const catalog = [
  { key:"rest-pass", icon:"☕", name:"悠闲下午券", note:"允许自己无负担地休息半天", price:80, tone:"jade" },
  { key:"movie-night", icon:"✧", name:"星空电影夜", note:"挑一部想看的电影认真享受", price:120, tone:"blue" },
  { key:"wish-tea", icon:"♨", name:"心愿甜品", note:"兑换一份期待已久的小奖励", price:60, tone:"gold" },
  { key:"adventure-day", icon:"⌁", name:"远方冒险日", note:"安排一场城市探索或近郊旅行", price:260, tone:"violet" },
];

function Bag({ data, act }: { data: GameData; act: (p: Record<string, unknown>, s: string) => Promise<boolean> }) {
  const owned = new Map(data.inventory.map(i => [i.item_key, i.quantity]));
  const achievements = [
    { icon:"✦", name:"初见之章", note:"完成第一个任务", unlocked:data.quests.some(q=>q.done) },
    { icon:"◷", name:"静心之证", note:"累计专注 60 分钟", unlocked:data.user.focusMinutes>=60 },
    { icon:"♙", name:"同行契约", note:"加入一个五人小组", unlocked:Boolean(data.team) },
    { icon:"☼", name:"引路星辉", note:"成功邀请一位好友", unlocked:data.user.referralCount>0 },
  ];
  return <section className="bag-panel"><div className="bag-hero"><div><span className="chapter">旅行者行囊</span><h2>收藏每一段认真生活</h2><p>任务获得的星辉，可以兑换你为自己设定的现实奖励。</p></div><div className="bag-balance"><span>当前星辉</span><strong>✦ {data.user.coins}</strong><small>完成任务与邀请好友均可获得</small></div></div><div className="bag-grid"><section className="glass-card reward-shop"><div className="card-heading"><div><small>心愿商店</small><h3>现实奖励</h3></div><span>每一次兑换，都是对努力的回应</span></div><div className="reward-grid">{catalog.map(item => <article key={item.key} className={`reward-item ${item.tone}`}><div className="reward-icon">{item.icon}</div><div><h4>{item.name}</h4><p>{item.note}</p><span>✦ {item.price}</span></div><button disabled={data.user.coins<item.price} onClick={() => void act({action:"buyItem",itemKey:item.key},`已兑换「${item.name}」`)}>{owned.get(item.key) ? `再兑换 · 已有 ${owned.get(item.key)}` : "兑换"}</button></article>)}</div></section><aside className="glass-card inventory-card"><div className="card-heading"><div><small>我的收藏</small><h3>行囊物品</h3></div><span>◇</span></div>{data.inventory.length ? <div className="owned-list">{data.inventory.map(i => { const item=catalog.find(x=>x.key===i.item_key); return <article key={i.item_key}><span>{item?.icon}</span><div><b>{item?.name}</b><small>可随时兑现给自己</small></div><em>× {i.quantity}</em></article>})}</div> : <div className="empty-bag"><span>◇</span><p>行囊还是空的<br/>去心愿商店兑换第一份奖励吧。</p></div>}</aside><section className="glass-card achievement-card"><div className="card-heading"><div><small>星旅成就</small><h3>冒险徽章</h3></div><b>{achievements.filter(a=>a.unlocked).length}/{achievements.length} 已解锁</b></div><div className="achievement-grid">{achievements.map(a=><article key={a.name} className={a.unlocked ? "" : "locked"}><span>{a.icon}</span><b>{a.name}</b><small>{a.note}</small><em>{a.unlocked ? "已获得" : "未解锁"}</em></article>)}</div></section></div></section>;
}

function TeamHall({ data, teamName, setTeamName, teamInput, setTeamInput, act, copy }: { data: GameData; teamName: string; setTeamName: (v: string) => void; teamInput: string; setTeamInput: (v: string) => void; act: (p: Record<string, unknown>, s: string) => Promise<boolean>; copy: (v: string, s: string) => Promise<void> }) {
  return <section className="social-panel">
    <div className="invite-card glass-card"><div><small>好友邀请</small><h2>分享一束星光</h2><p>好友首次使用你的邀请码，你获得 <b>200 EXP + 120 星辉</b>，好友获得 <b>100 EXP + 80 星辉</b>。</p></div><div className="code-box"><span>我的邀请码</span><strong>{data.user.inviteCode}</strong><button onClick={() => void copy(data.user.inviteCode, "邀请码已复制")}>复制</button></div><div className="invite-count">已成功邀请 <b>{data.user.referralCount}</b> 位旅行者</div></div>
    <div className="team-card glass-card">{data.team ? <><div className="team-head"><div className="team-crest">♙</div><div><small>我的五人小组</small><h2>{data.team.name}</h2><p>{data.team.member_count}/5 位成员 · 小组口令 {data.team.code}</p></div><button onClick={() => void copy(data.team!.code, "小组口令已复制")}>复制口令</button></div><div className="member-list">{data.team.members.map((m, i) => <article key={m.email}><span className="member-rank">{i + 1}</span><div className="member-avatar">{m.display_name.slice(0, 1)}</div><div><b>{m.display_name}</b><small>{m.focus_minutes} 分钟专注</small></div><strong>{m.strength.toLocaleString()} <small>实力</small></strong></article>)}{Array.from({ length: 5 - data.team.member_count }).map((_, i) => <article className="empty-member" key={i}><span>＋</span><p>等待新的同行者</p></article>)}</div></> : <><div className="section-intro"><small>同行者大厅</small><h2>创建或加入小组</h2><p>每位旅行者只能加入一个小组，每组最多 5 人。</p></div><div className="team-choices"><div><h3>建立新的营地</h3><input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="输入小组名称" maxLength={16}/><button onClick={() => void act({ action: "createTeam", name: teamName }, "小组创建成功")}>创建小组</button></div><div><h3>加入好友的小组</h3><input value={teamInput} onChange={(e) => setTeamInput(e.target.value)} placeholder="输入小组口令"/><button onClick={() => void act({ action: "joinTeam", code: teamInput }, "已加入小组")}>加入小组</button></div></div></>}</div>
  </section>;
}

function World({ data, act, activeRealmId, onEnter, onLeave }: { data: GameData; act: (p: Record<string, unknown>, s: string) => Promise<boolean>; activeRealmId: string | null; onEnter: (realm: Realm) => void; onLeave: () => void }) {
  const level = levelFromXp(data.user.xp);
  const progressFor = (realmId: string) => data.realmProgress.find((item) => item.realmId === realmId);
  const unlocked = continents.filter((continent) => Boolean(progressFor(continent.id)?.unlocked));
  const target = continents.find((continent) => progressFor(continent.id)?.target);
  const unfinished = unlocked.find((continent) => (progressFor(continent.id)?.completedRegions ?? 0) < continent.quests.length);
  const canChooseTarget = !unfinished;
  const [view, setView] = useState<"map"|"ranking">("map");
  const [selectedId, setSelectedId] = useState(target?.id ?? unlocked.at(-1)?.id ?? "dawn");
  const selected = continents.find(c => c.id === selectedId) ?? continents[0];
  const selectedProgress = progressFor(selected.id);
  const isUnlocked = Boolean(selectedProgress?.unlocked);
  const isTarget = Boolean(selectedProgress?.target);
  const completedRegions = selectedProgress?.completedRegions ?? 0;
  const remainingXp = Math.max(0, selected.xpRequired - data.user.xp);
  const thresholdProgress = selected.xpRequired ? Math.min(100, data.user.xp / selected.xpRequired * 100) : 100;

  return <section className="atlas-panel">
    <div className="atlas-header">
      <div><span className="chapter">星旅世界 · 自由远征</span><h2>选择你的下一片大陆</h2><p>曦华大陆默认开放。完成已解锁大陆的三项任务后，可自由选择新的远征目标，再以累计 EXP 点亮边界。</p></div>
      <div className="atlas-level"><span>Lv.{level} · {data.user.xp.toLocaleString()} EXP</span><strong>{target ? target.name : unfinished ? `完成${unfinished.name}` : "选择新目标"}</strong><small>{target ? `解锁门槛 ${target.xpRequired.toLocaleString()} EXP` : unlocked.length === continents.length ? "七境全部开放" : "远征路线由你决定"}</small></div>
    </div>
    <div className="atlas-tabs"><button className={view==="map"?"active":""} onClick={()=>setView("map")}>◎ 世界地图</button><button className={view==="ranking"?"active":""} onClick={()=>setView("ranking")}>♙ 小组排行</button></div>
    {view === "map" ? <div className="atlas-content">
      <div className="world-map glass-card">
        <div className="map-grid-lines" /><div className="map-compass">✦<i>N</i></div>
        <div className="ocean-name">THE STARCAMP WORLD · 星旅世界</div>
        {continents.map((continent,index) => {
          const realmProgress = progressFor(continent.id);
          const open = Boolean(realmProgress?.unlocked);
          const aiming = Boolean(realmProgress?.target);
          return <button key={continent.id} className={`continent continent-${continent.id} land-${continent.style} ${selectedId===continent.id?"selected":""} ${open?"unlocked":"locked"} ${aiming?"targeted":""}`} onClick={()=>setSelectedId(continent.id)}>
            <span className="land-shape"><i>{open ? continent.icon : "⌾"}</i></span>
            <b>{continent.name}</b><small>{continent.id === "dawn" ? "初始大陆 · 默认解锁" : `${continent.xpRequired.toLocaleString()} EXP · ${continent.difficulty}`}</small>
            {aiming ? <em>当前目标</em> : !open && <em>未解锁</em>}<u>{index+1}</u>
          </button>;
        })}
        <div className="sea-route route-a" /><div className="sea-route route-b" /><div className="sea-route route-c" />
      </div>
      <aside className={`continent-detail detail-${selected.style} glass-card ${isUnlocked?"":"locked"}`}>
        <div className="detail-banner"><span>{isUnlocked ? selected.icon : "⌾"}</span><div><small>{selected.real} · 世界第 {continents.findIndex(c=>c.id===selected.id)+1} 境</small><h3>{selected.name}</h3><p>{selected.title}</p></div></div>
        {isUnlocked ? <><p className="continent-story">{selected.story}</p><div className="realm-trait"><span>{selected.icon}</span><div><small>全站环境特性</small><b>{selected.trait}</b></div></div><div className="explore-progress"><div><span>大陆任务进度</span><b>{completedRegions}/{selected.quests.length}</b></div><i><em style={{width:`${completedRegions / selected.quests.length * 100}%`}} /></i></div><div className="region-list">{selected.quests.map((quest,index) => { const done = index < completedRegions; const available = index === completedRegions; return <button key={quest} className={done ? "region-done" : available ? "region-available" : "region-locked"} disabled={!available} onClick={() => void act({ action:"completeRealmTask", realmId:selected.id, regionIndex:index }, `完成「${quest}」：+${selected.taskReward} EXP`)}><span>{done ? "✓" : index+1}</span><div><b>{quest}</b><small>{done ? "任务完成 · EXP 已领取" : available ? `完成任务 · +${selected.taskReward} EXP` : "完成前置任务后开放"}</small></div><em>{done ? "已完成" : available ? "领取" : "⌾"}</em></button>; })}</div><div className={completedRegions >= selected.quests.length ? "continent-boss conquered" : "continent-boss"}><span>♢</span><div><small>{completedRegions >= selected.quests.length ? "大陆任务全部完成" : "大陆终局试炼"}</small><b>{selected.boss}</b></div><em>{completedRegions >= selected.quests.length ? `已获得 · ${selected.reward}` : `限定奖励 · ${selected.reward}`}</em></div><button className={activeRealmId === selected.id ? "enter-continent active" : "enter-continent"} onClick={() => onEnter(selected)}>{activeRealmId === selected.id ? `已驻扎 · 返回${selected.name}营地` : `进入 ${selected.name}`}</button>{activeRealmId === selected.id && <button className="leave-continent" onClick={onLeave}>离开大陆，返回星旅主世界</button>}{completedRegions >= selected.quests.length && unlocked.length < continents.length && <div className="route-choice-ready">✓ 已获得选择下一大陆的资格</div>}</> : <div className="locked-detail"><span>{isTarget ? "◎" : "⌾"}</span><h4>{isTarget ? "远征目标已选定" : "大陆边界尚未显现"}</h4><p><b>{selected.difficulty}</b>难度 · 需要累计 <b>{selected.xpRequired.toLocaleString()} EXP</b>{isTarget ? `，还差 ${remainingXp.toLocaleString()} EXP。` : " 才能解锁。"}</p><div><i style={{width:`${thresholdProgress}%`}} /></div>{canChooseTarget ? <button className={isTarget ? "choose-realm-target active" : "choose-realm-target"} disabled={isTarget} onClick={() => void act({ action:"chooseRealmTarget", realmId:selected.id }, `${selected.name}已设为下一远征目标`)}>{isTarget ? "当前远征目标" : target ? "改选为下一大陆" : "选择为下一大陆"}</button> : <small className="route-choice-blocked">先完成 {unfinished?.name ?? "当前大陆"} 的三项任务，才能自由选择。</small>}</div>}
        <div className="world-milestone"><span>{unlocked.length}/7</span><p>已发现大陆<br/><small>继续完成任务以拓展世界地图</small></p></div>
      </aside>
    </div> : <div className="ranking glass-card atlas-ranking">{data.leaderboard.length ? data.leaderboard.map((team, i) => <article key={team.id} className={data.team?.id === team.id ? "my-team" : ""}><div className={`rank-number rank-${i + 1}`}>{i + 1}</div><div className="rank-crest">{i < 3 ? "✦" : "◇"}</div><div className="rank-name"><b>{team.name}</b><span>{team.members}/5 位旅行者 · 累计专注 {team.focus_minutes} 分钟</span></div><div className="rank-power"><strong>{Number(team.strength).toLocaleString()}</strong><span>世界实力</span></div></article>) : <div className="empty-ranking"><span>◎</span><h3>世界正在等待第一支队伍</h3><p>创建小组并完成任务，你们将成为榜单上的第一束星光。</p></div>}</div>}
  </section>;
}
