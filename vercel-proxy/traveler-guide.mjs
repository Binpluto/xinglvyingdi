import {openFirstAction} from './first-action.mjs?v=16';
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
const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text)n.textContent=text;return n;};
function mobileGuide(){
  const section=el('section','guide-mobile');section.id='guide-mobile';
  section.append(el('small','','MOBILE · 手机与平板'),el('h2','','手机移动端使用方法'),el('p','guide-mobile-intro','先在手机浏览器打开星旅营地，再按机型添加到桌面。添加桌面免费；它是网页 App 或桌面快捷方式，无需在应用商店下载。'));
  const address=el('a','guide-mobile-url','https://starcamp-life-adventure.vercel.app');address.href='https://starcamp-life-adventure.vercel.app';address.target='_blank';address.rel='noopener noreferrer';section.append(address);
  section.append(el('p','guide-mobile-tip','从微信或其他 App 内打开时，如果找不到安装入口，请复制链接到 Safari、Chrome 或华为浏览器再操作。'));
  const phones=[
    ['iPhone / iPad','Safari 浏览器',[
      '在 Safari 中打开上方网址，点击“分享 / 共享”（方框向上箭头；部分版本先点页面菜单）。',
      '在选项列表中找到“添加到主屏幕”。若没有，滑到列表底部进入“编辑操作”添加该选项。',
      '如出现“作为网页 App 打开”，将其开启，再点“添加”。回到桌面，点击“星旅营地”。',
    ]],
    ['安卓手机','Chrome 浏览器 · 小米、OPPO、vivo、荣耀、三星等',[
      '在 Chrome 中打开上方网址，点击右上角“⋮”菜单。',
      '选择“安装并创建快捷方式”→“安装”，然后按提示确认。旧版本可能显示“安装应用”或“添加到主屏幕”。',
      '如果没有安装选项，可选择“创建快捷方式”。回到桌面点击图标；快捷方式可能在浏览器中打开。',
    ]],
    ['华为 / 鸿蒙','华为浏览器',[
      '使用华为浏览器打开上方网址。',
      'HarmonyOS 5.0 及以上：点菜单“∷”→“添加至桌面”→确认。更早版本：菜单“∷”→“添加至”→“桌面”。',
      '回到桌面点击“星旅营地”。部分机型创建的是网页快捷方式，点击后在浏览器中打开。',
    ]],
  ];
  const grid=el('div','guide-mobile-grid');phones.forEach(([name,browser,steps])=>{const card=el('article','guide-mobile-card');card.append(el('h3','',name),el('small','',browser));const list=el('ol','');steps.forEach(text=>list.append(el('li','',text)));card.append(list);grid.append(card);});section.append(grid);
  const tips=el('div','guide-mobile-usage');tips.append(el('h3','','添加后怎么用？'));
  const list=el('ul','');[
    '账号与记录：使用注册时的同一邮箱登录。若桌面版再次要求登录，重新登录即可；任务和记录保存在该邮箱对应的账户中。使用与云端同步需要联网。',
    '手机记录时间：进入“时序”，先点待排任务，再点时间轴上的开始位置；也可直接点“手动填写”。点色块编辑，拖动调整时间；小屏建议先用日视图。保存记录后，对应任务自动完成。',
    '导出文件：在“时序”点“导出日程”，选择日期范围和 CSV / ICS。下载后可在浏览器下载列表或手机文件管理中查找。导出与日历导入/同步属于付费功能，五个永久免费 VIP 名额除外。',
    '提醒与声音：需要时允许浏览器通知，并检查手机音量。网页或桌面版运行时可提醒；被系统暂停或完全关闭后，不能保证准时通知。添加到桌面本身不会开启后台推送。',
    '页面更新：看不到新功能时，先刷新网页，或关闭桌面版后重新打开。不要为了刷新而删除账户。',
  ].forEach(text=>list.append(el('li','',text)));tips.append(list);section.append(tips);
  section.append(el('p','guide-mobile-footnote','菜单名称和位置可能随系统、浏览器版本变化，以手机实际界面为准。'));
  return section;
}
export function openTravelerGuide(){
  if(document.querySelector('.traveler-guide-page'))return;
  const page=el('section','traveler-guide-page');page.setAttribute('aria-label','旅人指南');
  const inner=el('div','traveler-guide-inner'),header=el('header','');
  const back=el('button','guide-back','← 返回应用');back.onclick=()=>page.remove();
  header.append(back,el('small','','STARCAMP · 使用向导'),el('h1','','旅人指南'),el('p','','从第一步到长期成长，随时回来查看操作方法。'));inner.append(header);
  const notice=el('aside','guide-pay-note','收费说明：时序导出、日历导入与同步需要有效付费权益；五个永久免费 VIP 名额直接使用。不会因为关闭或跳过向导而扣费。');inner.append(notice);
  const mobile=mobileGuide();
  const shortcuts=el('nav','guide-shortcuts');shortcuts.setAttribute('aria-label','指南快捷入口');
  const grid=el('div','guide-section-grid');
  [['功能说明',grid],['手机移动端使用',mobile],['收费说明',notice]].forEach(([label,target])=>{const button=el('button','',label);button.onclick=()=>target.scrollIntoView({behavior:'smooth',block:'start'});shortcuts.append(button);});inner.append(shortcuts);
  sections.forEach(([name,title,body,badge],index)=>{const card=el('article','guide-section');card.append(el('small','',String(index+1).padStart(2,'0')+' · '+name),el('span','guide-badge',badge),el('h2','',title),el('p','',body));grid.append(card);});inner.append(grid,mobile);
  inner.append(el('footer','','有疑问时，点击导航中的“指南”即可再次打开。手机桌面版也可从同一入口进入。'));page.append(inner);document.body.append(page);back.focus();
}
function openOnboarding(email){
  if(document.querySelector('.traveler-onboarding'))return;
  function markSeen(){try{localStorage.setItem('starcamp:guide-seen:'+email,'1');sessionStorage.removeItem('starcamp:new-user-guide');}catch{}}
  openFirstAction({email,onSkip:()=>{markSeen();const toast=el('div','guide-toast','已跳过启程三问。使用方法可随时在导航「指南」查看。');document.body.append(toast);setTimeout(()=>toast.remove(),5000);},
    onSaved:markSeen,
    onDone:result=>{markSeen();sessionStorage.setItem('starcamp:first-action-go','1');const event=new CustomEvent('starcamp:first-action-created',{detail:result.data,cancelable:true});window.dispatchEvent(event);if(!event.defaultPrevented)location.reload();}
  });
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
    if(email&&document.querySelector('.app-shell,.daily-departure-page,.monthly-goal-page')&&!localStorage.getItem('starcamp:guide-seen:'+email))openOnboarding(email);
    if(sessionStorage.getItem('starcamp:first-action-go')&&!document.querySelector('.traveler-onboarding')){
      const monthSkip=document.querySelector('.monthly-goal-skip');if(monthSkip){monthSkip.click();return;}
      const tasks=[...document.querySelectorAll('.nav-stack .nav-item')].find(button=>button.querySelector('small')?.textContent==='任务');
      if(tasks){sessionStorage.removeItem('starcamp:first-action-go');tasks.click();}
    }
  }
  let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;sync();});}).observe(document.documentElement,{childList:true,subtree:true});sync();
}
