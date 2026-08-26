import { env } from "cloudflare:workers";
import { assertSameOrigin, getAppUser } from "../../app-auth";
import { claimLevel100CalendarReward, getCalendarAccess } from "../../calendar-access";
import { GoogleCalendarReconnectRequired, syncGoogleCalendar } from "../../google-calendar";
import { getPremiumProgram, updatePremiumFreeSlots } from "../../premium-access";

type UserRow = {
  email: string;
  display_name: string;
  invite_code: string;
  invited_by: string | null;
  xp: number;
  coins: number;
  focus_minutes: number;
  avatar_key: string;
  custom_avatar: string | null;
};

type CalendarEvent = {
  uid: string;
  title: string;
  description: string;
  location: string;
  dueAt: string;
};

const starterQuests = [
  ["完成晨间仪式", "喝水 · 拉伸 · 写下今日目标", "日常", 30],
  ["推进「理想工作」主线", "完成作品集首页的内容整理", "主线", 80],
  ["知识秘境：深度阅读", "专注阅读 30 分钟并记录三点收获", "支线", 45],
  ["风之小径", "户外散步 20 分钟", "日常", 25],
] as const;

const dailySystemQuestPools = [
  {
    difficulty: "easy",
    type: "日常",
    reward: 25,
    quests: [
      ["整理今日航向", "用 5 分钟写下今天最重要的一件事，并明确完成标准。"],
      ["补给营地", "整理桌面或数字文件 10 分钟，让下一步行动更轻松。"],
      ["晨星签到", "记录今天的精力状态，并写下一句行动承诺。"],
      ["微光散步", "离开屏幕活动 10 分钟，回来后补充一杯水。"],
      ["清理消息岛", "处理、归档或删除至少 10 条无效消息，让注意力重新清爽。"],
      ["一页计划", "把今天的安排压缩成一页，只保留三件真正重要的事情。"],
      ["水晶补给", "完成一次补水，并为接下来两小时准备好饮用水。"],
      ["呼吸锚点", "进行 3 分钟缓慢呼吸，记录此刻最明显的身体感受。"],
      ["收纳一角", "选择一个小区域整理 10 分钟，让常用物品回到固定位置。"],
      ["感恩星笺", "写下今天值得感谢的三件小事，并说明其中一件为什么重要。"],
      ["数字减负", "关闭三个不必要的通知或标签页，减少今天的数字干扰。"],
      ["明日装备", "提前准备明天最先要用的资料、衣物或工具。"],
      ["财务微记", "记录今天的一笔支出或收入，并为它补充清晰分类。"],
      ["晨光伸展", "完成 8 分钟全身伸展，重点放松肩颈与腰背。"],
      ["灵感捕捉", "记录三个突然出现的想法，并挑选一个作为未来行动种子。"],
      ["早睡约定", "确定今晚停止使用屏幕的时间，并设置一个提前提醒。"],
    ],
  },
  {
    difficulty: "medium",
    type: "支线",
    reward: 45,
    quests: [
      ["专注秘境", "完成一次不少于 25 分钟的无干扰专注，并记录阶段成果。"],
      ["推进关键委托", "为当前最重要的目标投入 30 分钟，留下可查看的成果。"],
      ["知识补给", "学习一个主题 30 分钟，整理至少 3 条可复用笔记。"],
      ["关系回响", "主动完成一次真诚沟通，并记录达成的共识。"],
      ["身体历练", "完成一次 30 分钟运动，记录项目、时长与运动后的感受。"],
      ["输出一页", "围绕当前主题完成一页可阅读的文字、图表或设计草稿。"],
      ["难题拆解", "把一个复杂问题拆成至少五步，并立即完成第一步。"],
      ["家庭支援", "主动完成一项能减轻家人负担的事务，并确认实际结果。"],
      ["财务整理", "检查最近七天的消费，找出一项可以优化的支出。"],
      ["创作冲刺", "连续创作 35 分钟，中途不修改，结束后再统一整理。"],
      ["环境升级", "改善一个影响效率的环境问题，并记录调整前后的变化。"],
      ["社交补给", "联系一位许久未交流的人，完成一次有内容的问候。"],
      ["复盘航线", "回顾最近三项行动，分别写下继续、停止和改进的决定。"],
      ["技能练习", "针对一项核心技能完成 30 分钟刻意练习并留下结果。"],
      ["阅读航标", "阅读一个完整章节或长文，提炼观点、证据与一个疑问。"],
      ["延迟满足", "推迟一次非必要消费或娱乐 30 分钟，先完成当前重要事项。"],
    ],
  },
  {
    difficulty: "hard",
    type: "主线",
    reward: 80,
    quests: [
      ["深度远征", "完成一次 60 分钟深度工作，关闭通知并交付明确成果。"],
      ["攻克拖延巨兽", "完成一件拖延超过 3 天的重要事项，并记录解决方法。"],
      ["勇者交付", "提交一个可被他人查看或使用的完整成果，并收集一次反馈。"],
      ["世界航线复盘", "系统复盘本周目标，删除无效事项并制定下一阶段计划。"],
      ["长征交付", "连续投入 90 分钟，完成一个可以正式交付的阶段成果。"],
      ["系统整理", "重构一个长期混乱的工作流程，并留下可重复执行的清单。"],
      ["关系深谈", "完成一次不少于 45 分钟的重要对话，澄清分歧与下一步。"],
      ["健康突破", "完成一项有明确强度的健康挑战，并记录数据与恢复计划。"],
      ["财务决策", "完成一次完整的预算或大额支出评估，写下依据与边界。"],
      ["创作成章", "完成一个完整章节、作品单元或可公开展示的创作成果。"],
      ["学习实战", "把新学知识应用到真实问题，产出结果并记录验证过程。"],
      ["积压清零", "集中处理一组长期积压事项，至少关闭其中五项。"],
      ["公开表达", "完成一次公开分享、演示或发布，并收集至少一条反馈。"],
      ["团队协作", "组织一次明确分工的协作，推动团队交付共同成果。"],
      ["长期规划", "制定未来 30 天目标，写明衡量标准、关键节点与风险预案。"],
      ["数字断舍离", "深度整理一个数字空间，归档资料并建立可持续命名规则。"],
    ],
  },
] as const;

const DAILY_QUEST_REPEAT_WINDOW = 14;

type SceneTemplateQuest = readonly [title: string, detail: string, type: "主线" | "支线" | "日常", reward: number];

const sceneTemplates: Record<string, { name: string; quests: readonly SceneTemplateQuest[] }> = {
  exam: {
    name: "备考远征",
    quests: [
      ["完成备考诊断", "列出考试范围、当前掌握度与三个最薄弱章节，形成一页诊断。", "主线", 80],
      ["搭建复习航线", "按剩余时间拆分章节，排出学习、练习与复盘节点。", "支线", 45],
      ["攻克薄弱章节", "完成一个薄弱章节的学习，并整理至少 5 条关键笔记。", "主线", 80],
      ["完成一组限时练习", "模拟真实时限完成练习，记录正确率与超时题。", "日常", 30],
      ["建立错题星图", "归类错题原因，并为每类错误写下一条纠正策略。", "支线", 45],
      ["进行一次全真模拟", "按考试流程完成模拟，复盘分数、节奏与下一轮重点。", "主线", 80],
    ],
  },
  thesis: {
    name: "论文远征",
    quests: [
      ["明确论文核心问题", "用一句话写清研究问题、价值与预期结论边界。", "主线", 80],
      ["建立文献地图", "收集并分类核心文献，标记观点、方法与可引用证据。", "支线", 45],
      ["冻结论文结构", "完成章节大纲，为每节写下论点、证据和篇幅目标。", "主线", 80],
      ["完成首段深度写作", "连续写作一个完整小节，先完成内容再统一润色。", "日常", 30],
      ["补齐证据与引用", "检查关键论点，为缺失处补充数据、文献或访谈证据。", "支线", 45],
      ["完成一轮整体修订", "检查逻辑、格式和引用一致性，输出可提交版本。", "主线", 80],
    ],
  },
  job: {
    name: "求职远征",
    quests: [
      ["确定目标岗位", "筛选 3 类目标岗位，整理能力要求、地点与优先级。", "主线", 80],
      ["重写一页简历", "围绕目标岗位量化成果，删除无关经历并完成一版简历。", "主线", 80],
      ["整理作品与案例", "选出 3 个代表案例，补齐背景、行动、结果与证明材料。", "支线", 45],
      ["建立投递清单", "收集至少 8 个合适岗位，记录截止日期与跟进状态。", "日常", 30],
      ["完成一次模拟面试", "练习自我介绍与 5 个高频问题，记录需要改进的表达。", "支线", 45],
      ["完成高质量投递", "针对岗位调整材料并正式投递，设置后续跟进日期。", "主线", 80],
    ],
  },
  fitness: {
    name: "健身远征",
    quests: [
      ["记录身体起点", "记录体重或围度、当前体能与一个可持续目标。", "主线", 80],
      ["完成全身力量训练", "训练 30～45 分钟，记录动作、组数和主观强度。", "支线", 45],
      ["完成低强度有氧", "快走、骑行或游泳 30 分钟，保持可以对话的强度。", "日常", 30],
      ["准备恢复补给", "规划一日蛋白质、饮水与蔬果，提前准备一份健康餐。", "日常", 30],
      ["完成渐进训练", "在安全前提下增加一次重量、次数或训练时长。", "支线", 45],
      ["完成一周体能复盘", "复盘训练、睡眠和疲劳，调整下一周的训练负荷。", "主线", 80],
    ],
  },
  freelance: {
    name: "自由职业远征",
    quests: [
      ["定义本周可交付成果", "选定一个最重要的客户或产品成果，写明验收标准。", "主线", 80],
      ["划定深度工作时段", "在日历中锁定至少 3 段无会议专注时间。", "日常", 30],
      ["整理客户与线索", "更新客户、报价、合同与回款状态，标记下一步行动。", "支线", 45],
      ["完成核心交付", "完成并发送一个可供客户检查的阶段成果。", "主线", 80],
      ["发布专业内容", "分享一个案例、洞见或作品，让潜在客户看见你的能力。", "支线", 45],
      ["完成经营复盘", "复盘收入、工时与获客效果，决定下周保留和停止的事项。", "主线", 80],
    ],
  },
  sleep: {
    name: "早睡远征",
    quests: [
      ["设定固定熄灯时间", "选择现实可行的上床与起床时间，并设置睡前提醒。", "主线", 80],
      ["建立睡前关机仪式", "睡前 30 分钟停止工作与短视频，改为洗漱、拉伸或阅读。", "日常", 30],
      ["清理睡眠环境", "降低光线与噪音，让卧室保持凉爽并把手机移出伸手范围。", "支线", 45],
      ["记录睡眠航海日志", "记录上床、入睡、起床时间以及醒来后的精力。", "日常", 30],
      ["调整白天能量节律", "白天晒太阳并活动 20 分钟，下午后减少咖啡因。", "支线", 45],
      ["完成一周睡眠复盘", "比较计划与实际入睡时间，找出最常见阻碍并调整。", "主线", 80],
    ],
  },
};

const scenePaces = {
  gentle: { indexes: [0, 1, 3, 5], offsets: [0, 2, 4, 6], focusMinutes: 25 },
  standard: { indexes: [0, 1, 2, 3, 4, 5], offsets: [0, 2, 4, 7, 10, 13], focusMinutes: 45 },
  sprint: { indexes: [0, 1, 2, 3, 4, 5], offsets: [0, 1, 2, 3, 5, 6], focusMinutes: 60 },
} as const;

const sevenDayChallengeTasks: readonly SceneTemplateQuest[] = [
  ["Day 1 · 点亮第一颗主星", "写下本周最重要的一个目标，把它拆成三个可以开始的步骤。", "主线", 50],
  ["Day 2 · 完成首次专注", "选择一个任务，完成至少 25 分钟无干扰专注，并留下阶段成果。", "支线", 45],
  ["Day 3 · 清理一个阻碍", "完成一件已经拖延的小事，记录让自己顺利开始的方法。", "支线", 45],
  ["Day 4 · 读懂今日能量", "记录当前精力，并选择与状态匹配的一项任务完成。", "日常", 35],
  ["Day 5 · 寻找同行星光", "邀请一位好友，或浏览小组大厅并选择一个想同行的小组。", "支线", 50],
  ["Day 6 · 留下一项成果", "完成一项可以查看、提交或分享的成果，为本周留下证据。", "主线", 80],
  ["Day 7 · 完成篝火复盘", "打开每周航海报告，写下保留、减少和优先的各一件事。", "主线", 60],
] as const;

async function sevenDayChallengeState(email: string, clientDate: string) {
  const rows = await env.DB.prepare(`
    SELECT id, title, detail, reward, due_at AS dueDate, completed AS done
    FROM quests
    WHERE user_email = ? AND source = 'seven-day-challenge'
    ORDER BY due_at, id LIMIT 7
  `).bind(email).all<{ id: number; title: string; detail: string; reward: number; dueDate: string; done: number }>();
  const days = rows.results.map((row, index) => ({ ...row, day: index + 1, done: Boolean(row.done) }));
  const currentTask = days.find((day) => !day.done && day.dueDate <= clientDate)
    ?? days.find((day) => !day.done)
    ?? days.at(-1)
    ?? null;
  return {
    active: days.length > 0,
    startDate: days[0]?.dueDate ?? null,
    completedCount: days.filter((day) => day.done).length,
    currentDay: currentTask?.day ?? 1,
    currentTask,
    days,
    totalReward: sevenDayChallengeTasks.reduce((total, task) => total + task[3], 0),
  };
}

function stableQuestOffset(key: string) {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function dailyQuestIndex(email: string, clientDate: string, difficulty: string, poolSize: number) {
  if (poolSize <= DAILY_QUEST_REPEAT_WINDOW) throw new Error("每日系统任务库不足以保证两周内不重复");
  const dayNumber = Math.floor(Date.parse(`${clientDate}T00:00:00Z`) / 86400000);
  const userOffset = stableQuestOffset(`${email}:${difficulty}`) % poolSize;
  return (dayNumber + userOffset) % poolSize;
}

async function ensureDailySystemQuests(email: string, clientDate: string) {
  const existingDay = await env.DB.prepare(`
    SELECT 1 FROM daily_system_quest_days
    WHERE user_email = ? AND quest_date = ?
  `).bind(email, clientDate).first();
  if (existingDay) return;

  const questStatements = dailySystemQuestPools.map((pool) => {
    const template = pool.quests[dailyQuestIndex(email, clientDate, pool.difficulty, pool.quests.length)];
    return env.DB.prepare(`
      INSERT OR IGNORE INTO quests
        (user_email, title, detail, type, reward, source, due_at, external_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      email,
      template[0],
      template[1],
      pool.type,
      pool.reward,
      `system-daily-${pool.difficulty}`,
      clientDate,
      `daily:${clientDate}:${pool.difficulty}`,
    );
  });
  await env.DB.batch([
    ...questStatements,
    env.DB.prepare(`
      INSERT OR IGNORE INTO daily_system_quest_days (user_email, quest_date)
      VALUES (?, ?)
    `).bind(email, clientDate),
  ]);
}

type RealmRule = {
  xpRequired: number;
  taskReward: number;
  completedQuests: number;
  focusMinutes: number;
  referrals: number;
  teamMembers: number;
  previousRealmId: string | null;
};

type JourneyMetrics = {
  xp: number;
  focus_minutes: number;
  completed_quests: number;
  referral_count: number;
  team_members: number;
};

const realmOrder = ["dawn", "crown", "ember", "storm", "verdant", "coral", "polar"] as const;
const realmNames: Record<string, string> = {
  dawn: "曦华大陆",
  crown: "苍冠大陆",
  ember: "赤土大陆",
  storm: "风暴大陆",
  verdant: "森灵大陆",
  coral: "珊海群岛",
  polar: "极星大陆",
};
const realmRules: Record<string, RealmRule> = {
  dawn: { xpRequired: 0, taskReward: 30, completedQuests: 0, focusMinutes: 0, referrals: 0, teamMembers: 0, previousRealmId: null },
  crown: { xpRequired: 600, taskReward: 45, completedQuests: 8, focusMinutes: 120, referrals: 1, teamMembers: 0, previousRealmId: "dawn" },
  ember: { xpRequired: 1500, taskReward: 55, completedQuests: 18, focusMinutes: 300, referrals: 2, teamMembers: 2, previousRealmId: "crown" },
  storm: { xpRequired: 3000, taskReward: 70, completedQuests: 30, focusMinutes: 600, referrals: 3, teamMembers: 3, previousRealmId: "ember" },
  verdant: { xpRequired: 5000, taskReward: 85, completedQuests: 45, focusMinutes: 1000, referrals: 5, teamMembers: 3, previousRealmId: "storm" },
  coral: { xpRequired: 7500, taskReward: 105, completedQuests: 65, focusMinutes: 1500, referrals: 7, teamMembers: 4, previousRealmId: "verdant" },
  polar: { xpRequired: 11000, taskReward: 130, completedQuests: 90, focusMinutes: 2400, referrals: 10, teamMembers: 5, previousRealmId: "coral" },
};

const calendarHosts = [
  "calendar.google.com",
  "outlook.live.com",
  "outlook.office365.com",
  "outlook.office.com",
  "icloud.com",
];

function unescapeIcs(value = "") {
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function parseIcsDate(value = "") {
  const normalized = value.trim();
  const match = normalized.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, utc] = match;
  const allDay = !hour;
  const date = utc
    ? new Date(Date.UTC(+year, +month - 1, +day, +(hour || 0), +(minute || 0), +(second || 0)))
    : new Date(+year, +month - 1, +day, +(hour || 0), +(minute || 0), +(second || 0));
  const dueAt = allDay
    ? `${year}-${month}-${day}`
    : utc
      ? date.toISOString()
      : `${year}-${month}-${day}T${hour}:${minute}:${second || "00"}`;
  return { date, dueAt, allDay };
}

function occurrenceDueAt(date: Date, allDay: boolean, utc: boolean) {
  const pad = (value: number) => String(value).padStart(2, "0");
  if (allDay) return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  if (utc) return date.toISOString();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function parseCalendar(ics: string, rangeDays: number, requestedStartDate?: string) {
  const unfolded = ics.replace(/\r?\n[ \t]/g, "");
  const blocks = unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [];
  const now = new Date();
  const requestedParts = /^\d{4}-\d{2}-\d{2}$/.test(requestedStartDate ?? "")
    ? requestedStartDate!.split("-").map(Number)
    : null;
  const startWindow = requestedParts
    ? new Date(requestedParts[0], requestedParts[1] - 1, requestedParts[2])
    : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endWindow = new Date(startWindow);
  endWindow.setDate(endWindow.getDate() + rangeDays);
  const output: CalendarEvent[] = [];
  const weekday: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

  for (const block of blocks) {
    const properties = new Map<string, string[]>();
    for (const line of block.split(/\r?\n/)) {
      const split = line.indexOf(":");
      if (split < 0) continue;
      const key = line.slice(0, split).split(";")[0].toUpperCase();
      const values = properties.get(key) ?? [];
      values.push(line.slice(split + 1));
      properties.set(key, values);
    }
    if (properties.get("STATUS")?.[0] === "CANCELLED") continue;
    const parsedStart = parseIcsDate(properties.get("DTSTART")?.[0]);
    if (!parsedStart) continue;
    const title = unescapeIcs(properties.get("SUMMARY")?.[0]) || "未命名日程";
    const description = unescapeIcs(properties.get("DESCRIPTION")?.[0]).slice(0, 120);
    const location = unescapeIcs(properties.get("LOCATION")?.[0]).slice(0, 60);
    const uid = unescapeIcs(properties.get("UID")?.[0]) || `${title}-${parsedStart.dueAt}`;
    const recurrence = Object.fromEntries(
      (properties.get("RRULE")?.[0] ?? "")
        .split(";")
        .map((part) => part.split("="))
        .filter((part) => part.length === 2),
    );
    const exclusions = new Set(
      (properties.get("EXDATE") ?? [])
        .flatMap((value) => value.split(","))
        .map((value) => parseIcsDate(value)?.dueAt.slice(0, 10))
        .filter(Boolean),
    );
    const until = parseIcsDate(recurrence.UNTIL)?.date;
    const interval = Math.max(1, Number(recurrence.INTERVAL) || 1);
    const utc = /Z$/.test(properties.get("DTSTART")?.[0] ?? "");

    const addOccurrence = (date: Date) => {
      if (date < startWindow || date >= endWindow || (until && date > until)) return;
      const dueAt = occurrenceDueAt(date, parsedStart.allDay, utc);
      if (exclusions.has(dueAt.slice(0, 10))) return;
      output.push({ uid: `${uid}:${dueAt}`, title, description, location, dueAt });
    };

    if (!recurrence.FREQ) {
      addOccurrence(parsedStart.date);
    } else {
      for (let cursor = new Date(startWindow); cursor < endWindow; cursor.setDate(cursor.getDate() + 1)) {
        const candidate = new Date(
          cursor.getFullYear(),
          cursor.getMonth(),
          cursor.getDate(),
          parsedStart.date.getHours(),
          parsedStart.date.getMinutes(),
          parsedStart.date.getSeconds(),
        );
        if (candidate < parsedStart.date) continue;
        const days = Math.floor((candidate.getTime() - new Date(parsedStart.date.getFullYear(), parsedStart.date.getMonth(), parsedStart.date.getDate()).getTime()) / 86400000);
        const months = (candidate.getFullYear() - parsedStart.date.getFullYear()) * 12 + candidate.getMonth() - parsedStart.date.getMonth();
        const years = candidate.getFullYear() - parsedStart.date.getFullYear();
        const byDays = (recurrence.BYDAY || "").split(",").map((day) => weekday[day.slice(-2)]).filter((day) => day !== undefined);
        const byMonthDays = (recurrence.BYMONTHDAY || "").split(",").map(Number).filter(Boolean);
        const matches =
          recurrence.FREQ === "DAILY" ? days % interval === 0 :
          recurrence.FREQ === "WEEKLY" ? Math.floor(days / 7) % interval === 0 && (byDays.length ? byDays.includes(candidate.getDay()) : candidate.getDay() === parsedStart.date.getDay()) :
          recurrence.FREQ === "MONTHLY" ? months % interval === 0 && (byMonthDays.length ? byMonthDays.includes(candidate.getDate()) : candidate.getDate() === parsedStart.date.getDate()) :
          recurrence.FREQ === "YEARLY" ? years % interval === 0 && candidate.getMonth() === parsedStart.date.getMonth() && candidate.getDate() === parsedStart.date.getDate() :
          false;
        if (matches) addOccurrence(candidate);
      }
    }
    if (output.length >= 40) break;
  }
  return output.sort((a, b) => a.dueAt.localeCompare(b.dueAt)).slice(0, 40);
}

function calendarUrl(input: string) {
  const normalized = input.trim().replace(/^webcal:\/\//i, "https://");
  const url = new URL(normalized);
  if (url.protocol !== "https:") throw new Error("日历链接必须使用 HTTPS 或 webcal");
  const host = url.hostname.toLowerCase();
  if (!calendarHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) {
    throw new Error("此链接暂不支持，请下载 .ics 文件后导入");
  }
  return url;
}

function makeCode(prefix: string, value: string) {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `${prefix}${(hash >>> 0).toString(36).toUpperCase().slice(0, 7)}`;
}

const avatarLevels: Record<string, number> = {
  initial: 1,
  streak30: 1,
  dawn: 100,
  quill: 125,
  ember: 150,
  tide: 200,
  storm: 300,
  verdant: 500,
  polar: 700,
  crown: 1000,
  custom: 100,
};

async function addNotification(userEmail: string, kind: string, title: string, body: string, entityId?: number | null) {
  await env.DB.prepare(`
    INSERT INTO site_notifications (user_email, kind, title, body, entity_id)
    VALUES (?, ?, ?, ?, ?)
  `).bind(userEmail, kind, title.slice(0, 80), body.slice(0, 220), entityId ?? null).run();
}

const HABIT_REST_TICKETS_PER_MONTH = 2;
const habitMilestones = [7, 14, 30] as const;

function shiftDate(date: string, days: number) {
  const moment = new Date(`${date}T12:00:00Z`);
  moment.setUTCDate(moment.getUTCDate() + days);
  return moment.toISOString().slice(0, 10);
}

function longestDateStreak(dates: Set<string>) {
  const ordered = [...dates].sort();
  let longest = 0;
  let run = 0;
  let previous = "";
  for (const date of ordered) {
    run = previous && shiftDate(previous, 1) === date ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = date;
  }
  return longest;
}

async function habitActivityDates(email: string) {
  const rows = await env.DB.prepare(`
    SELECT activity_date AS date FROM (
      SELECT departure_date AS activity_date FROM daily_departures WHERE user_email = ?
      UNION
      SELECT completed_date AS activity_date FROM quest_completions WHERE user_email = ?
      UNION
      SELECT completed_date AS activity_date FROM focus_sessions WHERE user_email = ? AND completed_date IS NOT NULL
      UNION
      SELECT rest_date AS activity_date FROM habit_rest_days WHERE user_email = ?
    ) WHERE activity_date IS NOT NULL ORDER BY activity_date
  `).bind(email, email, email, email).all<{ date: string }>();
  return new Set(rows.results.map((row) => row.date));
}

async function grantHabitRewards(email: string, longestStreak: number) {
  const rewards = {
    7: { item: "habit-supply-box", coins: 100, title: "七日星火补给已抵达", body: "连续启程 7 天：小型补给箱与 100 星辉已收入行囊。" },
    14: { item: "rare-medal-fragment", coins: 180, title: "十四日稀有碎片已获得", body: "连续启程 14 天：稀有勋章碎片与 180 星辉已收入行囊。" },
    30: { item: "starfire-camp-decor", coins: 300, title: "三十日限定荣誉已解锁", body: "连续启程 30 天：星火营地装饰、限定头像与 300 星辉已解锁。" },
  } as const;
  for (const milestone of habitMilestones) {
    if (longestStreak < milestone) continue;
    const inserted = await env.DB.prepare(`
      INSERT OR IGNORE INTO habit_rewards (user_email, milestone) VALUES (?, ?)
    `).bind(email, milestone).run();
    if (!Number(inserted.meta.changes || 0)) continue;
    const reward = rewards[milestone];
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET coins = coins + ? WHERE email = ?").bind(reward.coins, email),
      env.DB.prepare(`
        INSERT INTO inventory (user_email, item_key, quantity) VALUES (?, ?, 1)
        ON CONFLICT(user_email, item_key) DO UPDATE SET quantity = quantity + 1, acquired_at = CURRENT_TIMESTAMP
      `).bind(email, reward.item),
    ]);
    await addNotification(email, `habit_streak_${milestone}`, reward.title, reward.body);
  }
}

async function habitState(email: string, clientDate: string, grantRewards = false) {
  const activeDates = await habitActivityDates(email);
  const yesterday = shiftDate(clientDate, -1);
  let cursor = activeDates.has(clientDate) ? clientDate : activeDates.has(yesterday) ? yesterday : "";
  let currentStreak = 0;
  while (cursor && activeDates.has(cursor)) {
    currentStreak += 1;
    cursor = shiftDate(cursor, -1);
  }
  let longestStreak = longestDateStreak(activeDates);
  if (grantRewards) {
    await grantHabitRewards(email, longestStreak);
    longestStreak = longestDateStreak(activeDates);
  }
  const monthKey = clientDate.slice(0, 7);
  const restUsed = await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM habit_rest_days WHERE user_email = ? AND month_key = ?
  `).bind(email, monthKey).first<{ count: number }>();
  const claimed = await env.DB.prepare(`
    SELECT milestone FROM habit_rewards WHERE user_email = ? ORDER BY milestone
  `).bind(email).all<{ milestone: number }>();
  const restTicketsRemaining = Math.max(0, HABIT_REST_TICKETS_PER_MONTH - Number(restUsed?.count ?? 0));
  return {
    currentStreak,
    longestStreak,
    activeDays: activeDates.size,
    restTicketsRemaining,
    canRepairYesterday: restTicketsRemaining > 0 && activeDates.has(clientDate) && !activeDates.has(yesterday),
    claimedMilestones: claimed.results.map((row) => Number(row.milestone)),
  };
}

async function moveUserToTeam(userEmail: string, targetTeamId: number) {
  const db = env.DB;
  const current = await db.prepare(`
    SELECT tm.team_id AS teamId, t.name AS teamName, t.owner_email AS ownerEmail
    FROM team_members tm JOIN teams t ON t.id = tm.team_id
    WHERE tm.user_email = ?
  `).bind(userEmail).first<{ teamId: number; teamName: string; ownerEmail: string }>();
  if (current?.teamId === targetTeamId) return { previousTeamName: current.teamName, switched: false };

  const statements = [
    db.prepare("DELETE FROM team_join_request_votes WHERE voter_email = ? AND request_id IN (SELECT id FROM team_join_requests WHERE team_id = ? AND status = 'pending')")
      .bind(userEmail, current?.teamId ?? -1),
  ];
  let successorEmail: string | null = null;
  let previousMembers: string[] = [];

  if (current) {
    const remaining = await db.prepare(`
      SELECT user_email AS email FROM team_members
      WHERE team_id = ? AND user_email != ? ORDER BY joined_at, user_email
    `).bind(current.teamId, userEmail).all<{ email: string }>();
    previousMembers = remaining.results.map((member) => member.email);
    if (current.ownerEmail === userEmail) {
      successorEmail = previousMembers[0] ?? null;
      if (successorEmail) {
        statements.push(db.prepare("UPDATE teams SET owner_email = ? WHERE id = ?").bind(successorEmail, current.teamId));
        statements.push(db.prepare("DELETE FROM team_members WHERE team_id = ? AND user_email = ?").bind(current.teamId, userEmail));
      } else {
        statements.push(db.prepare("DELETE FROM teams WHERE id = ?").bind(current.teamId));
      }
    } else {
      statements.push(db.prepare("DELETE FROM team_members WHERE team_id = ? AND user_email = ?").bind(current.teamId, userEmail));
    }
  }
  statements.push(db.prepare("INSERT INTO team_members (team_id, user_email) VALUES (?, ?)").bind(targetTeamId, userEmail));
  await db.batch(statements);

  if (successorEmail) {
    await addNotification(successorEmail, "team_owner_transferred", "你已成为新队长", `原队长转换小组后，系统已将「${current?.teamName ?? "小组"}」的队长身份交给你。`);
  }
  for (const memberEmail of previousMembers) {
    await addNotification(memberEmail, "team_member_switched", "同行者已转换小组", `${userEmail} 已离开「${current?.teamName ?? "原小组"}」并前往新的小组。`);
  }
  return { previousTeamName: current?.teamName ?? null, switched: Boolean(current) };
}

async function currentUser(request: Request) {
  const identity = await getAppUser(request);
  if (!identity) return null;
  const db = env.DB;
  const inviteCode = makeCode("STAR", identity.email.toLowerCase());
  await db.prepare(`
    INSERT INTO users (email, display_name, invite_code, xp)
    VALUES (?, ?, ?, 0)
    ON CONFLICT(email) DO UPDATE SET display_name = excluded.display_name
  `).bind(identity.email, identity.displayName, inviteCode).run();
  await db.prepare(`
    UPDATE users SET xp = 0
    WHERE email = ? AND xp = 680 AND focus_minutes = 0
      AND NOT EXISTS (SELECT 1 FROM quests q WHERE q.user_email = users.email AND q.completed = 1)
      AND NOT EXISTS (SELECT 1 FROM referrals r WHERE r.referrer_email = users.email OR r.invitee_email = users.email)
      AND NOT EXISTS (SELECT 1 FROM team_members tm WHERE tm.user_email = users.email)
  `).bind(identity.email).run();
  await db.prepare(`
    INSERT OR IGNORE INTO realm_progress
      (user_email, realm_id, completed_regions, unlocked, target, unlocked_at)
    VALUES (?, 'dawn', 0, 1, 0, CURRENT_TIMESTAMP)
  `).bind(identity.email).run();

  const count = await db.prepare("SELECT COUNT(*) AS count FROM quests WHERE user_email = ?")
    .bind(identity.email).first<{ count: number }>();
  if (!count?.count) {
    await db.batch(starterQuests.map((quest) =>
      db.prepare("INSERT INTO quests (user_email, title, detail, type, reward) VALUES (?, ?, ?, ?, ?)")
        .bind(identity.email, ...quest),
    ));
  }
  return identity;
}

async function realmGateStatuses(email: string) {
  const metrics = await env.DB.prepare(`
    SELECT u.xp, u.focus_minutes,
      (SELECT COUNT(*) FROM quest_completions qc WHERE qc.user_email = u.email) AS completed_quests,
      (SELECT COUNT(*) FROM referrals r WHERE r.referrer_email = u.email) AS referral_count,
      COALESCE((
        SELECT COUNT(*) FROM team_members group_member
        WHERE group_member.team_id = (
          SELECT own_membership.team_id FROM team_members own_membership
          WHERE own_membership.user_email = u.email LIMIT 1
        )
      ), 0) AS team_members
    FROM users u WHERE u.email = ?
  `).bind(email).first<JourneyMetrics>();
  const progressRows = await env.DB.prepare(`
    SELECT realm_id, completed_regions, unlocked
    FROM realm_progress WHERE user_email = ?
  `).bind(email).all<{ realm_id: string; completed_regions: number; unlocked: number }>();
  const progress = new Map(progressRows.results.map((row) => [row.realm_id, row]));
  const values = metrics ?? { xp: 0, focus_minutes: 0, completed_quests: 0, referral_count: 0, team_members: 0 };

  return realmOrder.map((realmId, sequence) => {
    const rule = realmRules[realmId];
    const previous = rule.previousRealmId ? progress.get(rule.previousRealmId) : null;
    const requirements = rule.previousRealmId ? [
      {
        key: "previousRealm",
        label: `完成${realmNames[rule.previousRealmId]}三项试炼`,
        current: previous?.unlocked ? Math.min(3, previous.completed_regions) : 0,
        required: 3,
        unit: "项",
      },
      { key: "xp", label: "累计冒险经验", current: values.xp, required: rule.xpRequired, unit: " EXP" },
      { key: "quests", label: "完成系统任务", current: values.completed_quests, required: rule.completedQuests, unit: "项" },
      { key: "focus", label: "累计专注修行", current: values.focus_minutes, required: rule.focusMinutes, unit: "分钟" },
      { key: "referrals", label: "成功邀请好友", current: values.referral_count, required: rule.referrals, unit: "人" },
      ...(rule.teamMembers ? [{ key: "team", label: "小组同行人数", current: values.team_members, required: rule.teamMembers, unit: "人" }] : []),
    ].map((requirement) => ({ ...requirement, met: requirement.current >= requirement.required })) : [];
    return {
      realmId,
      sequence,
      unlocked: Boolean(progress.get(realmId)?.unlocked),
      eligible: realmId === "dawn" || requirements.every((requirement) => requirement.met),
      requirements,
    };
  });
}

async function syncRealmUnlock(email: string) {
  await env.DB.prepare(`
    UPDATE realm_progress SET target = 0, updated_at = CURRENT_TIMESTAMP
    WHERE user_email = ? AND target = 1
  `).bind(email).run();

  for (let attempt = 0; attempt < realmOrder.length - 1; attempt += 1) {
    const gates = await realmGateStatuses(email);
    const next = gates.find((gate) => gate.realmId !== "dawn" && !gate.unlocked);
    if (!next) return;
    await env.DB.prepare(`
      INSERT INTO realm_progress (user_email, realm_id, completed_regions, unlocked, target)
      VALUES (?, ?, 0, 0, 1)
      ON CONFLICT(user_email, realm_id) DO UPDATE SET
        target = 1,
        updated_at = CURRENT_TIMESTAMP
    `).bind(email, next.realmId).run();
    if (!next.eligible) return;
    await env.DB.prepare(`
      UPDATE realm_progress
      SET unlocked = 1, target = 0, unlocked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE user_email = ? AND realm_id = ?
    `).bind(email, next.realmId).run();
  }
}

function validClientDate(value?: string | null) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return new Date().toISOString().slice(0, 10);
  return value!;
}

function weekBounds(clientDate: string) {
  const moment = new Date(`${clientDate}T12:00:00Z`);
  const mondayOffset = (moment.getUTCDay() + 6) % 7;
  const startDate = shiftDate(clientDate, -mondayOffset);
  return { startDate, endDate: shiftDate(startDate, 6) };
}

async function weeklyVoyageReport(email: string, clientDate: string) {
  const { startDate, endDate } = weekBounds(clientDate);
  const db = env.DB;
  const [completed, focus, postponed, energy, unfinishedMain, latestDeparture] = await Promise.all([
    db.prepare(`
      SELECT qc.quest_title AS title, qc.reward, qc.completed_date AS completedDate,
        COALESCE(q.type, CASE
          WHEN qc.source LIKE 'system-daily-hard%' OR qc.source = 'daily-departure' THEN '主线'
          WHEN qc.source LIKE 'system-daily-medium%' THEN '支线'
          ELSE '日常' END) AS type
      FROM quest_completions qc
      LEFT JOIN quests q ON q.id = qc.quest_id AND q.user_email = qc.user_email
      WHERE qc.user_email = ? AND qc.completed_date BETWEEN ? AND ?
      ORDER BY qc.reward DESC, qc.completed_at DESC
    `).bind(email, startDate, endDate).all<{ title: string; reward: number; completedDate: string; type: string }>(),
    db.prepare(`
      SELECT
        COALESCE((SELECT SUM(focus_goal_minutes) FROM daily_departures
          WHERE user_email = ? AND departure_date BETWEEN ? AND ?), 0) AS planned,
        COALESCE((SELECT SUM(minutes) FROM focus_sessions
          WHERE user_email = ? AND completed_date BETWEEN ? AND ?), 0) AS actual
    `).bind(email, startDate, endDate, email, startDate, endDate).first<{ planned: number; actual: number }>(),
    db.prepare(`
      SELECT type, COUNT(*) AS count FROM (
        SELECT q.type AS type
        FROM quests q
        WHERE q.user_email = ? AND q.completed = 0 AND q.due_at IS NOT NULL
          AND substr(q.due_at, 1, 10) BETWEEN ? AND ?
          AND substr(q.due_at, 1, 10) < ?
        UNION ALL
        SELECT COALESCE(q.type, '日常') AS type
        FROM quest_completions qc JOIN quests q ON q.id = qc.quest_id
        WHERE qc.user_email = ? AND qc.completed_date BETWEEN ? AND ?
          AND q.due_at IS NOT NULL AND qc.completed_date > substr(q.due_at, 1, 10)
      ) GROUP BY type ORDER BY count DESC, type LIMIT 1
    `).bind(email, startDate, endDate, clientDate, email, startDate, endDate).first<{ type: string; count: number }>(),
    db.prepare(`
      SELECT d.energy_level AS energyLevel, COUNT(q.id) AS planned,
        COALESCE(SUM(CASE WHEN q.completed = 1 THEN 1 ELSE 0 END), 0) AS completed
      FROM daily_departures d
      LEFT JOIN quests q ON q.user_email = d.user_email
        AND q.due_at IS NOT NULL AND substr(q.due_at, 1, 10) = d.departure_date
      WHERE d.user_email = ? AND d.departure_date BETWEEN ? AND ?
      GROUP BY d.energy_level
    `).bind(email, startDate, endDate).all<{ energyLevel: string; planned: number; completed: number }>(),
    db.prepare(`
      SELECT COUNT(*) AS count FROM quests
      WHERE user_email = ? AND type = '主线' AND completed = 0
        AND (due_at IS NULL OR substr(due_at, 1, 10) <= ?)
    `).bind(email, endDate).first<{ count: number }>(),
    db.prepare(`
      SELECT main_goal AS mainGoal, departure_date AS departureDate
      FROM daily_departures WHERE user_email = ? AND departure_date BETWEEN ? AND ?
      ORDER BY departure_date DESC LIMIT 1
    `).bind(email, startDate, endDate).first<{ mainGoal: string; departureDate: string }>(),
  ]);

  const typeCounts = new Map<string, number>();
  for (const item of completed.results) typeCounts.set(item.type, (typeCounts.get(item.type) ?? 0) + 1);
  const typeBreakdown = [...typeCounts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((left, right) => right.count - left.count || left.type.localeCompare(right.type));
  const completedCount = completed.results.length;
  const plannedFocusMinutes = Number(focus?.planned ?? 0);
  const actualFocusMinutes = Number(focus?.actual ?? 0);
  const focusAchievementRate = plannedFocusMinutes
    ? Math.min(200, Math.round(actualFocusMinutes / plannedFocusMinutes * 100))
    : actualFocusMinutes ? 100 : 0;
  const topType = typeBreakdown[0];
  const postponedType = postponed ? { type: postponed.type, count: Number(postponed.count) } : null;
  const mainRemaining = Number(unfinishedMain?.count ?? 0);
  const energyCompletion = ["low", "medium", "high"].map((energyLevel) => {
    const row = energy.results.find((item) => item.energyLevel === energyLevel);
    const planned = Number(row?.planned ?? 0);
    const completedForEnergy = Number(row?.completed ?? 0);
    return {
      energyLevel,
      planned,
      completed: completedForEnergy,
      rate: planned ? Math.round(completedForEnergy / planned * 100) : null,
    };
  });
  const keep = topType
    ? `保留「${topType.type}」节奏：本周完成 ${topType.count} 项，是最稳定的行动类型。`
    : "保留每日启程：先选定一件最重要的事，让行动从最小一步开始。";
  const reduce = plannedFocusMinutes > 0 && actualFocusMinutes < plannedFocusMinutes * 0.7
    ? `减少过量计划：下周每日计划专注可先降低约 ${Math.max(5, Math.round((plannedFocusMinutes - actualFocusMinutes) / 7 / 5) * 5)} 分钟。`
    : postponedType
      ? `减少「${postponedType.type}」积压：本周有 ${postponedType.count} 项发生延期，建议拆成更小步骤。`
      : "减少无截止日期的堆积：只保留能在下周真正推进的任务。";
  const prioritize = mainRemaining
    ? `优先清理主线：当前有 ${mainRemaining} 项主线待完成，先为最重要的一项预留专注时间。`
    : "优先延续本周成果：从完成度最高的方向选择下一条主线。";
  const bestCompleted = completed.results[0];
  const highlight = bestCompleted
    ? { title: bestCompleted.title, reward: Number(bestCompleted.reward), date: bestCompleted.completedDate }
    : latestDeparture
      ? { title: latestDeparture.mainGoal, reward: 0, date: latestDeparture.departureDate }
      : null;

  return {
    startDate,
    endDate,
    completedCount,
    completedItems: completed.results.slice(0, 5),
    typeBreakdown,
    plannedFocusMinutes,
    actualFocusMinutes,
    focusAchievementRate,
    postponedType,
    energyCompletion,
    recommendations: { keep, reduce, prioritize },
    highlight,
  };
}

async function dashboard(email: string, requestedClientDate?: string | null) {
  const db = env.DB;
  const clientDate = validClientDate(requestedClientDate);
  await ensureDailySystemQuests(email, clientDate);
  await syncRealmUnlock(email);
  const habit = await habitState(email, clientDate, true);
  const weeklyReport = await weeklyVoyageReport(email, clientDate);
  const sevenDayChallenge = await sevenDayChallengeState(email, clientDate);
  const dailyDeparture = await db.prepare(`
    SELECT departure_date AS departureDate, main_goal AS mainGoal,
      focus_goal_minutes AS focusGoalMinutes, energy_level AS energyLevel,
      started_at AS startedAt
    FROM daily_departures WHERE user_email = ? AND departure_date = ?
  `).bind(email, clientDate).first();
  const savedHabitSettings = await db.prepare(`
    SELECT departure_reminder AS departureReminder, main_reminder AS mainReminder,
      review_reminder AS reviewReminder, notifications_enabled AS notificationsEnabled
    FROM habit_settings WHERE user_email = ?
  `).bind(email).first<{
    departureReminder: string | null;
    mainReminder: string | null;
    reviewReminder: string | null;
    notificationsEnabled: number;
  }>();
  const user = await db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<UserRow>();
  const quests = await db.prepare(`
    SELECT id, title, detail, type, reward, source, due_at AS dueAt,
      CASE WHEN instr(created_at, 'T') > 0
        THEN created_at ELSE replace(created_at, ' ', 'T') || 'Z' END AS createdAt,
      CASE WHEN completed_at IS NULL THEN NULL
        WHEN instr(completed_at, 'T') > 0 THEN completed_at
        ELSE replace(completed_at, ' ', 'T') || 'Z' END AS completedAt,
      completed AS done
    FROM quests WHERE user_email = ?
    ORDER BY CASE WHEN due_at IS NULL THEN 1 ELSE 0 END, due_at, id
  `).bind(email).all();
  const questActivity = await db.prepare(`
    SELECT completed_date AS date, COUNT(*) AS count
    FROM quest_completions WHERE user_email = ?
    GROUP BY completed_date ORDER BY completed_date
  `).bind(email).all();
  const questTypeActivity = await db.prepare(`
    SELECT qc.completed_date AS date,
      CASE
        WHEN COALESCE(q.type, '') IN ('主线', '支线', '日常') THEN q.type
        WHEN qc.source LIKE 'system-daily-hard%' OR qc.source = 'daily-departure' THEN '主线'
        WHEN qc.source LIKE 'system-daily-medium%' THEN '支线'
        ELSE '日常'
      END AS type,
      COUNT(*) AS count
    FROM quest_completions qc
    LEFT JOIN quests q ON q.id = qc.quest_id AND q.user_email = qc.user_email
    WHERE qc.user_email = ? AND qc.completed_date >= date(?, '-370 days')
    GROUP BY qc.completed_date, type
    ORDER BY qc.completed_date, type
  `).bind(email, clientDate).all();
  const questCompletionTotal = await db.prepare(`
    SELECT COUNT(*) AS count FROM quest_completions WHERE user_email = ?
  `).bind(email).first<{ count: number }>();
  const recentQuestCompletions = await db.prepare(`
    SELECT id, quest_title AS title, reward,
      CASE WHEN instr(completed_at, 'T') > 0
        THEN completed_at ELSE replace(completed_at, ' ', 'T') || 'Z' END AS completedAt
    FROM quest_completions WHERE user_email = ?
    ORDER BY id DESC LIMIT 5
  `).bind(email).all();
  const team = await db.prepare(`
    SELECT t.id, t.name, t.code, t.owner_email,
      (SELECT COUNT(*) FROM team_members tm2 WHERE tm2.team_id = t.id) AS member_count
    FROM teams t JOIN team_members tm ON tm.team_id = t.id
    WHERE tm.user_email = ?
  `).bind(email).first();
  const members = team ? await db.prepare(`
    SELECT u.display_name, u.email, u.xp, u.focus_minutes, u.avatar_key, u.custom_avatar,
      (u.xp + u.focus_minutes * 2) AS strength
    FROM team_members tm JOIN users u ON u.email = tm.user_email
    WHERE tm.team_id = ? ORDER BY strength DESC
  `).bind(team.id).all() : { results: [] };
  const teamPendingInvitations = team ? await db.prepare(`
    SELECT id, invitee_email AS inviteeEmail, created_at AS createdAt
    FROM team_invitations
    WHERE team_id = ? AND status = 'pending'
    ORDER BY id DESC
  `).bind(team.id).all() : { results: [] };
  const pendingTeamInvitations = await db.prepare(`
    SELECT ti.id, ti.team_id AS teamId, t.name AS teamName,
      u.display_name AS inviterName, ti.created_at AS createdAt,
      (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = ti.team_id) AS memberCount
    FROM team_invitations ti
    JOIN teams t ON t.id = ti.team_id
    JOIN users u ON u.email = ti.inviter_email
    WHERE ti.invitee_email = ? AND ti.status = 'pending'
    ORDER BY ti.id DESC
  `).bind(email).all();
  const pendingFriendInvitations = await db.prepare(`
    SELECT fi.id, fi.inviter_email AS inviterEmail, u.display_name AS inviterName,
      u.avatar_key AS avatarKey, u.custom_avatar AS customAvatar, fi.created_at AS createdAt
    FROM friend_invitations fi
    JOIN users u ON u.email = fi.inviter_email
    WHERE fi.invitee_email = ? AND fi.status = 'pending'
    ORDER BY fi.id DESC
  `).bind(email).all();
  const teamPendingJoinRequests = team ? await db.prepare(`
    SELECT jr.id, jr.applicant_email AS applicantEmail, u.display_name AS applicantName,
      u.avatar_key AS avatarKey, u.custom_avatar AS customAvatar, jr.created_at AS createdAt,
      (SELECT COUNT(*) FROM team_join_request_votes v WHERE v.request_id = jr.id AND v.decision = 'approve') AS approvals,
      (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = jr.team_id) AS requiredApprovals,
      (SELECT decision FROM team_join_request_votes mine WHERE mine.request_id = jr.id AND mine.voter_email = ?) AS myVote
    FROM team_join_requests jr
    JOIN users u ON u.email = jr.applicant_email
    WHERE jr.team_id = ? AND jr.status = 'pending'
    ORDER BY jr.id DESC
  `).bind(email, team.id).all() : { results: [] };
  const myTeamJoinRequests = await db.prepare(`
    SELECT jr.id, jr.status, jr.created_at AS createdAt, t.name AS teamName,
      (SELECT COUNT(*) FROM team_join_request_votes v WHERE v.request_id = jr.id AND v.decision = 'approve') AS approvals,
      (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = jr.team_id) AS requiredApprovals
    FROM team_join_requests jr JOIN teams t ON t.id = jr.team_id
    WHERE jr.applicant_email = ? AND jr.status = 'pending'
    ORDER BY jr.id DESC
  `).bind(email).all();
  const notifications = await db.prepare(`
    SELECT id, kind, title, body, entity_id AS entityId, read_at AS readAt, created_at AS createdAt
    FROM site_notifications WHERE user_email = ? ORDER BY id DESC LIMIT 30
  `).bind(email).all();
  const unreadNotifications = await db.prepare(`
    SELECT COUNT(*) AS count FROM site_notifications WHERE user_email = ? AND read_at IS NULL
  `).bind(email).first<{ count: number }>();
  const leaderboard = await db.prepare(`
    SELECT t.id, t.name, t.code, COUNT(tm.user_email) AS members,
      SUM(u.xp + u.focus_minutes * 2) AS strength,
      SUM(u.focus_minutes) AS focus_minutes
    FROM teams t
    JOIN team_members tm ON tm.team_id = t.id
    JOIN users u ON u.email = tm.user_email
    GROUP BY t.id ORDER BY strength DESC, focus_minutes DESC LIMIT 50
  `).all();
  const referralCount = await db.prepare("SELECT COUNT(*) AS count FROM referrals WHERE referrer_email = ?")
    .bind(email).first<{ count: number }>();
  const focusHistory = await db.prepare(`
    SELECT id, minutes, created_at FROM focus_sessions
    WHERE user_email = ? ORDER BY id DESC LIMIT 10
  `).bind(email).all();
  const todayFocus = await db.prepare(`
    SELECT COALESCE(SUM(minutes), 0) AS minutes
    FROM focus_sessions
    WHERE user_email = ?
      AND (completed_date = ? OR (completed_date IS NULL AND substr(created_at, 1, 10) = ?))
  `).bind(email, clientDate, clientDate).first<{ minutes: number }>();
  const inventory = await db.prepare(`
    SELECT item_key, quantity, acquired_at FROM inventory
    WHERE user_email = ? ORDER BY acquired_at DESC
  `).bind(email).all();
  const realmProgress = await db.prepare(`
    SELECT realm_id AS realmId, completed_regions AS completedRegions,
      unlocked, target, unlocked_at AS unlockedAt
    FROM realm_progress WHERE user_email = ?
    ORDER BY unlocked DESC, updated_at
  `).bind(email).all();
  const realmGates = await realmGateStatuses(email);
  const calendarAccess = await getCalendarAccess(email);
  const premiumProgram = await getPremiumProgram(email);
  const calendarConnection = await db.prepare(`
    SELECT google_email AS googleEmail, last_synced_at AS lastSyncedAt, connected_at AS connectedAt
    FROM google_calendar_connections WHERE user_email = ?
  `).bind(email).first<{ googleEmail: string | null; lastSyncedAt: string | null; connectedAt: string }>();

  return {
    user: {
      email: user?.email,
      name: user?.display_name,
      inviteCode: user?.invite_code,
      invitedBy: user?.invited_by,
      xp: user?.xp ?? 0,
      coins: user?.coins ?? 0,
      focusMinutes: user?.focus_minutes ?? 0,
      referralCount: referralCount?.count ?? 0,
      avatarKey: user?.avatar_key ?? "initial",
      customAvatar: user?.custom_avatar ?? null,
    },
    quests: quests.results,
    questActivity: questActivity.results,
    questTypeActivity: questTypeActivity.results,
    questCompletionTotal: questCompletionTotal?.count ?? 0,
    recentQuestCompletions: recentQuestCompletions.results,
    focusHistory: focusHistory.results,
    todayFocusMinutes: Number(todayFocus?.minutes ?? 0),
    weeklyReport,
    sevenDayChallenge,
    dailyDeparture: dailyDeparture ?? null,
    habit,
    habitSettings: savedHabitSettings
      ? { ...savedHabitSettings, notificationsEnabled: Boolean(savedHabitSettings.notificationsEnabled) }
      : { departureReminder: "08:30", mainReminder: "17:30", reviewReminder: "21:30", notificationsEnabled: false },
    inventory: inventory.results,
    realmProgress: realmProgress.results,
    realmGates,
    calendarAccess,
    premiumProgram,
    calendarConnection: calendarConnection
      ? { connected: true, googleEmail: calendarConnection.googleEmail, lastSyncedAt: calendarConnection.lastSyncedAt }
      : { connected: false, googleEmail: null, lastSyncedAt: null },
    team: team ? { ...team, members: members.results, pendingInvitations: teamPendingInvitations.results, pendingJoinRequests: teamPendingJoinRequests.results } : null,
    pendingTeamInvitations: pendingTeamInvitations.results,
    pendingFriendInvitations: pendingFriendInvitations.results,
    myTeamJoinRequests: myTeamJoinRequests.results,
    notifications: notifications.results,
    unreadNotificationCount: unreadNotifications?.count ?? 0,
    leaderboard: leaderboard.results,
  };
}

export async function GET(request: Request) {
  try {
    const identity = await currentUser(request);
    if (!identity) return Response.json({ error: "请先登录" }, { status: 401 });
    const clientDate = new URL(request.url).searchParams.get("clientDate");
    return Response.json(await dashboard(identity.email, clientDate));
  } catch (error) {
    console.error("Game dashboard failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "读取失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const identity = await currentUser(request);
    if (!identity) return Response.json({ error: "请先登录" }, { status: 401 });
    const body = await request.json() as {
      action?: string;
      questId?: number;
      questIds?: number[];
      minutes?: number;
      code?: string;
      name?: string;
      title?: string;
      detail?: string;
      type?: string;
      itemKey?: string;
      price?: number;
      calendarUrl?: string;
      calendarText?: string;
      provider?: string;
      rangeDays?: number;
      realmId?: string;
      regionIndex?: number;
      criteriaConfirmed?: number[];
      clientDate?: string;
      premiumEmails?: string[];
      email?: string;
      invitationId?: number;
      requestId?: number;
      decision?: string;
      avatarKey?: string;
      customAvatar?: string;
      mainGoal?: string;
      focusGoalMinutes?: number;
      energyLevel?: string;
      departureReminder?: string | null;
      mainReminder?: string | null;
      reviewReminder?: string | null;
      notificationsEnabled?: boolean;
      sceneId?: string;
      scenePace?: string;
      templateStartDate?: string;
    };
    const db = env.DB;

    if (body.action === "startDailyDeparture") {
      const clientDate = validClientDate(body.clientDate);
      const mainGoal = (body.mainGoal ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
      const focusGoalMinutes = Math.max(5, Math.min(240, Math.round(Number(body.focusGoalMinutes) || 25)));
      const energyLevel = ["low", "medium", "high"].includes(body.energyLevel ?? "") ? body.energyLevel! : "medium";
      if (mainGoal.length < 2) return Response.json({ error: "请写下今天最重要的一件事" }, { status: 400 });
      const energyLabel = energyLevel === "low" ? "低" : energyLevel === "high" ? "高" : "中";
      await db.batch([
        db.prepare(`
          INSERT INTO daily_departures
            (user_email, departure_date, main_goal, focus_goal_minutes, energy_level)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(user_email, departure_date) DO UPDATE SET
            main_goal = excluded.main_goal,
            focus_goal_minutes = excluded.focus_goal_minutes,
            energy_level = excluded.energy_level
        `).bind(identity.email, clientDate, mainGoal, focusGoalMinutes, energyLevel),
        db.prepare(`
          INSERT INTO quests
            (user_email, title, detail, type, reward, source, due_at, external_id)
          VALUES (?, ?, ?, '主线', 60, 'daily-departure', ?, ?)
          ON CONFLICT(user_email, source, external_id) DO UPDATE SET
            title = excluded.title,
            detail = excluded.detail,
            due_at = excluded.due_at
        `).bind(identity.email, mainGoal, `今日启程主线 · 当前精力：${energyLabel} · 计划专注 ${focusGoalMinutes} 分钟`, clientDate, `departure:${clientDate}`),
      ]);
    } else if (body.action === "updateHabitSettings") {
      const parseReminder = (value: string | null | undefined) => {
        if (value === null || value === undefined || value.trim() === "") return null;
        const time = value.trim();
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("提醒时间格式不正确");
        return time;
      };
      const departureReminder = parseReminder(body.departureReminder);
      const mainReminder = parseReminder(body.mainReminder);
      const reviewReminder = parseReminder(body.reviewReminder);
      await db.prepare(`
        INSERT INTO habit_settings
          (user_email, departure_reminder, main_reminder, review_reminder, notifications_enabled, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_email) DO UPDATE SET
          departure_reminder = excluded.departure_reminder,
          main_reminder = excluded.main_reminder,
          review_reminder = excluded.review_reminder,
          notifications_enabled = excluded.notifications_enabled,
          updated_at = CURRENT_TIMESTAMP
      `).bind(identity.email, departureReminder, mainReminder, reviewReminder, body.notificationsEnabled ? 1 : 0).run();
    } else if (body.action === "useHabitRestTicket") {
      const clientDate = validClientDate(body.clientDate);
      const restDate = shiftDate(clientDate, -1);
      const activeDates = await habitActivityDates(identity.email);
      if (activeDates.has(restDate)) return Response.json({ error: "昨天已有冒险记录，不需要使用休整券" }, { status: 400 });
      if (!activeDates.has(clientDate)) return Response.json({ error: "请先完成今天的每日启程" }, { status: 400 });
      const current = await habitState(identity.email, clientDate);
      if (current.restTicketsRemaining <= 0) return Response.json({ error: "本月休整券已用完" }, { status: 400 });
      await db.prepare(`
        INSERT OR IGNORE INTO habit_rest_days (user_email, rest_date, month_key) VALUES (?, ?, ?)
      `).bind(identity.email, restDate, clientDate.slice(0, 7)).run();
    } else if (body.action === "updateAvatar") {
      const user = await db.prepare("SELECT xp FROM users WHERE email = ?").bind(identity.email).first<{ xp: number }>();
      const level = Math.floor(Math.max(0, user?.xp ?? 0) / 100) + 1;
      const avatarKey = (body.avatarKey ?? "").trim();
      const requiredLevel = avatarLevels[avatarKey];
      if (!requiredLevel) return Response.json({ error: "头像不存在" }, { status: 404 });
      if (level < requiredLevel) return Response.json({ error: `该头像将在 Lv.${requiredLevel} 解锁` }, { status: 403 });
      if (avatarKey === "streak30") {
        const reward = await db.prepare("SELECT 1 FROM habit_rewards WHERE user_email = ? AND milestone = 30")
          .bind(identity.email).first();
        if (!reward) return Response.json({ error: "连续启程 30 天后解锁该头像" }, { status: 403 });
      }
      let customAvatar: string | null = null;
      if (avatarKey === "custom") {
        customAvatar = (body.customAvatar ?? "").trim();
        const symbols = Array.from(customAvatar);
        if (!customAvatar || symbols.length > 2 || /[\u0000-\u001f\u007f]/.test(customAvatar)) {
          return Response.json({ error: "自定义头像请输入 1～2 个文字或符号" }, { status: 400 });
        }
      }
      await db.prepare("UPDATE users SET avatar_key = ?, custom_avatar = ? WHERE email = ?")
        .bind(avatarKey, customAvatar, identity.email).run();
    } else if (body.action === "markNotificationsRead") {
      await db.prepare("UPDATE site_notifications SET read_at = CURRENT_TIMESTAMP WHERE user_email = ? AND read_at IS NULL")
        .bind(identity.email).run();
    } else if (body.action === "updatePremiumFreeSlots") {
      await updatePremiumFreeSlots(identity.email, Array.isArray(body.premiumEmails) ? body.premiumEmails : []);
    } else if (body.action === "completeRealmTask") {
      const realmId = body.realmId ?? "";
      const rule = realmRules[realmId];
      if (!rule) return Response.json({ error: "大陆不存在" }, { status: 404 });
      const criteriaConfirmed = Array.isArray(body.criteriaConfirmed)
        ? [...new Set(body.criteriaConfirmed.map(Number))].sort((left, right) => left - right)
        : [];
      if (criteriaConfirmed.join(",") !== "0,1,2") {
        return Response.json({ error: "请逐项确认三条完成标准后再提交大陆任务" }, { status: 400 });
      }
      const progress = await db.prepare(`
        SELECT completed_regions, unlocked FROM realm_progress
        WHERE user_email = ? AND realm_id = ?
      `).bind(identity.email, realmId).first<{ completed_regions: number; unlocked: number }>();
      if (!progress?.unlocked) return Response.json({ error: "该大陆尚未解锁" }, { status: 400 });
      const regionIndex = Math.max(0, Math.min(2, Number(body.regionIndex) || 0));
      if (regionIndex < progress.completed_regions) {
        return Response.json({ error: "这项大陆任务已经完成" }, { status: 400 });
      }
      if (regionIndex > progress.completed_regions) {
        return Response.json({ error: "请按顺序完成大陆任务" }, { status: 400 });
      }
      await db.batch([
        db.prepare(`
          UPDATE realm_progress
          SET completed_regions = completed_regions + 1, updated_at = CURRENT_TIMESTAMP
          WHERE user_email = ? AND realm_id = ? AND completed_regions = ?
        `).bind(identity.email, realmId, regionIndex),
        db.prepare("UPDATE users SET xp = xp + ?, coins = coins + ? WHERE email = ?")
          .bind(rule.taskReward, Math.ceil(rule.taskReward / 2), identity.email),
      ]);
    } else if (body.action === "chooseRealmTarget") {
      return Response.json({ error: "大陆按照固定远征顺序解锁，请完成当前系统门槛" }, { status: 400 });
    } else if (body.action === "completeQuest") {
      const quest = await db.prepare(
        "SELECT reward, completed FROM quests WHERE id = ? AND user_email = ?",
      ).bind(body.questId, identity.email).first<{ reward: number; completed: number }>();
      if (!quest) return Response.json({ error: "任务不存在" }, { status: 404 });
      if (!quest.completed) {
        const completedDate = /^\d{4}-\d{2}-\d{2}$/.test(body.clientDate ?? "")
          ? body.clientDate!
          : new Date().toISOString().slice(0, 10);
        await db.batch([
          db.prepare("UPDATE quests SET completed = 1, completed_at = CURRENT_TIMESTAMP WHERE id = ? AND user_email = ?").bind(body.questId, identity.email),
          db.prepare(`
            INSERT OR IGNORE INTO quest_completions
              (user_email, quest_id, quest_title, reward, source, completed_date)
            SELECT user_email, id, title, reward, source, ?
            FROM quests WHERE id = ? AND user_email = ?
          `).bind(completedDate, body.questId, identity.email),
          db.prepare("UPDATE users SET xp = xp + ?, coins = coins + ? WHERE email = ?")
            .bind(quest.reward, Math.ceil(quest.reward / 2), identity.email),
        ]);
      }
    } else if (body.action === "editQuest") {
      const title = (body.title ?? "").trim().slice(0, 80);
      const detail = (body.detail ?? "").trim().slice(0, 180);
      const type = ["主线", "日常", "支线"].includes(body.type ?? "") ? body.type! : "支线";
      if (title.length < 2) return Response.json({ error: "任务名称至少需要 2 个字" }, { status: 400 });
      const quest = await db.prepare("SELECT 1 FROM quests WHERE id = ? AND user_email = ?")
        .bind(body.questId, identity.email).first();
      if (!quest) return Response.json({ error: "任务不存在" }, { status: 404 });
      await db.prepare(`
        UPDATE quests SET title = ?, detail = ?, type = ?
        WHERE id = ? AND user_email = ?
      `).bind(title, detail || "由旅行者亲自整理的任务说明", type, body.questId, identity.email).run();
    } else if (body.action === "deleteQuest") {
      const quest = await db.prepare("SELECT 1 FROM quests WHERE id = ? AND user_email = ?")
        .bind(body.questId, identity.email).first();
      if (!quest) return Response.json({ error: "任务不存在" }, { status: 404 });
      await db.prepare("DELETE FROM quests WHERE id = ? AND user_email = ?")
        .bind(body.questId, identity.email).run();
    } else if (body.action === "batchDeleteQuests") {
      const questIds = Array.isArray(body.questIds)
        ? [...new Set(body.questIds.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))].slice(0, 100)
        : [];
      if (!questIds.length) return Response.json({ error: "请至少选择一个任务" }, { status: 400 });
      const placeholders = questIds.map(() => "?").join(",");
      const owned = await db.prepare(`
        SELECT id FROM quests WHERE user_email = ? AND id IN (${placeholders})
      `).bind(identity.email, ...questIds).all<{ id: number }>();
      if (owned.results.length !== questIds.length) {
        return Response.json({ error: "选中的任务中包含不存在或无权操作的记录" }, { status: 403 });
      }
      await db.prepare(`
        DELETE FROM quests WHERE user_email = ? AND id IN (${placeholders})
      `).bind(identity.email, ...questIds).run();
    } else if (body.action === "startSevenDayChallenge") {
      const startDate = validClientDate(body.templateStartDate ?? body.clientDate);
      const existing = await db.prepare(`
        SELECT COUNT(*) AS count FROM quests
        WHERE user_email = ? AND source = 'seven-day-challenge'
      `).bind(identity.email).first<{ count: number }>();
      if ((existing?.count ?? 0) > 0) {
        return Response.json({ error: "7天星旅挑战已经启用，继续完成当前航线即可" }, { status: 400 });
      }
      await db.batch(sevenDayChallengeTasks.map((quest, index) => db.prepare(`
        INSERT INTO quests
          (user_email, title, detail, type, reward, source, due_at, external_id)
        VALUES (?, ?, ?, ?, ?, 'seven-day-challenge', ?, ?)
      `).bind(
        identity.email,
        quest[0],
        quest[1],
        quest[2],
        quest[3],
        shiftDate(startDate, index),
        `${startDate}:day-${index + 1}`,
      )));
    } else if (body.action === "applySceneTemplate") {
      const sceneId = (body.sceneId ?? "").trim();
      const template = sceneTemplates[sceneId];
      const scenePace = body.scenePace === "gentle" || body.scenePace === "sprint" ? body.scenePace : "standard";
      const pace = scenePaces[scenePace];
      const startDate = validClientDate(body.templateStartDate);
      if (!template) return Response.json({ error: "场景模板不存在" }, { status: 404 });
      const results = await db.batch(pace.indexes.map((questIndex, scheduleIndex) => {
        const quest = template.quests[questIndex];
        const dueAt = shiftDate(startDate, pace.offsets[scheduleIndex]);
        return db.prepare(`
          INSERT OR IGNORE INTO quests
            (user_email, title, detail, type, reward, source, due_at, external_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          identity.email,
          quest[0],
          `${quest[1]} · 建议专注 ${pace.focusMinutes} 分钟`,
          quest[2],
          quest[3],
          `scene-template-${sceneId}`,
          dueAt,
          `${startDate}:${scenePace}:${questIndex}`,
        );
      }));
      const created = results.reduce((total, result) => total + Number(result.meta.changes || 0), 0);
      if (!created) return Response.json({ error: "这套场景方案已从同一天启用过，可编辑现有任务或更换开始日期" }, { status: 400 });
    } else if (body.action === "createQuest") {
      const title = (body.title ?? "").trim().slice(0, 40);
      const detail = (body.detail ?? "").trim().slice(0, 100);
      const type = ["主线", "日常", "支线"].includes(body.type ?? "") ? body.type : "支线";
      if (title.length < 2) return Response.json({ error: "任务名称至少需要 2 个字" }, { status: 400 });
      const reward = type === "主线" ? 80 : type === "日常" ? 30 : 45;
      await db.prepare("INSERT INTO quests (user_email, title, detail, type, reward) VALUES (?, ?, ?, ?, ?)")
        .bind(identity.email, title, detail || "由旅行者亲自制定的冒险委托", type, reward).run();
    } else if (body.action === "claimCalendarLevelReward") {
      await claimLevel100CalendarReward(identity.email);
    } else if (body.action === "syncGoogleCalendar") {
      await syncGoogleCalendar(identity.email, body.clientDate);
    } else if (body.action === "disconnectGoogleCalendar") {
      await db.prepare("DELETE FROM google_calendar_connections WHERE user_email = ?")
        .bind(identity.email).run();
    } else if (body.action === "importCalendar") {
      const provider = ["google", "outlook", "icloud", "ics"].includes(body.provider ?? "") ? body.provider! : "ics";
      const rangeDays = Math.max(1, Math.min(30, Number(body.rangeDays) || 7));
      let calendarText = (body.calendarText ?? "").trim();
      if (!calendarText && body.calendarUrl) {
        const source = calendarUrl(body.calendarUrl);
        const response = await fetch(source, {
          redirect: "follow",
          headers: { Accept: "text/calendar,text/plain;q=0.9,*/*;q=0.1" },
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) throw new Error("无法读取日历链接，请确认已经开启公开/私密订阅");
        const declaredSize = Number(response.headers.get("content-length") || 0);
        if (declaredSize > 1_500_000) throw new Error("日历文件过大，请缩短导出范围后重试");
        calendarText = await response.text();
      }
      if (calendarText.length > 1_500_000) throw new Error("日历文件过大，请缩短导出范围后重试");
      if (!calendarText.includes("BEGIN:VCALENDAR")) {
        return Response.json({ error: "没有识别到有效的 .ics 日历内容" }, { status: 400 });
      }
      const events = parseCalendar(calendarText, rangeDays, body.clientDate);
      if (!events.length) {
        return Response.json({ error: `未来 ${rangeDays} 天没有可导入的日程` }, { status: 400 });
      }
      const results = await db.batch(events.map((event) => {
        const moment = new Date(event.dueAt);
        const time = event.dueAt.length === 10
          ? "全天"
          : moment.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
        const detail = [time, event.location, event.description].filter(Boolean).join(" · ").slice(0, 180);
        return db.prepare(`
          INSERT OR IGNORE INTO quests
            (user_email, title, detail, type, reward, source, due_at, external_id)
          VALUES (?, ?, ?, '日常', 30, ?, ?, ?)
        `).bind(identity.email, event.title.slice(0, 80), detail || "来自日历的云端日程", provider, event.dueAt, event.uid);
      }));
      const imported = results.reduce((total, result) => total + Number(result.meta.changes || 0), 0);
      return Response.json({ ...(await dashboard(identity.email, body.clientDate)), lastImportCount: imported });
    } else if (body.action === "focus") {
      const minutes = Math.max(1, Math.min(180, Number(body.minutes) || 25));
      await db.batch([
        db.prepare("INSERT INTO focus_sessions (user_email, minutes, completed_date) VALUES (?, ?, ?)")
          .bind(identity.email, minutes, validClientDate(body.clientDate)),
        db.prepare("UPDATE users SET focus_minutes = focus_minutes + ?, xp = xp + ?, coins = coins + ? WHERE email = ?")
          .bind(minutes, minutes * 2, Math.ceil(minutes / 2), identity.email),
      ]);
    } else if (body.action === "buyItem") {
      const catalog: Record<string, { price: number }> = {
        "rest-pass": { price: 80 },
        "movie-night": { price: 120 },
        "wish-tea": { price: 60 },
        "adventure-day": { price: 260 },
      };
      const item = catalog[body.itemKey ?? ""];
      if (!item) return Response.json({ error: "奖励不存在" }, { status: 404 });
      const balance = await db.prepare("SELECT coins FROM users WHERE email = ?").bind(identity.email).first<{ coins: number }>();
      if ((balance?.coins ?? 0) < item.price) return Response.json({ error: "星辉不足，完成更多任务后再来吧" }, { status: 400 });
      await db.batch([
        db.prepare("UPDATE users SET coins = coins - ? WHERE email = ?").bind(item.price, identity.email),
        db.prepare(`
          INSERT INTO inventory (user_email, item_key, quantity) VALUES (?, ?, 1)
          ON CONFLICT(user_email, item_key) DO UPDATE SET quantity = quantity + 1, acquired_at = CURRENT_TIMESTAMP
        `).bind(identity.email, body.itemKey),
      ]);
    } else if (body.action === "sendFriendInvitation") {
      const inviteeEmail = (body.email ?? "").trim().toLowerCase().slice(0, 254);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteeEmail)) {
        return Response.json({ error: "请输入有效的注册邮箱" }, { status: 400 });
      }
      if (inviteeEmail === identity.email) return Response.json({ error: "不能邀请自己" }, { status: 400 });
      const invitee = await db.prepare("SELECT invited_by AS invitedBy FROM users WHERE email = ?")
        .bind(inviteeEmail).first<{ invitedBy: string | null }>();
      if (!invitee) return Response.json({ error: "该邮箱尚未注册，请改用外部邮箱邀请链接" }, { status: 404 });
      if (invitee.invitedBy) return Response.json({ error: "该旅行者已经绑定过邀请人" }, { status: 400 });
      const existing = await db.prepare("SELECT status FROM friend_invitations WHERE inviter_email = ? AND invitee_email = ?")
        .bind(identity.email, inviteeEmail).first<{ status: string }>();
      if (existing?.status === "pending") return Response.json({ error: "邀请已经送达，请等待对方处理" }, { status: 400 });
      const invitation = await db.prepare(`
        INSERT INTO friend_invitations (inviter_email, invitee_email)
        VALUES (?, ?)
        ON CONFLICT(inviter_email, invitee_email) DO UPDATE SET
          status = 'pending', responded_at = NULL, created_at = CURRENT_TIMESTAMP
        RETURNING id
      `).bind(identity.email, inviteeEmail).first<{ id: number }>();
      await addNotification(inviteeEmail, "friend_invite", "收到好友同行邀请", `${identity.displayName} 邀请你绑定同行关系，接受后双方都会获得 EXP 与星辉。`, invitation?.id);
    } else if (body.action === "acceptFriendInvitation") {
      const invitationId = Number(body.invitationId);
      const invitation = await db.prepare(`
        SELECT fi.id, fi.inviter_email AS inviterEmail, u.invited_by AS invitedBy
        FROM friend_invitations fi JOIN users u ON u.email = fi.invitee_email
        WHERE fi.id = ? AND fi.invitee_email = ? AND fi.status = 'pending'
      `).bind(invitationId, identity.email).first<{ id: number; inviterEmail: string; invitedBy: string | null }>();
      if (!invitation) return Response.json({ error: "好友邀请不存在或已经处理" }, { status: 404 });
      if (invitation.invitedBy) return Response.json({ error: "你已经绑定过邀请人" }, { status: 400 });
      await db.batch([
        db.prepare("INSERT INTO referrals (referrer_email, invitee_email) VALUES (?, ?)").bind(invitation.inviterEmail, identity.email),
        db.prepare("UPDATE users SET invited_by = ?, xp = xp + 100, coins = coins + 80 WHERE email = ?").bind(invitation.inviterEmail, identity.email),
        db.prepare("UPDATE users SET xp = xp + 200, coins = coins + 120 WHERE email = ?").bind(invitation.inviterEmail),
        db.prepare("UPDATE friend_invitations SET status = 'accepted', responded_at = CURRENT_TIMESTAMP WHERE id = ?").bind(invitation.id),
        db.prepare("UPDATE friend_invitations SET status = 'declined', responded_at = CURRENT_TIMESTAMP WHERE invitee_email = ? AND status = 'pending' AND id != ?").bind(identity.email, invitation.id),
      ]);
      await addNotification(invitation.inviterEmail, "friend_invite_accepted", "好友邀请已接受", `${identity.displayName} 已接受你的同行邀请，奖励已经发放。`, invitation.id);
    } else if (body.action === "declineFriendInvitation") {
      const invitationId = Number(body.invitationId);
      const invitation = await db.prepare(`
        SELECT id, inviter_email AS inviterEmail FROM friend_invitations
        WHERE id = ? AND invitee_email = ? AND status = 'pending'
      `).bind(invitationId, identity.email).first<{ id: number; inviterEmail: string }>();
      if (!invitation) return Response.json({ error: "好友邀请不存在或已经处理" }, { status: 404 });
      await db.prepare("UPDATE friend_invitations SET status = 'declined', responded_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(invitation.id).run();
      await addNotification(invitation.inviterEmail, "friend_invite_declined", "好友邀请未被接受", `${identity.displayName} 暂时没有接受你的同行邀请。`, invitation.id);
    } else if (body.action === "redeemInvite") {
      const code = (body.code ?? "").trim().toUpperCase();
      const me = await db.prepare("SELECT invite_code, invited_by FROM users WHERE email = ?")
        .bind(identity.email).first<{ invite_code: string; invited_by: string | null }>();
      if (!code || code === me?.invite_code) return Response.json({ error: "不能使用自己的邀请码" }, { status: 400 });
      if (me?.invited_by) return Response.json({ error: "你已经绑定过邀请人" }, { status: 400 });
      const inviter = await db.prepare("SELECT email FROM users WHERE invite_code = ?").bind(code).first<{ email: string }>();
      if (!inviter) return Response.json({ error: "邀请码不存在" }, { status: 404 });
      await db.batch([
        db.prepare("INSERT INTO referrals (referrer_email, invitee_email) VALUES (?, ?)").bind(inviter.email, identity.email),
        db.prepare("UPDATE users SET invited_by = ?, xp = xp + 100, coins = coins + 80 WHERE email = ?").bind(inviter.email, identity.email),
        db.prepare("UPDATE users SET xp = xp + 200, coins = coins + 120 WHERE email = ?").bind(inviter.email),
      ]);
    } else if (body.action === "createTeam") {
      const name = (body.name ?? "").trim().slice(0, 16);
      if (name.length < 2) return Response.json({ error: "小组名称至少需要 2 个字" }, { status: 400 });
      const exists = await db.prepare("SELECT 1 FROM team_members WHERE user_email = ?").bind(identity.email).first();
      if (exists) return Response.json({ error: "你已经加入了一个小组" }, { status: 400 });
      const code = makeCode("TEAM", `${identity.email}-${Date.now()}`);
      const created = await db.prepare("INSERT INTO teams (name, code, owner_email) VALUES (?, ?, ?) RETURNING id")
        .bind(name, code, identity.email).first<{ id: number }>();
      await db.prepare("INSERT INTO team_members (team_id, user_email) VALUES (?, ?)").bind(created?.id, identity.email).run();
    } else if (body.action === "sendTeamInvitation") {
      const inviteeEmail = (body.email ?? "").trim().toLowerCase().slice(0, 254);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteeEmail)) {
        return Response.json({ error: "请输入有效的邮箱地址" }, { status: 400 });
      }
      if (inviteeEmail === identity.email) return Response.json({ error: "不能邀请自己加入小组" }, { status: 400 });
      const ownedTeam = await db.prepare(`
        SELECT t.id,
          (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id) AS members,
          (SELECT COUNT(*) FROM team_invitations ti WHERE ti.team_id = t.id AND ti.status = 'pending') AS pendingInvites
        FROM teams t WHERE t.owner_email = ?
      `).bind(identity.email).first<{ id: number; members: number; pendingInvites: number }>();
      if (!ownedTeam) return Response.json({ error: "只有小组队长可以通过邮箱邀请成员" }, { status: 403 });
      const invitedUser = await db.prepare("SELECT 1 FROM users WHERE email = ?").bind(inviteeEmail).first();
      if (!invitedUser) return Response.json({ error: "该邮箱尚未注册星旅营地，请对方注册后再邀请" }, { status: 404 });
      const membership = await db.prepare("SELECT team_id AS teamId FROM team_members WHERE user_email = ?")
        .bind(inviteeEmail).first<{ teamId: number }>();
      if (membership?.teamId === ownedTeam.id) return Response.json({ error: "该旅行者已经在你的小组中" }, { status: 400 });
      const existingInvitation = await db.prepare(`
        SELECT status FROM team_invitations WHERE team_id = ? AND invitee_email = ?
      `).bind(ownedTeam.id, inviteeEmail).first<{ status: string }>();
      if (existingInvitation?.status === "pending") return Response.json({ error: "小组邀请已经送达，请等待对方处理" }, { status: 400 });
      const reservedPlaces = ownedTeam.members + ownedTeam.pendingInvites - (existingInvitation?.status === "pending" ? 1 : 0);
      if (reservedPlaces >= 5) return Response.json({ error: "小组成员与待确认邀请已达到 5 人上限" }, { status: 400 });
      const teamInvitation = await db.prepare(`
        INSERT INTO team_invitations (team_id, inviter_email, invitee_email)
        VALUES (?, ?, ?)
        ON CONFLICT(team_id, invitee_email) DO UPDATE SET
          inviter_email = excluded.inviter_email,
          status = 'pending', responded_at = NULL, created_at = CURRENT_TIMESTAMP
        RETURNING id
      `).bind(ownedTeam.id, identity.email, inviteeEmail).first<{ id: number }>();
      await addNotification(inviteeEmail, "team_invite", membership ? "收到转换小组邀请" : "收到小组邀请", membership
        ? `${identity.displayName} 邀请你转换到他的小组；接受后会自动离开当前小组。`
        : `${identity.displayName} 邀请你加入小组，前往小组页接受或拒绝。`, teamInvitation?.id);
    } else if (body.action === "acceptTeamInvitation") {
      const invitationId = Number(body.invitationId);
      const invitation = await db.prepare(`
        SELECT ti.id, ti.team_id AS teamId, t.name AS teamName,
          (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = ti.team_id) AS members
        FROM team_invitations ti JOIN teams t ON t.id = ti.team_id
        WHERE ti.id = ? AND ti.invitee_email = ? AND ti.status = 'pending'
      `).bind(invitationId, identity.email).first<{ id: number; teamId: number; teamName: string; members: number }>();
      if (!invitation) return Response.json({ error: "邀请不存在或已经处理" }, { status: 404 });
      const membership = await db.prepare("SELECT team_id AS teamId FROM team_members WHERE user_email = ?")
        .bind(identity.email).first<{ teamId: number }>();
      if (membership?.teamId === invitation.teamId) {
        await db.prepare("UPDATE team_invitations SET status = 'accepted', responded_at = CURRENT_TIMESTAMP WHERE id = ?").bind(invitation.id).run();
        return Response.json(await dashboard(identity.email, body.clientDate));
      }
      if (invitation.members >= 5) return Response.json({ error: "该小组已经满员（最多 5 人）" }, { status: 400 });
      const movement = await moveUserToTeam(identity.email, invitation.teamId);
      await db.batch([
        db.prepare("UPDATE team_invitations SET status = 'accepted', responded_at = CURRENT_TIMESTAMP WHERE id = ?").bind(invitation.id),
        db.prepare("UPDATE team_invitations SET status = 'declined', responded_at = CURRENT_TIMESTAMP WHERE invitee_email = ? AND status = 'pending' AND id != ?").bind(identity.email, invitation.id),
        db.prepare("UPDATE team_join_requests SET status = 'rejected', responded_at = CURRENT_TIMESTAMP WHERE applicant_email = ? AND status = 'pending'").bind(identity.email),
      ]);
      const owner = await db.prepare("SELECT owner_email AS ownerEmail FROM teams WHERE id = ?")
        .bind(invitation.teamId).first<{ ownerEmail: string }>();
      if (owner?.ownerEmail) await addNotification(owner.ownerEmail, "team_invite_accepted", movement.switched ? "成员已转换加入" : "新成员已加入", movement.switched
        ? `${identity.displayName} 已接受邀请，从「${movement.previousTeamName}」转换加入「${invitation.teamName}」。`
        : `${identity.displayName} 已接受邀请并加入你的小组。`, invitation.id);
    } else if (body.action === "declineTeamInvitation") {
      const invitationId = Number(body.invitationId);
      const invitation = await db.prepare(`
        SELECT id, inviter_email AS inviterEmail FROM team_invitations
        WHERE id = ? AND invitee_email = ? AND status = 'pending'
      `).bind(invitationId, identity.email).first<{ id: number; inviterEmail: string }>();
      if (!invitation) return Response.json({ error: "邀请不存在或已经处理" }, { status: 404 });
      const updated = await db.prepare(`
        UPDATE team_invitations SET status = 'declined', responded_at = CURRENT_TIMESTAMP
        WHERE id = ? AND invitee_email = ? AND status = 'pending'
      `).bind(invitationId, identity.email).run();
      if (!updated.meta.changes) return Response.json({ error: "邀请不存在或已经处理" }, { status: 404 });
      await addNotification(invitation.inviterEmail, "team_invite_declined", "小组邀请未被接受", `${identity.displayName} 暂时没有接受你的小组邀请。`, invitation.id);
    } else if (body.action === "requestJoinTeam") {
      const code = (body.code ?? "").trim().toUpperCase();
      const membership = await db.prepare(`
        SELECT tm.team_id AS teamId, t.name AS teamName FROM team_members tm
        JOIN teams t ON t.id = tm.team_id WHERE tm.user_email = ?
      `).bind(identity.email).first<{ teamId: number; teamName: string }>();
      const existingRequest = await db.prepare("SELECT team_id AS teamId FROM team_join_requests WHERE applicant_email = ? AND status = 'pending'")
        .bind(identity.email).first<{ teamId: number }>();
      const team = await db.prepare(`
        SELECT t.id, t.name, COUNT(tm.user_email) AS members FROM teams t
        LEFT JOIN team_members tm ON tm.team_id = t.id WHERE t.code = ? GROUP BY t.id
      `).bind(code).first<{ id: number; name: string; members: number }>();
      if (!team) return Response.json({ error: "小组口令不存在" }, { status: 404 });
      if (membership?.teamId === team.id) return Response.json({ error: "你已经在这个小组中" }, { status: 400 });
      if (team.members >= 5) return Response.json({ error: "该小组已经满员（最多 5 人）" }, { status: 400 });
      if (existingRequest && existingRequest.teamId !== team.id) {
        return Response.json({ error: "你已有一项待表决的入组申请，请等待结果" }, { status: 400 });
      }
      if (existingRequest?.teamId === team.id) return Response.json({ error: "该入组申请正在表决中" }, { status: 400 });
      const request = await db.prepare(`
        INSERT INTO team_join_requests (team_id, applicant_email)
        VALUES (?, ?)
        ON CONFLICT(team_id, applicant_email) DO UPDATE SET
          status = 'pending', responded_at = NULL, created_at = CURRENT_TIMESTAMP
        RETURNING id
      `).bind(team.id, identity.email).first<{ id: number }>();
      await db.prepare("DELETE FROM team_join_request_votes WHERE request_id = ?").bind(request?.id).run();
      const recipients = await db.prepare("SELECT user_email AS email FROM team_members WHERE team_id = ?")
        .bind(team.id).all<{ email: string }>();
      for (const recipient of recipients.results) {
        await addNotification(recipient.email, "team_join_request", membership ? "收到转换小组申请" : "收到入组申请", membership
          ? `${identity.displayName} 申请从「${membership.teamName}」转换加入「${team.name}」，需要所有现有成员同意。`
          : `${identity.displayName} 申请加入「${team.name}」，需要所有现有成员同意。`, request?.id);
      }
    } else if (body.action === "voteTeamJoinRequest") {
      const requestId = Number(body.requestId);
      const decision = body.decision === "reject" ? "reject" : body.decision === "approve" ? "approve" : "";
      if (!decision) return Response.json({ error: "请选择同意或拒绝" }, { status: 400 });
      const request = await db.prepare(`
        SELECT jr.id, jr.team_id AS teamId, jr.applicant_email AS applicantEmail,
          t.name AS teamName,
          (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = jr.team_id) AS members
        FROM team_join_requests jr JOIN teams t ON t.id = jr.team_id
        WHERE jr.id = ? AND jr.status = 'pending'
          AND EXISTS (SELECT 1 FROM team_members own WHERE own.team_id = jr.team_id AND own.user_email = ?)
      `).bind(requestId, identity.email).first<{ id: number; teamId: number; applicantEmail: string; teamName: string; members: number }>();
      if (!request) return Response.json({ error: "申请不存在、已处理或你无权表决" }, { status: 404 });
      await db.prepare(`
        INSERT INTO team_join_request_votes (request_id, voter_email, decision)
        VALUES (?, ?, ?)
        ON CONFLICT(request_id, voter_email) DO UPDATE SET decision = excluded.decision, created_at = CURRENT_TIMESTAMP
      `).bind(request.id, identity.email, decision).run();
      if (decision === "reject") {
        await db.prepare("UPDATE team_join_requests SET status = 'rejected', responded_at = CURRENT_TIMESTAMP WHERE id = ?")
          .bind(request.id).run();
        await addNotification(request.applicantEmail, "team_join_rejected", "入组申请未通过", `「${request.teamName}」的成员暂未通过你的入组申请。`, request.id);
      } else {
        const approvals = await db.prepare("SELECT COUNT(*) AS count FROM team_join_request_votes WHERE request_id = ? AND decision = 'approve'")
          .bind(request.id).first<{ count: number }>();
        if ((approvals?.count ?? 0) >= request.members) {
          const membership = await db.prepare("SELECT team_id AS teamId FROM team_members WHERE user_email = ?")
            .bind(request.applicantEmail).first<{ teamId: number }>();
          const memberCount = await db.prepare("SELECT COUNT(*) AS count FROM team_members WHERE team_id = ?")
            .bind(request.teamId).first<{ count: number }>();
          if (membership?.teamId === request.teamId) return Response.json({ error: "申请人已经在该小组中" }, { status: 400 });
          if ((memberCount?.count ?? 0) >= 5) return Response.json({ error: "小组已经满员" }, { status: 400 });
          const movement = await moveUserToTeam(request.applicantEmail, request.teamId);
          await db.batch([
            db.prepare("UPDATE team_join_requests SET status = 'accepted', responded_at = CURRENT_TIMESTAMP WHERE id = ?").bind(request.id),
            db.prepare("UPDATE team_join_requests SET status = 'rejected', responded_at = CURRENT_TIMESTAMP WHERE applicant_email = ? AND status = 'pending' AND id != ?").bind(request.applicantEmail, request.id),
          ]);
          await addNotification(request.applicantEmail, "team_join_accepted", movement.switched ? "转换小组申请已通过" : "入组申请已通过", movement.switched
            ? `「${request.teamName}」全体成员已同意，你已从「${movement.previousTeamName}」转换加入新小组。`
            : `「${request.teamName}」全体成员已同意，你现在已经加入小组。`, request.id);
        }
      }
    } else {
      return Response.json({ error: "未知操作" }, { status: 400 });
    }

    return Response.json(await dashboard(identity.email, body.clientDate));
  } catch (error) {
    console.error("Game action failed", error);
    if (error instanceof GoogleCalendarReconnectRequired) {
      return Response.json({ error: error.message, code: error.code }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "操作失败";
    return Response.json({ error: message.includes("UNIQUE") ? "该操作已经完成" : message }, { status: 500 });
  }
}
