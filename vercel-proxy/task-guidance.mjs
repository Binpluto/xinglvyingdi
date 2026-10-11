import {taskMetadata} from './system-task-meta.mjs?v=19';
import {recoverLaunchProfile} from './monthly-launch-state.mjs?v=18';
const el=(tag,cls,text)=>{const node=document.createElement(tag);node.className=cls||'';if(text!==undefined)node.textContent=text;return node;};
export const feedbackReasons=[['goal','与当前目标不相关'],['time','需要的时间太长'],['energy','当前精力不适合'],['done','已经做过类似行动'],['other','其他原因 / 暂不需要']];
export function createTaskGuidance(task,context={},options={}){
  const meta=taskMetadata(task,context);if(!meta)return null;
  const panel=el('section','task-guidance');panel.setAttribute('aria-label',`${task.title}的行动说明`);
  const facts=el('div','task-guidance-facts');
  const time=el('div','');time.append(el('small','','预计全程'),el('b','',meta.duration),el('span','',meta.timeBasis));
  const energy=el('div','');energy.append(el('small','','适合精力'),el('b','',meta.energyLabel),el('span','','任务安排参考，不是健康评价'));facts.append(time,energy);panel.append(facts);
  const start=el('div','task-guidance-start');start.append(el('small','','第一步怎么做'),el('p','',meta.start));panel.append(start);
  const why=el('details','task-guidance-why');why.dataset.purpose='reason';why.append(el('summary','','为什么推荐这项？'),el('p','',meta.reason));why.append(el('small','',meta.selectionNote));panel.append(why);
  if(meta.warnings.length){const warning=el('div','task-guidance-warning');meta.warnings.forEach(text=>warning.append(el('p','',text)));panel.append(warning);}
  const state=options.feedback||{},actions=el('div','task-guidance-actions'),adopt=el('button','task-guidance-adopt',task.done?'已完成 · 可回看说明':state.decision==='adopt'?'✓ 已选为本次行动':'就从这一步开始');adopt.type='button';adopt.disabled=!!task.done;adopt.setAttribute('aria-pressed',String(state.decision==='adopt'));adopt.onclick=()=>options.onFeedback?.({decision:state.decision==='adopt'?'none':'adopt'});actions.append(adopt);
  const feedback=el('details','task-guidance-feedback');feedback.append(el('summary','','这次不太合适？'));const feedbackBody=el('div',''),select=el('select','');select.setAttribute('aria-label',`${task.title}的推荐反馈`);const placeholder=el('option','','选择一个原因');placeholder.value='';select.append(placeholder);feedbackReasons.forEach(([id,text])=>{const opt=el('option','',text);opt.value=id;select.append(opt);});select.value=state.reason||'';
  const record=el('button','','记录反馈');record.type='button';record.disabled=!select.value;select.onchange=()=>record.disabled=!select.value;record.onclick=()=>options.onFeedback?.({decision:'decline',reason:select.value});feedbackBody.append(select,record,el('p','','仅记录推荐反馈，不删除或替换任务，不改变积分。'));feedback.append(feedbackBody);actions.append(feedback);panel.append(actions);
  const status=el('p','task-guidance-status',task.done?'完成状态以原任务记录为准。':state.decision==='adopt'?'已记录选择。起步或专注后，仍需按原完成标准确认任务。':state.decision==='decline'?`已记录：${feedbackReasons.find(([id])=>id===state.reason)?.[1]||'暂不采用'}。任务仍保留。`:meta.startNote);status.setAttribute('role','status');panel.append(status);
  panel.append(el('small','task-guidance-storage',options.preview?'验收预览：选择、反馈和完成仅为示例，不保存真实账号。':'选择与反馈仅保存在当前浏览器；任务完成仍以云端任务记录为准。'));
  return panel;
}
export function guidanceContext(data){
  let profile=null;try{profile=JSON.parse(localStorage.getItem('starcamp:launch-profile:'+data.user.email)||'null');}catch{}
  profile=profile||recoverLaunchProfile(data);
  return {goal:profile?.answers?.goal,budget:profile?.answers?.budget,energy:data.dailyDeparture?.energyLevel};
}
export function installTaskGuidance(){
  if(typeof window==='undefined'||window.__starcampTaskGuidance)return;window.__starcampTaskGuidance=true;
  let data=window.starcampTransport?.peek(),loading=false,queued=false,lastAttempt=0;const memory=new Map();
  const day=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const key=q=>`starcamp:task-guidance:${data.user.email}:${q.id}:${q.dueAt||day()}`;
  const stored=k=>{if(memory.has(k))return memory.get(k);try{return JSON.parse(localStorage.getItem(k)||'null');}catch{return null;}};
  const save=(k,value)=>{memory.set(k,value);try{localStorage.setItem(k,JSON.stringify(value));}catch{}schedule();};
  function render(){
    if(document.querySelector('.auth-page')){data=null;document.querySelectorAll('.task-guidance').forEach(n=>n.remove());return;}
    const rows=[...document.querySelectorAll('.quest')];
    if(!data?.user){if(!loading&&Date.now()-lastAttempt>15000&&rows.some(row=>row.querySelector('[class*="source-system-daily-"]'))){loading=true;lastAttempt=Date.now();fetch(`/api/game?clientDate=${day()}`).then(r=>r.ok?r.json():null).then(json=>{data=json;if(json)schedule();}).catch(()=>{}).finally(()=>loading=false);}return;}
    const context=guidanceContext(data);
    rows.forEach(row=>{
      if(row.querySelector('.quest-edit-form')){row.querySelector('.task-guidance')?.remove();return;}
      const title=row.querySelector('.quest-text h4')?.textContent;
      const candidates=(data.quests||[]).filter(q=>/^system-daily-(easy|medium|hard)$/.test(q.source||'')&&(row.dataset.questId?String(q.id)===row.dataset.questId:q.title===title&&row.querySelector('.calendar-source')?.classList.contains(`source-${q.source}`)));
      const old=row.querySelector('.task-guidance');if(candidates.length!==1){old?.remove();return;}
      const task=candidates[0],feedback=stored(key(task)),signature=JSON.stringify([task.title,task.detail,task.done,context,feedback]);if(old?.dataset.signature===signature)return;
      const panel=createTaskGuidance(task,context,{feedback,onFeedback:value=>save(key(task),{...value,at:new Date().toISOString()})});if(!panel)return;
      panel.dataset.signature=signature;const wasOpen=old?.querySelector('.task-guidance-why')?.open;old?.remove();panel.querySelector('.task-guidance-why').open=!!wasOpen;row.querySelector('.quest-text')?.append(panel);
    });
  }
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;render();});}
  window.addEventListener('starcamp:game-data',e=>{data=e.detail;schedule();});window.addEventListener('starcamp:session-reset',()=>{data=null;memory.clear();document.querySelectorAll('.task-guidance').forEach(n=>n.remove());});
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});schedule();
}
