"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Quest = { id: number; title: string; detail: string; reward: number; type: string; source: string; dueAt: string | null; createdAt: string; completedAt: string | null; done: number };
type Member = { display_name: string; email: string; xp: number; focus_minutes: number; strength: number };
type Team = { id: number; name: string; code: string; owner_email: string; member_count: number; members: Member[] };
type RankTeam = { id: number; name: string; code: string; members: number; strength: number; focus_minutes: number };
type FocusRecord = { id: number; minutes: number; created_at: string };
type QuestActivityDay = { date: string; count: number };
type QuestCompletionRecord = { id: number; title: string; reward: number; completedAt: string };
type QuestActivityFeed = Quest[] & { activity: QuestActivityDay[]; total: number; recent: QuestCompletionRecord[] };
type InventoryItem = { item_key: string; quantity: number; acquired_at: string };
type RealmProgress = { realmId: string; completedRegions: number; unlocked: number; target: number; unlockedAt: string | null };
type RealmGateRequirement = { key: string; label: string; current: number; required: number; unit: string; met: boolean };
type RealmGate = { realmId: string; sequence: number; unlocked: boolean; eligible: boolean; requirements: RealmGateRequirement[] };
type CalendarConnection = { connected: boolean; googleEmail: string | null; lastSyncedAt: string | null };
type CalendarAccess = { active: boolean; status: "free" | "founder" | "trial" | "paid" | "level_reward" | "expired"; accessUntil: string | null; trialStartedAt: string | null; trialAvailable: boolean; daysRemaining: number; levelRewardEligible: boolean; levelRewardClaimed: boolean };
type PremiumProgram = { isAdmin: boolean; isFreeMember: boolean; maxSlots: number; occupiedSlots: number; slots: Array<{ slot: number; email: string | null }> };
type GameData = {
  user: { email: string; name: string; inviteCode: string; invitedBy: string | null; xp: number; coins: number; focusMinutes: number; referralCount: number };
  quests: Quest[];
  questActivity: QuestActivityDay[];
  questCompletionTotal: number;
  recentQuestCompletions: QuestCompletionRecord[];
  focusHistory: FocusRecord[];
  inventory: InventoryItem[];
  realmProgress: RealmProgress[];
  realmGates: RealmGate[];
  calendarAccess: CalendarAccess;
  calendarConnection: CalendarConnection;
  premiumProgram: PremiumProgram;
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
  quests: { name: string; criteria: [string, string, string] }[];
  boss: string;
  reward: string;
  hero: [string, string];
  campStory: string;
  trait: string;
};

const continents: Realm[] = [
  { id:"dawn", name:"曦华大陆", real:"亚洲", xpRequired:0, difficulty:"启程", taskReward:30, icon:"☼", style:"jade", title:"千城与古卷之地", story:"古老智慧与未来都市共存，完成学习、规划和长期成长任务。", quests:[{name:"知识古塔",criteria:["完成至少 30 分钟主题学习","记录 3 条可复用笔记","写明一个下一步行动"]},{name:"习惯茶庭",criteria:["连续执行选定习惯 3 次","记录每次完成时间","复盘一个阻碍与改进"]},{name:"千阶书院",criteria:["完成一个阶段性学习成果","输出可查看的总结或作品","设定下一阶段目标"]}], boss:"时间之龙", reward:"曦华罗盘", hero:["晨光落在古卷","新的知识正在苏醒"], campStory:"玉色山岚环绕营地，适合学习、规划与建立稳定习惯。", trait:"智慧 · 秩序 · 长期成长" },
  { id:"crown", name:"苍冠大陆", real:"欧洲", xpRequired:300, difficulty:"容易", taskReward:45, icon:"♜", style:"blue", title:"城堡与创造之地", story:"穿行艺术工坊与雾中古堡，挑战表达、创造和审美修行。", quests:[{name:"灵感画廊",criteria:["收集并整理 5 个灵感素材","完成一份创意草稿","说明最终选择的创意方向"]},{name:"工匠长街",criteria:["完成至少 45 分钟精细制作","修正一个明确的质量问题","保存可查看的阶段成果"]},{name:"诗人钟楼",criteria:["完成一次公开或书面表达","根据反馈修改一次","归档最终版本"]}], boss:"完美主义者", reward:"苍银羽笔", hero:["越过雾中古堡","让灵感成为作品"], campStory:"银蓝穹顶与古典拱窗守护创造，适合艺术、表达和精细打磨。", trait:"创造 · 审美 · 表达" },
  { id:"ember", name:"赤土大陆", real:"非洲", xpRequired:650, difficulty:"普通", taskReward:55, icon:"☀", style:"ember", title:"烈阳与生命之地", story:"辽阔草原回响着生命鼓点，锻炼健康、勇气与行动能力。", quests:[{name:"晨曦草原",criteria:["完成一次 30 分钟运动","记录运动类型与时长","完成拉伸和补水"]},{name:"勇气峡谷",criteria:["完成一件持续拖延的事情","留下可检查的完成结果","记录迈出第一步的方法"]},{name:"生命绿洲",criteria:["完成一次身心状态检查","安排一项恢复精力的行动","写下未来 7 天健康计划"]}], boss:"倦怠巨兽", reward:"赤阳护符", hero:["烈阳点燃旷野","用行动回应生命"], campStory:"赤金阳光照亮辽阔草原，适合运动、健康与需要勇气的挑战。", trait:"生命 · 勇气 · 行动力" },
  { id:"storm", name:"风暴大陆", real:"北美洲", xpRequired:1100, difficulty:"进阶", taskReward:70, icon:"↯", style:"storm", title:"峡谷与革新之地", story:"从自由港驶向雷霆峡谷，完成事业、创新与突破类挑战。", quests:[{name:"创业者港",criteria:["定义一个可验证的事业目标","完成最小可行行动","记录结果与关键数据"]},{name:"雷霆工坊",criteria:["完成一次新方法实验","对比实验前后的差异","决定保留或调整的方案"]},{name:"自由之路",criteria:["解决一个关键工作阻碍","交付可检查的成果","制定下一次突破计划"]}], boss:"拖延风暴", reward:"先驱徽记", hero:["驾驭雷霆风暴","向未知发起突破"], campStory:"电光穿过峡谷与高塔，适合事业冲刺、创新实验与快速决策。", trait:"革新 · 突破 · 事业" },
  { id:"verdant", name:"森灵大陆", real:"南美洲", xpRequired:1700, difficulty:"困难", taskReward:85, icon:"❧", style:"forest", title:"雨林与心灵之地", story:"在繁茂雨林中理解情绪、关系和内在成长的神秘连接。", quests:[{name:"回声雨林",criteria:["完成一次 15 分钟情绪记录","识别情绪背后的真实需要","写下一个温和回应"]},{name:"关系藤桥",criteria:["与重要的人进行一次真诚沟通","清楚表达需求并认真倾听","记录双方达成的共识"]},{name:"心流瀑布",criteria:["完成一次 45 分钟无干扰投入","产出明确的阶段成果","记录进入心流的触发条件"]}], boss:"迷惘之影", reward:"森灵种子", hero:["听见雨林回声","与内心重新连接"], campStory:"藤蔓、雨雾与萤火构成柔软庇护，适合情绪、关系和心灵成长。", trait:"关系 · 情绪 · 内在成长" },
  { id:"coral", name:"珊海群岛", real:"大洋洲", xpRequired:2400, difficulty:"艰深", taskReward:105, icon:"≈", style:"coral", title:"海风与平衡之地", story:"星罗岛屿守护生活的平衡，探索协作、休息与自在创造。", quests:[{name:"珊瑚学宫",criteria:["完成一次跨领域学习","把新知识用于一个现实问题","记录应用结果"]},{name:"月湾营地",criteria:["安排并完成一次高质量休息","休息期间停止工作信息输入","记录恢复前后的精力变化"]},{name:"群岛协作",criteria:["与至少一位伙伴明确分工","共同完成一个可查看成果","完成一次协作复盘"]}], boss:"失衡海兽", reward:"潮汐贝冠", hero:["跟随温柔潮汐","找回生活的平衡"], campStory:"珊瑚海湾与月光潮汐舒展身心，适合休息、协作与自由创造。", trait:"平衡 · 协作 · 松弛" },
  { id:"polar", name:"极星大陆", real:"南极洲", xpRequired:3300, difficulty:"传说", taskReward:130, icon:"✦", style:"polar", title:"冰原与终章之地", story:"世界尽头的纯净冰原，只向真正理解自己的旅行者开放。", quests:[{name:"寂静冰原",criteria:["完成一次 60 分钟深度独处","关闭非必要信息与通知","记录最重要的三个发现"]},{name:"极光神殿",criteria:["回顾一个长期目标的真实动机","删除或调整一个不再适合的目标","写下新的行动承诺"]},{name:"世界之心",criteria:["完成整段旅程的系统复盘","总结最重要的成长证据","制定下一阶段人生蓝图"]}], boss:"旧日的自己", reward:"极星之证", hero:["在极光之下","看见真正的自己"], campStory:"冰晶与极光洗去噪音，适合深度反思、长期愿景与自我超越。", trait:"纯粹 · 反思 · 自我超越" },
];
const advancedRealmMeta: Record<string, Pick<Realm, "xpRequired" | "difficulty">> = {
  dawn: { xpRequired: 0, difficulty: "启程" },
  crown: { xpRequired: 600, difficulty: "旅者" },
  ember: { xpRequired: 1500, difficulty: "历练" },
  storm: { xpRequired: 3000, difficulty: "精英" },
  verdant: { xpRequired: 5000, difficulty: "大师" },
  coral: { xpRequired: 7500, difficulty: "史诗" },
  polar: { xpRequired: 11000, difficulty: "传说" },
};
continents.forEach((continent) => Object.assign(continent, advancedRealmMeta[continent.id]));

const nav = [["营地", "⌂"], ["任务", "✦"], ["专注", "◷"], ["行囊", "◇"], ["小组", "♙"], ["世界", "◎"]];
const XP_PER_LEVEL = 100;
const levelFromXp = (xp: number) => Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1;
const milestoneCopy = (level: number) => {
  const chapters = [
    { title: "星火成炬", message: "你已把一个个微小行动，汇聚成足以照亮前路的星光。" },
    { title: "远征不息", message: "真正的成长从不喧哗。你坚持走过的每一步，都已经成为实力。" },
    { title: "群星见证", message: "你不只抵达了更高等级，也成为同行者眼中可靠的光。" },
    { title: "传奇新章", message: "里程碑不是终点，而是你有能力继续创造更大世界的证明。" },
  ];
  return chapters[(Math.floor(level / 50) - 1) % chapters.length];
};
const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const storedDateKey = (value: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{4}-\d{2}-\d{2} /.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : localDateKey(date);
};
const questDateKey = (quest: Quest) => {
  if (!quest.dueAt) return "";
  return storedDateKey(quest.dueAt);
};
const questTaskDateKey = (quest: Quest) => questDateKey(quest) || storedDateKey(quest.createdAt);
const todayRelevantQuests = (quests: Quest[]) => {
  const today = localDateKey(new Date());
  return quests.filter((quest) => {
    const taskDate = questTaskDateKey(quest);
    if (!taskDate) return !quest.done;
    return taskDate === today || (taskDate < today && !quest.done);
  });
};
const sortQuests = (quests: Quest[]) => {
  const today = localDateKey(new Date());
  const rank = (quest: Quest) => quest.done ? 3 : questTaskDateKey(quest) === today ? 0 : !quest.dueAt ? 1 : 2;
  return [...quests].sort((left, right) =>
    rank(left) - rank(right)
    || (left.dueAt || "9999").localeCompare(right.dueAt || "9999")
    || right.id - left.id,
  );
};
const taskActivityLevel = (count: number) => count <= 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : count === 3 ? 3 : 4;

type FocusAlertMode = "both" | "popup" | "sound" | "silent";
type AmbientSound = "rain" | "fire" | "ocean" | "none";
type AmbientSession = {
  context: AudioContext;
  sources: AudioBufferSourceNode[];
};

function createAmbientSession(kind: Exclude<AmbientSound, "none">): AmbientSession {
  const context = new AudioContext();
  const seconds = kind === "ocean" ? 18 : kind === "fire" ? 13 : 11;
  const buffer = context.createBuffer(2, context.sampleRate * seconds, context.sampleRate);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const samples = buffer.getChannelData(channel);
    let brown = 0;
    let transient = 0;
    let transientTone = 1100;
    for (let index = 0; index < samples.length; index += 1) {
      const time = index / context.sampleRate;
      const white = Math.random() * 2 - 1;
      brown = brown * .994 + white * .006;
      let sample = 0;
      if (kind === "rain") {
        if (Math.random() < .00042) {
          transient = .35 + Math.random() * .65;
          transientTone = 1200 + Math.random() * 2400;
        }
        transient *= .996;
        const drop = Math.sin(time * Math.PI * 2 * transientTone) * transient;
        sample = white * .54 + brown * 1.4 + drop * .22;
      } else if (kind === "fire") {
        if (Math.random() < .0002) transient = .5 + Math.random() * .85;
        transient *= .983;
        const emberRumble = Math.sin(time * Math.PI * 2 * (46 + channel * 7)) * .08;
        sample = brown * 3.2 + emberRumble + white * transient * .78;
      } else {
        const wavePeriod = 5.4 + channel * .75;
        const swell = Math.pow(.5 + .5 * Math.sin(time * Math.PI * 2 / wavePeriod - Math.PI / 2), 1.65);
        const backwash = Math.pow(.5 + .5 * Math.sin(time * Math.PI * 2 / (wavePeriod * .51) + 1.4), 2.2);
        sample = brown * (2.1 + swell * 2.8) + white * (swell * .28 + backwash * .08);
      }
      samples[index] = Math.tanh(sample);
    }
  }

  const source = context.createBufferSource();
  const highpass = context.createBiquadFilter();
  const lowpass = context.createBiquadFilter();
  const compressor = context.createDynamicsCompressor();
  const master = context.createGain();
  source.buffer = buffer;
  source.loop = true;
  highpass.type = "highpass";
  highpass.frequency.value = kind === "rain" ? 420 : kind === "fire" ? 45 : 70;
  lowpass.type = "lowpass";
  lowpass.frequency.value = kind === "rain" ? 7200 : kind === "fire" ? 2100 : 1350;
  lowpass.Q.value = kind === "rain" ? .4 : .65;
  compressor.threshold.value = -22;
  compressor.knee.value = 16;
  compressor.ratio.value = 3;
  master.gain.value = kind === "rain" ? .115 : kind === "fire" ? .18 : .16;
  source.connect(highpass).connect(lowpass).connect(compressor).connect(master).connect(context.destination);
  source.start();
  void context.resume();
  return { context, sources: [source] };
}

function stopAmbientSession(session: AmbientSession | null) {
  if (!session) return;
  session.sources.forEach((source) => {
    try { source.stop(); } catch {}
  });
  void session.context.close();
}

function playFocusChime(context: AudioContext) {
  void context.resume();
  const start = context.currentTime;
  [659.25, 783.99, 987.77].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const noteStart = start + index * .18;
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(.0001, noteStart);
    gain.gain.exponentialRampToValueAtTime(.19, noteStart + .025);
    gain.gain.exponentialRampToValueAtTime(.0001, noteStart + .48);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(noteStart);
    oscillator.stop(noteStart + .5);
  });
}

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
  const [focusAlertMode, setFocusAlertMode] = useState<FocusAlertMode>("both");
  const [ambientSound, setAmbientSound] = useState<AmbientSound>("rain");
  const [showFocusComplete, setShowFocusComplete] = useState(false);
  const [levelMilestone, setLevelMilestone] = useState<number | null>(null);
  const [activeRealmId, setActiveRealmId] = useState<string | null>(null);
  const [showLevelGuide, setShowLevelGuide] = useState(false);
  const alertAudioRef = useRef<AudioContext | null>(null);
  const ambientAudioRef = useRef<AmbientSession | null>(null);

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const savedAlert = window.localStorage.getItem("starcamp-focus-alert");
    const savedAmbient = window.localStorage.getItem("starcamp-focus-ambient");
    if (savedAlert === "both" || savedAlert === "popup" || savedAlert === "sound" || savedAlert === "silent") setFocusAlertMode(savedAlert);
    if (savedAmbient === "rain" || savedAmbient === "fire" || savedAmbient === "ocean" || savedAmbient === "none") setAmbientSound(savedAmbient);
    return () => {
      stopAmbientSession(ambientAudioRef.current);
      if (alertAudioRef.current?.state !== "closed") void alertAudioRef.current?.close();
    };
  }, []);
  useEffect(() => {
    if (!running || timer <= 0) return;
    const id = window.setInterval(() => setTimer((v) => v - 1), 1000);
    return () => window.clearInterval(id);
  }, [running, timer]);
  useEffect(() => {
    stopAmbientSession(ambientAudioRef.current);
    ambientAudioRef.current = null;
    if (!running || ambientSound === "none") return;
    try {
      ambientAudioRef.current = createAmbientSession(ambientSound);
    } catch {
      notify("浏览器暂时无法播放环境音，请检查声音权限");
    }
    return () => {
      stopAmbientSession(ambientAudioRef.current);
      ambientAudioRef.current = null;
    };
  }, [running, ambientSound]);
  useEffect(() => {
    if (timer === 0 && running) {
      setRunning(false);
      if (focusAlertMode === "sound" || focusAlertMode === "both") {
        const context = alertAudioRef.current;
        if (context && context.state !== "closed") playFocusChime(context);
      }
      if (focusAlertMode === "popup" || focusAlertMode === "both") setShowFocusComplete(true);
      void act({ action: "focus", minutes: focusMinutes }, "秘境完成：专注记录已保存到云端");
    }
  }, [timer, running, focusAlertMode, focusMinutes]);
  useEffect(() => {
    if (!data) return;
    const saved = window.localStorage.getItem("starcamp-active-realm");
    const realm = continents.find((continent) => continent.id === saved);
    const progress = data.realmProgress.find((item) => item.realmId === realm?.id);
    if (realm && progress?.unlocked) setActiveRealmId(realm.id);
    else if (saved) window.localStorage.removeItem("starcamp-active-realm");
  }, [data?.realmProgress]);
  useEffect(() => {
    if (!data) return;
    const currentLevel = levelFromXp(data.user.xp);
    const reachedMilestone = Math.floor(currentLevel / 50) * 50;
    if (reachedMilestone < 50) return;
    const storageKey = `starcamp-level-milestone:${identity.email}`;
    const lastCelebrated = Number(window.localStorage.getItem(storageKey) || 0);
    if (reachedMilestone > lastCelebrated) {
      setLevelMilestone(reachedMilestone);
      window.localStorage.setItem(storageKey, String(reachedMilestone));
    }
  }, [data?.user.xp, identity.email]);
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("calendar");
    if (!status) return;
    const message = status === "connected" ? "Google 日历连接成功，任务已自动同步"
      : status === "payment-success" ? "支付完成，星历通行证正在生效"
      : status === "payment-cancelled" ? "已取消支付，未产生扣款"
      : status === "configuration-error" ? "日历连接暂不可用，请稍后重试"
      : "Google 日历连接未完成，请重试";
    notify(message);
    window.history.replaceState({}, "", window.location.pathname);
  }, []);
  useEffect(() => {
    if (!data?.calendarConnection.connected || !data.calendarAccess.active) return;
    const lastSync = data.calendarConnection.lastSyncedAt ? Date.parse(data.calendarConnection.lastSyncedAt) : 0;
    if (!lastSync || Date.now() - lastSync > 120000) {
      void act({ action: "syncGoogleCalendar" }, "Google 日历变动已同步");
    }
    const interval = window.setInterval(() => {
      void act({ action: "syncGoogleCalendar" }, "Google 日历变动已同步");
    }, 120000);
    return () => window.clearInterval(interval);
  }, [data?.calendarConnection.connected, data?.calendarAccess.active]);

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
    const res = await fetch("/api/game", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, clientDate: localDateKey(new Date()) }) });
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

  function toggleFocusTimer() {
    if (!running) {
      if (!alertAudioRef.current || alertAudioRef.current.state === "closed") {
        alertAudioRef.current = new AudioContext();
      }
      void alertAudioRef.current.resume();
    }
    setRunning(!running);
  }

  function changeFocusAlert(mode: FocusAlertMode) {
    setFocusAlertMode(mode);
    window.localStorage.setItem("starcamp-focus-alert", mode);
  }

  function changeAmbientSound(sound: AmbientSound) {
    setAmbientSound(sound);
    window.localStorage.setItem("starcamp-focus-ambient", sound);
  }

  const time = useMemo(() => `${String(Math.floor(timer / 60)).padStart(2, "0")}:${String(timer % 60).padStart(2, "0")}`, [timer]);
  const done = data?.quests.filter((q) => Boolean(q.done)).length ?? 0;
  const displayName = data?.user.name || identity.name.split("@")[0];
  const xp = data?.user.xp ?? 0;
  const coins = data?.user.coins ?? 0;
  const level = levelFromXp(xp);
  const levelXp = xp % XP_PER_LEVEL;
  const activeRealm = continents.find((continent) => continent.id === activeRealmId) ?? null;
  const activeMilestoneCopy = levelMilestone ? milestoneCopy(levelMilestone) : null;

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
                <small className="level-world-note">曦华大陆默认开放。其余大陆按固定顺序解锁，必须同时完成前一大陆试炼，并达到经验、系统任务、专注、邀请好友和小组人数门槛。</small>
              </aside>}
            </div>
          </div>
        </header>

        {tab === "营地" && <Camp data={data} done={done} setTab={setTab} act={act} realm={activeRealm} />}
        {tab === "任务" && <QuestBoard data={data} done={done} act={act} />}
        {tab === "专注" && <Focus data={data} timer={time} running={running} setRunning={setRunning} toggleRunning={toggleFocusTimer} setTimer={setTimer} focusMinutes={focusMinutes} setFocusMinutes={setFocusMinutes} alertMode={focusAlertMode} setAlertMode={changeFocusAlert} ambientSound={ambientSound} setAmbientSound={changeAmbientSound} act={act} />}
        {tab === "行囊" && <Bag data={data} act={act} />}
        {tab === "小组" && <TeamHall data={data} teamName={teamName} setTeamName={setTeamName} teamInput={teamInput} setTeamInput={setTeamInput} act={act} copy={copy} />}
        {tab === "世界" && <World data={data} act={act} activeRealmId={activeRealmId} onEnter={(realm) => { setActiveRealmId(realm.id); window.localStorage.setItem("starcamp-active-realm", realm.id); setTab("营地"); notify(`已进入${realm.name}：全站环境已切换`); }} onLeave={() => { setActiveRealmId(null); window.localStorage.removeItem("starcamp-active-realm"); }} />}
      </section>

      <button className="invite-fab" onClick={() => setTab("小组")}><span>♙</span>邀请好友</button>
      {tab === "营地" && !data.user.invitedBy && <div className="invite-banner"><div><b>来自好友的星光？</b><span>填写邀请码，你与邀请人都能获得奖励</span></div><input value={inviteInput} onChange={(e) => setInviteInput(e.target.value)} placeholder="输入好友邀请码" /><button onClick={() => void act({ action: "redeemInvite", code: inviteInput }, "邀请绑定成功，双方奖励已到账")}>领取奖励</button></div>}
      {toast && <div className="toast">✦ {toast}</div>}
      {showFocusComplete && <div className="focus-complete-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setShowFocusComplete(false); }}><section className="focus-complete-dialog" role="dialog" aria-modal="true" aria-labelledby="focus-complete-title"><button className="focus-complete-close" aria-label="关闭专注完成提示" onClick={() => setShowFocusComplete(false)}>×</button><span className="focus-complete-seal">✦</span><small>FOCUS COMPLETE</small><h2 id="focus-complete-title">专注秘境完成</h2><p>你已完成 {focusMinutes} 分钟专注，历练记录与小组实力已同步到云端。</p><div><button onClick={() => { setShowFocusComplete(false); setTab("营地"); }}>返回营地</button><button className="focus-again" onClick={() => { setShowFocusComplete(false); setTimer(focusMinutes * 60); setTab("专注"); }}>再来一次</button></div></section></div>}
      {levelMilestone && activeMilestoneCopy && <div className="level-milestone-backdrop"><div className="milestone-stars" aria-hidden="true">{Array.from({ length: 10 }, (_, index) => <i key={index}>✦</i>)}</div><section className="level-milestone-card" role="dialog" aria-modal="true" aria-labelledby="level-milestone-title"><button className="level-milestone-close" aria-label="关闭等级里程碑提示" onClick={() => setLevelMilestone(null)}>×</button><div className="milestone-radiance" aria-hidden="true" /><div className="milestone-level"><span>Lv.</span><strong>{levelMilestone}</strong></div><small>LEVEL MILESTONE · 等级里程碑</small><h2 id="level-milestone-title">恭喜抵达 Lv.{levelMilestone}</h2><h3>{activeMilestoneCopy.title}</h3><p>{activeMilestoneCopy.message}</p><div className="milestone-next"><span>下一里程碑</span><b>Lv.{levelMilestone + 50}</b></div><button className="milestone-continue" onClick={() => setLevelMilestone(null)}>收下祝福 · 继续远征</button></section></div>}
    </main>
  );
}

function Camp({ data, done, setTab, act, realm }: { data: GameData; done: number; setTab: (v: string) => void; act: (p: Record<string, unknown>, s: string) => Promise<boolean>; realm: Realm | null }) {
  const calendarAgenda = sortQuests(todayRelevantQuests(data.quests).filter((quest) => quest.dueAt && !quest.done)).slice(0, 3);
  const agenda = calendarAgenda.length ? calendarAgenda.map((quest) => ({
    time: quest.dueAt?.length === 10 ? "全天" : new Date(quest.dueAt!).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }),
    title: quest.title,
    detail: quest.detail,
    state: quest.source.startsWith("google") ? "Google" : quest.source === "outlook" ? "Outlook" : quest.source === "icloud" ? "iCloud" : "日历",
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

function TaskCompletionMap({ quests }: { quests: QuestActivityFeed }) {
  const weekCount = 18;
  const completionCounts = new Map(quests.activity.map((day) => [day.date, Number(day.count)]));
  const activityScrollRef = useRef<HTMLDivElement | null>(null);
  const [activityTooltip, setActivityTooltip] = useState<{ date: string; count: number; intensity: number; left: number; top: number } | null>(null);

  const showActivityTooltip = (day: { label: string; count: number }, intensity: number, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    setActivityTooltip({
      date: day.label,
      count: day.count,
      intensity,
      left: Math.max(92, Math.min(window.innerWidth - 92, rect.left + rect.width / 2)),
      top: rect.top - 9,
    });
  };

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const todayKey = localDateKey(today);
  const start = new Date(today);
  const mondayOffset = (today.getDay() + 6) % 7;
  start.setDate(today.getDate() - mondayOffset - (weekCount - 1) * 7);
  const weeks = Array.from({ length: weekCount }, (_, weekIndex) => {
    const days = Array.from({ length: 7 }, (_, dayIndex) => {
      const date = new Date(start);
      date.setDate(start.getDate() + weekIndex * 7 + dayIndex);
      const key = localDateKey(date);
      return {
        key,
        count: completionCounts.get(key) ?? 0,
        label: date.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "short" }),
        future: key > todayKey,
        today: key === todayKey,
      };
    });
    const firstDayOfMonth = days.find((day) => day.key.endsWith("-01"));
    const monthMarker = firstDayOfMonth ?? (weekIndex === 0 ? days[0] : null);
    return {
      key: days[0].key,
      days,
      month: monthMarker ? `${Number(monthMarker.key.slice(5, 7))}月` : "",
    };
  });

  let streak = 0;
  const cursor = new Date(today);
  if (!completionCounts.has(todayKey)) cursor.setDate(cursor.getDate() - 1);
  while (completionCounts.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  const todayCount = completionCounts.get(todayKey) ?? 0;
  useEffect(() => {
    const scroller = activityScrollRef.current;
    if (scroller) scroller.scrollLeft = scroller.scrollWidth;
  }, [quests.activity]);

  return <section className="task-activity">
    <div className="task-activity-heading"><div><small>冒险足迹 · 完成任务量 · 云端永久记录</small><h3>每一次完成，都在地图上留下星光</h3></div><span className={todayCount ? "activity-today-count active" : "activity-today-count"}>今日 +{todayCount}</span></div>
    <div className="task-activity-stats">
      <div><strong>{quests.total}</strong><span>累计完成</span></div>
      <div><strong>{completionCounts.size}</strong><span>活跃天数</span></div>
      <div><strong>{streak}</strong><span>连续天数</span></div>
    </div>
    <p className="activity-scale-note">每格代表一天 · 完成任务越多，格子颜色越深</p>
    <div className="activity-scroll" ref={activityScrollRef}>
      <div className="activity-chart">
        <div className="activity-weekdays"><span>一</span><span>三</span><span>五</span><span>日</span></div>
        <div className="activity-weeks">{weeks.map((week) => <div className="activity-week" key={week.key}>{week.days.map((day) => {
          const intensity = taskActivityLevel(day.count);
          return <span
            key={day.key}
            data-date={day.key}
            data-count={day.count}
            data-intensity={intensity}
            className={`activity-cell level-${intensity}${day.today ? " today" : ""}${day.future ? " future" : ""}`}
            aria-label={`${day.label}，完成 ${day.count} 项任务，颜色强度 ${intensity}/4`}
            aria-describedby={activityTooltip?.date === day.label ? "activity-day-tooltip" : undefined}
            role="img"
            tabIndex={0}
            onMouseEnter={(event) => showActivityTooltip(day, intensity, event.currentTarget)}
            onMouseMove={(event) => showActivityTooltip(day, intensity, event.currentTarget)}
            onMouseLeave={() => setActivityTooltip(null)}
            onFocus={(event) => showActivityTooltip(day, intensity, event.currentTarget)}
            onBlur={() => setActivityTooltip(null)}
          />;
        })}</div>)}</div>
        <div className="activity-months">{weeks.map((week) => <span key={week.key}>{week.month}</span>)}</div>
      </div>
    </div>
    {activityTooltip && <div id="activity-day-tooltip" className="activity-day-tooltip" role="tooltip" style={{ left: activityTooltip.left, top: activityTooltip.top }}><b>{activityTooltip.date}</b><span>完成 {activityTooltip.count} 项任务</span><small>颜色强度 {activityTooltip.intensity}/4</small></div>}
    {quests.recent.length > 0 && <div className="recent-footprints"><small>最近留下的足迹</small><div>{quests.recent.slice(0, 3).map((record) => <span key={record.id}><i>✓</i><b>{record.title}</b><time>{new Date(record.completedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time></span>)}</div></div>}
    <div className="activity-legend"><span>每日完成量</span>{["0","1","2","3","4+"].map((label, level) => <span className="activity-legend-step" key={label}><i className={`level-${level}`} /><small>{label}</small></span>)}</div>
  </section>;
}

function PremiumSlotManager({ program, act }: { program: PremiumProgram; act: (p: Record<string, unknown>, s: string) => Promise<boolean> }) {
  const [emails, setEmails] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setEmails(Array.from({ length: program.maxSlots }, (_, index) => program.slots[index]?.email || ""));
  }, [program.maxSlots, program.occupiedSlots, program.slots]);
  async function save() {
    setSaving(true);
    await act({ action: "updatePremiumFreeSlots", premiumEmails: emails }, "创始免费名额已更新");
    setSaving(false);
  }
  return <section className="premium-slot-manager"><div className="premium-slot-heading"><div><small>管理员专属 · 创始体验计划</small><b>管理 5 个永久免费名额</b></div><span>{program.occupiedSlots}/{program.maxSlots} 已使用</span></div><p>名额按照邮箱识别；对方以后使用相同邮箱注册，也会自动获得全部付费功能。</p><div className="premium-slot-grid">{Array.from({ length: program.maxSlots }, (_, index) => <label key={index}><span>名额 {index + 1}{index === 0 ? " · 管理员" : ""}</span><input type="email" value={emails[index] || ""} disabled={index === 0} placeholder={index === 0 ? "管理员固定名额" : "填写免费账户邮箱"} onChange={(event) => setEmails((current) => current.map((email, emailIndex) => emailIndex === index ? event.target.value : email))} /></label>)}</div><button disabled={saving} onClick={() => void save()}>{saving ? "保存中…" : "保存免费名额"}</button></section>;
}

function QuestBoard({ data, done: _allDone, act, compact = false }: { data: GameData; done: number; act: (p: Record<string, unknown>, s: string) => Promise<boolean>; compact?: boolean }) {
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
  const [deletingQuest, setDeletingQuest] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedQuestIds, setSelectedQuestIds] = useState<number[]>([]);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState("");
  const allQuests = Object.assign([...data.quests], {
    activity: data.questActivity,
    total: data.questCompletionTotal,
    recent: data.recentQuestCompletions,
  }) as QuestActivityFeed;
  const boardQuests = todayRelevantQuests(allQuests);
  data = { ...data, quests: boardQuests };
  const done = boardQuests.filter((quest) => Boolean(quest.done)).length;
  const visible = sortQuests(data.quests.filter(q => filter === "全部" || (filter === "日历" ? q.source !== "manual" : q.type === filter)));
  const visibleIds = visible.map((quest) => quest.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedQuestIds.includes(id));
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
  async function deleteQuest() {
    if (editingQuestId === null) return;
    const confirmed = window.confirm("确定删除这个任务吗？此操作无法撤销。已获得的 EXP 和星辉不会被追回。");
    if (!confirmed) return;
    setDeletingQuest(true);
    const deleted = await act(
      { action: "deleteQuest", questId: editingQuestId },
      "任务已从云端删除",
    );
    setDeletingQuest(false);
    if (deleted) setEditingQuestId(null);
  }
  function toggleQuestSelection(questId: number) {
    setSelectedQuestIds((selected) => selected.includes(questId)
      ? selected.filter((id) => id !== questId)
      : [...selected, questId]);
  }
  function toggleSelectVisible() {
    setSelectedQuestIds((selected) => {
      if (allVisibleSelected) return selected.filter((id) => !visibleIds.includes(id));
      return [...new Set([...selected, ...visibleIds])];
    });
  }
  async function deleteSelectedQuests() {
    if (!selectedQuestIds.length) return;
    const confirmed = window.confirm(`确定删除选中的 ${selectedQuestIds.length} 个任务吗？此操作无法撤销，已获得的 EXP 和星辉不会被追回。`);
    if (!confirmed) return;
    setDeletingSelected(true);
    const deleted = await act(
      { action: "batchDeleteQuests", questIds: selectedQuestIds },
      `已从云端删除 ${selectedQuestIds.length} 个任务`,
    );
    setDeletingSelected(false);
    if (deleted) {
      setSelectedQuestIds([]);
      setSelectionMode(false);
    }
  }
  async function syncGoogle() {
    setSyncingGoogle(true);
    await act({ action: "syncGoogleCalendar" }, "Google 日历已同步到每日任务");
    setSyncingGoogle(false);
    setFilter("日历");
  }
  async function disconnectGoogle() {
    if (!window.confirm("确定断开 Google 日历吗？已同步的任务会保留，但不再自动更新。")) return;
    await act({ action: "disconnectGoogleCalendar" }, "Google 日历已断开");
  }
  async function purchaseCalendarPlan(plan: "week" | "month" | "year") {
    setCheckoutPlan(plan);
    const response = await fetch("/api/billing/calendar-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const result = await response.json() as { checkoutUrl?: string; error?: string };
    setCheckoutPlan("");
    if (!response.ok || !result.checkoutUrl) {
      window.alert(result.error || "暂时无法打开支付页面");
      return;
    }
    window.location.href = result.checkoutUrl;
  }
  const accessLabel = data.calendarAccess.active
    ? data.calendarAccess.status === "founder" ? "创始免费名额 · 全部付费功能已解锁"
      : data.calendarAccess.status === "trial" ? `免费试用中 · 剩余 ${data.calendarAccess.daysRemaining} 天`
      : data.calendarAccess.status === "level_reward" ? `Lv.100 奖励生效中 · 剩余 ${data.calendarAccess.daysRemaining} 天`
      : `星历通行证生效中 · 剩余 ${data.calendarAccess.daysRemaining} 天`
    : data.calendarAccess.trialAvailable ? "尚未开始 7 天免费试用" : "通行证已到期 · 自动同步已暂停";
  const accessUntilLabel = data.calendarAccess.accessUntil
    ? new Date(data.calendarAccess.accessUntil).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })
    : data.calendarAccess.status === "founder" ? "永久有效 · 无需续费" : "连接 Google 日历时开始计时";
  const sourceLabel = (source: string) => source.startsWith("google") ? "Google" : source === "outlook" ? "Outlook" : source === "icloud" ? "iCloud" : source === "ics" ? "ICS" : "";
  return <section className={`quest-card glass-card ${compact ? "" : "full-panel enriched-quests"}`}><div className="card-heading"><div><small>冒险家协会 · 云端委托</small><h3>今日任务</h3></div><div className="completion"><b>{done}/{data.quests.length}</b><span>完成 {Math.round(done / Math.max(data.quests.length, 1) * 100)}%</span></div></div>{!compact && <><div className="quest-toolbar"><div>{["全部","主线","日常","支线","日历"].map(v => <button key={v} className={filter === v ? "active" : ""} onClick={() => { setFilter(v); setSelectedQuestIds([]); }}>{v}</button>)}</div><div className="quest-toolbar-actions"><button className={selectionMode ? "batch-manage-button active" : "batch-manage-button"} onClick={() => { setSelectionMode((enabled) => !enabled); setSelectedQuestIds([]); setEditingQuestId(null); }}>☑ {selectionMode ? "退出管理" : "批量管理"}</button><button className="calendar-button" onClick={() => setCalendarOpen(!calendarOpen)}>▦ 同步日历</button><button className="new-quest-button" onClick={() => setCreating(!creating)}>＋ 发布新委托</button></div></div>{selectionMode && <div className="quest-bulk-bar"><button className="bulk-select-all" onClick={toggleSelectVisible}>{allVisibleSelected ? "取消全选" : "全选当前"}</button><span>已选择 <b>{selectedQuestIds.length}</b> 个任务</span><button className="bulk-cancel" onClick={() => { setSelectionMode(false); setSelectedQuestIds([]); }}>取消</button><button className="bulk-delete" disabled={!selectedQuestIds.length || deletingSelected} onClick={() => void deleteSelectedQuests()}>{deletingSelected ? "删除中…" : `删除选中（${selectedQuestIds.length}）`}</button></div>}{calendarOpen && <section className="calendar-portal"><div className="calendar-heading"><div><small>星历传送门 · 实时绑定为付费权益</small><h3>连接并自动同步 Google 日历</h3><p>授权后每两分钟检查一次变化，只同步当天及未来日程；普通任务与手动上传 ICS 永久免费，实时账号绑定需要星历通行证。</p></div><span>◫</span></div><div className={`calendar-membership-status ${data.calendarAccess.active ? "active" : "inactive"}`}><span>{data.calendarAccess.active ? "✦" : "◇"}</span><div><b>{accessLabel}</b><small>{data.calendarAccess.active ? `有效期至 ${accessUntilLabel}` : accessUntilLabel}</small></div>{data.calendarAccess.levelRewardEligible && <button onClick={() => void act({ action: "claimCalendarLevelReward" }, "恭喜获得一年星历通行证")}>领取 Lv.100 一年奖励</button>}</div>{data.premiumProgram.isFreeMember && <section className="premium-free-summary"><span>✦</span><div><small>创始体验账户</small><b>全部付费功能永久免费</b><p>无需购买套餐，当前及后续付费功能都会直接解锁。</p></div></section>}{data.premiumProgram.isAdmin && <PremiumSlotManager program={data.premiumProgram} act={act} />}<div className={data.premiumProgram.isFreeMember ? "calendar-pricing premium-hidden" : "calendar-pricing"}><div className="calendar-pricing-intro"><div><small>星历通行证</small><b>先免费体验 7 天，再决定是否开通</b></div><span>不自动扣费 · 到期前可随时续期</span></div><div className="calendar-plan-grid">{[
    { key: "week", name: "周卡", price: "HK$8", unit: "/ 7天", note: "短期冲刺与旅行安排" },
    { key: "month", name: "月卡", price: "HK$20", unit: "/ 30天", note: "稳定使用 · 每天约 HK$0.67" },
    { key: "year", name: "年卡", price: "HK$160", unit: "/ 365天", note: "推荐 · 比月卡节省约 34%" },
  ].map((plan) => <article className={plan.key === "year" ? "calendar-plan recommended" : "calendar-plan"} key={plan.key}>{plan.key === "year" && <em>最划算</em>}<small>{plan.name}</small><div><b>{plan.price}</b><span>{plan.unit}</span></div><p>{plan.note}</p><button disabled={Boolean(checkoutPlan)} onClick={() => void purchaseCalendarPlan(plan.key as "week" | "month" | "year")}>{checkoutPlan === plan.key ? "正在前往支付…" : "选择套餐"}</button></article>)}</div><p className="calendar-trial-rule">由 Waffo 提供安全收款，均为一次性付款，不会自动续费。每个账号仅可试用一次；试用从首次连接 Google 日历时开始。Lv.100 奖励限领取一次，可与剩余通行证时长叠加。</p></div>{data.calendarConnection.connected ? <div className={`google-live-card connected${data.calendarAccess.active ? "" : " access-paused"}`}><span className="google-calendar-mark">G</span><div><small>Google Calendar 已连接</small><b>{data.calendarConnection.googleEmail || "主日历"}</b><em>{data.calendarAccess.active ? data.calendarConnection.lastSyncedAt ? `上次同步 ${new Date(data.calendarConnection.lastSyncedAt).toLocaleString("zh-CN")}` : "正在进行首次同步" : "通行证到期，自动同步已暂停；已导入任务继续保留"}</em></div><button onClick={() => void syncGoogle()} disabled={syncingGoogle || !data.calendarAccess.active}>{syncingGoogle ? "同步中…" : data.calendarAccess.active ? "立即同步" : "续费后同步"}</button><button className="disconnect-google" onClick={() => void disconnectGoogle()}>断开</button></div> : <div className="google-live-card"><span className="google-calendar-mark">G</span><div><small>{data.calendarAccess.trialAvailable ? "首次连接 · 自动开启 7 天试用" : data.calendarAccess.active ? "星历通行证已生效" : "需要开通星历通行证"}</small><b>连接你的 Google 主日历</b><em>仅请求只读权限，授权令牌加密保存在云端</em></div>{(data.calendarAccess.active || data.calendarAccess.trialAvailable) ? <a href={`/api/google-calendar/connect?from=${localDateKey(new Date())}`}>{data.calendarAccess.trialAvailable ? "免费试用并连接 →" : "连接 Google 日历 →"}</a> : <span className="calendar-locked-action">选择套餐后连接</span>}</div>}<div className="calendar-fallback-title"><span>免费工具 · 其他日历或备用导入</span><i /></div><div className="provider-grid">{[
    ["google","G","Google Calendar ICS","不授权账号时，可使用 iCal 格式的私密网址"],
    ["outlook","O","Outlook / Microsoft 365","使用“设置 → 共享日历 → 发布日历 → ICS”"],
    ["icloud","◆","Apple iCloud","将日历设为公开并复制 webcal 订阅链接"],
    ["ics","↓","通用 ICS 文件","适用于飞书、钉钉、Notion Calendar 等导出的 .ics 文件"],
  ].map(([key,icon,name,note]) => <button key={key} className={provider === key ? `provider-card ${key} active` : `provider-card ${key}`} onClick={() => setProvider(key)}><span>{icon}</span><div><b>{name}</b><small>{note}</small></div><em>{provider === key ? "已选择" : "选择"}</em></button>)}</div><div className="calendar-import-row"><label className="calendar-link-field"><span>订阅链接</span><input value={calendarUrl} disabled={provider === "ics" && Boolean(calendarText)} onChange={(event) => setCalendarUrl(event.target.value)} placeholder="粘贴 https:// 或 webcal:// 开头的 ICS 链接" /></label><label className="calendar-range"><span>导入范围</span><select value={rangeDays} onChange={(event) => setRangeDays(Number(event.target.value))}><option value={1}>今天</option><option value={7}>未来 7 天</option><option value={14}>未来 14 天</option><option value={30}>未来 30 天</option></select></label><label className="ics-upload"><input type="file" accept=".ics,text/calendar" onChange={(event) => void chooseCalendarFile(event.target.files?.[0])} /><span>{calendarFile ? `✓ ${calendarFile}` : "上传 .ics 文件"}</span></label><button className="calendar-import-button" disabled={importing || (!calendarUrl.trim() && !calendarText)} onClick={() => void importCalendar()}>{importing ? "正在穿越星门…" : "导入任务"}</button></div><p className="calendar-privacy">安全提示：请勿分享日历订阅链接；系统只读取日程并保存任务，不保存链接或邮箱密码。</p></section>}{creating && <div className="quest-composer"><input value={title} onChange={e => setTitle(e.target.value)} placeholder="任务名称，例如：完成作品集第二页" /><input value={detail} onChange={e => setDetail(e.target.value)} placeholder="写下清晰的完成标准" /><select value={type} onChange={e => setType(e.target.value)}><option>日常</option><option>支线</option><option>主线</option></select><button onClick={() => void create()}>加入卷轴</button></div>}<div className="quest-summary-row"><div><span>✦</span><b>{data.quests.reduce((n,q) => n + (q.done ? q.reward : 0),0)}</b><small>今日已获经验</small></div><div><span>◇</span><b>{data.quests.filter(q => !q.done).length}</b><small>待完成委托</small></div><div><span>▦</span><b>{data.quests.filter(q => q.source !== "manual").length}</b><small>日历导入任务</small></div></div><TaskCompletionMap quests={allQuests} /></>}<div className="quest-list">{visible.map((q) => <article key={q.id} className={`${q.done ? "quest done" : "quest"}${selectedQuestIds.includes(q.id) ? " selected" : ""}`}>{editingQuestId === q.id ? <div className="quest-edit-form"><div className="quest-edit-fields"><label><span>任务名称</span><input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} maxLength={80} autoFocus /></label><label className="quest-edit-detail"><span>任务说明</span><textarea value={editDetail} onChange={(event) => setEditDetail(event.target.value)} maxLength={180} rows={2} /></label><label><span>任务类型</span><select value={editType} onChange={(event) => setEditType(event.target.value)}><option>主线</option><option>日常</option><option>支线</option></select></label></div><div className="quest-edit-actions"><button className="delete" onClick={() => void deleteQuest()} disabled={savingQuest || deletingQuest}>{deletingQuest ? "删除中…" : "删除任务"}</button><button onClick={() => setEditingQuestId(null)} disabled={savingQuest || deletingQuest}>取消</button><button className="save" onClick={() => void saveEdit()} disabled={savingQuest || deletingQuest || editTitle.trim().length < 2}>{savingQuest ? "保存中…" : "保存修改"}</button></div></div> : <>{selectionMode && <button className={selectedQuestIds.includes(q.id) ? "quest-select selected" : "quest-select"} aria-label={`${selectedQuestIds.includes(q.id) ? "取消选择" : "选择"}任务：${q.title}`} aria-pressed={selectedQuestIds.includes(q.id)} onClick={() => toggleQuestSelection(q.id)}>{selectedQuestIds.includes(q.id) ? "✓" : ""}</button>}<button className="quest-check" disabled={Boolean(q.done) || selectionMode} onClick={() => void act({ action: "completeQuest", questId: q.id }, `任务完成：经验 +${q.reward}`)}>{q.done ? "✓" : ""}</button><div className="quest-text"><div className="quest-badges"><span className={`quest-type type-${q.type}`}>{q.type}</span>{q.source !== "manual" && <span className={`calendar-source ${q.source.startsWith("google") ? "source-google" : `source-${q.source}`}`}>▦ {sourceLabel(q.source)}</span>}{q.dueAt && <time>{q.dueAt.length === 10 ? new Date(`${q.dueAt}T12:00:00`).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }) : new Date(q.dueAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}</time>}</div><h4>{q.title}</h4><p>{q.detail}</p></div>{!selectionMode && <button className="quest-edit-button" aria-label={`编辑任务：${q.title}`} onClick={() => beginEdit(q)}>✎<span>编辑</span></button>}<div className="reward"><span>✦</span><b>+{q.reward}</b></div></>}</article>)}</div></section>;
}

function Focus({ data, timer, running, setRunning, toggleRunning, setTimer, focusMinutes, setFocusMinutes, alertMode, setAlertMode, ambientSound, setAmbientSound, act }: {
  data: GameData;
  timer: string;
  running: boolean;
  setRunning: (v: boolean) => void;
  toggleRunning: () => void;
  setTimer: React.Dispatch<React.SetStateAction<number>>;
  focusMinutes: number;
  setFocusMinutes: (v: number) => void;
  alertMode: FocusAlertMode;
  setAlertMode: (v: FocusAlertMode) => void;
  ambientSound: AmbientSound;
  setAmbientSound: (v: AmbientSound) => void;
  act: (p: Record<string, unknown>, s: string) => Promise<boolean>;
}) {
  function choose(minutes: number) { if (running) return; setFocusMinutes(minutes); setTimer(minutes * 60); }
  const ambientOptions: { key: Exclude<AmbientSound, "none">; icon: string; name: string; note: string }[] = [
    { key: "rain", icon: "☂", name: "星雨", note: "近窗细雨 · 偶有雨滴" },
    { key: "fire", icon: "♨", name: "篝火", note: "木柴爆裂 · 炉火低鸣" },
    { key: "ocean", icon: "≈", name: "潮汐", note: "远近浪涌 · 泡沫回落" },
  ];
  const alertOptions: { key: FocusAlertMode; icon: string; name: string }[] = [
    { key: "both", icon: "✦", name: "弹窗 + 提示音" },
    { key: "popup", icon: "▣", name: "仅弹窗" },
    { key: "sound", icon: "♪", name: "仅提示音" },
    { key: "silent", icon: "◌", name: "静默结束" },
  ];
  return <section className="focus-layout"><div className="focus-stage glass-card"><div className="section-intro"><small>静谧秘境</small><h2>专注沙漏</h2><p>隔绝干扰、积累阅历，完成后自动同步到小组实力。</p></div><div className="focus-modes">{[["轻旅",15],["标准",25],["深潜",45],["长征",60]].map(([name,minutes]) => <button key={name} className={focusMinutes === minutes ? "active" : ""} onClick={() => choose(Number(minutes))}><b>{minutes}</b><span>{name}</span></button>)}</div><div className={running ? "timer-orbit giant running" : "timer-orbit giant"}><div className="orbit-dot" /><div className="timer-face"><small>{running ? "正在专注" : "准备启程"}</small><strong>{timer}</strong><span>{focusMinutes >= 45 ? "深度工作" : "专注修行"} · 云端计时</span></div></div><div className="timer-actions"><button className="secondary-button" onClick={() => { setRunning(false); setTimer(focusMinutes * 60); }}>重置</button><button className="primary-round" aria-label={running ? "暂停专注" : "开始专注"} onClick={toggleRunning}>{running ? "Ⅱ" : "▶"}</button><button className="secondary-button" onClick={() => setTimer((v) => v + 5 * 60)}>+5 分钟</button></div><div className="focus-control-deck"><section className="ambient-picker"><div className="focus-setting-heading"><div><small>白噪音场景</small><b>{ambientSound === "none" ? "环境音已关闭" : running ? "随专注播放中" : "开始计时后播放"}</b></div><button onClick={() => setAmbientSound("none")} className={ambientSound === "none" ? "active" : ""}>关闭</button></div><div className="ambient-options">{ambientOptions.map((option) => <button key={option.key} aria-pressed={ambientSound === option.key} className={ambientSound === option.key ? "active" : ""} onClick={() => setAmbientSound(option.key)}><span>{option.icon}</span><div><b>{option.name}</b><small>{option.note}</small></div><em>{ambientSound === option.key ? running ? "播放中" : "已选择" : "选择"}</em></button>)}</div></section><section className="alert-picker"><div className="focus-setting-heading"><div><small>结束提醒</small><b>专注结束时如何提醒</b></div><span>◷</span></div><div className="alert-options">{alertOptions.map((option) => <button key={option.key} aria-pressed={alertMode === option.key} className={alertMode === option.key ? "active" : ""} onClick={() => setAlertMode(option.key)}><span>{option.icon}</span>{option.name}</button>)}</div><p>提醒与白噪音偏好只保存在当前设备。</p></section></div></div><aside className="focus-insights"><div className="glass-card focus-stat"><small>专注总览</small><h3>{data.user.focusMinutes}<em> 分钟</em></h3><div className="focus-bars">{[35,62,45,80,55,72,40].map((v,i)=><i key={i} style={{height:`${v}%`}} />)}</div><p>坚持完成一次专注秘境，小组实力将增加 <b>{focusMinutes * 2}</b>。</p></div><div className="glass-card focus-history"><div className="card-heading"><div><small>历练手记</small><h3>最近专注</h3></div><span>◷</span></div>{data.focusHistory.length ? data.focusHistory.map(r => <article key={r.id}><span>静谧秘境</span><b>{r.minutes} 分钟</b><small>{new Date(r.created_at).toLocaleDateString("zh-CN")}</small></article>) : <div className="no-history">完成第一次专注后，记录会出现在这里。</div>}</div><button className="quick-finish" onClick={() => void act({action:"focus",minutes:focusMinutes},`已记录 ${focusMinutes} 分钟专注`)}>直接记录已完成专注</button></aside></section>;
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
    { icon:"✦", name:"初见之章", note:"完成第一个任务", unlocked:data.questCompletionTotal>0 },
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
  const gateFor = (realmId: string) => data.realmGates.find((item) => item.realmId === realmId);
  const unlocked = continents.filter((continent) => Boolean(progressFor(continent.id)?.unlocked));
  const nextGate = data.realmGates.find((gate) => gate.realmId !== "dawn" && !gate.unlocked);
  const target = continents.find((continent) => continent.id === nextGate?.realmId);
  const [view, setView] = useState<"map"|"ranking">("map");
  const [selectedId, setSelectedId] = useState(target?.id ?? unlocked.at(-1)?.id ?? "dawn");
  const [verifyingTask, setVerifyingTask] = useState<{ realmId: string; regionIndex: number } | null>(null);
  const [checkedCriteria, setCheckedCriteria] = useState<number[]>([]);
  const selected = continents.find(c => c.id === selectedId) ?? continents[0];
  const selectedProgress = progressFor(selected.id);
  const selectedGate = gateFor(selected.id);
  const isUnlocked = Boolean(selectedProgress?.unlocked);
  const isTarget = nextGate?.realmId === selected.id;
  const completedRegions = selectedProgress?.completedRegions ?? 0;
  const gateCompleted = selectedGate?.requirements.filter((requirement) => requirement.met).length ?? 0;
  const gateTotal = selectedGate?.requirements.length ?? 0;
  const verificationQuest = verifyingTask?.realmId === selected.id ? selected.quests[verifyingTask.regionIndex] : null;

  function openTaskVerification(regionIndex: number) {
    setVerifyingTask({ realmId: selected.id, regionIndex });
    setCheckedCriteria([]);
  }

  function toggleCriterion(index: number) {
    setCheckedCriteria((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index]);
  }

  async function confirmRealmTask() {
    if (!verifyingTask || !verificationQuest || checkedCriteria.length !== verificationQuest.criteria.length) return;
    const completed = await act(
      {
        action: "completeRealmTask",
        realmId: verifyingTask.realmId,
        regionIndex: verifyingTask.regionIndex,
        criteriaConfirmed: [...checkedCriteria].sort((left, right) => left - right),
      },
      `完成「${verificationQuest.name}」：+${selected.taskReward} EXP`,
    );
    if (completed) {
      setVerifyingTask(null);
      setCheckedCriteria([]);
    }
  }

  return <section className="atlas-panel">
    <div className="atlas-header">
      <div><span className="chapter">星旅世界 · 序列远征</span><h2>逐境完成高阶解锁门槛</h2><p>大陆按固定航线依次开放。除了累计 EXP，还要完成系统任务、专注修行、邀请好友、小组同行和前一大陆试炼。</p></div>
      <div className="atlas-level"><span>Lv.{level} · {data.user.xp.toLocaleString()} EXP</span><strong>{target ? target.name : "七境完成"}</strong><small>{target ? `当前已达成 ${nextGate?.requirements.filter((requirement) => requirement.met).length ?? 0}/${nextGate?.requirements.length ?? 0} 项门槛` : "全部大陆均已解锁"}</small></div>
    </div>
    <div className="atlas-tabs"><button className={view==="map"?"active":""} onClick={()=>setView("map")}>◎ 世界地图</button><button className={view==="ranking"?"active":""} onClick={()=>setView("ranking")}>♙ 小组排行</button></div>
    {view === "map" ? <div className="atlas-content">
      <div className="world-map glass-card">
        <div className="map-grid-lines" /><div className="map-compass">✦<i>N</i></div>
        <div className="ocean-name">THE STARCAMP WORLD · 星旅世界</div>
        {continents.map((continent,index) => {
          const realmProgress = progressFor(continent.id);
          const open = Boolean(realmProgress?.unlocked);
          const realmGate = gateFor(continent.id);
          const aiming = nextGate?.realmId === continent.id;
          const metRequirements = realmGate?.requirements.filter((requirement) => requirement.met).length ?? 0;
          const totalRequirements = realmGate?.requirements.length ?? 0;
          return <button key={continent.id} className={`continent continent-${continent.id} land-${continent.style} ${selectedId===continent.id?"selected":""} ${open?"unlocked":"locked"} ${aiming?"targeted":""}`} onClick={()=>setSelectedId(continent.id)}>
            <span className="land-shape" aria-hidden="true"><span className="terrain terrain-one" /><span className="terrain terrain-two" /><span className="terrain terrain-three" /><i>{open ? continent.icon : "⌾"}</i></span>
            <b>{continent.name}</b><span className="land-identity">{continent.real} · {continent.trait}</span><small>{continent.id === "dawn" ? "初始大陆 · 默认解锁" : `${metRequirements}/${totalRequirements} 门槛 · ${continent.difficulty}`}</small>
            {aiming ? <em>下一远征</em> : !open && <em>序列锁定</em>}<u>{index+1}</u>
          </button>;
        })}
        <div className="continent continent-mystery expanding" role="status" aria-label="神秘大陆，拓展中">
          <span className="land-shape" aria-hidden="true"><span className="terrain terrain-one" /><span className="terrain terrain-two" /><span className="terrain terrain-three" /><i>?</i></span>
          <b>神秘大陆</b><span className="land-identity">未知领域 · 星雾封锁</span><small>世界边界之外</small><em>拓展中</em>
        </div>
        <div className="sea-route route-a" /><div className="sea-route route-b" /><div className="sea-route route-c" /><div className="sea-route route-mystery" />
      </div>
      <aside className={`continent-detail detail-${selected.style} glass-card ${isUnlocked?"":"locked"}`}>
        <div className="detail-banner"><span>{isUnlocked ? selected.icon : "⌾"}</span><div><small>{selected.real} · 世界第 {continents.findIndex(c=>c.id===selected.id)+1} 境</small><h3>{selected.name}</h3><p>{selected.title}</p></div></div>
        {isUnlocked ? <>
          <p className="continent-story">{selected.story}</p>
          <div className="realm-trait"><span>{selected.icon}</span><div><small>全站环境特性</small><b>{selected.trait}</b></div></div>
          <div className="explore-progress"><div><span>大陆任务进度 · 完成标准核验后计入</span><b>{completedRegions}/{selected.quests.length}</b></div><i><em style={{width:`${completedRegions / selected.quests.length * 100}%`}} /></i></div>
          <div className="region-list">{selected.quests.map((quest,index) => {
            const done = index < completedRegions;
            const available = index === completedRegions;
            return <button key={quest.name} className={done ? "region-done" : available ? "region-available" : "region-locked"} disabled={!available} onClick={() => openTaskVerification(index)}>
              <span>{done ? "✓" : index+1}</span>
              <div><b>{quest.name}</b><small>{done ? "标准已核验 · EXP 已领取" : available ? `核验 3 项完成标准 · +${selected.taskReward} EXP` : "完成前置任务后开放"}</small></div>
              <em>{done ? "已完成" : available ? "核验" : "⌾"}</em>
            </button>;
          })}</div>
          {verificationQuest && verifyingTask && <section className="realm-verification" role="dialog" aria-modal="true" aria-label={`${verificationQuest.name}完成标准`}>
            <div className="verification-head"><div><small>{selected.name} · 第 {verifyingTask.regionIndex + 1} 项试炼</small><h4>确认「{verificationQuest.name}」完成标准</h4></div><button aria-label="关闭核验" onClick={() => setVerifyingTask(null)}>×</button></div>
            <p>以下标准必须真实完成并逐项确认，全部通过后才会计入大陆进度。</p>
            <div className="criteria-list">{verificationQuest.criteria.map((criterion,index) => <label key={criterion} className={checkedCriteria.includes(index) ? "checked" : ""}><input type="checkbox" checked={checkedCriteria.includes(index)} onChange={() => toggleCriterion(index)} /><span>{checkedCriteria.includes(index) ? "✓" : index + 1}</span><b>{criterion}</b></label>)}</div>
            <div className="verification-actions"><button onClick={() => { setVerifyingTask(null); setCheckedCriteria([]); }}>暂不提交</button><button className="verify-submit" disabled={checkedCriteria.length !== verificationQuest.criteria.length} onClick={() => void confirmRealmTask()}>确认全部达成并领取</button></div>
          </section>}
          <div className={completedRegions >= selected.quests.length ? "continent-boss conquered" : "continent-boss"}><span>♢</span><div><small>{completedRegions >= selected.quests.length ? "大陆任务全部完成" : "大陆终局试炼"}</small><b>{selected.boss}</b></div><em>{completedRegions >= selected.quests.length ? `已获得 · ${selected.reward}` : `限定奖励 · ${selected.reward}`}</em></div>
          <button className={activeRealmId === selected.id ? "enter-continent active" : "enter-continent"} onClick={() => onEnter(selected)}>{activeRealmId === selected.id ? `已驻扎 · 返回${selected.name}营地` : `进入 ${selected.name}`}</button>
          {activeRealmId === selected.id && <button className="leave-continent" onClick={onLeave}>离开大陆，返回星旅主世界</button>}
          {completedRegions >= selected.quests.length && unlocked.length < continents.length && <div className="route-choice-ready">✓ 当前大陆试炼已完成，继续达成下一境系统门槛</div>}
        </> : <div className="locked-detail realm-gate-detail">
          <span>{isTarget ? "◎" : "⌾"}</span>
          <h4>{isTarget ? `下一远征 · ${selected.name}` : `序列未抵达 · ${selected.name}`}</h4>
          <p><b>{selected.difficulty}</b>级远征，需要同时完成以下 {gateTotal} 项系统门槛；仅有 EXP 达标不会解锁。</p>
          <div className="realm-gate-summary"><i style={{width:`${gateTotal ? gateCompleted / gateTotal * 100 : 0}%`}} /></div>
          <strong className="gate-count">{gateCompleted}/{gateTotal} 项已达成</strong>
          <div className="realm-gate-list">{selectedGate?.requirements.map((requirement) => {
            const progress = Math.min(100, requirement.current / Math.max(1, requirement.required) * 100);
            return <article key={requirement.key} className={requirement.met ? "met" : ""}><span>{requirement.met ? "✓" : "◇"}</span><div><b>{requirement.label}</b><small>{requirement.current.toLocaleString()}/{requirement.required.toLocaleString()}{requirement.unit}</small><i><em style={{width:`${progress}%`}} /></i></div></article>;
          })}</div>
          <small className="route-choice-blocked">{isTarget ? "所有门槛完成后系统会自动解锁，无需手动申请。" : `请先完成${target?.name ?? "前方大陆"}的远征门槛，世界航线不可跳过。`}</small>
        </div>}
        <div className="world-milestone"><span>{unlocked.length}/7</span><p>已发现大陆<br/><small>继续完成任务以拓展世界地图</small></p></div>
      </aside>
    </div> : <div className="ranking glass-card atlas-ranking">{data.leaderboard.length ? data.leaderboard.map((team, i) => <article key={team.id} className={data.team?.id === team.id ? "my-team" : ""}><div className={`rank-number rank-${i + 1}`}>{i + 1}</div><div className="rank-crest">{i < 3 ? "✦" : "◇"}</div><div className="rank-name"><b>{team.name}</b><span>{team.members}/5 位旅行者 · 累计专注 {team.focus_minutes} 分钟</span></div><div className="rank-power"><strong>{Number(team.strength).toLocaleString()}</strong><span>世界实力</span></div></article>) : <div className="empty-ranking"><span>◎</span><h3>世界正在等待第一支队伍</h3><p>创建小组并完成任务，你们将成为榜单上的第一束星光。</p></div>}</div>}
  </section>;
}
