(() => {
  const rarityMeta = {
    bronze: ["青铜", "✦"],
    silver: ["白银", "✦✦"],
    epic: ["史诗", "✦✦✦"],
    legendary: ["传说", "✦✦✦✦"],
  };
  const categories = ["全部", "任务", "专注", "同行", "世界", "成长", "收藏"];

  function localDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function activityStreak(activity) {
    const active = new Set((activity || []).filter((day) => day.count > 0).map((day) => day.date));
    const cursor = new Date();
    if (!active.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    let streak = 0;
    while (active.has(localDateKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function medal(icon, name, story, category, rarity, current, target, unit) {
    const safeCurrent = Math.max(0, Number(current) || 0);
    return { icon, name, story, category, rarity, current: safeCurrent, target, unit,
      unlocked: safeCurrent >= target, progress: Math.min(100, Math.round(safeCurrent / target * 100)) };
  }

  function medals(data) {
    const activity = data.questActivity || [];
    const questTotal = Number(data.questCompletionTotal) || 0;
    const focus = Number(data.user?.focusMinutes) || 0;
    const referrals = Number(data.user?.referralCount) || 0;
    const level = Math.floor((Number(data.user?.xp) || 0) / 100) + 1;
    const bestDay = Math.max(0, ...activity.map((day) => Number(day.count) || 0));
    const activeDays = activity.filter((day) => day.count > 0).length;
    const realms = data.realmProgress || [];
    const unlockedRealms = Math.max(1, realms.filter((realm) => realm.unlocked).length);
    const completedRegions = realms.reduce((total, realm) => total + (Number(realm.completedRegions) || 0), 0);
    const teamMembers = Number(data.team?.member_count) || 0;
    return [
      medal("✦","初见之章","第一份完成，让沉睡的星图亮起。","任务","bronze",questTotal,1,"项任务"),
      medal("⚔","委托猎手","在营地告示板留下十次可靠回应。","任务","bronze",questTotal,10,"项任务"),
      medal("♜","百战手册","五十次行动被写进旅行者手册。","任务","silver",questTotal,50,"项任务"),
      medal("⌘","星图编年史","百次完成汇聚成一部属于你的史诗。","任务","epic",questTotal,100,"项任务"),
      medal("✧","三星同耀","一天点亮三颗任务星，营火格外明亮。","任务","silver",bestDay,3,"项/单日"),
      medal("☄","七曜不断","连续七天留下足迹，让航线不再中断。","任务","epic",activityStreak(activity),7,"天连续"),
      medal("▦","足迹收藏家","认真生活的日期，已经铺满一段星路。","任务","silver",activeDays,30,"个活跃日"),
      medal("◷","静心之证","在六十分钟的安静里听见内心。","专注","bronze",focus,60,"分钟"),
      medal("⌛","深潜者","穿过五小时无声海域，带回专注宝藏。","专注","silver",focus,300,"分钟"),
      medal("◇","时间铸匠","把一千分钟锻造成真正可见的实力。","专注","epic",focus,1000,"分钟"),
      medal("♢","万籁宗师","三千分钟心无旁骛，世界为你暂时安静。","专注","legendary",focus,3000,"分钟"),
      medal("♙","同行契约","不再独行，与伙伴共享第一簇营火。","同行","bronze",data.team ? 1 : 0,1,"个小组"),
      medal("♟","五曜结阵","五位旅行者集结，组成完整远征小队。","同行","epic",teamMembers,5,"位成员"),
      medal("☼","引路星辉","为一位新旅行者指出营地的方向。","同行","bronze",referrals,1,"位好友"),
      medal("♧","灯塔守望者","三位同行者循着你的灯塔抵达。","同行","silver",referrals,3,"位好友"),
      medal("♛","星门领航员","十位旅行者因你相遇，星门为此长明。","同行","legendary",referrals,10,"位好友"),
      medal("☀","曦华初醒","踏上初始大陆，晨光正式照进旅程。","世界","bronze",unlockedRealms,1,"座大陆"),
      medal("≈","跨海旅人","越过第一片海，见到另一种大陆色彩。","世界","silver",unlockedRealms,2,"座大陆"),
      medal("◎","四境巡礼","四方风土已经在你的地图上留下纹章。","世界","epic",unlockedRealms,4,"座大陆"),
      medal("✺","七洲星冠","七座大陆共同承认你的世界旅行者之名。","世界","legendary",unlockedRealms,7,"座大陆"),
      medal("⚑","秘境征服者","通过三处大陆试炼，获得守门者认可。","世界","silver",completedRegions,3,"处试炼"),
      medal("❂","世界之心","完成二十一处大陆试炼，触碰世界核心。","世界","legendary",completedRegions,21,"处试炼"),
      medal("Ⅰ","十阶新星","抵达十级，第一次被群星记住名字。","成长","bronze",level,10,"级"),
      medal("Ⅴ","半百远征","五十级不是中点，而是一段强大证明。","成长","epic",level,50,"级"),
      medal("Ⅹ","百级传说","跨越百级门槛，获得专属远征奖状。","成长","legendary",level,100,"级"),
      medal("▣","星历相连","让现实日程穿过星门，成为每日委托。","收藏","silver",data.calendarConnection?.connected ? 1 : 0,1,"个日历"),
      medal("◈","心愿收藏家","把四种奖励装进行囊，认真犒赏自己。","收藏","epic",(data.inventory || []).length,4,"种奖励"),
    ];
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function renderMedalGrid(grid, collection, filter) {
    grid.replaceChildren();
    collection.filter((item) => filter === "全部" || item.category === filter).forEach((item) => {
      const article = element("article", `${item.unlocked ? "unlocked" : "locked"} rarity-${item.rarity}`);
      const face = element("div", "achievement-medal");
      face.append(element("span", "", item.icon), element("i", "", rarityMeta[item.rarity][1]));
      const copy = element("div", "achievement-copy");
      const labels = element("div");
      labels.append(element("em", "", item.category), element("small", "", rarityMeta[item.rarity][0]));
      const progress = element("div", "achievement-progress");
      const rail = element("span");
      const fill = element("i");
      fill.style.width = `${item.progress}%`;
      rail.append(fill);
      progress.append(rail, element("small", "", item.unlocked ? "已获得" : `${item.current}/${item.target} ${item.unit}`));
      copy.append(labels, element("b", "", item.name), element("p", "", item.story), progress);
      article.append(face, copy);
      grid.append(article);
    });
  }

  async function upgrade(card) {
    if (!card || card.dataset.medalLoading || card.querySelector(".achievement-grid.enriched")) return;
    card.dataset.medalLoading = "1";
    try {
      const response = await fetch(`/api/game?clientDate=${localDateKey(new Date())}`, { credentials: "same-origin" });
      if (!response.ok) return;
      const data = await response.json();
      const collection = medals(data);
      const unlocked = collection.filter((item) => item.unlocked);
      const next = collection.filter((item) => !item.unlocked).sort((a, b) => b.progress - a.progress || a.target - b.target)[0];
      const heading = card.querySelector(".card-heading");
      const headingSmall = heading?.querySelector("small");
      const headingTitle = heading?.querySelector("h3");
      const headingCount = heading?.querySelector("b");
      if (headingSmall) headingSmall.textContent = "星旅成就 · 自动记录";
      if (headingTitle) headingTitle.textContent = "冒险勋章册";
      if (headingCount) headingCount.textContent = `${unlocked.length}/${collection.length} 已解锁`;

      const overview = element("div", "achievement-overview");
      [["✦", unlocked.length, "已获得勋章"], ["♛", unlocked.filter((item) => item.rarity === "legendary").length, "传说勋章"]].forEach(([icon, value, label]) => {
        const stat = element("div");
        stat.append(element("span", "", String(icon)), element("strong", "", String(value)), element("small", "", String(label)));
        overview.append(stat);
      });
      const nextCard = element("div", `next-achievement${next ? "" : " complete"}`);
      nextCard.append(element("span", "", next?.icon || "✺"));
      const nextCopy = element("div");
      nextCopy.append(element("small", "", next ? "下一枚最接近" : "群星全数点亮"), element("b", "", next?.name || "勋章大师"), element("em", "", next ? `${next.current}/${next.target} ${next.unit}` : "全部冒险勋章已获得"));
      nextCard.append(nextCopy);
      if (next) {
        const rail = element("i");
        const fill = element("u");
        fill.style.width = `${next.progress}%`;
        rail.append(fill);
        nextCard.append(rail);
      }
      overview.append(nextCard);

      const filters = element("div", "achievement-filters");
      filters.setAttribute("aria-label", "勋章分类");
      const grid = element("div", "achievement-grid enriched");
      categories.forEach((category) => {
        const count = category === "全部" ? collection.length : collection.filter((item) => item.category === category).length;
        const button = element("button", category === "全部" ? "active" : "", category);
        button.append(element("small", "", String(count)));
        button.addEventListener("click", () => {
          filters.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
          renderMedalGrid(grid, collection, category);
        });
        filters.append(button);
      });
      renderMedalGrid(grid, collection, "全部");
      card.querySelector(".achievement-grid")?.remove();
      const archive = card.querySelector(".honor-certificate-archive");
      if (archive) archive.before(overview, filters, grid);
      else card.append(overview, filters, grid);
      card.dataset.medalUpgraded = "1";
    } catch (_) {
      card.dataset.medalLoading = "";
    }
  }

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      upgrade(document.querySelector(".achievement-card"));
    });
  }
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  schedule();
})();
