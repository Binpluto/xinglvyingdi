(() => {
  const sentinel = "☾ 月度航向 ";
  let cachedData = null;
  let loading = false;

  function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function monthKey(date) {
    return dateKey(date).slice(0, 7);
  }

  function goalQuest(data, key) {
    return (data.quests || []).find((quest) => quest.title === `${sentinel}${key}`) || null;
  }

  function parseGoal(quest) {
    if (!quest) return null;
    try {
      const value = JSON.parse(quest.detail || "");
      if (!value || typeof value.g !== "string") return null;
      return {
        primaryGoal: value.g,
        taskGoalCount: Math.max(1, Number(value.t) || 20),
        focusGoalMinutes: Math.max(30, Number(value.f) || 600),
        focusBaseline: Math.max(0, Number(value.b) || 0),
      };
    } catch {
      return null;
    }
  }

  async function request(body) {
    const response = await fetch("/api/game", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, clientDate: dateKey(new Date()) }),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || "保存失败，请稍后重试");
    cachedData = json;
    return json;
  }

  async function loadData() {
    if (cachedData) return cachedData;
    const response = await fetch(`/api/game?clientDate=${dateKey(new Date())}`, { credentials: "same-origin" });
    if (!response.ok) throw new Error("月度记录读取失败");
    cachedData = await response.json();
    return cachedData;
  }

  function monthFocusAlreadyRecorded(data, key) {
    return (data.focusHistory || []).reduce((total, session) => {
      const stamp = String(session.created_at || "").replace(" ", "T");
      return stamp.slice(0, 7) === key ? total + (Number(session.minutes) || 0) : total;
    }, 0);
  }

  function summary(data, goal, key) {
    const activity = (data.questActivity || []).filter((day) => String(day.date).slice(0, 7) === key);
    const completedCount = activity.reduce((total, day) => total + (Number(day.count) || 0), 0);
    const typeBreakdown = ["主线", "支线", "日常"].map((type) => ({
      type,
      count: (data.questTypeActivity || []).filter((item) => String(item.date).slice(0, 7) === key && item.type === type)
        .reduce((total, item) => total + (Number(item.count) || 0), 0),
    }));
    const focusMinutes = goal ? Math.max(0, (Number(data.user?.focusMinutes) || 0) - goal.focusBaseline) : monthFocusAlreadyRecorded(data, key);
    const bestDay = activity.sort((left, right) => Number(right.count) - Number(left.count))[0] || null;
    return { completedCount, typeBreakdown, focusMinutes, bestDay };
  }

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
  }

  function inputField(label, value, options = {}) {
    const wrapper = node("label");
    wrapper.append(node("span", "", label));
    const input = node("input");
    input.value = String(value ?? "");
    Object.entries(options).forEach(([key, option]) => input.setAttribute(key, String(option)));
    wrapper.append(input);
    return { wrapper, input };
  }

  async function saveGoal(data, quest, key, values, status) {
    const primaryGoal = values.primaryGoal.trim().replace(/\s+/g, " ").slice(0, 32);
    if (primaryGoal.length < 2) {
      status.textContent = "请至少写 2 个字";
      return false;
    }
    const previous = parseGoal(quest);
    const recorded = monthFocusAlreadyRecorded(data, key);
    const payload = JSON.stringify({
      g: primaryGoal,
      t: Math.max(1, Math.min(300, Number(values.taskGoalCount) || 20)),
      f: Math.max(30, Math.min(10000, Number(values.focusGoalMinutes) || 600)),
      b: previous?.focusBaseline ?? Math.max(0, (Number(data.user?.focusMinutes) || 0) - recorded),
    });
    status.textContent = "正在保存到云端…";
    try {
      await request(quest
        ? { action: "editQuest", questId: quest.id, title: `${sentinel}${key}`, detail: payload, type: "日常" }
        : { action: "createQuest", title: `${sentinel}${key}`, detail: payload, type: "日常" });
      status.textContent = "本月航向已保存";
      render(true);
      return true;
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "保存失败，请稍后重试";
      return false;
    }
  }

  function openGoalDialog(data, quest, key, goal) {
    document.querySelector(".monthly-compat-backdrop")?.remove();
    const backdrop = node("div", "monthly-compat-backdrop");
    const dialog = node("section", "monthly-compat-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    const close = node("button", "monthly-compat-close", "×");
    close.setAttribute("aria-label", "关闭月目标设置");
    close.onclick = () => backdrop.remove();
    const keyDate = new Date(`${key}-01T12:00:00`);
    const header = node("header");
    header.append(node("span", "monthly-compat-seal", "◇"), node("small", "", "MONTHLY DEPARTURE · 月初定航"), node("h2", "", `写下${keyDate.toLocaleDateString("zh-CN", { month: "long" })}的航向`), node("p", "", "选择一个最重要的目标，再设定任务与专注时长。之后可随时调整。"));
    const goalField = inputField("这个月最想完成什么？", goal?.primaryGoal || "", { maxlength: 32, placeholder: "例如：完成论文初稿" });
    const taskField = inputField("计划完成任务", goal?.taskGoalCount || 20, { type: "number", min: 1, max: 300 });
    const focusField = inputField("计划专注分钟", goal?.focusGoalMinutes || 600, { type: "number", min: 30, max: 10000, step: 30 });
    const metrics = node("div", "monthly-compat-fields");
    metrics.append(taskField.wrapper, focusField.wrapper);
    const status = node("small", "monthly-compat-status", "目标会保存在你的星旅云端账户");
    const save = node("button", "monthly-compat-save", "确认本月航向 →");
    save.onclick = async () => {
      save.disabled = true;
      const saved = await saveGoal(data, quest, key, {
        primaryGoal: goalField.input.value,
        taskGoalCount: taskField.input.value,
        focusGoalMinutes: focusField.input.value,
      }, status);
      save.disabled = false;
      if (saved) window.setTimeout(() => backdrop.remove(), 450);
    };
    dialog.append(close, header, goalField.wrapper, metrics, save, status);
    backdrop.append(dialog);
    backdrop.addEventListener("mousedown", (event) => { if (event.target === backdrop) backdrop.remove(); });
    document.body.append(backdrop);
    goalField.input.focus();
  }

  function buildCard(data, quest, key, goal) {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const isMonthEnd = now.getDate() >= lastDay - 2;
    const result = summary(data, goal, key);
    const card = node("section", `monthly-compat-card${isMonthEnd ? " month-end" : ""}`);
    card.dataset.monthlyCompat = key;
    const heading = node("header");
    const copy = node("div");
    copy.append(node("small", "", isMonthEnd ? "MONTH-END REVIEW · 月末总结" : "MONTHLY VOYAGE · 本月航向"), node("h2", "", `${now.toLocaleDateString("zh-CN", { month: "long" })}${isMonthEnd ? "航行总结" : "进度"}`), node("p", "", goal?.primaryGoal || "设定本月最重要的一件事，让每天的行动朝同一方向累积。"));
    const edit = node("button", "", goal ? "调整目标" : "填写月目标");
    edit.onclick = () => openGoalDialog(data, quest, key, goal);
    heading.append(copy, edit);
    card.append(heading);
    if (goal) {
      const stats = node("div", "monthly-compat-stats");
      [
        [result.completedCount, "完成任务", `${Math.min(100, Math.round(result.completedCount / goal.taskGoalCount * 100))}% 月目标`],
        [`${Math.round(result.focusMinutes / 6) / 10}`, "专注小时", `${Math.min(100, Math.round(result.focusMinutes / goal.focusGoalMinutes * 100))}% 月目标`],
        [result.bestDay?.count || 0, "单日最佳", result.bestDay?.date || "等待首次完成"],
      ].forEach(([value, label, note]) => {
        const item = node("div");
        item.append(node("strong", "", String(value)), node("span", "", String(label)), node("small", "", String(note)));
        stats.append(item);
      });
      const types = node("div", "monthly-compat-types");
      result.typeBreakdown.forEach((item) => types.append(node("span", `type-${item.type}`, `${item.type}　${item.count} 项`)));
      card.append(stats, types);
    }
    return card;
  }

  function hideStorageQuest() {
    document.querySelectorAll(".quest").forEach((quest) => {
      if ((quest.textContent || "").includes(sentinel)) quest.style.display = "none";
    });
  }

  async function render(force = false) {
    hideStorageQuest();
    if (loading) return;
    const anchor = document.querySelector(".weekly-voyage-report, .habit-hub, .camp-bottom-grid");
    if (!anchor) return;
    const key = monthKey(new Date());
    const existing = document.querySelector(".monthly-compat-card");
    if (existing && !force && existing.dataset.monthlyCompat === key) return;
    loading = true;
    try {
      if (force) cachedData = null;
      const data = await loadData();
      if (data.monthlyReview) return;
      const quest = goalQuest(data, key);
      const goal = parseGoal(quest);
      existing?.remove();
      anchor.before(buildCard(data, quest, key, goal));
      const promptKey = `starcamp-monthly-goal-skip:${key}`;
      if (!goal && new Date().getDate() <= 5 && !sessionStorage.getItem(promptKey) && !document.querySelector(".monthly-compat-backdrop")) {
        openGoalDialog(data, quest, key, goal);
        const close = document.querySelector(".monthly-compat-close");
        close?.addEventListener("click", () => sessionStorage.setItem(promptKey, "1"), { once: true });
      }
      hideStorageQuest();
    } catch {
      // Keep the existing journey usable if the optional monthly summary cannot load.
    } finally {
      loading = false;
    }
  }

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      void render();
    });
  };
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  schedule();
})();
