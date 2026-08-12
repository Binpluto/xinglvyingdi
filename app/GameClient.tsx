"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

type Quest = { id: number; title: string; detail: string; reward: number; type: string; source: string; dueAt: string | null; createdAt: string; completedAt: string | null; done: number };
type Member = { display_name: string; email: string; xp: number; focus_minutes: number; strength: number; avatar_key: string; custom_avatar: string | null };
type TeamInvitation = { id: number; teamId: number; teamName: string; inviterName: string; memberCount: number; createdAt: string };
type FriendInvitation = { id: number; inviterEmail: string; inviterName: string; avatarKey: string; customAvatar: string | null; createdAt: string };
type TeamJoinRequest = { id: number; applicantEmail: string; applicantName: string; avatarKey: string; customAvatar: string | null; approvals: number; requiredApprovals: number; myVote: "approve" | "reject" | null; createdAt: string };
type MyTeamJoinRequest = { id: number; teamName: string; status: string; approvals: number; requiredApprovals: number; createdAt: string };
type SiteNotification = { id: number; kind: string; title: string; body: string; entityId: number | null; readAt: string | null; createdAt: string };
type Team = { id: number; name: string; code: string; owner_email: string; member_count: number; members: Member[]; pendingInvitations: Array<{ id: number; inviteeEmail: string; createdAt: string }>; pendingJoinRequests: TeamJoinRequest[] };
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
type DailyDeparture = { departureDate: string; mainGoal: string; focusGoalMinutes: number; energyLevel: "low" | "medium" | "high"; startedAt: string };
type HabitSettings = { departureReminder: string | null; mainReminder: string | null; reviewReminder: string | null; notificationsEnabled: boolean };
type HabitState = { currentStreak: number; longestStreak: number; activeDays: number; restTicketsRemaining: number; canRepairYesterday: boolean; claimedMilestones: number[] };
type WeeklyEnergyCompletion = { energyLevel: "low" | "medium" | "high"; planned: number; completed: number; rate: number | null };
type WeeklyReport = {
  startDate: string;
  endDate: string;
  completedCount: number;
  completedItems: Array<{ title: string; reward: number; completedDate: string; type: string }>;
  typeBreakdown: Array<{ type: string; count: number }>;
  plannedFocusMinutes: number;
  actualFocusMinutes: number;
  focusAchievementRate: number;
  postponedType: { type: string; count: number } | null;
  energyCompletion: WeeklyEnergyCompletion[];
  recommendations: { keep: string; reduce: string; prioritize: string };
  highlight: { title: string; reward: number; date: string } | null;
};
type SevenDayChallengeDay = { id: number; day: number; title: string; detail: string; reward: number; dueDate: string; done: boolean };
type SevenDayChallenge = {
  active: boolean;
  startDate: string | null;
  completedCount: number;
  currentDay: number;
  currentTask: SevenDayChallengeDay | null;
  days: SevenDayChallengeDay[];
  totalReward: number;
};
type GameData = {
  user: { email: string; name: string; inviteCode: string; invitedBy: string | null; xp: number; coins: number; focusMinutes: number; referralCount: number; avatarKey: string; customAvatar: string | null };
  quests: Quest[];
  questActivity: QuestActivityDay[];
  questCompletionTotal: number;
  recentQuestCompletions: QuestCompletionRecord[];
  focusHistory: FocusRecord[];
  todayFocusMinutes: number;
  weeklyReport: WeeklyReport;
  sevenDayChallenge: SevenDayChallenge;
  dailyDeparture: DailyDeparture | null;
  habitSettings: HabitSettings;
  habit: HabitState;
  inventory: InventoryItem[];
  realmProgress: RealmProgress[];
  realmGates: RealmGate[];
  calendarAccess: CalendarAccess;
  calendarConnection: CalendarConnection;
  premiumProgram: PremiumProgram;
  team: Team | null;
  pendingTeamInvitations: TeamInvitation[];
  pendingFriendInvitations: FriendInvitation[];
  myTeamJoinRequests: MyTeamJoinRequest[];
  notifications: SiteNotification[];
  unreadNotificationCount: number;
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
const avatarCatalog = [
  { key: "initial", symbol: "初", name: "初心印记", level: 1 },
  { key: "streak30", symbol: "🔥", name: "三十日星冠", level: 1 },
  { key: "dawn", symbol: "☼", name: "曦华晨星", level: 100 },
  { key: "quill", symbol: "✒", name: "苍冠羽笔", level: 125 },
  { key: "ember", symbol: "☀", name: "赤土烈阳", level: 150 },
  { key: "tide", symbol: "≈", name: "珊海潮歌", level: 200 },
  { key: "storm", symbol: "↯", name: "风暴先驱", level: 300 },
  { key: "verdant", symbol: "❧", name: "森灵之心", level: 500 },
  { key: "polar", symbol: "✦", name: "极星之证", level: 700 },
  { key: "crown", symbol: "♛", name: "千级星冠", level: 1000 },
] as const;
function avatarGlyph(user: { name?: string; display_name?: string; avatarKey?: string; avatar_key?: string; customAvatar?: string | null; custom_avatar?: string | null }) {
  const key = user.avatarKey ?? user.avatar_key ?? "initial";
  if (key === "initial") return (user.name ?? user.display_name ?? "旅").slice(0, 1);
  if (key === "custom") return user.customAvatar ?? user.custom_avatar ?? (user.name ?? user.display_name ?? "旅").slice(0, 1);
  return avatarCatalog.find((avatar) => avatar.key === key)?.symbol ?? (user.name ?? user.display_name ?? "旅").slice(0, 1);
}
const milestoneCopy = (level: number) => {
  const smallChapters = [
    { title: "十阶星光", message: "又一段旅程被你稳稳走完。微小但持续的行动，正在改变远方。" },
    { title: "营火更明", message: "每十级都是一次小小抵达，也是一份值得认真收藏的坚持。" },
    { title: "步履有声", message: "你为目标留下了新的证据。请带着这束星光，继续向前。" },
    { title: "新程已启", message: "成长没有被辜负，你已经站上下一段旅程的起点。" },
  ];
  const grandChapters = [
    { title: "星火成炬", message: "你已把一个个微小行动，汇聚成足以照亮前路的星光。" },
    { title: "远征不息", message: "真正的成长从不喧哗。你坚持走过的每一步，都已经成为实力。" },
    { title: "群星见证", message: "你不只抵达了更高等级，也成为同行者眼中可靠的光。" },
    { title: "传奇新章", message: "里程碑不是终点，而是你有能力继续创造更大世界的证明。" },
  ];
  return level % 100 === 0
    ? grandChapters[(Math.floor(level / 100) - 1) % grandChapters.length]
    : smallChapters[(Math.floor(level / 10) - 1) % smallChapters.length];
};

function downloadHonorCertificate(level: number, travelerName: string, shareCode: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 1120;
  const context = canvas.getContext("2d");
  if (!context) return;
  const background = context.createLinearGradient(0, 0, 1600, 1120);
  background.addColorStop(0, "#f8f3df");
  background.addColorStop(.52, "#eff6eb");
  background.addColorStop(1, "#dcece7");
  context.fillStyle = background;
  context.fillRect(0, 0, 1600, 1120);
  const glow = context.createRadialGradient(800, 430, 30, 800, 430, 620);
  glow.addColorStop(0, "rgba(236,198,103,.30)");
  glow.addColorStop(1, "rgba(236,198,103,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, 1600, 1120);
  context.strokeStyle = "#b99547";
  context.lineWidth = 7;
  context.strokeRect(52, 52, 1496, 1016);
  context.strokeStyle = "rgba(37,103,111,.55)";
  context.lineWidth = 2;
  context.strokeRect(74, 74, 1452, 972);
  context.textAlign = "center";
  context.fillStyle = "#b58a38";
  context.font = "28px Georgia, 'PingFang SC', serif";
  context.fillText("✦  S T A R C A M P  ·  星 旅 营 地  ✦", 800, 160);
  context.fillStyle = "#214f61";
  context.font = "600 72px 'PingFang SC', 'Microsoft YaHei', sans-serif";
  context.fillText("百级远征荣誉奖状", 800, 278);
  context.fillStyle = "#7b8d8d";
  context.font = "28px Georgia, serif";
  context.fillText("CENTENNIAL EXPEDITION CERTIFICATE", 800, 332);
  context.fillStyle = "#8a743e";
  context.font = "25px 'PingFang SC', sans-serif";
  context.fillText("谨授予旅行者", 800, 418);
  context.fillStyle = "#183f52";
  context.font = "600 62px 'PingFang SC', 'Microsoft YaHei', sans-serif";
  context.fillText((travelerName || "星旅旅行者").slice(0, 20), 800, 505);
  context.fillStyle = "#526f74";
  context.font = "30px 'PingFang SC', sans-serif";
  context.fillText("以持续的专注、行动与勇气，完成百级远征里程碑", 800, 580);
  const levelGradient = context.createLinearGradient(610, 0, 990, 0);
  levelGradient.addColorStop(0, "#1d6172");
  levelGradient.addColorStop(.5, "#b68735");
  levelGradient.addColorStop(1, "#1d6172");
  context.fillStyle = levelGradient;
  context.font = "700 96px Georgia, serif";
  context.fillText(`Lv. ${level}`, 800, 710);
  context.fillStyle = "#8d733c";
  context.font = "27px 'PingFang SC', sans-serif";
  context.fillText(milestoneCopy(level).title, 800, 765);
  context.strokeStyle = "rgba(181,138,56,.55)";
  context.beginPath();
  context.moveTo(280, 820);
  context.lineTo(1320, 820);
  context.stroke();
  context.fillStyle = "#315e66";
  context.font = "600 30px 'PingFang SC', sans-serif";
  context.fillText(`星旅营地分享码：${shareCode}`, 800, 885);
  context.fillStyle = "#7e8e8d";
  context.font = "22px 'PingFang SC', sans-serif";
  context.fillText("邀请好友输入分享码，与同行者共同开启人生冒险", 800, 928);
  context.textAlign = "left";
  context.fillText(`荣誉签发日：${new Date().toLocaleDateString("zh-CN")}`, 138, 1000);
  context.textAlign = "right";
  context.fillText(`证书编号：SC-${level}-${shareCode}`, 1462, 1000);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `星旅营地-Lv${level}-荣誉奖状.png`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}
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
const isCalendarQuestSource = (source: string) => source.startsWith("google") || ["outlook", "icloud", "ics"].includes(source);

type ScenePace = "gentle" | "standard" | "sprint";
const sceneTemplateCatalog = [
  { id: "exam", icon: "▤", name: "备考", tagline: "从诊断、复习到全真模拟", duration: "7～14 天", tasks: ["完成备考诊断", "搭建复习航线", "攻克薄弱章节", "完成一组限时练习", "建立错题星图", "进行一次全真模拟"] },
  { id: "thesis", icon: "✎", name: "论文", tagline: "把研究问题推进到可提交版本", duration: "7～14 天", tasks: ["明确论文核心问题", "建立文献地图", "冻结论文结构", "完成首段深度写作", "补齐证据与引用", "完成一轮整体修订"] },
  { id: "job", icon: "◇", name: "求职", tagline: "目标岗位、材料、面试与投递", duration: "7～14 天", tasks: ["确定目标岗位", "重写一页简历", "整理作品与案例", "建立投递清单", "完成一次模拟面试", "完成高质量投递"] },
  { id: "fitness", icon: "↟", name: "健身", tagline: "训练、补给、恢复形成闭环", duration: "7～14 天", tasks: ["记录身体起点", "完成全身力量训练", "完成低强度有氧", "准备恢复补给", "完成渐进训练", "完成一周体能复盘"] },
  { id: "freelance", icon: "⌁", name: "自由职业", tagline: "兼顾交付、获客与经营节律", duration: "7～14 天", tasks: ["定义本周可交付成果", "划定深度工作时段", "整理客户与线索", "完成核心交付", "发布专业内容", "完成经营复盘"] },
  { id: "sleep", icon: "☾", name: "早睡计划", tagline: "用环境与仪式建立睡眠节律", duration: "7～14 天", tasks: ["设定固定熄灯时间", "建立睡前关机仪式", "清理睡眠环境", "记录睡眠航海日志", "调整白天能量节律", "完成一周睡眠复盘"] },
] as const;
const scenePaceOptions: Array<{ id: ScenePace; name: string; note: string; count: number }> = [
  { id: "gentle", name: "轻装", note: "7 天 · 隔日推进", count: 4 },
  { id: "standard", name: "标准", note: "14 天 · 完整路线", count: 6 },
  { id: "sprint", name: "冲刺", note: "7 天 · 集中完成", count: 6 },
];

const QUEST_ENERGY: Record<string, number> = { "主线": 20, "支线": 14, "日常": 10 };
const DAILY_ENERGY_GOAL = 150;
function campEnergy(data: GameData) {
  const today = localDateKey(new Date());
  const completedToday = data.quests.filter((quest) => {
    if (!quest.done || !quest.completedAt) return false;
    const completedAt = new Date(quest.completedAt);
    return !Number.isNaN(completedAt.getTime()) && localDateKey(completedAt) === today;
  });
  const taskEnergy = completedToday.reduce((total, quest) => total + (QUEST_ENERGY[quest.type] ?? 10), 0);
  const focusEnergy = Math.min(40, Math.floor(data.todayFocusMinutes / 2));
  const score = taskEnergy + focusEnergy;
  const progress = Math.min(100, Math.round((score / DAILY_ENERGY_GOAL) * 100));
  const main = completedToday.filter((quest) => quest.type === "主线").length;
  const side = completedToday.filter((quest) => quest.type === "支线").length;
  const daily = completedToday.filter((quest) => quest.type === "日常").length;
  const state = score >= 120
    ? { tone: "green-deep", icon: "✧", label: "深绿巅峰", message: "今日行动力已经抵达巅峰，深绿色能量正照亮整个营地。" }
    : score >= 90
      ? { tone: "green", icon: "✦", label: "能量充盈", message: "稳定的专注与完成正在累积，今日能量十分充盈。" }
      : score >= 60
        ? { tone: "green-soft", icon: "☀", label: "状态良好", message: "今日状态已经进入绿色区间，继续保持这份节奏。" }
        : score >= 30
          ? { tone: "orange", icon: "◐", label: "逐渐升温", message: "能量正在回升，再完成一项任务就更接近绿色区间。" }
          : score > 0
            ? { tone: "red", icon: "◔", label: "初光已现", message: "今日能量已经开始积累，再完成一项任务即可继续推进。" }
            : { tone: "red", icon: "☁", label: "等待点亮", message: "今日能量仍然偏低，开始一次专注或完成任务即可推进。" };
  return { score, progress, taskEnergy, focusEnergy, completedToday: completedToday.length, main, side, daily, ...state };
}

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

export default function GameClient({ identity, onLogout, onDeleteAccount }: { identity: { email: string; name: string }; onLogout: () => Promise<void>; onDeleteAccount: (password: string) => Promise<void> }) {
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
  const [showInbox, setShowInbox] = useState(false);
  const [customAvatarDraft, setCustomAvatarDraft] = useState("");
  const [showAccountDeletion, setShowAccountDeletion] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteAccountError, setDeleteAccountError] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
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
    const reachedMilestone = Math.floor(currentLevel / 10) * 10;
    if (reachedMilestone < 10) return;
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
    const inviteCode = new URLSearchParams(window.location.search).get("invite")?.trim().toUpperCase() ?? "";
    if (!/^[A-Z0-9-]{4,32}$/.test(inviteCode)) return;
    setInviteInput(inviteCode);
    setTab("营地");
    notify("好友邀请链接已载入，登录后确认即可领取双方奖励");
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
  useEffect(() => {
    if (!data?.habitSettings.notificationsEnabled || !("Notification" in window)) return;
    const checkReminders = async () => {
      if (Notification.permission !== "granted") return;
      const now = new Date();
      const today = localDateKey(now);
      const storageKey = `starcamp-proactive-reminders:${identity.email}:${today}`;
      let sent: string[] = [];
      try { sent = JSON.parse(window.localStorage.getItem(storageKey) || "[]"); } catch { sent = []; }
      if (sent.length >= 2) return;
      const minuteNow = now.getHours() * 60 + now.getMinutes();
      const due = (value: string | null) => {
        if (!value) return false;
        const [hour, minute] = value.split(":").map(Number);
        const delta = minuteNow - (hour * 60 + minute);
        return delta >= 0 && delta <= 15;
      };
      const mainQuest = sortQuests(data.quests).find((quest) => !quest.done && quest.type === "主线" && (!quest.dueAt || quest.dueAt.slice(0, 10) <= today));
      const remainingFocus = Math.max(5, (data.dailyDeparture?.focusGoalMinutes ?? 15) - data.todayFocusMinutes);
      const candidates = [
        !data.dailyDeparture && due(data.habitSettings.departureReminder)
          ? { key: "departure", body: "用 20 秒选择今日主线与专注时长，然后立刻开始第一步。" } : null,
        mainQuest && due(data.habitSettings.mainReminder)
          ? { key: "main", body: `完成今日主线「${mainQuest.title}」只需再专注 ${remainingFocus} 分钟。` } : null,
        due(data.habitSettings.reviewReminder)
          ? { key: "review", body: `今天已完成 ${data.questActivity.find((day) => day.date === today)?.count ?? 0} 项任务、专注 ${data.todayFocusMinutes} 分钟，花 1 分钟复盘并准备明日航线。` } : null,
      ].filter((item): item is { key: string; body: string } => Boolean(item));
      for (const reminder of candidates) {
        if (sent.length >= 2 || sent.includes(reminder.key)) continue;
        try {
          const registration = await navigator.serviceWorker?.ready;
          if (registration) await registration.showNotification("星旅营地 · 行动提醒", { body: reminder.body, icon: "/app-icon-192.png", tag: `starcamp-${today}-${reminder.key}` });
          else new Notification("星旅营地 · 行动提醒", { body: reminder.body, icon: "/app-icon-192.png", tag: `starcamp-${today}-${reminder.key}` });
          sent.push(reminder.key);
          window.localStorage.setItem(storageKey, JSON.stringify(sent));
        } catch { /* 浏览器拒绝系统通知时保持安静 */ }
      }
    };
    void checkReminders();
    const interval = window.setInterval(() => void checkReminders(), 30000);
    return () => window.clearInterval(interval);
  }, [data, identity.email]);

  async function load() {
    const res = await fetch(`/api/game?clientDate=${localDateKey(new Date())}`);
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

  async function redeemFriendInvite() {
    const redeemed = await act({ action: "redeemInvite", code: inviteInput }, "邀请绑定成功，双方奖励已到账");
    if (redeemed) window.history.replaceState({}, "", window.location.pathname);
  }

  async function toggleInbox() {
    const opening = !showInbox;
    setShowInbox(opening);
    if (!opening || !data?.unreadNotificationCount) return;
    const res = await fetch("/api/game", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "markNotificationsRead", clientDate: localDateKey(new Date()) }) });
    if (res.ok) setData(await res.json());
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

  async function permanentlyDeleteAccount() {
    if (!deletePassword) return;
    setDeletingAccount(true);
    setDeleteAccountError("");
    try {
      await onDeleteAccount(deletePassword);
    } catch (error) {
      setDeleteAccountError(error instanceof Error ? error.message : "账号删除失败，请稍后重试");
      setDeletingAccount(false);
    }
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
  const isGrandMilestone = Boolean(levelMilestone && levelMilestone % 100 === 0);

  if (!data) {
    return <main className="loading-world"><div className="loading-seal">✧</div><p>正在连接星旅世界…</p></main>;
  }

  if (!data.dailyDeparture) {
    return <><DailyDeparturePage name={displayName} onStart={async (payload) => {
      const started = await act({ action: "startDailyDeparture", ...payload }, "今日航向已保存，主线任务已生成");
      if (started) {
        setFocusMinutes(payload.focusGoalMinutes);
        setTimer(payload.focusGoalMinutes * 60);
        setTab("任务");
      }
      return started;
    }} />{toast && <div className="toast">✦ {toast}</div>}</>;
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
            <div className="notification-menu">
              <button className="notification-button" aria-label={`星邮通知，${data.unreadNotificationCount} 条未读`} aria-expanded={showInbox} onClick={() => void toggleInbox()}><span>✉</span>{data.unreadNotificationCount > 0 && <i>{Math.min(99, data.unreadNotificationCount)}</i>}</button>
              {showInbox && <aside className="notification-popover"><div className="notification-heading"><div><small>STARCAMP POST</small><b>星邮通知中心</b></div><button aria-label="关闭星邮" onClick={() => setShowInbox(false)}>×</button></div>{data.notifications.length ? <div className="notification-list">{data.notifications.map((notice) => <button key={notice.id} className={notice.readAt ? "read" : "unread"} onClick={() => { setShowInbox(false); setTab("小组"); }}><span>{notice.kind.includes("friend") ? "☼" : notice.kind.includes("team") ? "♙" : "✦"}</span><div><b>{notice.title}</b><p>{notice.body}</p><small>{new Date(notice.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</small></div></button>)}</div> : <div className="notification-empty"><span>◇</span><p>暂时没有新的星邮<br/>邀请和入组申请会出现在这里。</p></div>}<small className="notification-note">当前仅提供邀请与审批通知，不开放陌生人自由聊天。</small></aside>}
            </div>
            <div className="level-menu">
              <button className="avatar" aria-label="查看升级规则与头像" aria-expanded={showLevelGuide} onClick={() => { setShowInbox(false); setShowLevelGuide((visible) => !visible); }}><span>{avatarGlyph(data.user)}</span><em>Lv. {level}</em></button>
              {showLevelGuide && <aside className="level-guide">
                <div className="level-guide-head"><span>Lv.{level}</span><div><small>距离 Lv.{level + 1}</small><b>{levelXp} / {XP_PER_LEVEL} EXP</b></div><button aria-label="关闭升级说明" onClick={() => setShowLevelGuide(false)}>×</button></div>
                <div className="level-guide-progress"><i style={{ width: `${levelXp}%` }} /></div>
                <h4>旅行者升级规则</h4>
                <p>从 Lv.1、0 EXP 开始，每累计 100 EXP 提升 1 级。</p>
                <ul><li><span>完成任务</span><b>+25～80 EXP</b></li><li><span>专注修行</span><b>每分钟 +2 EXP</b></li><li><span>邀请好友</span><b>双方 +100 / +200 EXP</b></li></ul>
                <div className="avatar-unlock-panel"><div><b>百级头像工坊 · 荣誉头像</b><small>{level < 100 ? `百级头像 Lv.100 开放 · 还差 ${100 - level} 级` : "等级越高，可选择的头像越多"}</small></div><div className="avatar-choice-grid">{avatarCatalog.map((choice) => { const streakLocked = choice.key === "streak30" && !data.habit.claimedMilestones.includes(30); const unlocked = level >= choice.level && !streakLocked; const lockLabel = streakLocked ? "连续启程 30 天" : `Lv.${choice.level}`; return <button key={choice.key} className={data.user.avatarKey === choice.key ? "selected" : ""} disabled={!unlocked} title={unlocked ? choice.name : `${lockLabel} 解锁`} onClick={() => void act({ action: "updateAvatar", avatarKey: choice.key }, `已换上「${choice.name}」头像`)}><span>{choice.key === "initial" ? displayName.slice(0, 1) : choice.symbol}</span><small>{unlocked ? choice.name : lockLabel}</small></button>})}</div>{level >= 100 && <div className="custom-avatar-row"><label><span>自定义文字/符号头像</span><input value={customAvatarDraft} onChange={(event) => setCustomAvatarDraft(Array.from(event.target.value).slice(0, 2).join(""))} placeholder="如：🌙 或 旅" /></label><button disabled={!customAvatarDraft.trim()} onClick={() => void act({ action: "updateAvatar", avatarKey: "custom", customAvatar: customAvatarDraft }, "自定义头像已保存到云端")}>使用</button></div>}</div>
                <div className="continent-level-rules"><b>大陆解锁门槛</b>{continents.map((realm) => <span key={realm.id}><i>{realm.icon}</i>{realm.name}<em>{realm.id === "dawn" ? "默认解锁" : `${realm.xpRequired} EXP · ${realm.difficulty}`}</em></span>)}</div>
                <small className="level-world-note">曦华大陆默认开放。其余大陆按固定顺序解锁，必须同时完成前一大陆试炼，并达到经验、系统任务、专注、邀请好友和小组人数门槛。</small>
                <div className="account-data-actions"><a href="/privacy.html" target="_blank" rel="noreferrer">隐私政策</a><button onClick={() => { setShowLevelGuide(false); setShowAccountDeletion(true); }}>删除账号与云端数据</button></div>
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
      {tab === "营地" && !data.user.invitedBy && <div className="invite-banner"><div><b>来自好友的星光？</b><span>填写邀请码，你与邀请人都能获得奖励</span></div><input value={inviteInput} onChange={(e) => setInviteInput(e.target.value)} placeholder="输入好友邀请码" /><button onClick={() => void redeemFriendInvite()}>领取奖励</button></div>}
      {toast && <div className="toast">✦ {toast}</div>}
      {showFocusComplete && <div className="focus-complete-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setShowFocusComplete(false); }}><section className="focus-complete-dialog" role="dialog" aria-modal="true" aria-labelledby="focus-complete-title"><button className="focus-complete-close" aria-label="关闭专注完成提示" onClick={() => setShowFocusComplete(false)}>×</button><span className="focus-complete-seal">✦</span><small>FOCUS COMPLETE</small><h2 id="focus-complete-title">专注秘境完成</h2><p>你已完成 {focusMinutes} 分钟专注，历练记录与小组实力已同步到云端。</p><div><button onClick={() => { setShowFocusComplete(false); setTab("营地"); }}>返回营地</button><button className="focus-again" onClick={() => { setShowFocusComplete(false); setTimer(focusMinutes * 60); setTab("专注"); }}>再来一次</button></div></section></div>}
      {showAccountDeletion && <div className="account-delete-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target && !deletingAccount) setShowAccountDeletion(false); }}><section className="account-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="account-delete-title"><button aria-label="关闭删除账号窗口" onClick={() => setShowAccountDeletion(false)} disabled={deletingAccount}>×</button><span>◇</span><small>ACCOUNT &amp; CLOUD DATA</small><h2 id="account-delete-title">永久删除账号</h2><p>任务、专注记录、队伍关系、世界进度、日历连接和权益记录将从云端永久删除，且无法恢复。</p><label><b>输入当前密码确认</b><input type="password" autoComplete="current-password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} placeholder="当前账号密码" /></label>{deleteAccountError && <div role="alert">{deleteAccountError}</div>}<footer><button onClick={() => { setShowAccountDeletion(false); setDeletePassword(""); setDeleteAccountError(""); }} disabled={deletingAccount}>取消</button><button className="danger" onClick={() => void permanentlyDeleteAccount()} disabled={deletingAccount || !deletePassword}>{deletingAccount ? "正在删除…" : "永久删除账号"}</button></footer></section></div>}
      {levelMilestone && activeMilestoneCopy && <div className={`level-milestone-backdrop ${isGrandMilestone ? "milestone-grand" : "milestone-small"}`}>
        <div className="milestone-stars" aria-hidden="true">{Array.from({ length: isGrandMilestone ? 18 : 8 }, (_, index) => <i key={index}>✦</i>)}</div>
        <section className="level-milestone-card" role="dialog" aria-modal="true" aria-labelledby="level-milestone-title">
          <button className="level-milestone-close" aria-label="关闭等级庆祝提示" onClick={() => setLevelMilestone(null)}>×</button>
          <div className="milestone-radiance" aria-hidden="true" />
          <div className="milestone-level"><span>Lv.</span><strong>{levelMilestone}</strong></div>
          <small>{isGrandMilestone ? "CENTENNIAL HONOR · 百级荣誉庆典" : "TEN-LEVEL STARLIGHT · 十级星光"}</small>
          <h2 id="level-milestone-title">{isGrandMilestone ? "百级远征达成！" : `恭喜抵达 Lv.${levelMilestone}`}</h2>
          <h3>{activeMilestoneCopy.title}</h3>
          <p>{activeMilestoneCopy.message}</p>
          {isGrandMilestone && <div className="milestone-honor-note"><span>♜</span><div><b>专属荣誉奖状已解锁</b><small>包含旅行者名称、百级等级与分享码 {data.user.inviteCode}</small></div></div>}
          <div className="milestone-next"><span>{isGrandMilestone ? "下一次百级荣誉" : "下一次十级星光"}</span><b>Lv.{levelMilestone + (isGrandMilestone ? 100 : 10)}</b></div>
          <div className="milestone-actions">
            {isGrandMilestone && <button className="milestone-certificate-download" onClick={() => downloadHonorCertificate(levelMilestone, data.user.name, data.user.inviteCode)}>下载专属荣誉奖状</button>}
            <button className="milestone-continue" onClick={() => setLevelMilestone(null)}>收下祝福 · 继续远征</button>
          </div>
        </section>
      </div>}
    </main>
  );
}

function DailyDeparturePage({ name, onStart }: { name: string; onStart: (payload: { mainGoal: string; focusGoalMinutes: number; energyLevel: "low" | "medium" | "high" }) => Promise<boolean> }) {
  const [mainGoal, setMainGoal] = useState("");
  const [focusGoalMinutes, setFocusGoalMinutes] = useState(25);
  const [energyLevel, setEnergyLevel] = useState<"low" | "medium" | "high">("medium");
  const [submitting, setSubmitting] = useState(false);
  async function start() {
    if (mainGoal.trim().length < 2 || submitting) return;
    setSubmitting(true);
    await onStart({ mainGoal: mainGoal.trim(), focusGoalMinutes, energyLevel });
    setSubmitting(false);
  }
  return <main className="daily-departure-page">
    <div className="departure-glow departure-glow-one" /><div className="departure-glow departure-glow-two" />
    <section className="daily-departure-card" aria-labelledby="daily-departure-title">
      <header><span className="departure-seal">✦</span><small>DAILY DEPARTURE · 每日启程</small><h1 id="daily-departure-title">早安，{name}</h1><p>先确定今天的航向，再进入营地。只需 20 秒。</p></header>
      <label className="departure-main-goal"><span>今天最重要的一件事是什么？</span><input autoFocus maxLength={80} value={mainGoal} onChange={(event) => setMainGoal(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void start(); }} placeholder="例如：完成产品方案第一版" /></label>
      <fieldset><legend>今天准备专注多少分钟？</legend><div className="departure-focus-options">{[15, 25, 45, 60].map((minutes) => <button type="button" className={focusGoalMinutes === minutes ? "active" : ""} key={minutes} onClick={() => setFocusGoalMinutes(minutes)}><b>{minutes}</b><span>分钟</span></button>)}</div></fieldset>
      <fieldset><legend>当前精力</legend><div className="departure-energy-options">{[
        ["low", "低", "轻装出发"], ["medium", "中", "稳定推进"], ["high", "高", "全力远征"],
      ].map(([key, label, note]) => <button type="button" key={key} className={energyLevel === key ? `active energy-${key}` : ""} onClick={() => setEnergyLevel(key as "low" | "medium" | "high")}><i /><b>{label}</b><span>{note}</span></button>)}</div></fieldset>
      <button className="departure-start" disabled={mainGoal.trim().length < 2 || submitting} onClick={() => void start()}>{submitting ? "正在生成今日航线…" : "开始今日冒险"}<span>→</span></button>
      <footer><span>今日主线会自动加入任务页</span><span>云端保存</span></footer>
    </section>
  </main>;
}

function HabitHub({ data, act }: { data: GameData; act: (p: Record<string, unknown>, s: string) => Promise<boolean> }) {
  const [settings, setSettings] = useState<HabitSettings>(data.habitSettings);
  const [saving, setSaving] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  useEffect(() => setSettings(data.habitSettings), [data.habitSettings]);
  useEffect(() => setPermission("Notification" in window ? Notification.permission : "unsupported"), []);
  async function requestNotificationPermission() {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") setSettings((current) => ({ ...current, notificationsEnabled: true }));
  }
  async function saveSettings() {
    setSaving(true);
    await act({ action: "updateHabitSettings", ...settings }, settings.notificationsEnabled ? "行动提醒已保存到云端" : "主动提醒已关闭");
    setSaving(false);
  }
  const rewardSteps = [
    { day: 7, icon: "▣", title: "小型补给箱", note: "+100 星辉" },
    { day: 14, icon: "◇", title: "稀有勋章碎片", note: "+180 星辉" },
    { day: 30, icon: "♛", title: "限定头像与装饰", note: "+300 星辉" },
  ];
  return <section className="habit-hub">
    <article className="glass-card streak-card">
      <div className="card-heading"><div><small>连续启程 · 温和坚持</small><h3>星火旅程</h3></div><span className="streak-flame">♨</span></div>
      <div className="streak-stats"><div><strong>{data.habit.currentStreak}</strong><span>当前连续</span></div><div><strong>{data.habit.longestStreak}</strong><span>历史最长</span></div><div><strong>{data.habit.restTicketsRemaining}</strong><span>本月休整券</span></div></div>
      <div className="streak-strip" aria-label={`当前连续启程 ${data.habit.currentStreak} 天`}>{Array.from({ length: 30 }, (_, index) => <i key={index} className={index < Math.min(30, data.habit.currentStreak) ? "lit" : ""} />)}</div>
      <div className="streak-rewards">{rewardSteps.map((reward) => { const claimed = data.habit.claimedMilestones.includes(reward.day); return <div key={reward.day} className={claimed ? "claimed" : data.habit.currentStreak >= reward.day ? "ready" : ""}><span>{claimed ? "✓" : reward.icon}</span><div><b>{reward.day} 天 · {reward.title}</b><small>{claimed ? "已收入行囊" : reward.note}</small></div></div>})}</div>
      <p>连续 1～6 天积累星火；漏一天不会抹去历史最长记录。每月自动获得 2 张休整券。</p>
      {data.habit.canRepairYesterday && <button className="rest-ticket-button" onClick={() => void act({ action: "useHabitRestTicket" }, "休整券已使用，昨日星火已被温柔接续")}>使用 1 张休整券修复昨日</button>}
    </article>
    <article className="glass-card reminder-card">
      <div className="card-heading"><div><small>习惯触发点 · 自主选择</small><h3>行动提醒</h3></div><label className="reminder-switch"><input type="checkbox" checked={settings.notificationsEnabled} onChange={(event) => setSettings((current) => ({ ...current, notificationsEnabled: event.target.checked }))} /><i /></label></div>
      <p className="reminder-limit">每天最多发送 2 次主动通知；专注结束弹窗不计入。</p>
      <div className="reminder-times">
        <label><span><i>☼</i><b>每日启程</b><small>选择主线并立即开始</small></span><input type="time" value={settings.departureReminder ?? ""} onChange={(event) => setSettings((current) => ({ ...current, departureReminder: event.target.value || null }))} /></label>
        <label><span><i>✦</i><b>未完成主线</b><small>告诉你还需专注多久</small></span><input type="time" value={settings.mainReminder ?? ""} onChange={(event) => setSettings((current) => ({ ...current, mainReminder: event.target.value || null }))} /></label>
        <label><span><i>☾</i><b>睡前复盘</b><small>汇总任务与专注成果</small></span><input type="time" value={settings.reviewReminder ?? ""} onChange={(event) => setSettings((current) => ({ ...current, reviewReminder: event.target.value || null }))} /></label>
      </div>
      {permission !== "granted" && <button className="notification-permission" disabled={permission === "denied" || permission === "unsupported"} onClick={() => void requestNotificationPermission()}>{permission === "denied" ? "浏览器通知已被拒绝，请在系统设置中开启" : permission === "unsupported" ? "当前浏览器不支持系统通知" : "允许浏览器发送提醒"}</button>}
      <button className="save-reminders" disabled={saving || (settings.notificationsEnabled && permission !== "granted")} onClick={() => void saveSettings()}>{saving ? "保存中…" : "保存提醒设置"}</button>
      <small className="reminder-footnote">网页或已安装的 App/PWA 运行时可准时提醒；完全关闭后需要后续接入系统推送服务。</small>
    </article>
  </section>;
}

function WeeklyVoyageReport({ report }: { report: WeeklyReport }) {
  const [shareState, setShareState] = useState("");
  const energyNames = { low: "低精力", medium: "中精力", high: "高精力" };
  const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  const shareText = [
    "星旅营地 · 本周航海报告",
    `${dateLabel(report.startDate)}—${dateLabel(report.endDate)}`,
    `完成 ${report.completedCount} 项任务，实际专注 ${report.actualFocusMinutes} 分钟。`,
    report.highlight ? `本周最值得分享：${report.highlight.title}` : "这一周，我仍在为自己的航向积蓄星光。",
  ].join("\n");

  async function shareHighlight() {
    try {
      if (navigator.share) {
        await navigator.share({ title: "星旅营地 · 每周航海报告", text: shareText });
        setShareState("已打开分享");
      } else {
        await navigator.clipboard.writeText(shareText);
        setShareState("报告摘要已复制");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(shareText);
        setShareState("报告摘要已复制");
      } catch {
        setShareState("复制失败，请稍后重试");
      }
    }
  }

  return <section className="weekly-voyage-report" aria-labelledby="weekly-report-title">
    <header className="weekly-report-head">
      <div><small>WEEKLY VOYAGE REPORT · 每周航海报告</small><h2 id="weekly-report-title">把一周的航迹，收进这一页</h2><p>{dateLabel(report.startDate)} — {dateLabel(report.endDate)} · 每周一自动开启新航程</p></div>
      <span className="weekly-report-compass" aria-hidden="true">✦</span>
    </header>
    <div className="weekly-report-stats">
      <div><strong>{report.completedCount}</strong><span>本周完成</span></div>
      <div><strong>{report.plannedFocusMinutes}</strong><span>计划专注 / 分钟</span></div>
      <div><strong>{report.actualFocusMinutes}</strong><span>实际专注 / 分钟</span></div>
      <div><strong>{report.focusAchievementRate}%</strong><span>专注达成率</span></div>
    </div>
    <div className="weekly-report-grid">
      <article className="weekly-report-panel weekly-completed-panel">
        <div className="weekly-section-title"><span>01</span><div><small>本周完成了什么</small><h3>已抵达的航标</h3></div></div>
        {report.typeBreakdown.length > 0 && <div className="weekly-type-chips">{report.typeBreakdown.map((item) => <span key={item.type}>{item.type}<b>{item.count}</b></span>)}</div>}
        {report.completedItems.length ? <ol>{report.completedItems.map((item) => <li key={`${item.completedDate}-${item.title}`}><i>✓</i><span><b>{item.title}</b><small>{item.type} · {dateLabel(item.completedDate)}</small></span><em>+{item.reward}</em></li>)}</ol> : <p className="weekly-empty">本周还没有完成记录。完成第一项任务后，航标会出现在这里。</p>}
      </article>
      <article className="weekly-report-panel weekly-focus-panel">
        <div className="weekly-section-title"><span>02</span><div><small>计划专注与实际专注</small><h3>{report.actualFocusMinutes >= report.plannedFocusMinutes && report.plannedFocusMinutes > 0 ? "航速达到预期" : "校准下周航速"}</h3></div></div>
        <div className="weekly-focus-compare"><div><i style={{ width: `${Math.min(100, report.plannedFocusMinutes ? report.actualFocusMinutes / report.plannedFocusMinutes * 100 : 0)}%` }} /></div><p><b>{report.actualFocusMinutes}</b> / {report.plannedFocusMinutes || "未设计划"} 分钟</p></div>
        <div className="weekly-delay"><span>03</span><div><small>最常延期的任务类型</small><b>{report.postponedType ? report.postponedType.type : "本周无明显延期"}</b><p>{report.postponedType ? `共 ${report.postponedType.count} 项，建议拆分后重新排期。` : "继续保持清晰截止时间与适量计划。"}</p></div></div>
      </article>
      <article className="weekly-report-panel weekly-energy-panel">
        <div className="weekly-section-title"><span>04</span><div><small>不同精力状态下的完成率</small><h3>认识自己的行动节律</h3></div></div>
        <div className="weekly-energy-list">{report.energyCompletion.map((item) => <div key={item.energyLevel} className={`energy-${item.energyLevel}`}><header><b>{energyNames[item.energyLevel]}</b><span>{item.rate === null ? "尚无样本" : `${item.rate}%`}</span></header><div><i style={{ width: `${item.rate ?? 0}%` }} /></div><small>{item.planned ? `${item.completed} / ${item.planned} 项完成` : "完成每日启程后开始统计"}</small></div>)}</div>
      </article>
      <article className="weekly-report-panel weekly-next-panel">
        <div className="weekly-section-title"><span>05</span><div><small>下周航线建议</small><h3>保留、减少与优先</h3></div></div>
        <div className="weekly-recommendations"><div className="keep"><b>保留</b><p>{report.recommendations.keep}</p></div><div className="reduce"><b>减少</b><p>{report.recommendations.reduce}</p></div><div className="prioritize"><b>优先</b><p>{report.recommendations.prioritize}</p></div></div>
      </article>
    </div>
    <footer className="weekly-highlight">
      <span aria-hidden="true">✦</span><div><small>06 · 本周最值得分享的一项成果</small><h3>{report.highlight?.title ?? "继续出发，下一项成果正在前方"}</h3>{report.highlight && <p>{dateLabel(report.highlight.date)}{report.highlight.reward ? ` · 获得 ${report.highlight.reward} 星辉` : " · 本周主线"}</p>}</div>
      <button type="button" onClick={() => void shareHighlight()}>分享本周成果 ↗</button>{shareState && <em role="status">{shareState}</em>}
    </footer>
  </section>;
}

const sevenDayPreview = [
  ["定目标", "点亮第一颗主星"],
  ["专注", "完成首次专注"],
  ["行动", "清理一个阻碍"],
  ["能量", "读懂今日状态"],
  ["同行", "寻找同行星光"],
  ["成果", "留下一项成果"],
  ["复盘", "完成篝火复盘"],
] as const;

function SevenDayChallengeCard({ challenge, act, setTab }: { challenge: SevenDayChallenge; act: (p: Record<string, unknown>, s: string) => Promise<boolean>; setTab: (tab: string) => void }) {
  const [starting, setStarting] = useState(false);
  const today = localDateKey(new Date());
  const finished = challenge.active && challenge.completedCount === 7;
  const currentTask = challenge.currentTask;

  async function startChallenge() {
    setStarting(true);
    const started = await act(
      { action: "startSevenDayChallenge", templateStartDate: today },
      "7天星旅挑战已开启，今天的第一项任务已抵达",
    );
    setStarting(false);
    if (started) setTab("任务");
  }

  return <section className={`seven-day-challenge${challenge.active ? " active" : " ready"}${finished ? " finished" : ""}`} aria-labelledby="seven-day-title">
    <div className="seven-day-orbit" aria-hidden="true"><i /><i /><i /></div>
    <header className="seven-day-head">
      <div><small>NEW TRAVELER ROUTE · 新手第一周</small><h2 id="seven-day-title">7天星旅挑战</h2><p>{challenge.active ? finished ? "七颗星已经连成你的第一条航线。" : "每天完成一个核心行动，不需要一次弄懂所有功能。" : "不知道第一周该做什么？沿着七颗星出发，每天只完成一件关键小事。"}</p></div>
      <div className="seven-day-reward"><span>✦</span><div><b>{challenge.totalReward}</b><small>全程可获 EXP</small></div></div>
    </header>
    <div className="seven-day-route" role="list" aria-label="七天挑战路线">{sevenDayPreview.map(([label, title], index) => {
      const persistedDay = challenge.days[index];
      const done = Boolean(persistedDay?.done);
      const current = challenge.active && !finished && challenge.currentDay === index + 1;
      return <div role="listitem" key={label} className={`${done ? "done" : ""}${current ? " current" : ""}`}><span>{done ? "✓" : index + 1}</span><i /><div><small>DAY {index + 1} · {label}</small><b>{persistedDay?.title.replace(/^Day \d · /, "") ?? title}</b></div></div>;
    })}</div>
    {!challenge.active ? <footer className="seven-day-start"><div><b>今天从 Day 1 开始</b><span>生成 7 项带日期的云端任务 · 可编辑 · 可删除 · 不收费</span></div><button type="button" disabled={starting} onClick={() => void startChallenge()}>{starting ? "正在点亮航线…" : "开启7天挑战 →"}</button></footer> : finished ? <footer className="seven-day-complete"><span>✦</span><div><b>第一条星旅航线已完成</b><p>打开每周航海报告，看看这一周的专注、精力与成果。</p></div><button type="button" onClick={() => document.getElementById("weekly-report-title")?.scrollIntoView({ behavior: "smooth" })}>查看本周报告 ↓</button></footer> : <footer className="seven-day-today"><span>DAY {currentTask?.day ?? challenge.currentDay}</span><div><small>{currentTask?.dueDate && currentTask.dueDate > today ? `${new Date(`${currentTask.dueDate}T12:00:00`).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })} 开启下一站` : "今天只做这一件"}</small><b>{currentTask?.title ?? "继续今日航线"}</b><p>{currentTask?.detail}</p></div><button type="button" onClick={() => setTab("任务")}>{currentTask?.dueDate && currentTask.dueDate > today ? "查看任务页" : "去完成今日任务 →"}</button></footer>}
  </section>;
}

function Camp({ data, done, setTab, act, realm }: { data: GameData; done: number; setTab: (v: string) => void; act: (p: Record<string, unknown>, s: string) => Promise<boolean>; realm: Realm | null }) {
  const energy = campEnergy(data);
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
  </div><SevenDayChallengeCard challenge={data.sevenDayChallenge} act={act} setTab={setTab} /><WeeklyVoyageReport report={data.weeklyReport} /><HabitHub data={data} act={act} /><div className="camp-bottom-grid">
    <section className="glass-card camp-agenda"><div className="card-heading"><div><small>今日旅程</small><h3>冒险日程</h3></div><button className="text-button" onClick={() => setTab("任务")}>管理任务 →</button></div>{agenda.map((item, index) => <div className="agenda-line" key={`${item.title}-${index}`}><i /><span>{item.time}</span><div><b>{item.title}</b><small>{item.detail}</small></div><em>{item.state}</em></div>)}</section>
    <section className={`glass-card camp-weather energy-${energy.tone}`}>
      <div className="card-heading"><div><small>营地天气 · 实时变化</small><h3>今日能量</h3></div><span className="weather-symbol">{energy.icon}</span></div>
      <div className="energy-score"><div><strong>{energy.score}</strong><small>今日积分</small></div><em>{energy.label}</em></div>
      <div
        className="energy-meter"
        style={{ "--energy-progress": `${energy.progress}%` } as CSSProperties}
        role="progressbar"
        aria-label={`今日能量 ${energy.score} 分，${energy.label}`}
        aria-valuemin={0}
        aria-valuemax={DAILY_ENERGY_GOAL}
        aria-valuenow={Math.min(energy.score, DAILY_ENERGY_GOAL)}
      ><i aria-hidden="true" /></div>
      <div className="energy-scale" aria-hidden="true"><span>0</span><span>30</span><span>60</span><span>90</span><span>120</span><span>150</span></div>
      <div className="energy-sources" aria-label="今日能量来源">
        <span><i>◷</i><b>专注 {data.todayFocusMinutes} 分钟</b><em>+{energy.focusEnergy}</em></span>
        <span><i>✦</i><b>完成 {energy.completedToday} 项任务</b><em>+{energy.taskEnergy}</em></span>
      </div>
      <div className="energy-task-legend"><span>主线 +20</span><span>支线 +14</span><span>日常 +10</span></div>
      <p>{energy.message}</p>
    </section>
    <section className="glass-card camp-achievement"><div className="card-heading"><div><small>最近获得</small><h3>冒险回响</h3></div><button className="text-button" onClick={() => setTab("行囊")}>打开行囊 →</button></div><div className="mini-badges"><div><span>✦</span><b>初心者</b><small>完成首个任务</small></div><div><span>◷</span><b>静心者</b><small>累计专注 60 分钟</small></div><div className={data.user.referralCount ? "" : "locked"}><span>♙</span><b>引路人</b><small>邀请一位好友</small></div></div></section>
  </div></>;
}

function TaskCompletionMap({ quests }: { quests: QuestActivityFeed }) {
  const weekCount = 53;
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
    <p className="activity-scale-note">近一年冒险轨迹 · 每格代表一天 · 完成任务越多，格子颜色越深</p>
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

function SceneTemplateLibrary({ act, onClose }: { act: (p: Record<string, unknown>, s: string) => Promise<boolean>; onClose: () => void }) {
  const [sceneId, setSceneId] = useState("exam");
  const [pace, setPace] = useState<ScenePace>("standard");
  const [startDate, setStartDate] = useState(() => localDateKey(new Date()));
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const scene = sceneTemplateCatalog.find((item) => item.id === sceneId) ?? sceneTemplateCatalog[0];
  const paceMeta = scenePaceOptions.find((item) => item.id === pace) ?? scenePaceOptions[1];

  async function applyTemplate() {
    setApplying(true);
    setApplied(false);
    const succeeded = await act(
      { action: "applySceneTemplate", sceneId, scenePace: pace, templateStartDate: startDate },
      `${scene.name}模板已启用，${paceMeta.count} 项任务已排入云端航线`,
    );
    setApplying(false);
    setApplied(succeeded);
  }

  return <section className="scene-template-library" aria-labelledby="scene-template-title">
    <header className="scene-template-head"><div><small>SCENE ROUTES · 场景模板</small><h3 id="scene-template-title">选择一个现实目标，生成可执行的冒险航线</h3><p>模板会自动安排主线、支线、日期与建议专注时长，启用后仍可自由编辑或批量删除。</p></div><button type="button" aria-label="关闭场景模板" onClick={onClose}>×</button></header>
    <div className="scene-template-cards">{sceneTemplateCatalog.map((item) => <button type="button" key={item.id} className={sceneId === item.id ? `scene-${item.id} active` : `scene-${item.id}`} onClick={() => { setSceneId(item.id); setApplied(false); }}><span>{item.icon}</span><div><b>{item.name}</b><small>{item.tagline}</small></div><em>{item.duration}</em></button>)}</div>
    <div className="scene-template-builder">
      <div className="scene-template-preview"><div><span>{scene.icon}</span><div><small>{scene.name} · 任务预览</small><h4>{scene.tagline}</h4></div></div><ol>{scene.tasks.map((task, index) => <li key={task} className={pace === "gentle" && ![0, 1, 3, 5].includes(index) ? "pace-skipped" : ""}><i>{index + 1}</i><span>{task}</span></li>)}</ol></div>
      <div className="scene-template-settings">
        <fieldset><legend>执行节奏</legend>{scenePaceOptions.map((option) => <button type="button" key={option.id} className={pace === option.id ? "active" : ""} onClick={() => { setPace(option.id); setApplied(false); }}><b>{option.name}</b><span>{option.note}</span><em>{option.count} 项</em></button>)}</fieldset>
        <label><span>开始日期</span><input type="date" min={localDateKey(new Date())} value={startDate} onChange={(event) => { setStartDate(event.target.value); setApplied(false); }} /></label>
        <div className="scene-template-summary"><span>✦</span><p>将生成 <b>{paceMeta.count} 项</b>云端任务；到期当天自动进入“今日任务”，并计入热力图和每周航海报告。</p></div>
        <button type="button" className="apply-scene-template" disabled={applying || !startDate} onClick={() => void applyTemplate()}>{applying ? "正在绘制航线…" : `启用「${scene.name}」模板 →`}</button>
        {applied && <p className="scene-template-success" role="status">✓ 航线已生成。今天到期的任务已出现在下方，未来任务会按日期抵达。</p>}
      </div>
    </div>
  </section>;
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
  const [sceneTemplatesOpen, setSceneTemplatesOpen] = useState(false);
  const allQuests = Object.assign([...data.quests], {
    activity: data.questActivity,
    total: data.questCompletionTotal,
    recent: data.recentQuestCompletions,
  }) as QuestActivityFeed;
  const boardQuests = todayRelevantQuests(allQuests);
  data = { ...data, quests: boardQuests };
  const done = boardQuests.filter((quest) => Boolean(quest.done)).length;
  const visible = sortQuests(data.quests.filter(q => filter === "全部" || (filter === "日历" ? isCalendarQuestSource(q.source) : q.type === filter)));
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
  const sourceLabel = (source: string) => source === "system-daily-easy" ? "系统 · 简单" : source === "system-daily-medium" ? "系统 · 普通" : source === "system-daily-hard" ? "系统 · 困难" : source.startsWith("scene-template-") ? "场景模板" : source.startsWith("google") ? "Google" : source === "outlook" ? "Outlook" : source === "icloud" ? "iCloud" : source === "ics" ? "ICS" : "";
  return <section className={`quest-card glass-card ${compact ? "" : "full-panel enriched-quests"}`}><div className="card-heading"><div><small>冒险家协会 · 云端委托</small><h3>今日任务</h3></div><div className="completion"><b>{done}/{data.quests.length}</b><span>完成 {Math.round(done / Math.max(data.quests.length, 1) * 100)}%</span></div></div>{!compact && <><div className="quest-toolbar"><div>{["全部","主线","日常","支线","日历"].map(v => <button key={v} className={filter === v ? "active" : ""} onClick={() => { setFilter(v); setSelectedQuestIds([]); }}>{v}</button>)}</div><div className="quest-toolbar-actions"><button className={sceneTemplatesOpen ? "scene-template-button active" : "scene-template-button"} onClick={() => { setSceneTemplatesOpen((open) => !open); setCalendarOpen(false); }}>◈ 场景模板</button><button className={selectionMode ? "batch-manage-button active" : "batch-manage-button"} onClick={() => { setSelectionMode((enabled) => !enabled); setSelectedQuestIds([]); setEditingQuestId(null); }}>☑ {selectionMode ? "退出管理" : "批量管理"}</button><button className="calendar-button" onClick={() => { setCalendarOpen(!calendarOpen); setSceneTemplatesOpen(false); }}>▦ 同步日历</button><button className="new-quest-button" onClick={() => setCreating(!creating)}>＋ 发布新委托</button></div></div>{sceneTemplatesOpen && <SceneTemplateLibrary act={act} onClose={() => setSceneTemplatesOpen(false)} />}{selectionMode && <div className="quest-bulk-bar"><button className="bulk-select-all" onClick={toggleSelectVisible}>{allVisibleSelected ? "取消全选" : "全选当前"}</button><span>已选择 <b>{selectedQuestIds.length}</b> 个任务</span><button className="bulk-cancel" onClick={() => { setSelectionMode(false); setSelectedQuestIds([]); }}>取消</button><button className="bulk-delete" disabled={!selectedQuestIds.length || deletingSelected} onClick={() => void deleteSelectedQuests()}>{deletingSelected ? "删除中…" : `删除选中（${selectedQuestIds.length}）`}</button></div>}{calendarOpen && <section className="calendar-portal"><div className="calendar-heading"><div><small>星历传送门 · 实时绑定为付费权益</small><h3>连接并自动同步 Google 日历</h3><p>授权后每两分钟检查一次变化，只同步当天及未来日程；普通任务与手动上传 ICS 永久免费，实时账号绑定需要星历通行证。</p></div><span>◫</span></div><div className={`calendar-membership-status ${data.calendarAccess.active ? "active" : "inactive"}`}><span>{data.calendarAccess.active ? "✦" : "◇"}</span><div><b>{accessLabel}</b><small>{data.calendarAccess.active ? `有效期至 ${accessUntilLabel}` : accessUntilLabel}</small></div>{data.calendarAccess.levelRewardEligible && <button onClick={() => void act({ action: "claimCalendarLevelReward" }, "恭喜获得一年星历通行证")}>领取 Lv.100 一年奖励</button>}</div>{data.premiumProgram.isFreeMember && <section className="premium-free-summary"><span>✦</span><div><small>创始体验账户</small><b>全部付费功能永久免费</b><p>无需购买套餐，当前及后续付费功能都会直接解锁。</p></div></section>}{data.premiumProgram.isAdmin && <PremiumSlotManager program={data.premiumProgram} act={act} />}<div className={data.premiumProgram.isFreeMember ? "calendar-pricing premium-hidden" : "calendar-pricing"}><div className="calendar-pricing-intro"><div><small>星历通行证</small><b>先免费体验 7 天，再决定是否开通</b></div><span>不自动扣费 · 到期前可随时续期</span></div><div className="calendar-plan-grid">{[
    { key: "week", name: "周卡", price: "HK$8", unit: "/ 7天", note: "短期冲刺与旅行安排" },
    { key: "month", name: "月卡", price: "HK$20", unit: "/ 30天", note: "稳定使用 · 每天约 HK$0.67" },
    { key: "year", name: "年卡", price: "HK$160", unit: "/ 365天", note: "推荐 · 比月卡节省约 34%" },
  ].map((plan) => <article className={plan.key === "year" ? "calendar-plan recommended" : "calendar-plan"} key={plan.key}>{plan.key === "year" && <em>最划算</em>}<small>{plan.name}</small><div><b>{plan.price}</b><span>{plan.unit}</span></div><p>{plan.note}</p><button disabled={Boolean(checkoutPlan)} onClick={() => void purchaseCalendarPlan(plan.key as "week" | "month" | "year")}>{checkoutPlan === plan.key ? "正在前往支付…" : "选择套餐"}</button></article>)}</div><p className="calendar-trial-rule">由 Waffo 提供安全收款，均为一次性付款，不会自动续费。每个账号仅可试用一次；试用从首次连接 Google 日历时开始。Lv.100 奖励限领取一次，可与剩余通行证时长叠加。</p></div>{data.calendarConnection.connected ? <div className={`google-live-card connected${data.calendarAccess.active ? "" : " access-paused"}`}><span className="google-calendar-mark">G</span><div><small>Google Calendar 已连接</small><b>{data.calendarConnection.googleEmail || "主日历"}</b><em>{data.calendarAccess.active ? data.calendarConnection.lastSyncedAt ? `上次同步 ${new Date(data.calendarConnection.lastSyncedAt).toLocaleString("zh-CN")}` : "正在进行首次同步" : "通行证到期，自动同步已暂停；已导入任务继续保留"}</em></div><button onClick={() => void syncGoogle()} disabled={syncingGoogle || !data.calendarAccess.active}>{syncingGoogle ? "同步中…" : data.calendarAccess.active ? "立即同步" : "续费后同步"}</button><button className="disconnect-google" onClick={() => void disconnectGoogle()}>断开</button></div> : <div className="google-live-card"><span className="google-calendar-mark">G</span><div><small>{data.calendarAccess.trialAvailable ? "首次连接 · 自动开启 7 天试用" : data.calendarAccess.active ? "星历通行证已生效" : "需要开通星历通行证"}</small><b>连接你的 Google 主日历</b><em>仅请求只读权限，授权令牌加密保存在云端</em></div>{(data.calendarAccess.active || data.calendarAccess.trialAvailable) ? <a href={`/api/google-calendar/connect?from=${localDateKey(new Date())}`}>{data.calendarAccess.trialAvailable ? "免费试用并连接 →" : "连接 Google 日历 →"}</a> : <span className="calendar-locked-action">选择套餐后连接</span>}</div>}<div className="calendar-fallback-title"><span>免费工具 · 其他日历或备用导入</span><i /></div><div className="provider-grid">{[
    ["google","G","Google Calendar ICS","不授权账号时，可使用 iCal 格式的私密网址"],
    ["outlook","O","Outlook / Microsoft 365","使用“设置 → 共享日历 → 发布日历 → ICS”"],
    ["icloud","◆","Apple iCloud","将日历设为公开并复制 webcal 订阅链接"],
    ["ics","↓","通用 ICS 文件","适用于飞书、钉钉、Notion Calendar 等导出的 .ics 文件"],
  ].map(([key,icon,name,note]) => <button key={key} className={provider === key ? `provider-card ${key} active` : `provider-card ${key}`} onClick={() => setProvider(key)}><span>{icon}</span><div><b>{name}</b><small>{note}</small></div><em>{provider === key ? "已选择" : "选择"}</em></button>)}</div><div className="calendar-import-row"><label className="calendar-link-field"><span>订阅链接</span><input value={calendarUrl} disabled={provider === "ics" && Boolean(calendarText)} onChange={(event) => setCalendarUrl(event.target.value)} placeholder="粘贴 https:// 或 webcal:// 开头的 ICS 链接" /></label><label className="calendar-range"><span>导入范围</span><select value={rangeDays} onChange={(event) => setRangeDays(Number(event.target.value))}><option value={1}>今天</option><option value={7}>未来 7 天</option><option value={14}>未来 14 天</option><option value={30}>未来 30 天</option></select></label><label className="ics-upload"><input type="file" accept=".ics,text/calendar" onChange={(event) => void chooseCalendarFile(event.target.files?.[0])} /><span>{calendarFile ? `✓ ${calendarFile}` : "上传 .ics 文件"}</span></label><button className="calendar-import-button" disabled={importing || (!calendarUrl.trim() && !calendarText)} onClick={() => void importCalendar()}>{importing ? "正在穿越星门…" : "导入任务"}</button></div><p className="calendar-privacy">安全提示：请勿分享日历订阅链接；系统只读取日程并保存任务，不保存链接或邮箱密码。</p></section>}{creating && <div className="quest-composer"><input value={title} onChange={e => setTitle(e.target.value)} placeholder="任务名称，例如：完成作品集第二页" /><input value={detail} onChange={e => setDetail(e.target.value)} placeholder="写下清晰的完成标准" /><select value={type} onChange={e => setType(e.target.value)}><option>日常</option><option>支线</option><option>主线</option></select><button onClick={() => void create()}>加入卷轴</button></div>}<div className="quest-summary-row"><div><span>✦</span><b>{data.quests.reduce((n,q) => n + (q.done ? q.reward : 0),0)}</b><small>今日已获经验</small></div><div><span>◇</span><b>{data.quests.filter(q => !q.done).length}</b><small>待完成委托</small></div><div><span>▦</span><b>{data.quests.filter(q => isCalendarQuestSource(q.source)).length}</b><small>日历导入任务</small></div></div><TaskCompletionMap quests={allQuests} /></>}<div className="quest-list">{visible.map((q) => <article key={q.id} className={`${q.done ? "quest done" : "quest"}${selectedQuestIds.includes(q.id) ? " selected" : ""}`}>{editingQuestId === q.id ? <div className="quest-edit-form"><div className="quest-edit-fields"><label><span>任务名称</span><input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} maxLength={80} autoFocus /></label><label className="quest-edit-detail"><span>任务说明</span><textarea value={editDetail} onChange={(event) => setEditDetail(event.target.value)} maxLength={180} rows={2} /></label><label><span>任务类型</span><select value={editType} onChange={(event) => setEditType(event.target.value)}><option>主线</option><option>日常</option><option>支线</option></select></label></div><div className="quest-edit-actions"><button className="delete" onClick={() => void deleteQuest()} disabled={savingQuest || deletingQuest}>{deletingQuest ? "删除中…" : "删除任务"}</button><button onClick={() => setEditingQuestId(null)} disabled={savingQuest || deletingQuest}>取消</button><button className="save" onClick={() => void saveEdit()} disabled={savingQuest || deletingQuest || editTitle.trim().length < 2}>{savingQuest ? "保存中…" : "保存修改"}</button></div></div> : <>{selectionMode && <button className={selectedQuestIds.includes(q.id) ? "quest-select selected" : "quest-select"} aria-label={`${selectedQuestIds.includes(q.id) ? "取消选择" : "选择"}任务：${q.title}`} aria-pressed={selectedQuestIds.includes(q.id)} onClick={() => toggleQuestSelection(q.id)}>{selectedQuestIds.includes(q.id) ? "✓" : ""}</button>}<button className="quest-check" disabled={Boolean(q.done) || selectionMode} onClick={() => void act({ action: "completeQuest", questId: q.id }, `任务完成：经验 +${q.reward}`)}>{q.done ? "✓" : ""}</button><div className="quest-text"><div className="quest-badges"><span className={`quest-type type-${q.type}`}>{q.type}</span>{q.source !== "manual" && <span className={`calendar-source ${q.source.startsWith("google") ? "source-google" : q.source.startsWith("scene-template-") ? "source-scene-template" : `source-${q.source}`}`}>▦ {sourceLabel(q.source)}</span>}{q.dueAt && <time>{q.dueAt.length === 10 ? new Date(`${q.dueAt}T12:00:00`).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }) : new Date(q.dueAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}</time>}</div><h4>{q.title}</h4><p>{q.detail}</p></div>{!selectionMode && <button className="quest-edit-button" aria-label={`编辑任务：${q.title}`} onClick={() => beginEdit(q)}>✎<span>编辑</span></button>}<div className="reward"><span>✦</span><b>+{q.reward}</b></div></>}</article>)}</div></section>;
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
const habitRewardCatalog = [
  { key:"habit-supply-box", icon:"▣", name:"七日小型补给箱", note:"连续启程 7 天的云端纪念收藏" },
  { key:"rare-medal-fragment", icon:"◇", name:"稀有勋章碎片", note:"连续启程 14 天获得的稀有碎片" },
  { key:"starfire-camp-decor", icon:"♨", name:"星火营地装饰", note:"连续启程 30 天获得的限定装饰" },
];

type AchievementCategory = "任务" | "专注" | "同行" | "世界" | "成长" | "收藏";
type AchievementRarity = "bronze" | "silver" | "epic" | "legendary";
type Achievement = {
  icon: string;
  name: string;
  story: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  current: number;
  target: number;
  unit: string;
};

const achievementRarity: Record<AchievementRarity, { label: string; stars: string }> = {
  bronze: { label: "青铜", stars: "✦" },
  silver: { label: "白银", stars: "✦✦" },
  epic: { label: "史诗", stars: "✦✦✦" },
  legendary: { label: "传说", stars: "✦✦✦✦" },
};

function activityStreak(activity: QuestActivityDay[]) {
  const active = new Set(activity.filter((day) => day.count > 0).map((day) => day.date));
  let cursor = new Date();
  if (!active.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (active.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function Bag({ data, act }: { data: GameData; act: (p: Record<string, unknown>, s: string) => Promise<boolean> }) {
  const [achievementFilter, setAchievementFilter] = useState<"全部" | AchievementCategory>("全部");
  const owned = new Map(data.inventory.map(i => [i.item_key, i.quantity]));
  const currentLevel = levelFromXp(data.user.xp);
  const honorLevels = Array.from({ length: Math.floor(currentLevel / 100) }, (_, index) => (index + 1) * 100).reverse();
  const bestQuestDay = Math.max(0, ...data.questActivity.map((day) => day.count));
  const activeDays = data.habit.activeDays;
  const streak = data.habit.currentStreak;
  const unlockedRealms = Math.max(1, data.realmProgress.filter((realm) => realm.unlocked).length);
  const completedRegions = data.realmProgress.reduce((total, realm) => total + realm.completedRegions, 0);
  const teamMembers = data.team?.member_count ?? 0;
  const achievements: Achievement[] = [
    { icon:"✦", name:"初见之章", story:"第一份完成，让沉睡的星图亮起。", category:"任务", rarity:"bronze", current:data.questCompletionTotal, target:1, unit:"项任务" },
    { icon:"⚔", name:"委托猎手", story:"在营地告示板留下十次可靠回应。", category:"任务", rarity:"bronze", current:data.questCompletionTotal, target:10, unit:"项任务" },
    { icon:"♜", name:"百战手册", story:"五十次行动被写进旅行者手册。", category:"任务", rarity:"silver", current:data.questCompletionTotal, target:50, unit:"项任务" },
    { icon:"⌘", name:"星图编年史", story:"百次完成汇聚成一部属于你的史诗。", category:"任务", rarity:"epic", current:data.questCompletionTotal, target:100, unit:"项任务" },
    { icon:"✧", name:"三星同耀", story:"一天点亮三颗任务星，营火格外明亮。", category:"任务", rarity:"silver", current:bestQuestDay, target:3, unit:"项/单日" },
    { icon:"☄", name:"七曜不断", story:"连续七天留下足迹，让航线不再中断。", category:"任务", rarity:"epic", current:streak, target:7, unit:"天连续" },
    { icon:"▦", name:"足迹收藏家", story:"认真生活的日期，已经铺满一段星路。", category:"任务", rarity:"silver", current:activeDays, target:30, unit:"个活跃日" },
    { icon:"◷", name:"静心之证", story:"在六十分钟的安静里听见内心。", category:"专注", rarity:"bronze", current:data.user.focusMinutes, target:60, unit:"分钟" },
    { icon:"⌛", name:"深潜者", story:"穿过五小时无声海域，带回专注宝藏。", category:"专注", rarity:"silver", current:data.user.focusMinutes, target:300, unit:"分钟" },
    { icon:"◇", name:"时间铸匠", story:"把一千分钟锻造成真正可见的实力。", category:"专注", rarity:"epic", current:data.user.focusMinutes, target:1000, unit:"分钟" },
    { icon:"♢", name:"万籁宗师", story:"三千分钟心无旁骛，世界为你暂时安静。", category:"专注", rarity:"legendary", current:data.user.focusMinutes, target:3000, unit:"分钟" },
    { icon:"♙", name:"同行契约", story:"不再独行，与伙伴共享第一簇营火。", category:"同行", rarity:"bronze", current:data.team ? 1 : 0, target:1, unit:"个小组" },
    { icon:"♟", name:"五曜结阵", story:"五位旅行者集结，组成完整远征小队。", category:"同行", rarity:"epic", current:teamMembers, target:5, unit:"位成员" },
    { icon:"☼", name:"引路星辉", story:"为一位新旅行者指出营地的方向。", category:"同行", rarity:"bronze", current:data.user.referralCount, target:1, unit:"位好友" },
    { icon:"♧", name:"灯塔守望者", story:"三位同行者循着你的灯塔抵达。", category:"同行", rarity:"silver", current:data.user.referralCount, target:3, unit:"位好友" },
    { icon:"♛", name:"星门领航员", story:"十位旅行者因你相遇，星门为此长明。", category:"同行", rarity:"legendary", current:data.user.referralCount, target:10, unit:"位好友" },
    { icon:"☀", name:"曦华初醒", story:"踏上初始大陆，晨光正式照进旅程。", category:"世界", rarity:"bronze", current:unlockedRealms, target:1, unit:"座大陆" },
    { icon:"≈", name:"跨海旅人", story:"越过第一片海，见到另一种大陆色彩。", category:"世界", rarity:"silver", current:unlockedRealms, target:2, unit:"座大陆" },
    { icon:"◎", name:"四境巡礼", story:"四方风土已经在你的地图上留下纹章。", category:"世界", rarity:"epic", current:unlockedRealms, target:4, unit:"座大陆" },
    { icon:"✺", name:"七洲星冠", story:"七座大陆共同承认你的世界旅行者之名。", category:"世界", rarity:"legendary", current:unlockedRealms, target:7, unit:"座大陆" },
    { icon:"⚑", name:"秘境征服者", story:"通过三处大陆试炼，获得守门者认可。", category:"世界", rarity:"silver", current:completedRegions, target:3, unit:"处试炼" },
    { icon:"❂", name:"世界之心", story:"完成二十一处大陆试炼，触碰世界核心。", category:"世界", rarity:"legendary", current:completedRegions, target:21, unit:"处试炼" },
    { icon:"Ⅰ", name:"十阶新星", story:"抵达十级，第一次被群星记住名字。", category:"成长", rarity:"bronze", current:currentLevel, target:10, unit:"级" },
    { icon:"Ⅴ", name:"半百远征", story:"五十级不是中点，而是一段强大证明。", category:"成长", rarity:"epic", current:currentLevel, target:50, unit:"级" },
    { icon:"Ⅹ", name:"百级传说", story:"跨越百级门槛，获得专属远征奖状。", category:"成长", rarity:"legendary", current:currentLevel, target:100, unit:"级" },
    { icon:"▣", name:"星历相连", story:"让现实日程穿过星门，成为每日委托。", category:"收藏", rarity:"silver", current:data.calendarConnection.connected ? 1 : 0, target:1, unit:"个日历" },
    { icon:"◈", name:"心愿收藏家", story:"把四种奖励装进行囊，认真犒赏自己。", category:"收藏", rarity:"epic", current:data.inventory.length, target:4, unit:"种奖励" },
  ];
  const enrichedAchievements = achievements.map((achievement) => ({
    ...achievement,
    unlocked: achievement.current >= achievement.target,
    progress: Math.min(100, Math.round((achievement.current / achievement.target) * 100)),
  }));
  const unlockedAchievements = enrichedAchievements.filter((achievement) => achievement.unlocked);
  const visibleAchievements = achievementFilter === "全部" ? enrichedAchievements : enrichedAchievements.filter((achievement) => achievement.category === achievementFilter);
  const nextAchievement = enrichedAchievements.filter((achievement) => !achievement.unlocked).sort((left, right) => right.progress - left.progress || left.target - right.target)[0];
  const categories: Array<"全部" | AchievementCategory> = ["全部", "任务", "专注", "同行", "世界", "成长", "收藏"];
  return <section className="bag-panel"><div className="bag-hero"><div><span className="chapter">旅行者行囊</span><h2>收藏每一段认真生活</h2><p>任务获得的星辉，可以兑换你为自己设定的现实奖励。</p></div><div className="bag-balance"><span>当前星辉</span><strong>✦ {data.user.coins}</strong><small>完成任务与邀请好友均可获得</small></div></div><div className="bag-grid"><section className="glass-card reward-shop"><div className="card-heading"><div><small>心愿商店</small><h3>现实奖励</h3></div><span>每一次兑换，都是对努力的回应</span></div><div className="reward-grid">{catalog.map(item => <article key={item.key} className={`reward-item ${item.tone}`}><div className="reward-icon">{item.icon}</div><div><h4>{item.name}</h4><p>{item.note}</p><span>✦ {item.price}</span></div><button disabled={data.user.coins<item.price} onClick={() => void act({action:"buyItem",itemKey:item.key},`已兑换「${item.name}」`)}>{owned.get(item.key) ? `再兑换 · 已有 ${owned.get(item.key)}` : "兑换"}</button></article>)}</div></section><aside className="glass-card inventory-card"><div className="card-heading"><div><small>我的收藏</small><h3>行囊物品</h3></div><span>◇</span></div>{data.inventory.length ? <div className="owned-list">{data.inventory.map(i => { const item=[...catalog,...habitRewardCatalog].find(x=>x.key===i.item_key); return <article key={i.item_key}><span>{item?.icon ?? "✦"}</span><div><b>{item?.name ?? i.item_key}</b><small>{item?.note ?? "云端旅程收藏"}</small></div><em>× {i.quantity}</em></article>})}</div> : <div className="empty-bag"><span>◇</span><p>行囊还是空的<br/>去心愿商店兑换第一份奖励吧。</p></div>}</aside><section className="glass-card achievement-card"><div className="card-heading"><div><small>星旅成就 · 自动记录</small><h3>冒险勋章册</h3></div><b>{unlockedAchievements.length}/{enrichedAchievements.length} 已解锁</b></div><div className="achievement-overview"><div><span>✦</span><strong>{unlockedAchievements.length}</strong><small>已获得勋章</small></div><div><span>♛</span><strong>{unlockedAchievements.filter((achievement) => achievement.rarity === "legendary").length}</strong><small>传说勋章</small></div>{nextAchievement ? <div className="next-achievement"><span>{nextAchievement.icon}</span><div><small>下一枚最接近</small><b>{nextAchievement.name}</b><em>{nextAchievement.current}/{nextAchievement.target} {nextAchievement.unit}</em></div><i><u style={{ width: `${nextAchievement.progress}%` }} /></i></div> : <div className="next-achievement complete"><span>✺</span><div><small>群星全数点亮</small><b>勋章大师</b><em>全部冒险勋章已获得</em></div></div>}</div><div className="achievement-filters" aria-label="勋章分类">{categories.map((category) => <button key={category} className={achievementFilter === category ? "active" : ""} onClick={() => setAchievementFilter(category)}>{category}<small>{category === "全部" ? enrichedAchievements.length : enrichedAchievements.filter((achievement) => achievement.category === category).length}</small></button>)}</div><div className="achievement-grid enriched">{visibleAchievements.map((achievement) => { const rarity = achievementRarity[achievement.rarity]; return <article key={achievement.name} className={`${achievement.unlocked ? "unlocked" : "locked"} rarity-${achievement.rarity}`}><div className="achievement-medal"><span>{achievement.icon}</span><i>{rarity.stars}</i></div><div className="achievement-copy"><div><em>{achievement.category}</em><small>{rarity.label}</small></div><b>{achievement.name}</b><p>{achievement.story}</p><div className="achievement-progress"><span><i style={{ width: `${achievement.progress}%` }} /></span><small>{achievement.unlocked ? "已获得" : `${achievement.current}/${achievement.target} ${achievement.unit}`}</small></div></div></article>})}</div><div className="honor-certificate-archive"><div className="honor-archive-heading"><div><small>百级远征荣誉</small><h3>专属荣誉奖状</h3></div><span>每 100 级解锁一张 · 包含分享码</span></div>{honorLevels.length ? <div className="honor-certificate-list">{honorLevels.map((honorLevel) => <article key={honorLevel}><span>♜</span><div><small>星旅营地 · 百级荣誉</small><b>Lv.{honorLevel} 远征奖状</b><em>分享码 {data.user.inviteCode}</em></div><button onClick={() => downloadHonorCertificate(honorLevel, data.user.name, data.user.inviteCode)}>下载 PNG</button></article>)}</div> : <div className="honor-certificate-locked"><span>⌾</span><div><b>首张荣誉奖状将在 Lv.100 解锁</b><small>当前 Lv.{currentLevel} · 继续完成任务与专注远征</small></div></div>}</div></section></div></section>;
}

function TeamHall({ data, teamName, setTeamName, teamInput, setTeamInput, act, copy }: { data: GameData; teamName: string; setTeamName: (v: string) => void; teamInput: string; setTeamInput: (v: string) => void; act: (p: Record<string, unknown>, s: string) => Promise<boolean>; copy: (v: string, s: string) => Promise<void> }) {
  const [showEmailInvite, setShowEmailInvite] = useState(false);
  const [memberEmail, setMemberEmail] = useState("");
  const [friendEmail, setFriendEmail] = useState("");
  const isOwner = data.team?.owner_email === data.user.email;
  const pendingCount = data.team?.pendingInvitations.length ?? 0;
  const availablePlaces = Math.max(0, 5 - (data.team?.member_count ?? 0) - pendingCount);

  async function sendEmailInvitation() {
    const sent = await act({ action: "sendTeamInvitation", email: memberEmail }, "小组邀请已发送，对方登录后即可确认");
    if (sent) {
      setMemberEmail("");
      setShowEmailInvite(false);
    }
  }

  function referralShareUrl() {
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set("invite", data.user.inviteCode);
    return url.toString();
  }

  function sendReferralEmail() {
    const recipient = friendEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) return;
    const subject = "来自星旅营地的同行邀请";
    const body = [
      `${data.user.name} 邀请你加入「星旅营地」人生冒险。`,
      "",
      "通过下面的专属链接注册或登录，确认邀请后你们双方都会获得 EXP 与星辉奖励：",
      referralShareUrl(),
      "",
      `备用邀请码：${data.user.inviteCode}`,
    ].join("\n");
    window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  async function sendRegisteredFriendInvitation() {
    const sent = await act({ action: "sendFriendInvitation", email: friendEmail }, "站内好友邀请已送达对方星邮");
    if (sent) setFriendEmail("");
  }

  async function acceptTeamInvitation(invitation: TeamInvitation) {
    if (data.team && data.team.id !== invitation.teamId && !window.confirm(`接受后，你将离开「${data.team.name}」并转换加入「${invitation.teamName}」。是否继续？`)) return;
    await act(
      { action: "acceptTeamInvitation", invitationId: invitation.id },
      data.team ? `已转换加入「${invitation.teamName}」` : `已加入「${invitation.teamName}」`,
    );
  }

  async function requestTeamChange() {
    if (!teamInput.trim()) return;
    if (data.team && !window.confirm(`申请通过后，你将离开「${data.team.name}」并转换到新小组。是否提交？`)) return;
    await act(
      { action: "requestJoinTeam", code: teamInput },
      data.team ? "转换申请已发送给目标小组全体成员" : "入组申请已发送给全体成员",
    );
  }

  return <section className="social-panel">
    <div className="invite-card glass-card"><div><small>好友邀请</small><h2>分享一束星光</h2><p>好友首次使用你的邀请码，你获得 <b>200 EXP + 120 星辉</b>，好友获得 <b>100 EXP + 80 星辉</b>。</p></div>{data.pendingFriendInvitations.length > 0 && <div className="friend-invitation-inbox"><div><small>收到好友邀请</small><b>注册邮箱让同行相遇更直接</b></div>{data.pendingFriendInvitations.map((invitation) => <article key={invitation.id}><span>{avatarGlyph({ name: invitation.inviterName, avatarKey: invitation.avatarKey, customAvatar: invitation.customAvatar })}</span><div><b>{invitation.inviterName}</b><small>邀请你绑定同行关系</small></div><button className="decline" onClick={() => void act({ action: "declineFriendInvitation", invitationId: invitation.id }, "已婉拒好友邀请")}>拒绝</button><button onClick={() => void act({ action: "acceptFriendInvitation", invitationId: invitation.id }, "同行关系已绑定，双方奖励到账")}>接受</button></article>)}</div>}<div className="code-box"><span>我的邀请码</span><strong>{data.user.inviteCode}</strong><div className="code-actions"><button onClick={() => void copy(data.user.inviteCode, "邀请码已复制")}>复制邀请码</button><button onClick={() => void copy(referralShareUrl(), "专属邀请链接已复制")}>复制邀请链接</button></div></div><div className="referral-email-share"><div><small>注册邮箱邀请</small><b>已注册用户会直接收到站内星邮</b></div><input type="email" value={friendEmail} onChange={(event) => setFriendEmail(event.target.value)} placeholder="好友注册邮箱 friend@example.com"/><div className="referral-email-actions"><button disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(friendEmail.trim())} onClick={() => void sendRegisteredFriendInvitation()}>发送站内邀请</button><button disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(friendEmail.trim())} onClick={sendReferralEmail}>发送外部邮件</button></div><p>已注册用户优先使用站内邀请；尚未注册时可发送带专属链接的外部邮件。</p></div><div className="invite-count">已成功邀请 <b>{data.user.referralCount}</b> 位旅行者</div></div>
    <div className="team-card glass-card">
      {data.myTeamJoinRequests.length > 0 && <div className="team-invitation-inbox my-join-requests"><div className="team-inbox-heading"><span>⌛</span><div><small>{data.team ? "我的转换申请" : "我的入组申请"}</small><b>正在等待目标小组成员共同表决</b></div></div>{data.myTeamJoinRequests.map((request) => <article key={request.id}><div><small>{data.team ? `从「${data.team.name}」申请转换` : "申请加入"}</small><b>{request.teamName}</b><span>{request.approvals}/{request.requiredApprovals} 位成员已同意</span></div><strong>表决中</strong></article>)}</div>}
      {data.pendingTeamInvitations.length > 0 && <div className="team-invitation-inbox team-switch-invitations"><div className="team-inbox-heading"><span>✉</span><div><small>{data.team ? "转换小组邀请" : "同行邀请"}</small><b>{data.team ? "接受后会自动离开当前小组" : "有小组正在等待你的回应"}</b></div></div>{data.pendingTeamInvitations.map((invitation) => <article key={invitation.id}><div><small>{invitation.inviterName} 邀请你{data.team ? "转换到" : "加入"}</small><b>{invitation.teamName}</b><span>{invitation.memberCount}/5 位成员</span></div><div><button className="decline" onClick={() => void act({ action: "declineTeamInvitation", invitationId: invitation.id }, "已婉拒小组邀请")}>拒绝</button><button onClick={() => void acceptTeamInvitation(invitation)}>{data.team ? "同意并转换" : "接受邀请"}</button></div></article>)}</div>}
      {data.team ? <>
      <div className="team-head"><div className="team-crest">♙</div><div><small>我的五人小组</small><h2>{data.team.name}</h2><p>{data.team.member_count}/5 位成员 · {pendingCount} 个邀请待确认 · 小组口令 {data.team.code}</p></div><div className="team-head-actions">{isOwner && data.team.member_count + pendingCount < 5 && <button className="email-invite-toggle" onClick={() => setShowEmailInvite((open) => !open)}>＋ 邀请成员</button>}<button onClick={() => void copy(data.team!.code, "小组口令已复制")}>复制口令</button></div></div>
      {showEmailInvite && isOwner && <div className="team-email-invite"><div><small>通过注册邮箱邀请</small><b>邀请一位旅行者加入 {data.team.name}</b><p>对方登录星旅营地后会看到站内邀请，可选择接受或拒绝。</p></div><label><span>成员邮箱</span><input type="email" value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} placeholder="friend@example.com" autoFocus /></label><button disabled={!memberEmail.trim()} onClick={() => void sendEmailInvitation()}>发送邀请</button></div>}
      {data.team.pendingJoinRequests.length > 0 && <div className="team-invitation-inbox join-request-inbox"><div className="team-inbox-heading"><span>⌘</span><div><small>全员入组表决</small><b>所有现有成员同意后才能加入</b></div></div>{data.team.pendingJoinRequests.map((request) => <article key={request.id}><div className="join-applicant"><span className="member-avatar">{avatarGlyph({ name: request.applicantName, avatarKey: request.avatarKey, customAvatar: request.customAvatar })}</span><div><small>{request.applicantEmail}</small><b>{request.applicantName}</b><span>{request.approvals}/{request.requiredApprovals} 位成员已同意{request.myVote === "approve" ? " · 你已同意" : ""}</span></div></div><div><button className="decline" onClick={() => void act({ action: "voteTeamJoinRequest", requestId: request.id, decision: "reject" }, "已拒绝该入组申请")}>拒绝</button><button disabled={request.myVote === "approve"} onClick={() => void act({ action: "voteTeamJoinRequest", requestId: request.id, decision: "approve" }, "你的同意已记录")}>{request.myVote === "approve" ? "已同意" : "同意加入"}</button></div></article>)}</div>}
      <div className="member-list">{data.team.members.map((m, i) => <article key={m.email}><span className="member-rank">{i + 1}</span><div className="member-avatar">{avatarGlyph(m)}</div><div><b>{m.display_name}</b><small>{m.focus_minutes} 分钟专注</small></div><strong>{m.strength.toLocaleString()} <small>实力</small></strong></article>)}
        {data.team.pendingInvitations.map((invitation) => <article className="pending-member" key={`pending-${invitation.id}`}><span className="member-rank">⌛</span><div className="member-avatar">✉</div><div><b>{invitation.inviteeEmail}</b><small>等待对方确认邀请</small></div><strong>待加入</strong></article>)}
        {Array.from({ length: availablePlaces }).map((_, i) => isOwner ? <button className="empty-member" key={i} onClick={() => setShowEmailInvite(true)}><span>＋</span><p>输入邮箱邀请成员</p></button> : <article className="empty-member" key={i}><span>＋</span><p>等待新的同行者</p></article>)}
      </div>
      <div className="team-switch-card"><div><small>转换小组</small><b>申请前往新的同行营地</b><p>输入目标小组口令；目标小组全体成员同意后，系统会自动完成转换。</p></div><input value={teamInput} onChange={(event) => setTeamInput(event.target.value)} placeholder="输入目标小组口令"/><button disabled={data.myTeamJoinRequests.length > 0 || !teamInput.trim()} onClick={() => void requestTeamChange()}>{data.myTeamJoinRequests.length ? "等待目标小组表决" : "申请转换小组"}</button></div>
    </> : <>
      <div className="section-intro"><small>同行者大厅</small><h2>创建或申请加入小组</h2><p>每位旅行者只能加入一个小组，每组最多 5 人；主动申请需要现有成员全部同意。</p></div><div className="team-choices"><div><h3>建立新的营地</h3><input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="输入小组名称" maxLength={16}/><button onClick={() => void act({ action: "createTeam", name: teamName }, "小组创建成功")}>创建小组</button></div><div><h3>申请加入好友小组</h3><input value={teamInput} onChange={(e) => setTeamInput(e.target.value)} placeholder="输入小组口令"/><button disabled={data.myTeamJoinRequests.length > 0} onClick={() => void act({ action: "requestJoinTeam", code: teamInput }, "入组申请已发送给全体成员")}>{data.myTeamJoinRequests.length ? "等待成员表决" : "申请加入"}</button></div></div>
    </>}</div>
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
