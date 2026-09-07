(() => {
  function localDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function dateLabel(date) {
    return new Date(`${date}T12:00:00`).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
  }

  function dismiss(key) {
    window.localStorage.setItem(key, "seen");
    document.querySelector(".sunday-compat-backdrop")?.remove();
  }

  function show(report, key) {
    if (document.querySelector(".sunday-summary-backdrop, .sunday-compat-backdrop")) return;
    const topType = [...(report.typeBreakdown || [])].sort((left, right) => Number(right.count) - Number(left.count))[0];
    const backdrop = element("div", "sunday-compat-backdrop");
    const dialog = element("section", "sunday-compat-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "sunday-compat-title");
    const close = element("button", "sunday-compat-close", "×");
    close.setAttribute("aria-label", "关闭本周小结");
    close.onclick = () => dismiss(key);
    const header = element("header");
    header.append(
      element("span", "sunday-compat-seal", "✦"),
      element("small", "", "SUNDAY CAMPFIRE · 周日小结"),
      element("h2", "", "这一周，你留下了这些星光"),
      element("p", "", `${dateLabel(report.startDate)} — ${dateLabel(report.endDate)}`),
    );
    header.querySelector("h2").id = "sunday-compat-title";
    const stats = element("div", "sunday-compat-stats");
    [
      [report.completedCount || 0, "完成任务"],
      [report.actualFocusMinutes || 0, "专注分钟"],
      [topType?.type || "待启程", "最常完成"],
    ].forEach(([value, label]) => {
      const item = element("div");
      item.append(element("strong", "", String(value)), element("span", "", String(label)));
      stats.append(item);
    });
    const highlight = element("article", "sunday-compat-highlight");
    highlight.append(element("span", "", "◇"));
    const highlightCopy = element("div");
    highlightCopy.append(element("small", "", "本周闪光"), element("b", "", report.highlight?.title || "你仍在为自己的航向积蓄力量"));
    highlight.append(highlightCopy);
    const next = element("article", "sunday-compat-next");
    // Keep the recommendation singular so the weekly reflection stays small and actionable.
    next.append(element("small", "", "下周只记住这一件事"), element("p", "", report.recommendations?.prioritize || "从最重要的一项任务开始，为它留出一段完整专注时间。"));
    const footer = element("footer");
    const full = element("button", "secondary", "查看完整周报");
    full.onclick = () => {
      dismiss(key);
      document.getElementById("weekly-report-title")?.scrollIntoView({ behavior: "smooth" });
    };
    const done = element("button", "", "收下小结 · 继续出发");
    done.onclick = () => dismiss(key);
    footer.append(full, done);
    dialog.append(close, header, stats, highlight, next, footer);
    backdrop.append(dialog);
    backdrop.addEventListener("mousedown", (event) => { if (event.target === backdrop) dismiss(key); });
    document.body.append(backdrop);
  }

  async function start() {
    if (new Date().getDay() !== 0 || !document.querySelector(".app-shell")) return;
    const today = localDateKey(new Date());
    try {
      const response = await fetch(`/api/game?clientDate=${today}`, { credentials: "same-origin" });
      if (!response.ok) return;
      const data = await response.json();
      if (data.monthlyReview) return;
      const key = `starcamp-sunday-summary:${data.user?.email || "traveler"}:${today}`;
      if (!window.localStorage.getItem(key)) show(data.weeklyReport || {}, key);
    } catch {
      // The weekly summary is optional; never interrupt the main journey on a network error.
    }
  }

  let timer = 0;
  new MutationObserver(() => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void start(), 600);
  }).observe(document.documentElement, { childList: true, subtree: true });
  window.setTimeout(() => void start(), 700);
})();
