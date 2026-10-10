const sections=[
 ['营地','每天从一个明确目标出发','进入后填写今日主线、计划专注分钟和当前精力，再点“开始今日冒险”。营地可查看今日能量、任务概况、连续启程、周小结和月目标。','免费'],
 ['任务','把要做的事整理成可执行任务','点“发布新委托”填写名称与说明，选主线、支线或日常。每项任务可编辑和删除，也可批量删除。修改任务类型后，关联的时序记录会同步显示新类型。','免费'],
 ['时序','沿着一天的时间轴记录行动','选日期与日/周视图，切换 10、15、30 分钟刻度。从待排区拖入任务，或拖选空白时段、手动填写。保存记录会完成对应任务；手动记录会新增已完成任务。点色块可编辑，拖动可移动，底部把手可调时长。分类与颜色设置里可新增子分类。','记录免费 · 导出付费'],
 ['专注','为重要的事留出一段完整时间','选择专注时长，点开始。可选择雨声、篝火、潮汐，并设置结束弹窗或提示音。完成后保存专注记录。','免费'],
 ['行囊','查看成长成果与个人奖励','查看勋章条件、获得进度和奖励。用站内星辉兑换个人奖励；星辉不是现金支付。等级提升会解锁相应头像与荣誉内容。','免费'],
 ['小组','与最多五人的队伍一起前进','可复制邀请口令，或用已注册邮箱邀请好友与组队。接受邀请或获组内成员同意后加入；世界排名累计队伍成员的贡献。','免费'],
 ['世界','按门槛逐步探索大陆','从默认开放的曦华大陆出发。查看下一大陆需要的经验、试炼、专注及邀请条件，满足条件后解锁；进入大陆会切换对应页面主题。','免费'],
 ['日历','把日程带进任务栏','在任务页点“同步日历”。可绑定 Google 日历，或导入日历订阅链接与 ICS 文件。按页面提示授权，只导入同步日及以后的日程；需要有效付费权限。','付费'],
 ['导出与 VIP','先核对权益，再使用高级工具','在时序点“导出日程”，选择当天、本周、本月或自选日期，下载 CSV（表格统计）或 ICS（日历文件）。导出、日历导入和同步均须付费解锁；管理员维护的五个永久免费 VIP 名额可直接使用。添加手机桌面和手动记录不收费。','付费 / 永久 VIP 豁免'],
];
const steps=[['欢迎来到星旅营地','先选一件今天最重要的事，再开始行动。你可以随时关闭介绍。'],['整理你的任务','主线是关键目标，支线是辅助成长，日常是习惯与生活。它们都能编辑、分类和删除。'],['用时序留下记录','把任务拖到时间轴，或手动记录。保存后对应任务自动完成，不用重复勾选。'],['了解收费范围','日历导入/同步和 CSV、ICS 导出需付费解锁。五个永久免费 VIP 名额除外，其余手动任务和时序记录免费。']];
const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text)n.textContent=text;return n;};
export function openTravelerGuide(){
  if(document.querySelector('.traveler-guide-page'))return;
  const page=el('section','traveler-guide-page');page.setAttribute('aria-label','旅人指南');
  const inner=el('div','traveler-guide-inner'),header=el('header','');
  const back=el('button','guide-back','← 返回营地');back.onclick=()=>page.remove();
  header.append(back,el('small','','STARCAMP · 使用向导'),el('h1','','旅人指南'),el('p','','从第一步到长期成长，随时回来查看操作方法。'));inner.append(header);
  const notice=el('aside','guide-pay-note','收费说明：时序导出、日历导入与同步需要有效付费权益；五个永久免费 VIP 名额直接使用。不会因为关闭或跳过向导而扣费。');inner.append(notice);
  const grid=el('div','guide-section-grid');sections.forEach(([name,title,body,badge],index)=>{const card=el('article','guide-section');card.append(el('small','',String(index+1).padStart(2,'0')+' · '+name),el('span','guide-badge',badge),el('h2','',title),el('p','',body));grid.append(card);});inner.append(grid);
  inner.append(el('footer','','有疑问时，点击导航中的“指南”即可再次打开。手机桌面版也可从同一入口进入。'));page.append(inner);document.body.append(page);back.focus();
}
function openOnboarding(email){
  if(document.querySelector('.traveler-onboarding'))return;
  const backdrop=el('div','traveler-onboarding'),dialog=el('section','guide-welcome-card');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','新旅行者使用向导');
  let index=0;
  function done(){localStorage.setItem('starcamp:guide-seen:'+email,'1');sessionStorage.removeItem('starcamp:new-user-guide');backdrop.remove();
    const toast=el('div','guide-toast','已关闭介绍。进入营地后，可随时在导航“指南”查看使用方法。');document.body.append(toast);setTimeout(()=>toast.remove(),6000);
  }
  function render(){dialog.replaceChildren();const close=el('button','guide-close','×');close.setAttribute('aria-label','关闭使用向导');close.onclick=done;
    dialog.append(close,el('small','',`新旅行者向导 · ${index+1} / ${steps.length}`),el('h2','',steps[index][0]),el('p','',steps[index][1]),el('p','guide-reminder','以后有疑问，可在导航“指南”再次查看。'));
    const actions=el('div','guide-actions'),skip=el('button','','跳过介绍');skip.onclick=done;
    const next=el('button','primary',index===steps.length-1?'开始使用':'下一步');next.onclick=()=>{if(index===steps.length-1)done();else{index++;render();}};
    const full=el('button','guide-full','查看完整指南');full.onclick=()=>{done();openTravelerGuide();};actions.append(skip,next);dialog.append(actions,full);
  }
  render();backdrop.append(dialog);document.body.append(backdrop);dialog.querySelector('button').focus();
}
export function installTravelerGuide(){
  if(window.__starcampGuideInstalled)return;window.__starcampGuideInstalled=true;
  const original=window.fetch;
  window.fetch=async function(...args){const response=await original.apply(this,args);
    try{const url=new URL(typeof args[0]==='string'?args[0]:args[0].url,location.href);const body=args[1]?.body;
      if(url.origin===location.origin&&url.pathname==='/api/auth'&&typeof body==='string'&&JSON.parse(body).action==='register'&&response.ok){const data=await response.clone().json();if(data.user?.email)sessionStorage.setItem('starcamp:new-user-guide',data.user.email);}
    }catch{}return response;
  };
  function sync(){
    if(document.querySelector('.auth-page')){document.querySelector('.traveler-guide-page')?.remove();return;}
    const nav=document.querySelector('.nav-stack');
    if(nav&&!nav.querySelector('.traveler-guide-nav')){const button=el('button','nav-item traveler-guide-nav');button.append(el('span','','?'),el('small','','指南'));button.setAttribute('aria-label','旅人指南');button.onclick=openTravelerGuide;nav.append(button);}
    const email=sessionStorage.getItem('starcamp:new-user-guide');
    if(email&&document.querySelector('.app-shell,.daily-departure-page')&&!localStorage.getItem('starcamp:guide-seen:'+email))openOnboarding(email);
  }
  let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;sync();});}).observe(document.documentElement,{childList:true,subtree:true});sync();
}
