import {gentleCandidates,gentleFocus,gentleReasons,eligibleSystemTask,persistGentleReplacement,readReplacement,lightActions} from './gentle-policy.mjs?v=20';
import {guidanceContext} from './task-guidance.mjs?v=20';
import {taskMetadata} from './system-task-meta.mjs?v=20';
const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=text;return n;};
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export function openGentleReplacement({data,taskId,date=today(),context={},preview=false,gateway,onApplied=()=>{},onClose=()=>{}}){
  if(document.querySelector('.gentle-replace-modal'))return;
  const original=data.quests.find(q=>q.id===taskId);if(!eligibleSystemTask(original,date))return;
  const previousFocus=document.activeElement,overlay=el('div','first-action-backdrop gentle-replace-modal'),card=el('section','first-action-card');card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');card.setAttribute('aria-label','确认改选轻装行动');card.tabIndex=-1;
  let seen=[],choices=[],selected=null,reason='energy',busy=false,error='';
  const close=()=>{if(busy)return;overlay.remove();document.removeEventListener('keydown',keys);previousFocus?.focus?.();onClose();};
  const keys=e=>{if(e.key==='Escape')close();if(e.key==='Tab'){const buttons=[...card.querySelectorAll('button:not(:disabled),select:not(:disabled)')];if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===buttons.at(-1)){e.preventDefault();buttons[0]?.focus();}}};
  const pick=()=>{choices=gentleCandidates(data,{taskId,date,goal:context.goal,exclude:seen});selected=choices[0]||null;render();};
  async function save(){if(!selected||busy)return;busy=true;error='';render();try{const result=await persistGentleReplacement(gateway,{taskId,date,key:selected.key,reason});busy=false;overlay.remove();document.removeEventListener('keydown',keys);onApplied(result);}catch(e){busy=false;error=e.message||'保存失败，原任务未改动';render();}}
  function render(){card.replaceChildren();const x=el('button','first-action-close','×');x.setAttribute('aria-label','取消改选');x.disabled=busy;x.onclick=close;card.append(x,el('small','gentle-eyebrow',preview?'第 3 项 · 安全改选预览':'轻装行动 · 确认后才保存'),el('h2','','换个今天更适合的小行动'),el('p','gentle-muted','原任务会保留为未完成，今天的推荐改选为下面的小行动。不是把原任务直接标为完成。'));
    const old=el('div','gentle-original');old.append(el('small','','原任务 · 保留记录'),el('b','',original.title),el('p','',original.detail));card.append(old);
    const label=el('label','gentle-reason');label.append(el('span','','这次想改选的原因'));const select=el('select','');select.setAttribute('aria-label','改选原因');gentleReasons.forEach(([key,text])=>{const o=el('option','',text);o.value=key;select.append(o);});select.value=reason;select.disabled=busy;select.onchange=()=>reason=select.value;label.append(select);card.append(label);
    const options=el('div','gentle-options');choices.forEach(choice=>{const button=el('button','gentle-option');button.setAttribute('aria-pressed',String(selected?.key===choice.key));button.disabled=busy;button.append(el('b','',choice.title),el('small','',`约 ${choice.minutes} 分钟 · 日常`),el('p','',choice.detail));button.onclick=()=>{selected=choice;render();};options.append(button);});if(!choices.length)options.append(el('p','gentle-muted','暂时没有新的合适行动。可以保留原任务或稍后再选，不会强行重复推荐。'));card.append(options);
    const refresh=el('button','gentle-link','再看一组');refresh.disabled=busy||!choices.length;refresh.onclick=()=>{seen.push(...choices.map(c=>c.key));pick();};card.append(refresh);
    const rules=el('div','gentle-rules');rules.append(el('b','','确认后会发生什么'),el('p','','只新增这一项日常行动，原任务不删除、不完成。改选本身不发奖励，也不扣已有经验或货币；新行动实际完成后按日常任务计奖（当前规则为 30 EXP）。'),el('p','','原任务仍是未完成，实际完成率按真实记录计算。连续天数、休整券和历史成果不会因为点击改选而改变。'));card.append(rules);
    const status=el('p','first-action-error',error);status.setAttribute('role','alert');card.append(status);const actions=el('div','first-action-actions'),cancel=el('button','first-action-back','保留原任务');cancel.disabled=busy;cancel.onclick=close;const confirm=el('button','first-action-primary',busy?'正在保存…':'确认改选这项行动');confirm.disabled=busy||!selected;confirm.onclick=()=>void save();actions.append(cancel,confirm);card.append(actions,el('small','gentle-muted',preview?'预览不会写入真实账号，计奖也只做模拟。':'最近 14 天已采用的轻装行动不会再次推荐。'));
  }
  pick();overlay.append(card);document.body.append(overlay);document.addEventListener('keydown',keys);card.focus();
}
export function createGentlePanel({data,state,context,date=today(),preview=false,onState,onReplace,onLocate}){
  const panel=el('section','gentle-panel');panel.setAttribute('aria-label','今日轻装模式');
  const low=state.mode==='low'||(!state.mode&&context.energy==='low');const focused=gentleFocus(data,context,date,state.focusId,state.deferred||[]),light=focused&&readReplacement(focused),meta=focused&&taskMetadata(focused,context);const small=!!light||(focused&&!/^system-daily-/.test(focused.source||''))||(meta?.energy==='low'&&meta?.range?.[0]<=10);
  const header=el('div','gentle-panel-heading');header.append(el('small','gentle-eyebrow',low?'LIGHT JOURNEY · 轻装模式':'TODAY · 选择今天的节奏'));const toggle=el('button','gentle-toggle',low?'切回普通视图':'今天轻装一点');toggle.onclick=()=>onState({mode:low?'normal':'low',expanded:low,rest:false});header.append(toggle);panel.append(header);
  panel.append(el('h2','',state.rest?'今天先留一点余地':!focused?'今天没有需要启动的系统任务':low&&focused?.done?'今天已经迈出一小步了':low?'今天，先做一件就够了':'需要时，可以把推荐收拢到一件事'));
  if(state.rest)panel.append(el('p','gentle-muted','系统任务暂时收起，没有被删除，也没有被标为完成。你仍可展开查看。'));
  else if(low){panel.append(el('p','gentle-muted',focused?.done?'可以到这里停下，也可以展开其他任务，自行决定是否继续。':small?`本次先看：${focused.title}`:'当前推荐可能需要较完整的时间，可以先挑一个 3–5 分钟的小行动。'));
    const primary=el('button','gentle-primary',focused?.done?'回看这项成果':small?'查看这项行动':'挑一个小行动');primary.disabled=!focused;primary.onclick=()=>{if(small||focused?.done)onLocate(focused);else onReplace(focused.id);};panel.append(primary);
  }else panel.append(el('p','gentle-muted','轻装模式只调整推荐的展示，不修改你填写的精力状态，不自动开始任务。'));
  const actions=el('div','gentle-panel-actions');const expand=el('button','gentle-link',state.expanded?'收起其他系统任务':'展开其他系统任务');expand.onclick=()=>onState({expanded:!state.expanded});const rest=el('button','gentle-link','今天先不做系统任务');rest.onclick=()=>onState({rest:true,expanded:false});actions.append(expand,rest);panel.append(actions,el('small','gentle-muted','不扣已有积分，不代替打卡，不自动使用休整券。完成率仍按实际任务记录计算。'));
  return {panel,focused,low,small};
}
export function installGentleMode(){
  if(typeof window==='undefined'||window.starcampGentle)return;window.starcampGentle=true;
  let data=window.starcampTransport?.peek(),queued=false;const memory=new Map();
  const stateKey=()=>`starcamp:gentle:${data.user.email}:${today()}`;
  const readState=()=>{const key=stateKey();let s=memory.get(key);if(!s)try{s=JSON.parse(localStorage.getItem(key)||'null');}catch{}return {deferred:[],expanded:false,...s};};
  const writeState=patch=>{const key=stateKey(),next={...readState(),...patch};memory.set(key,next);try{localStorage.setItem(key,JSON.stringify(next));}catch{}schedule();};
  const gateway={get:async date=>{const r=await fetch(`/api/game?clientDate=${date}`,{cache:'no-store'});const json=await r.json();if(!r.ok)throw new Error(json.error||'读取失败');return json;},act:async body=>{const r=await fetch('/api/game',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const json=await r.json();if(!r.ok)throw new Error(json.error||'保存失败');return json;}};
  function replace(id){if(!data)return;openGentleReplacement({data,taskId:id,context:guidanceContext(data),gateway,onApplied:result=>{data=result.data;const origin=readReplacement(result.quest);writeState({mode:'low',focusId:result.quest.id,rest:false,deferred:[...new Set([...readState().deferred,origin.originalId])]});window.dispatchEvent(new CustomEvent('starcamp:game-data',{detail:data}));const event=new CustomEvent('starcamp:gentle-applied',{detail:data,cancelable:true});window.dispatchEvent(event);if(!event.defaultPrevented){sessionStorage.setItem('starcamp:return-tab','任务');location.reload();}}});}
  function locate(task){const row=[...document.querySelectorAll('.quest')].find(row=>row.dataset.questId===String(task.id)||row.querySelector('h4')?.textContent===task.title);row?.scrollIntoView({behavior:'smooth',block:'center'});row?.classList.add('gentle-highlight');setTimeout(()=>row?.classList.remove('gentle-highlight'),2000);}
  function reset(){data=null;memory.clear();document.querySelectorAll('.gentle-panel').forEach(n=>n.remove());document.querySelectorAll('.gentle-hidden,.gentle-highlight').forEach(n=>n.classList.remove('gentle-hidden','gentle-highlight'));}
  function render(){if(document.querySelector('.auth-page')){reset();return;}if(!data?.user)return;
    const state=readState(),context=guidanceContext(data),date=today();const replacements=data.quests.filter(q=>readReplacement(q)?.date===date);const deferred=[...new Set([...state.deferred,...replacements.map(q=>readReplacement(q).originalId)])];state.deferred=deferred;if((!state.focusId||deferred.includes(state.focusId))&&replacements.length)state.focusId=replacements.at(-1).id;
    const focus=gentleFocus(data,context,date,state.focusId,deferred);if(focus&&state.focusId!==focus.id){state.focusId=focus.id;writeState({focusId:focus.id});}
    document.querySelectorAll('.quest-card').forEach(section=>{const list=section.querySelector('.quest-list');if(!list)return;const signature=JSON.stringify([data.user.email,date,state,context,data.quests.map(q=>[q.id,q.title,q.detail,q.done])]);let panel=section.querySelector('.gentle-panel');const built=createGentlePanel({data,state,context,onState:writeState,onReplace:replace,onLocate:locate});if(panel?.dataset.signature!==signature){built.panel.dataset.signature=signature;panel?.remove();list.before(built.panel);panel=built.panel;}
      list.querySelectorAll('.quest').forEach(row=>{const task=data.quests.find(q=>String(q.id)===row.dataset.questId)||(data.quests.filter(q=>q.title===row.querySelector('h4')?.textContent).length===1?data.quests.find(q=>q.title===row.querySelector('h4')?.textContent):null);const system=task&&/^system-daily-/.test(task.source||'')&&String(task.dueAt||'').slice(0,10)===date;
        const hide=system&&!state.expanded&&(state.rest||deferred.includes(task.id)||(built.low&&(!built.small||task.id!==built.focused?.id)));row.classList.toggle('gentle-hidden',!!hide);
        if(task&&readReplacement(task)){const description=row.querySelector('.quest-text > p');if(description?.textContent.startsWith('[轻装v1|'))description.textContent=task.detail.split('\n').slice(1).join(' · ');}
      });
    });
  }
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;render();});}
  window.addEventListener('starcamp:gentle-replace',e=>replace(e.detail.taskId));window.addEventListener('starcamp:gentle-defer',e=>{const id=e.detail.taskId;if(!eligibleSystemTask(data?.quests?.find(q=>q.id===id),today()))return;writeState({deferred:[...new Set([...readState().deferred,id])],focusId:readState().focusId===id?null:readState().focusId});});
  window.addEventListener('starcamp:game-data',e=>{data=e.detail;schedule();});window.addEventListener('starcamp:session-reset',reset);new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});window.dispatchEvent(new Event('starcamp:gentle-ready'));schedule();
}
