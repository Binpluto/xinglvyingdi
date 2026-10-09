(() => {
  let checking = false;
  let nextTimer = 0;

  function localDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function isMobileDevice() {
    return window.matchMedia("(max-width: 980px), (pointer: coarse)").matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function dismiss(storageKey) {
    window.localStorage.setItem(storageKey, "seen");
    document.querySelector(".mobile-compat-reminder-backdrop")?.remove();
  }

  async function enableNotifications(status) {
    if (!("Notification" in window)) {
      status.textContent = "当前浏览器不支持系统通知，站内提醒仍会正常显示。";
      return;
    }
    const permission = await Notification.requestPermission();
    status.textContent = permission === "granted"
      ? "手机系统通知已开启。"
      : "系统通知未开启；打开星旅营地时仍会显示站内提醒。";
  }

  function showDialog(storageKey) {
    if (document.querySelector(".mobile-start-reminder-backdrop, .mobile-compat-reminder-backdrop")) return;
    const backdrop = element("div", "mobile-compat-reminder-backdrop");
    const dialog = element("section", "mobile-compat-reminder");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "mobile-compat-reminder-title");
    const close = element("button", "mobile-compat-reminder-close", "×");
    close.setAttribute("aria-label", "关闭今日启程提醒");
    close.onclick = () => dismiss(storageKey);
    const sun = element("div", "mobile-compat-reminder-sun");
    sun.append(element("span", "", "☼"), element("i"));
    const label = element("small", "", "LOCAL 10:00 · 每日启程");
    const title = element("h2", "", "早上好，今天的冒险可以开始了");
    title.id = "mobile-compat-reminder-title";
    const copy = element("p", "", "用 20 秒选定今日主线，再完成一个最小行动。星光会从第一步开始累积。");
    const actions = element("div", "mobile-compat-reminder-actions");
    const later = element("button", "secondary", "今天不再提醒");
    later.onclick = () => dismiss(storageKey);
    const start = element("button", "", "开始今日冒险 →");
    start.onclick = () => {
      dismiss(storageKey);
      const goal = document.querySelector(".daily-departure-card input");
      goal?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => goal?.focus(), 350);
    };
    actions.append(later, start);
    const status = element("small", "mobile-compat-reminder-status", "");
    if (!("Notification" in window) || Notification.permission !== "granted") {
      const permission = element("button", "mobile-compat-reminder-permission", "允许手机系统通知");
      permission.onclick = () => void enableNotifications(status);
      dialog.append(close, sun, label, title, copy, actions, permission, status);
    } else {
      dialog.append(close, sun, label, title, copy, actions, status);
    }
    backdrop.append(dialog);
    backdrop.addEventListener("mousedown", (event) => { if (event.target === backdrop) dismiss(storageKey); });
    document.body.append(backdrop);
  }

  async function sendSystemReminder(storageKey, today) {
    try {
      const registration = await navigator.serviceWorker?.ready;
      const options = {
        body: "用 20 秒选定今日主线，让今天的第一步真正开始。",
        icon: "/app-icon-192.png",
        badge: "/app-icon-192.png",
        tag: `starcamp-10am-${today}`,
        data: { url: "/" },
      };
      if (registration) await registration.showNotification("星旅营地 · 10点启程", options);
      else new Notification("星旅营地 · 10点启程", options);
      window.localStorage.setItem(storageKey, "notified");
    } catch {
      showDialog(storageKey);
    }
  }

  async function checkReminder() {
    window.clearTimeout(nextTimer);
    if (checking || !isMobileDevice() || !document.querySelector(".app-shell, .daily-departure-page")) return;
    const now = new Date();
    const minuteNow = now.getHours() * 60 + now.getMinutes();
    if (minuteNow < 600) {
      nextTimer = window.setTimeout(() => void checkReminder(), Math.max(1000, (600 - minuteNow) * 60000 - now.getSeconds() * 1000));
      return;
    }
    checking = true;
    try {
      const today = localDateKey(now);
      const response = await fetch(`/api/game?clientDate=${today}`, { credentials: "same-origin" });
      if (!response.ok) return;
      const data = await response.json();
      if (data.monthlyReview || data.dailyDeparture) return;
      const storageKey = `starcamp-mobile-10am:${data.user?.email || "traveler"}:${today}`;
      if (window.localStorage.getItem(storageKey)) return;
      if (document.visibilityState === "hidden" && "Notification" in window && Notification.permission === "granted") {
        await sendSystemReminder(storageKey, today);
      } else {
        showDialog(storageKey);
      }
    } catch {
      // Keep the main journey usable when an optional reminder check fails.
    } finally {
      checking = false;
    }
  }

  let mutationTimer = 0;
  new MutationObserver(() => {
    window.clearTimeout(mutationTimer);
    mutationTimer = window.setTimeout(() => void checkReminder(), 650);
  }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void checkReminder(); });
  window.setTimeout(() => void checkReminder(), 800);
})();
