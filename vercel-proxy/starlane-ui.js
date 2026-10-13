import { availableTasks, completedOnDate, taskSlot, downloadAuthorizedTimeline, dateRange, filterRange, shiftCalendarDate, validDate } from './starlane-data.mjs?v=11';
import {hasPaidTools,PREMIUM_MESSAGE} from './premium-policy.mjs?v=4';
import {createVerticalTimeline} from './starlane-timeline.mjs?v=21';
import {sequenceBlocks} from './sequence-records.mjs?v=10';
import {defaultTaskColor,taskTrayStyle} from './sequence-colors.mjs?v=10';
import {overlappingBlocks,overlapKey,overlapMessage} from './overlap-policy.mjs?v=17';

import {sequenceCategories,createCategoryManager} from './sequence-categories.mjs?v=12';

(() => {
  const BLOCK_PREFIX = "▥时轨|";
  const types = ["主线", "支线", "日常"];
  const colors = [
    ["jade", "翡翠", "#3f8d7a"], ["gold", "星金", "#d09c3f"], ["azure", "晴蓝", "#4e86bd"], ["coral", "珊瑚", "#d97862"],
    ["violet", "暮紫", "#8068b2"], ["rose", "蔷薇", "#bd6588"], ["amber", "琥珀", "#bf7637"], ["slate", "夜灰", "#607680"],
  ];
  let data = null;
  let pageOpen = false;
  let selectedDate = localDateKey(new Date());
  let enteredOn = selectedDate;
  let granularity = 15;
  let selectedTask = null;
  let viewMode = 'day';
  let pageElement = null;
  let opening = false;
  let navigationVersion = 0;
  const hiddenNodes = new Map();
  const scrollPositions = new Map();
  let disposeTimeline=null;
  let hostNeedsRefresh=false;
  let dataAt=0,fetchingData=null,savingSequence=false;
  const pendingDeletedBlocks=new Set();
  const pendingQuestEdits=new Map();
  function visibleQuests(){return (data?.quests||[]).map(q=>{const edit=pendingQuestEdits.get(q.id);return edit?{...q,title:edit.payload.title,detail:edit.payload.detail,type:edit.payload.type}:q;});}
  function repaintPending(){if(pageOpen&&!document.querySelector('.starlane-compat-editor-backdrop'))renderPage();}
  window.addEventListener('starcamp:quest-edit-pending',event=>{const {payload,previous,token}=event.detail;if(!data&&previous)data=previous;pendingQuestEdits.set(payload.questId,{payload,token});repaintPending();});
  window.addEventListener('starcamp:quest-edit-settled',event=>{const {questId,token}=event.detail;if(pendingQuestEdits.get(questId)?.token!==token)return;pendingQuestEdits.delete(questId);repaintPending();});
  window.addEventListener('starcamp:session-reset',()=>{pendingQuestEdits.clear();data=null;dataAt=0;if(pageOpen||opening)closePage();});
  window.addEventListener('starcamp:data-invalidated',()=>{dataAt=0;});
  window.addEventListener('starcamp:game-data',event=>{if(event.detail?.user&&Array.isArray(event.detail.quests)){data=event.detail;dataAt=Date.now();}});

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
  async function fetchData(force=false) {
    if(!force&&pendingQuestEdits.size&&data)return data;
    if(!force){const shared=window.starcampTransport?.peek();if(shared){data=shared;dataAt=Date.now();return data;}if(data&&Date.now()-dataAt<8000)return data;}
    if(fetchingData)return fetchingData;
    fetchingData=(async()=>{const response = await fetch(`/api/game?clientDate=${localDateKey(new Date())}`, { credentials: "same-origin",...(force?{cache:'no-store'}:{}) });
      if (!response.ok) throw new Error("时序数据读取失败");
      data = await response.json();dataAt=Date.now();return data;})();
    try{return await fetchingData;}finally{fetchingData=null;}
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
    return sequenceBlocks(visibleQuests()).filter(block=>!pendingDeletedBlocks.has(block.id));
  }
  function parseCategories(type) {return sequenceCategories(data?.quests||[],type);}
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
    if(savingSequence)throw new Error('上一条记录正在同步，请稍候');
    if (!block.title.trim()) throw new Error("请填写时间块名称");
    if (block.end - block.start < 10) throw new Error("时间块至少需要 10 分钟");
    const conflicts=overlappingBlocks(block,parseBlocks());
    if(conflicts.length&&!window.confirm(overlapMessage(conflicts)))throw new Error('已取消，原记录未更改');
    let consent={allowOverlap:conflicts.length>0,overlapKeys:conflicts.map(overlapKey)};
    savingSequence=true;notify('正在保存时序记录…');
    try{const payload={...block,recordKey:block.recordKey||crypto.randomUUID()};let json;
    for(let attempt=0;attempt<3;attempt++){const response=await fetch('/api/sequence-record',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,...consent})});json=await response.json();if(response.ok)break;if(json.code==='overlap_confirmation_required'&&attempt<2){if(!window.confirm(overlapMessage(json.conflicts)))throw new Error('已取消，原记录未更改');consent={allowOverlap:true,overlapKeys:json.conflicts.map(overlapKey)};continue;}throw new Error(json.error||'保存失败，请重试');}data=json;hostNeedsRefresh=true;
    window.dispatchEvent(new CustomEvent('starcamp:game-data',{detail:json}));
    notify('时序记录已保存，对应任务已完成');
    renderPage();
    }finally{savingSequence=false;}
  }
  async function deleteBlock(id) {
    if(pendingDeletedBlocks.has(id))return;
    pendingDeletedBlocks.add(id);renderPage();notify('正在同步删除时间块…');
    try{await api({ action: "deleteQuest", questId: id });notify("时间块已删除");}
    catch(error){throw new Error(`${error.message||'删除失败'}，时间块已恢复，请刷新后确认`);}
    finally{pendingDeletedBlocks.delete(id);renderPage();}
  }
  function closePage() {
    pageOpen = false;
    opening = false;
    navigationVersion += 1;
    disposeTimeline?.();disposeTimeline=null;
    pageElement?.remove();
    pageElement = null;
    document.querySelectorAll('.starlane-compat-editor-backdrop').forEach(node=>node.remove());
    hiddenNodes.forEach((wasHidden,node)=>{node.hidden=wasHidden;node.removeAttribute('data-starlane-hidden');});
    hiddenNodes.clear();
    scrollPositions.clear();
    document.querySelector(".starlane-nav")?.classList.remove("active");
  }
  function mountPage() {
    if(!pageOpen||!pageElement)return;
    const main=document.querySelector('.main-content');
    if(!main)return;
    // Reattach the same subtree, retaining scroll, selected view and event handlers.
    const remount=pageElement.parentElement!==main;
    if(remount)main.append(pageElement);
    [...main.children].forEach(child=>{
      if(child===pageElement)return;
      if(!hiddenNodes.has(child))hiddenNodes.set(child,child.hidden);
      if(!child.hidden)child.hidden=true;
      if(!child.hasAttribute('data-starlane-hidden'))child.setAttribute('data-starlane-hidden','1');
    });
    for(const node of hiddenNodes.keys())if(!node.isConnected)hiddenNodes.delete(node);
    if(remount)scrollPositions.forEach((position,node)=>{if(pageElement.contains(node)){node.scrollTop=position.top;node.scrollLeft=position.left;}});
    document.querySelectorAll('.nav-stack .nav-item').forEach(item=>item.classList.toggle('active',item.classList.contains('starlane-nav')));
  }
  async function openPage() {
    if(pageOpen&&pageElement){mountPage();return;}
    if(opening)return;
    opening=true;
    const navButton=document.querySelector('.starlane-nav');navButton?.setAttribute('aria-busy','true');
    if(!data&&!window.starcampTransport?.peek())notify('正在读取时序记录…');
    const version=++navigationVersion;
    try {
      const current = await fetchData();
      if(version!==navigationVersion)return;
      if (current.timeTrack) return;
      const main = document.querySelector(".main-content");
      if (!main) return;
      selectedDate=localDateKey(new Date());enteredOn=selectedDate;selectedTask=null;
      pageElement=el('section','starlane-compat-page');
      pageElement.addEventListener('scroll',event=>{const node=event.target;if(node instanceof HTMLElement && pageElement?.contains(node))scrollPositions.set(node,{top:node.scrollTop,left:node.scrollLeft});},true);
      pageOpen = true;
      mountPage();
      renderPage();
    } catch (error) { if(version===navigationVersion){closePage();notify(error instanceof Error ? error.message : "暂时无法打开时序");} }
    finally {navButton?.removeAttribute('aria-busy');if(version===navigationVersion)opening=false;}
  }
  function ensureNav() {
    hideStorageQuests();
    if(document.querySelector('.auth-page')){if(pageOpen||opening)closePage();data=null;return;}
    const nav = document.querySelector(".nav-stack");
    if(!nav)return;
    if(![...nav.querySelectorAll('.nav-item small')].some(item=>item.textContent==='时序'||item.textContent==='时轨')){
      const button=el('button','nav-item starlane-nav');const icon=el('span','sequence-nav-icon');icon.innerHTML='<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 3h12M6 21h12M7 3v4c0 2 3 3 5 5-2 2-5 3-5 5v4M17 3v4c0 2-3 3-5 5 2 2 5 3 5 5v4"/><path d="m9 18 3-3 3 3" stroke="#b99244"/></svg>';button.append(icon,el('small','','时序'));
      nav.insertBefore(button,nav.children[2]||null);
    }
    mountPage();
    const restore=sessionStorage.getItem('starcamp:return-tab');
    if(restore&&!pageOpen){const button=[...nav.querySelectorAll('.nav-item')].find(item=>item.querySelector('small')?.textContent===restore);if(button){sessionStorage.removeItem('starcamp:return-tab');button.click();}}
  }
  function renderPage() {
    if (!pageOpen || !pageElement || !data) return;
    // Build before replacing the visible page. A failed calculation must not blank it.
    if(!validDate(selectedDate))selectedDate=localDateKey(new Date());
    const range = dateRange(selectedDate, viewMode);
    const blocks = filterRange(parseBlocks(), range.start, range.end).sort((a, b) => a.date.localeCompare(b.date) || a.start-b.start);
    const header = el("header", "starlane-compat-header");
    const copy = el("div");
    copy.append(el("small", "", "STELLAR TIME MAP · 时序"), el("h2", "", "把一天，铺成看得见的时序"), el("p", "", "全天纵向展开：拖选时间，移动色块，点开编辑详情。"));
    const dateNav = el("div", "starlane-compat-date");
    const prev = el("button", "", "‹"); prev.setAttribute('aria-label',viewMode==='week'?'上一周':'前一天'); prev.onclick = () => { selectedDate = shiftDate(selectedDate, viewMode==='week'?-7:-1); renderPage(); };
    const dateInput = el("input"); dateInput.type = "date"; dateInput.value = selectedDate; dateInput.onchange = () => { if(!validDate(dateInput.value)){dateInput.value=selectedDate;notify('请选择有效日期，已保留当前日程');return;} selectedDate = dateInput.value; renderPage(); };
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
    const manual = el("button", "manual", "＋ 手动填写"); manual.onclick = () => openEditor({ date: selectedDate, start: 540, end: 600, title: "", type: "主线", category: parseCategories("主线")[0]?.name||"未分类", color: "gold", note: "" });
    toolbar.append(steps, manual);
    const exportButton=el('button','',hasPaidTools(data)?'导出日程':'导出日程 · 付费'); exportButton.onclick=openExportPanel; toolbar.append(exportButton);
    const layout = el("div", "starlane-compat-layout");
    const timelinePanel=el('div','flat-timeline-panel');
    const onTask=(id,day,minute)=>{const task=availableTasks(visibleQuests(),selectedDate).find(q=>q.id===id);if(task)placeTask(task,minute,day);};
    const timeline=createVerticalTimeline({date:selectedDate,step:granularity,blocks,mode:viewMode,onDay:day=>{selectedDate=day;viewMode='day';renderPage();},
          onCreate:(day,start,end)=>{if(selectedTask){placeTask(selectedTask,start,day);return;}openEditor({date:day,start,end,title:'',type:'主线',category:parseCategories('主线')[0]?.name||'未分类',color:'gold',note:''});},
          onEdit:block=>openEditor({...block}),
          onMove:async block=>{try{await saveBlock(block);}catch(error){notify(error.message);renderPage();}},
          onTask
        });
    timelinePanel.append(timeline);
    const sidebar = el('div', 'starlane-task-sidebar');
    const categoryDetails=el('details','flat-sidebar-details');categoryDetails.append(el('summary','','分类与颜色设置'),renderCategories());
    sidebar.append(renderTaskTray(), categoryDetails);
    layout.append(timelinePanel, sidebar);
    scrollPositions.clear();
    disposeTimeline?.();disposeTimeline=timeline.dispose;
    pageElement.replaceChildren(header, summary, toolbar, layout);
    mountPage();
  }
  function placeTask(task, minute, day = selectedDate) {
    selectedTask = null;
    const type = types.includes(task.type) ? task.type : '日常';
    const first = parseCategories(type)[0];
    openEditor({ date: day, ...taskSlot(minute, granularity), title: task.title, type, category: first?.name||"未分类", color: defaultTaskColor(type),colorCustom:false, note: '',questId:task.id });
    document.querySelector('.starlane-task-hint')?.replaceChildren(document.createTextNode('拖到轨道，或点选任务后点选时间。保存前可调整时长；保存后对应任务自动完成。'));
  }
  function renderTaskTray() {
    const tray = el('section', 'starlane-task-tray');
    tray.append(el('h3', '', '任务待排区'), el('p', 'starlane-task-hint', '当日已完成置顶；仅显示已到时间的当日及过往任务，按时间近远排列。未来任务隐藏，未设时间的最后。已完成任务可补记，不重复计奖。'));
    const refresh = el('button', 'refresh', '刷新任务');
    refresh.onclick = async () => {
      if(refresh.disabled)return;
      refresh.disabled=true;refresh.setAttribute('aria-busy','true');
      const spinner=el('span','sequence-refresh-spinner');spinner.setAttribute('aria-hidden','true');refresh.replaceChildren(spinner,document.createTextNode('刷新中…'));
      try{await fetchData(true);renderPage();notify('任务已刷新');}
      catch(error){notify(error.message||'刷新失败，请重试');}
      finally{refresh.disabled=false;refresh.removeAttribute('aria-busy');refresh.replaceChildren(document.createTextNode('刷新任务'));}
    };
    tray.append(refresh);
    const list = el('div', 'starlane-task-list'), tasks = availableTasks(visibleQuests(),selectedDate);
    if (!tasks.length) list.append(el('p', '', '暂无当日完成或待排任务，可先到任务页添加。'));
    tasks.forEach(task => {
      const button = el('button', 'starlane-task-item'); button.draggable = true;
      button.dataset.sequenceTaskId=String(task.id);
      const completed=completedOnDate(task,selectedDate);if(completed)button.classList.add('task-completed-today');
      Object.entries(taskTrayStyle(task.type)).forEach(([key,value])=>button.style.setProperty(key,value));
      const due=task.dueAt?(validDate(task.dueAt)?`${task.dueAt} 全天`:new Date(task.dueAt).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})):'未设时间';
      button.append(el('b', '', task.title), el('small', '', `${completed?'✓ 当日已完成 · ':''}${task.type} · ${due}`));
      const handle=el('span','sequence-drag-handle','⠿');handle.title='按住此处拖到时间轴';handle.setAttribute('aria-hidden','true');button.append(handle);
      if(pendingQuestEdits.has(task.id)){button.disabled=true;button.draggable=false;button.append(el('small','','类型同步中…'));}
      button.ondragstart = event => { selectedTask = null; event.dataTransfer.setData('application/x-starcamp-task', String(task.id)); event.dataTransfer.effectAllowed = 'copy'; };
      button.onclick = () => {
        selectedTask = task;
        tray.querySelector('.starlane-task-hint').textContent = `已选「${task.title}」，请点击轨道的开始时间。`;
        document.querySelector('.flat-timeline-panel')?.scrollIntoView({behavior:'smooth',block:'start'});
      };
      list.append(button);
    });
    tray.append(el('p','sequence-touch-help','按住任务右侧 ⠿ 拖到时间轴，靠近屏幕边缘可滚动；也可点选任务后点选时间。'),list); return tray;
  }
  function renderCategories() {return createCategoryManager({getCategories:parseCategories,mutate:api,onSaved:()=>{renderPage();const details=document.querySelector('.starlane-task-sidebar .flat-sidebar-details');if(details)details.open=true;notify('细分分类已保存');},notify});}
  function openExportPanel() {
    if(!hasPaidTools(data)){notify(PREMIUM_MESSAGE);return;}
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
      try{await downloadAuthorizedTimeline(start.value,end.value,format);update();}catch(error){status.textContent=error.message;button.disabled=false;}
    };actions.append(button);});
    start.onchange=end.onchange=update;
    panel.append(close,heading,note,shortcuts,startLabel,endLabel,status,actions);backdrop.append(panel);document.body.append(backdrop);update();start.focus();
    backdrop.onmousedown=event=>{if(event.target===backdrop)backdrop.remove();};
  }
  function openEditor(block) {
    block.recordKey ||= crypto.randomUUID();
    document.querySelector(".starlane-compat-editor-backdrop")?.remove();
    const backdrop = el("div", "starlane-compat-editor-backdrop"), dialog = el("section", "starlane-compat-editor");
    const close = el("button", "close", "×"); close.onclick = () => backdrop.remove();
    const header = el("header"); header.append(el("small", "", block.id ? "EDIT TIME BLOCK" : "NEW TIME BLOCK"), el("h3", "", block.id ? "编辑时间块" : "记录这段时间"), el("p", "", block.date));
    const title = el("input"); title.placeholder = "例如：完成产品方案结构"; title.maxLength = 24; title.value = block.title;
    const titleLabel = el("label"); titleLabel.append(el("span", "", "做了什么 / 准备做什么"), title);
    const typeRow = el("div", "starlane-compat-type-row");
    const category = el("select"), colorRow = el("div", "starlane-compat-color-row");
    let currentType = block.type, colorCustom=block.colorCustom===true, currentColor = colorCustom?block.color:defaultTaskColor(block.type);
    const fillCategories = () => { category.replaceChildren(); parseCategories(currentType).forEach((item) => { const option = el("option", "", item.name); option.value = item.name; category.append(option); }); if(block.id&&currentType===block.type&&block.category&&!parseCategories(currentType).some(item=>item.name===block.category)){const old=el("option","",`${block.category}（历史分类）`);old.value=block.category;category.append(old);}if(!category.options.length){const empty=el("option","","未分类");empty.value="未分类";category.append(empty);}category.value = block.category; if (!category.value) category.selectedIndex = 0; };
    types.forEach((type) => { const button = el("button", `${type === currentType ? 'active ' : ''}type-${type}`, type); button.onclick = () => { currentType = type; if(!colorCustom){currentColor=defaultTaskColor(type);colorRow.querySelectorAll('button[data-color]').forEach(b=>b.classList.toggle('active',b.dataset.color===currentColor));} typeRow.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button)); fillCategories(); }; typeRow.append(button); });
    fillCategories();
    colors.forEach(([key, label]) => { const button = el("button", `${key === currentColor ? "active " : ""}color-${key}`); button.dataset.color=key;button.title = label;button.setAttribute('aria-label',label); button.append(el("i")); button.onclick = () => { currentColor = key;colorCustom=true; colorRow.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button)); }; colorRow.append(button); });
    const resetColor=el('button','sequence-reset-color','恢复任务默认色');resetColor.onclick=()=>{colorCustom=false;currentColor=defaultTaskColor(currentType);colorRow.querySelectorAll('button[data-color]').forEach(b=>b.classList.toggle('active',b.dataset.color===currentColor));};
    const start = el("input"); start.type = "time"; start.step = String(granularity * 60); start.value = inputTime(block.start);
    const end = el("input"); end.type = "time"; end.step = String(granularity * 60); end.value = inputTime(block.end);
    const times = el("div", "starlane-compat-time-row"); const startLabel = el("label"); startLabel.append(el("span", "", "开始"), start); const endLabel = el("label"); endLabel.append(el("span", "", "结束"), end); times.append(startLabel, endLabel);
    const categoryLabel = el("label"); categoryLabel.append(el("span", "", "细分分类"), category);
    const note = el("textarea"); note.placeholder = "记录成果、状态或下一步"; note.maxLength = 24; note.value = block.note || ""; const noteLabel = el("label"); noteLabel.append(el("span", "", "备注（可选）"), note);
    const footer = el("footer"); if (block.id) { const remove = el("button", "delete", "删除"); remove.onclick = async () => { if(remove.disabled)return;remove.disabled=true;remove.textContent="删除中…";try { const deletion=deleteBlock(block.id);backdrop.remove();await deletion; } catch (error) { notify(error.message);remove.disabled=false;remove.textContent="删除"; } }; footer.append(remove); }
    const cancel = el("button", "cancel", "取消"); cancel.onclick = () => backdrop.remove(); const save = el("button", "save", "保存到时序"); save.onclick = async () => { if(save.disabled)return;save.disabled = true;save.textContent="正在保存…";try { await saveBlock({ ...block, title: title.value, type: currentType, category: category.value, color: currentColor, colorCustom, note: note.value, start: parseTime(start.value), end: parseTime(end.value) }); backdrop.remove(); } catch (error) { notify(error.message); save.disabled = false;save.textContent="保存到时序"; } }; footer.append(cancel, save);
    const typeField = el("fieldset"); typeField.append(el("legend", "", "所属模块"), typeRow); const colorField = el("fieldset"); colorField.append(el("legend", "", "色块颜色"), colorRow,resetColor);
    dialog.append(close, header, titleLabel, typeField, times, categoryLabel, colorField, noteLabel, footer); backdrop.append(dialog); backdrop.onmousedown = (event) => { if (event.target === backdrop) backdrop.remove(); }; document.body.append(backdrop); title.focus();
  }
  let queued = false;
  async function refreshSequence(){
    if(!pageOpen||savingSequence||document.visibilityState!=='visible'||document.querySelector('.starlane-compat-editor-backdrop, .sequence-drag-ghost'))return;
    const today=localDateKey(new Date());if(enteredOn!==today){enteredOn=today;selectedDate=today;selectedTask=null;renderPage();}
    const before=JSON.stringify(data?.quests||[]);
    try{await fetchData();if(pageOpen&&before!==JSON.stringify(data?.quests||[])&&!document.querySelector('.starlane-compat-editor-backdrop'))renderPage();}catch{}
  }
  window.addEventListener('focus',()=>void refreshSequence());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refreshSequence();});
  window.setInterval(()=>void refreshSequence(),30000);
  // Delegation survives replacement of the upstream navigation by React.
  document.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target.closest('.nav-item, .signout-link, .invite-fab'):null;
    if(!target)return;
    if(target.classList.contains('starlane-nav')){event.preventDefault();void openPage();}
    else if(target.closest('.nav-stack')||target.classList.contains('signout-link')||target.classList.contains('invite-fab')){
      const next=target.querySelector('small')?.textContent;
      closePage();
      if(hostNeedsRefresh&&next&&!target.classList.contains('signout-link')){hostNeedsRefresh=false;sessionStorage.setItem('starcamp:return-tab',next);window.setTimeout(()=>location.reload(),0);}
    }
  },true);
  function schedule() {
    if (queued) return; queued = true;
    requestAnimationFrame(() => { queued = false; ensureNav(); });
  }
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  schedule();
})();
