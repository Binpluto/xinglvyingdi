(() => {
  const levels = ["red", "orange", "green-soft", "green", "green-deep"];

  function energyState(score) {
    if (score >= 120) return { tone: "green-deep", label: "深绿巅峰" };
    if (score >= 90) return { tone: "green", label: "能量充盈" };
    if (score >= 60) return { tone: "green-soft", label: "状态良好" };
    if (score >= 30) return { tone: "orange", label: "逐渐升温" };
    return { tone: "red", label: "等待点亮" };
  }

  function sourceScore(card) {
    return [...card.querySelectorAll(".energy-sources em")].reduce((total, element) => {
      const points = Number((element.textContent || "").replace(/[^0-9.-]/g, ""));
      return total + (Number.isFinite(points) ? points : 0);
    }, 0);
  }

  function upgradeEnergyBar() {
    const card = document.querySelector(".camp-weather");
    const meter = card?.querySelector(".energy-ring");
    if (!card || !meter) return;
    const score = sourceScore(card);
    const progress = Math.min(100, Math.round(score / 150 * 100));
    const state = energyState(score);
    const scoreText = meter.querySelector("strong");
    const labelText = meter.querySelector("small");

    meter.classList.add("energy-bar-live");
    meter.style.setProperty("--energy-progress", `${progress}%`);
    meter.setAttribute("role", "progressbar");
    meter.setAttribute("aria-label", `今日能量 ${score} 分，${state.label}`);
    meter.setAttribute("aria-valuemin", "0");
    meter.setAttribute("aria-valuemax", "150");
    meter.setAttribute("aria-valuenow", String(Math.min(score, 150)));
    if (scoreText && scoreText.textContent !== String(score)) scoreText.textContent = String(score);
    if (labelText && labelText.textContent !== state.label) labelText.textContent = state.label;
    card.classList.remove(...levels.map((level) => `energy-${level}`));
    card.classList.add(`energy-${state.tone}`);
  }

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      upgradeEnergyBar();
    });
  };
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  schedule();
})();
