(() => {
  function replaceText(selector,text){document.querySelectorAll(selector).forEach(node=>{if(node.textContent!==text)node.textContent=text;});}
  function update(){
    replaceText('.calendar-heading p','日历导入、账号绑定和自动同步均为付费功能；五个永久免费 VIP 名额无需付费。手动创建任务与时序记录继续免费使用。');
    replaceText('.calendar-pricing-intro b','开通通行证，解锁日历导入与时序导出');
    replaceText('.calendar-trial-rule','付费功能不对普通账号免费开放，五个永久免费 VIP 名额除外。套餐为一次性付款，不自动续费。');
    replaceText('.calendar-fallback-title span','付费功能 · 日历链接与 ICS 文件导入');
    document.querySelectorAll('.google-live-card a').forEach(a=>{if(a.textContent.includes('免费'))a.textContent='连接日历 · 付费功能 →';});
    document.querySelectorAll('.calendar-membership-status button').forEach(button=>{if(button.textContent.includes('Lv.100'))button.hidden=true;});
    document.querySelectorAll('.google-live-card small,.calendar-membership-status b,.calendar-membership-status small').forEach(node=>{if(/试用|连接 Google 日历时开始计时/.test(node.textContent))node.textContent='需有效付费通行证或永久免费 VIP 权益';});
  }
  let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;update();});}).observe(document.documentElement,{childList:true,subtree:true});update();
})();
