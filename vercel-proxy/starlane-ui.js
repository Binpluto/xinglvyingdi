import { availableTasks, taskSlot, downloadTimeline, dateRange, filterRange, shiftCalendarDate } from './starlane-data.mjs?v=3';

(() => {
  const BLOCK_PREFIX = "▥时轨|";
  const CATEGORY_PREFIX = "▥分类|";
  const types = ["主线", "支线", "日常"];
  const colors = [
    ["jade", "翡翠", "#3f8d7a"], ["gold", "星金", "#d09c3f"], ["azure", "晴蓝", "#4e86bd"], ["coral", "珊瑚", "#d97862"],
    ["violet", "暮紫", "#8068b2"], ["rose", "蔷薇", "#bd6588"], ["amber", "琥珀", "#bf7637"], ["slate", "夜灰", "#607680"],
  ];
  const defaults = {
    主线: [["核心项目", "gold"], ["学习攻关", "amber"], ["关键交付", "coral"]],
    支线: [["创作", "violet"], ["运动", "azure"], ["关系", "rose"]],
    日常: [["生活整理", "jade"], ["通勤", "slate"], ["休息", "azure"]],
  };
  let data = null;
  let pageOpen = false;
  let selectedDate = localDateKey(new Date());
  let granularity = 15;
  let selectedTask = null;
  let viewMode = 'day';

  function localDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  function shiftDate(date, days) {
    const value = new Date(`${date}T12:00:00`);
    value.setDate(value.getDate() + days);
    return localDateKey(value);
  }
  function minuteLabel(total) {
    const minute = Math.max(0, Math.min(1440, total));
    return `${String(Math.floor(minute / 60) % 24).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
  }
  function inputTime(total) {
    return total >= 1440 ? "23:59" : minuteLabel(total);
  }
  function parseTime(value) {
    const [hour, minute] = value.split(":").map(Number);
    return Math.max(0, Math.min(1440, hour * 60 + minute));
  }
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function hideStorageQuests() {
    document.querySelectorAll(".quest").forEach((quest) => {
      const text = quest.textContent || "";
      if (text.includes("▥时轨") || text.includes("▥分类")) quest.style.display = "none";
    });
  }
  async function fetchData() {
    const response = await fetch(`/api/game?clientDate=${localDateKey(new Date())}`, { credentials: "same-origin" });
    if (!response.ok) throw new Error("星轨数据读取失败");
    data = await response.json();
    return data;
  }
  async function api(payload) {
    const response = await fetch("/api/game", {
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, clientDate: localDateKey(new Date()) }),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || "保存失败");
    data = json;
    hideStorageQuests();
    return json;
  }
  function parseBlocks() {
    return (data?.quests || []).filter((quest) => String(quest.title).startsWith(BLOCK_PREFIX)).map((quest) => {
      const [, date, start, end] = String(quest.title).split("|");
      try {
        const detail = JSON.parse(quest.detail || "{}");
        return { id: quest.id, date, start: Number(start), end: Number(end), title: detail.t || "未命名", type: types.includes(detail.m) ? detail.m : "日常", category: detail.c || "未分类", color: colors.some(([key]) => key === detail.k) ? detail.k : "jade", note: detail.n || "" };
      } catch { return null; }
    }).filter(Boolean);
  }
  function parseCategories(type) {
    const custom = (data?.quests || []).filter((quest) => String(quest.title).startsWith(`${CATEGORY_PREFIX}${type}|`)).map((quest) => {
      const name = String(quest.title).split("|").slice(2).join("|");
      let color = "jade";
      try { color = JSON.parse(quest.detail || "{}").k || color; } catch {}
      return { id: quest.id, name, color, custom: true };
    });
    return [...defaults[type].map(([name, color]) => ({ name, color, custom: false })), ...custom];
  }
  function payloadFor(block) {
    return JSON.stringify({ t: block.title.trim().slice(0, 24), m: block.type, c: block.category.slice(0, 12), k: block.color, n: block.note.trim().slice(0, 24) });
  }
  function storageTitle(block) {
    return `${BLOCK_PREFIX}${block.date}|${block.start}|${block.end}`;
  }
  function notify(message) {
    document.querySelector(".starlane-compat-toast")?.remove();
    const toast = el("div", "starlane-compat-toast", `✦ ${message}`);
    document.body.append(toast);
    setTimeout(() => toast.remove(), 2600);
  }
  function overlaps(block, excludeId) {
    return parseBlocks().some((item) => item.date === block.date && item.id !== excludeId && item.start < block.end && item.end > block.start);
  }
  async function saveBlock(block) {
    if (!block.title.trim()) throw new Error("请填写时间块名称");
    if (block.end - block.start < 10) throw new Error("时间块至少需要 10 分钟");
    if (overlaps(block, block.id)) throw new Error("这段时间已有安排，请调整时间");
    const common = { title: storageTitle(block), detail: payloadFor(block), type: block.type };
    await api(block.id ? { action: "editQuest", questId: block.id, ...common } : { action: "createQuest", ...common });
    notify(block.id ? "时间块已更新" : "新的时间块已写入星轨");
    renderPage();
  }
  async function deleteBlock(id) {
    await api({ action: "deleteQuest", questId: id });
    notify("时间块已删除");
    renderPage();
  }
  function closePage() {
    pageOpen = false;
    document.querySelector(".starlane-compat-page")?.remove();
    document.querySelectorAll(".main-content > [data-starlane-hidden]").forEach((node) => { node.hidden = false; node.removeAttribute("data-starlane-hidden"); });
    document.querySelector(".starlane-nav")?.classList.remove("active");
  }
  async function openPage() {
    if (pageOpen) return;
    try {
      const current = await fetchData();
      if (current.timeTrack) return;
      pageOpen = true;
      const main = document.querySelector(".main-content");
      if (!main) return;
      [...main.children].forEach((child) => { child.hidden = true; child.setAttribute("data-starlane-hidden", "1"); });
      main.append(el("section", "starlane-compat-page"));
      document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.classList.contains("starlane-nav")));
      renderPage();
    } catch (error) { notify(error instanceof Error ? error.message : "暂时无法打开星轨"); }
  }
  function ensureNav() {
    hideStorageQuests();
    const nav = document.querySelector(".nav-stack");
    if (!nav || [...nav.querySelectorAll(".nav-item small")].some((item) => item.textContent === "时轨")) return;
    const button = el("button", "nav-item starlane-nav");
    button.append(el("span", "", "▥"), el("small", "", "时轨"));
    button.onclick = () => void openPage();
    nav.insertBefore(button, nav.children[2] || null);
    nav.querySelectorAll(".nav-item:not(.starlane-nav)").forEach((item) => {
      if (item.dataset.starlaneBound) return;
      item.dataset.starlaneBound = "1";
      item.addEventListener("click", closePage, true);
    });
  }
  function renderPage() {
    const page = document.querySelector(".starlane-compat-page");
    if (!page || !data) return;
    page.replaceChildren();
    const range = dateRange(selectedDate, viewMode);
    const blocks = filterRange(parseBlocks(), range.start, range.end).sort((a, b) => a.date.localeCompare(b.date) || a.start-b.start);
    const header = el("header", "starlane-compat-header");
    const copy = el("div");
    copy.append(el("small", "", "STELLAR TIME MAP · 星轨时序"), el("h2", "", "把一天，铺成看得见的星轨"), el("p", "", "拖拽空白轨道创建时间块；拖动色块调整时间，底部把手改变时长。"));
    const dateNav = el("div", "starlane-compat-date");
    const prev = el("button", "", "‹"); prev.setAttribute('aria-label',viewMode==='week'?'上一周':'前一天'); prev.onclick = () => { selectedDate = shiftDate(selectedDate, viewMode==='week'?-7:-1); renderPage(); };
    const dateInput = el("input"); dateInput.type = "date"; dateInput.value = selectedDate; dateInput.onchange = () => { selectedDate = dateInput.value; renderPage(); };
    const next = el("button", "", "›"); next.setAttribute('aria-label',viewMode==='week'?'下一周':'后一天'); next.onclick = () => { selectedDate = shiftDate(selectedDate, viewMode==='week'?7:1); renderPage(); };
    const today = el("button", "today", "今天"); today.disabled = selectedDate === localDateKey(new Date()); today.onclick = () => { selectedDate = localDateKey(new Date()); renderPage(); };
    dateNav.append(prev, dateInput, next, today); header.append(copy, dateNav);
    const summary = el("div", "starlane-compat-summary");
    types.forEach((type) => {
      const minutes = blocks.filter((block) => block.type === type).reduce((sum, block) => sum + block.end - block.start, 0);
      const card = el("div", `summary-${type}`); card.append(el("span", "", type), el("b", "", `${Math.floor(minutes / 60)}h ${minutes % 60}m`)); summary.append(card);
    });
    const total = blocks.reduce((sum, block) => sum + block.end - block.start, 0);
    const totalCard = el("div", "summary-total"); totalCard.append(el("span", "", "已记录"), el("b", "", `${total} min`)); summary.append(totalCard);
    const toolbar = el("div", "starlane-compat-toolbar");
    const views = el('div','starlane-view-switch');
    [['day','日视图'],['week','周视图']].forEach(([mode,label])=>{const button=el('button',viewMode===mode?'active':'',label);button.setAttribute('aria-pressed',String(viewMode===mode));button.onclick=()=>{viewMode=mode;renderPage();};views.append(button);});
    toolbar.append(views);
    const steps = el("div"); steps.append(el("span", "", "时间刻度"));
    [10, 15, 30].forEach((step) => { const button = el("button", granularity === step ? "active" : "", `${step} min`); button.onclick = () => { granularity = step; renderPage(); }; steps.append(button); });
    const manual = el("button", "manual", "＋ 手动填写"); manual.onclick = () => openEditor({ date: selectedDate, start: 540, end: 600, title: "", type: "主线", category: "核心项目", color: "gold", note: "" });
    toolbar.append(steps, manual);
    const exportButton=el('button','','导出日程'); exportButton.onclick=openExportPanel; toolbar.append(exportButton);
    const layout = el("div", "starlane-compat-layout");
    const timelinePanel = el("section", "starlane-compat-timeline-panel");
    timelinePanel.append(el("div", "starlane-compat-legend", viewMode==='week' ? `${range.start} — ${range.end} · 周一至周日（手机可左右滑动）` : "拖拽空白区域，快速记录一段时间"));
    const scroll = el("div", "starlane-compat-scroll");
    const slotHeight = 18, height = 1440 / granularity * slotHeight;
    const labels = el("div", "starlane-compat-hours"); labels.style.height = `${height}px`;
    for (let hour = 0; hour <= 24; hour += 1) { const label = el("span", "", `${String(hour).padStart(2, "0")}:00`); label.style.top = `${hour / 24 * height}px`; labels.append(label); }
    const days=viewMode==='week'?Array.from({length:7},(_,i)=>shiftCalendarDate(range.start,i)):[selectedDate];
    const lanes=el('div',viewMode==='week'?'starlane-week-lanes':'starlane-day-lanes');
    if(viewMode==='week') scroll.classList.add('starlane-week-scroll');
    days.forEach(day=>{
      const column=el('div','starlane-day-column');
      if(viewMode==='week'){
        const heading=el('button','starlane-day-heading',`${['周日','周一','周二','周三','周四','周五','周六'][new Date(day+'T12:00:00Z').getUTCDay()]} ${day.slice(5)}`);
        heading.onclick=()=>{selectedDate=day;viewMode='day';renderPage();}; column.append(heading);
      }
      const grid = el("div", "starlane-compat-grid"); grid.dataset.date=day;
      grid.setAttribute('aria-label',day+' 时间轴');
      grid.style.height = `${height}px`; grid.style.setProperty("--slot-height", `${slotHeight}px`);
      grid.ondragover = event => { if (event.dataTransfer.types.includes('application/x-starcamp-task')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } };
      grid.ondrop = event => {
        event.preventDefault();
        const task = availableTasks(data.quests || []).find(q => q.id === Number(event.dataTransfer.getData('application/x-starcamp-task')));
        if (task) placeTask(task, minuteAt(event, grid, slotHeight), day);
      };
      if (day === localDateKey(new Date())) { const line = el("i", "starlane-compat-now"); line.style.top = `${(new Date().getHours() * 60 + new Date().getMinutes()) / granularity * slotHeight}px`; grid.append(line); }
      blocks.filter(b=>b.date===day).forEach(block=>grid.append(renderBlock(block,slotHeight)));
      bindCreateDrag(grid, slotHeight, day); column.append(grid); lanes.append(column);
    });
    scroll.append(labels, lanes); timelinePanel.append(scroll);
    const sidebar = el('div', 'starlane-task-sidebar');
    sidebar.append(renderTaskTray(), renderCategories());
    layout.append(timelinePanel, sidebar);
    page.append(header, summary, toolbar, layout);
    requestAnimationFrame(() => { scroll.scrollTop = Math.max(0, 360 / granularity * slotHeight - 20); });
  }
  function minuteAt(event, grid, slotHeight) {
    const rect = grid.getBoundingClientRect();
    return Math.max(0, Math.min(1440, Math.round(((event.clientY - rect.top) / slotHeight)) * granularity));
  }
  function bindCreateDrag(grid, slotHeight, day = selectedDate) {
    grid.onpointerdown = (event) => {
      if (event.target.closest(".starlane-compat-block")) return;
      const start = minuteAt(event, grid, slotHeight);
      if (selectedTask) { placeTask(selectedTask, start, day); return; }
      const preview = el("div", "starlane-compat-preview"); grid.append(preview);
      let from = start, to = Math.min(1440, start + granularity);
      const draw = () => { preview.style.top = `${from / granularity * slotHeight + 1}px`; preview.style.height = `${Math.max(22, (to - from) / granularity * slotHeight - 2)}px`; preview.textContent = `${minuteLabel(from)}–${minuteLabel(to)}`; };
      draw();
      const move = (pointer) => { const minute = minuteAt(pointer, grid, slotHeight); from = Math.min(start, minute); to = Math.min(1440, Math.max(start + granularity, minute + granularity)); draw(); };
      const cancel = () => {window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);preview.remove();};
      const up = () => { cancel(); openEditor({ date: day, start: from, end: to, title: "", type: "主线", category: "核心项目", color: "gold", note: "" }); };
      window.addEventListener("pointermove", move); window.addEventListener("pointerup", up, { once: true });window.addEventListener('pointercancel',cancel,{once:true});
    };
  }
  function placeTask(task, minute, day = selectedDate) {
    selectedTask = null;
    const type = types.includes(task.type) ? task.type : '日常';
    const first = defaults[type][0];
    openEditor({ date: day, ...taskSlot(minute, granularity), title: task.title, type, category: first[0], color: first[1], note: '' });
    document.querySelector('.starlane-task-hint')?.replaceChildren(document.createTextNode('拖到轨道，或点选任务后点选时间。保存前可调整时长；不会自动完成原任务。'));
  }
  function renderTaskTray() {
    const tray = el('section', 'starlane-task-tray');
    tray.append(el('h3', '', '任务待排区'), el('p', 'starlane-task-hint', '拖到轨道，或点选任务后点选时间。保存前可调整时长；不会自动完成原任务。'));
    const refresh = el('button', 'refresh', '刷新任务');
    refresh.onclick = async () => { refresh.disabled = true; try { await fetchData(); renderPage(); } catch (error) { notify(error.message); refresh.disabled = false; } };
    tray.append(refresh);
    const list = el('div', 'starlane-task-list'), tasks = availableTasks(data.quests || []);
    if (!tasks.length) list.append(el('p', '', '暂无未完成任务，可先到任务页添加。'));
    tasks.forEach(task => {
      const button = el('button', 'starlane-task-item'); button.draggable = true;
      button.append(el('b', '', task.title), el('small', '', `${task.type} · ${task.dueAt ? task.dueAt.slice(0,10) : '未设日期'}`));
      button.ondragstart = event => { selectedTask = null; event.dataTransfer.setData('application/x-starcamp-task', String(task.id)); event.dataTransfer.effectAllowed = 'copy'; };
      button.onclick = () => {
        selectedTask = task;
        tray.querySelector('.starlane-task-hint').textContent = `已选「${task.title}」，请点击轨道的开始时间。`;
        document.querySelector('.starlane-compat-timeline-panel')?.scrollIntoView({behavior:'smooth',block:'start'});
      };
      list.append(button);
    });
    tray.append(list); return tray;
  }
  function renderBlock(block, slotHeight) {
    const article = el("article", `starlane-compat-block color-${block.color}`);
    article.style.top = `${block.start / granularity * slotHeight + 1}px`; article.style.height = `${Math.max(25, (block.end - block.start) / granularity * slotHeight - 2)}px`;
    const edit = el("button", "", ""); edit.append(el("span", "", `${minuteLabel(block.start)}–${minuteLabel(block.end)}`), el("b", "", block.title), el("small", "", `${block.type} · ${block.category}`));
    edit.onclick = (event) => { event.stopPropagation(); openEditor({ ...block }); };
    const grip = el("u", "drag", "⋮⋮");
    const resize = el("i");
    article.append(grip, edit, resize);
    article.onpointerdown = (event) => {
      if (event.target !== grip) return;
      event.stopPropagation();
      const originY = event.clientY, duration = block.end - block.start; let nextStart = block.start;
      const move = (pointer) => { const delta = Math.round((pointer.clientY - originY) / slotHeight) * granularity; nextStart = Math.max(0, Math.min(1440 - duration, block.start + delta)); article.style.top = `${nextStart / granularity * slotHeight + 1}px`; };
      const up = async () => { window.removeEventListener("pointermove", move); if (nextStart !== block.start) { try { await saveBlock({ ...block, start: nextStart, end: nextStart + duration }); } catch (error) { notify(error.message); renderPage(); } } };
      window.addEventListener("pointermove", move); window.addEventListener("pointerup", up, { once: true });
    };
    resize.onpointerdown = (event) => {
      event.stopPropagation(); let nextEnd = block.end;
      const grid = article.parentElement;
      const move = (pointer) => { nextEnd = Math.max(block.start + granularity, minuteAt(pointer, grid, slotHeight)); article.style.height = `${Math.max(25, (nextEnd - block.start) / granularity * slotHeight - 2)}px`; };
      const up = async () => { window.removeEventListener("pointermove", move); if (nextEnd !== block.end) { try { await saveBlock({ ...block, end: nextEnd }); } catch (error) { notify(error.message); renderPage(); } } };
      window.addEventListener("pointermove", move); window.addEventListener("pointerup", up, { once: true });
    };
    return article;
  }
  function renderCategories() {
    const panel = el("aside", "starlane-compat-categories");
    const heading = el("header"); heading.append(el("div", "", "时间分类"), el("span", "", "8 色")); panel.append(heading);
    types.forEach((type) => {
      const group = el("section"); group.append(el("b", "", type)); const list = el("div");
      parseCategories(type).forEach((category) => { const chip = el("span", `color-${category.color}`); chip.append(el("i"), document.createTextNode(category.name)); if (category.custom) { const remove = el("button", "", "×"); remove.onclick = async () => { try { await api({ action: "deleteQuest", questId: category.id }); renderPage(); } catch (error) { notify(error.message); } }; chip.append(remove); } list.append(chip); });
      group.append(list); panel.append(group);
    });
    const creator = el("div", "starlane-compat-category-create");
    const typeSelect = el("select"); types.forEach((type) => { const option = el("option", "", type); typeSelect.append(option); });
    const name = el("input"); name.placeholder = "新增细分分类"; name.maxLength = 12;
    const palette = el("div", "starlane-compat-mini-colors"); let chosen = "gold";
    colors.forEach(([key, label]) => { const button = el("button", `${key === chosen ? "active " : ""}color-${key}`); button.title = label; button.onclick = () => { chosen = key; palette.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button)); }; palette.append(button); });
    const save = el("button", "save", "保存分类"); save.onclick = async () => { if (name.value.trim().length < 2) return; try { await api({ action: "createQuest", title: `${CATEGORY_PREFIX}${typeSelect.value}|${name.value.trim().slice(0, 12)}`, detail: JSON.stringify({ k: chosen }), type: typeSelect.value }); renderPage(); } catch (error) { notify(error.message); } };
    creator.append(typeSelect, name, palette, save); panel.append(creator); return panel;
  }
  function openExportPanel() {
    const backdrop=el('div','starlane-compat-editor-backdrop'), panel=el('section','starlane-compat-editor');
    panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','导出日程');
    const close=el('button','close','×');close.setAttribute('aria-label','关闭导出');close.onclick=()=>backdrop.remove();
    const heading=el('h3','','导出日程');
    const note=el('p','','周与月以当前选中日期为基准，范围包含起止两天。ICS 使用当地时间。');
    const shortcuts=el('div','starlane-exports');
    const start=el('input'),end=el('input'); start.type=end.type='date';
    const initial=dateRange(selectedDate,viewMode); start.value=initial.start;end.value=initial.end;
    const startLabel=el('label'),endLabel=el('label');startLabel.append(el('span','','开始日期'),start);endLabel.append(el('span','','结束日期'),end);
    const status=el('p','starlane-export-status');status.setAttribute('role','status');
    const actions=el('footer');
    function update(){try{const rows=filterRange(parseBlocks(),start.value,end.value);status.textContent=`${start.value} — ${end.value} · 共 ${rows.length} 个时间块`;actions.querySelectorAll('button').forEach(b=>b.disabled=!rows.length);}catch(error){status.textContent=error.message;actions.querySelectorAll('button').forEach(b=>b.disabled=true);}}
    [['day','当天'],['week','本周'],['month','本月']].forEach(([unit,label])=>{const button=el('button','',label);button.onclick=()=>{const range=dateRange(selectedDate,unit);start.value=range.start;end.value=range.end;update();};shortcuts.append(button);});
    ['csv','ics'].forEach(format=>{const button=el('button','save',`导出 ${format.toUpperCase()}`);button.onclick=async()=>{
      button.disabled=true;status.textContent='正在读取最新记录…';
      try{await fetchData();const rows=filterRange(parseBlocks(),start.value,end.value);if(!rows.length)throw new Error('所选范围暂无时间块');downloadTimeline(rows,format,`${start.value}_${end.value}`);update();}catch(error){status.textContent=error.message;button.disabled=false;}
    };actions.append(button);});
    start.onchange=end.onchange=update;
    panel.append(close,heading,note,shortcuts,startLabel,endLabel,status,actions);backdrop.append(panel);document.body.append(backdrop);update();start.focus();
    backdrop.onmousedown=event=>{if(event.target===backdrop)backdrop.remove();};
  }
  function openEditor(block) {
    document.querySelector(".starlane-compat-editor-backdrop")?.remove();
    const backdrop = el("div", "starlane-compat-editor-backdrop"), dialog = el("section", "starlane-compat-editor");
    const close = el("button", "close", "×"); close.onclick = () => backdrop.remove();
    const header = el("header"); header.append(el("small", "", block.id ? "EDIT TIME BLOCK" : "NEW TIME BLOCK"), el("h3", "", block.id ? "编辑时间块" : "记录这段时间"), el("p", "", block.date));
    const title = el("input"); title.placeholder = "例如：完成产品方案结构"; title.maxLength = 24; title.value = block.title;
    const titleLabel = el("label"); titleLabel.append(el("span", "", "做了什么 / 准备做什么"), title);
    const typeRow = el("div", "starlane-compat-type-row");
    const category = el("select"), colorRow = el("div", "starlane-compat-color-row");
    let currentType = block.type, currentColor = block.color;
    const fillCategories = () => { category.replaceChildren(); parseCategories(currentType).forEach((item) => { const option = el("option", "", item.name); option.value = item.name; category.append(option); }); category.value = block.category; if (!category.value) category.selectedIndex = 0; };
    types.forEach((type) => { const button = el("button", type === currentType ? `active type-${type}` : "", type); button.onclick = () => { currentType = type; typeRow.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button)); fillCategories(); }; typeRow.append(button); });
    fillCategories();
    colors.forEach(([key, label]) => { const button = el("button", `${key === currentColor ? "active " : ""}color-${key}`); button.title = label; button.append(el("i")); button.onclick = () => { currentColor = key; colorRow.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button)); }; colorRow.append(button); });
    const start = el("input"); start.type = "time"; start.step = String(granularity * 60); start.value = inputTime(block.start);
    const end = el("input"); end.type = "time"; end.step = String(granularity * 60); end.value = inputTime(block.end);
    const times = el("div", "starlane-compat-time-row"); const startLabel = el("label"); startLabel.append(el("span", "", "开始"), start); const endLabel = el("label"); endLabel.append(el("span", "", "结束"), end); times.append(startLabel, endLabel);
    const categoryLabel = el("label"); categoryLabel.append(el("span", "", "细分分类"), category);
    const note = el("textarea"); note.placeholder = "记录成果、状态或下一步"; note.maxLength = 24; note.value = block.note || ""; const noteLabel = el("label"); noteLabel.append(el("span", "", "备注（可选）"), note);
    const footer = el("footer"); if (block.id) { const remove = el("button", "delete", "删除"); remove.onclick = async () => { try { await deleteBlock(block.id); backdrop.remove(); } catch (error) { notify(error.message); } }; footer.append(remove); }
    const cancel = el("button", "cancel", "取消"); cancel.onclick = () => backdrop.remove(); const save = el("button", "save", "保存到星轨"); save.onclick = async () => { save.disabled = true; try { await saveBlock({ ...block, title: title.value, type: currentType, category: category.value, color: currentColor, note: note.value, start: parseTime(start.value), end: parseTime(end.value) }); backdrop.remove(); } catch (error) { notify(error.message); save.disabled = false; } }; footer.append(cancel, save);
    const typeField = el("fieldset"); typeField.append(el("legend", "", "所属模块"), typeRow); const colorField = el("fieldset"); colorField.append(el("legend", "", "色块颜色"), colorRow);
    dialog.append(close, header, titleLabel, typeField, times, categoryLabel, colorField, noteLabel, footer); backdrop.append(dialog); backdrop.onmousedown = (event) => { if (event.target === backdrop) backdrop.remove(); }; document.body.append(backdrop); title.focus();
  }
  let queued = false;
  function schedule() {
    if (queued) return; queued = true;
    requestAnimationFrame(() => { queued = false; ensureNav(); });
  }
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  schedule();
})();
