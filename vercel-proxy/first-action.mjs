import {goals,budgets,barriers,makeFirstAction,persistFirstAction} from './first-action-plan.mjs?v=16';
const el=(tag,cls,text)=>{const node=document.createElement(tag);node.className=cls||'';if(text!==undefined)node.textContent=text;return node;};
const localDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export function openFirstAction({preview=false,email='',onSkip=()=>{},onDone=()=>{},onSaved=()=>{},gateway}={}){
  if(document.querySelector('.first-action-backdrop'))return;
  const previousFocus=document.activeElement,backdrop=el('div','traveler-onboarding first-action-backdrop'),dialog=el('section','first-action-card');
  dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','first-action-title');dialog.tabIndex=-1;
  let step=0,answers={goal:'',budget:0,barrier:''},plan=null,busy=false,result=null,customTitle='',customDone='';
  const safeStore=(key,value)=>{try{localStorage.setItem(key,value);}catch{}};
  const close=()=>{backdrop.remove();document.removeEventListener('keydown',onKey);previousFocus?.focus?.();};
  const skip=()=>{if(busy)return;close();if(step===4&&result)onDone(result);else onSkip();};
  const onKey=e=>{if(e.key==='Escape'){e.preventDefault();skip();}if(e.key==='Tab'){const items=[...dialog.querySelectorAll('button:not(:disabled),input,textarea,a[href]')].filter(n=>!n.hidden);const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};
  function option(label,note,value,current,choose,icon){const button=el('button','first-action-option');button.type='button';button.setAttribute('aria-pressed',String(value===current));if(icon)button.append(el('span','first-action-option-icon',icon));const copy=el('span','');copy.append(el('b','',label),el('small','',note));button.append(copy,el('span','first-action-check',value===current?'✓':'○'));button.onclick=()=>{choose(value);render();dialog.querySelector(`[data-value="${value}"]`)?.focus();};button.dataset.value=String(value);return button;}
  async function save(){
    if(busy)return;const title=customTitle.trim(),done=customDone.trim();if(title.length<2||done.length<2){dialog.querySelector('.first-action-error').textContent='请填写至少两个字的任务名称和完成标准。';return;}
    busy=true;render();
    try{
      if(preview){result={quest:{title:`启程 · ${title}`,detail:done,type:'主线'},existing:false};}
      else{
        const api=gateway||{get:async date=>{const r=await fetch(`/api/game?clientDate=${date}`,{cache:'no-store'});const json=await r.json();if(!r.ok)throw new Error(json.error||'读取账号失败');return json;},act:async payload=>{const r=await fetch('/api/game',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const json=await r.json();if(!r.ok)throw new Error(json.error||'保存失败，请重试');return json;}};
        result=await persistFirstAction(api,{answers,title,done,date:localDate()});safeStore('starcamp:first-action:'+email,JSON.stringify({version:1,answers,questId:result.quest.id}));
        window.dispatchEvent(new CustomEvent('starcamp:game-data',{detail:result.data}));onSaved(result);
      }
      step=4;busy=false;render();
    }catch(error){busy=false;render();dialog.querySelector('.first-action-error').textContent=error.message||'保存失败，选择已保留，请重试。';}
  }
  function render(){
    dialog.replaceChildren();const closeButton=el('button','first-action-close','×');closeButton.setAttribute('aria-label','关闭启程向导');closeButton.disabled=busy;closeButton.onclick=skip;dialog.append(closeButton);
    const mark=el('div','first-action-brand');mark.append(el('span','first-action-seal','✧'),el('small','',preview?'STARCAMP · 第 1 项验收预览':'STARCAMP · 你的第一次启程'));dialog.append(mark);
    const progress=el('div','first-action-progress');['选择方向','留出时间','找到起点'].forEach((name,i)=>{const item=el('span',i<=step?'active':'',`${i<step?'✓':i+1} ${name}`);progress.append(item);});dialog.append(progress);
    const heading=el('h1','');heading.id='first-action-title';
    const subtitles=['不用规划整个人生，先选眼下最在意的一件事。','选一个通常能做到的时间，不必选择最多的。','没有标准答案。我们会据此把第一步变得更容易。','这是一条建议，不是额外的任务负担。你可以修改后再加入。'];
    heading.textContent=['先为自己选一条航线','每天，愿意留多少时间？','什么让开始变得有点难？','今天，只迈出这一小步',preview?'你的第一项行动，准备好了':'第一项行动已加入主线'][step];dialog.append(heading);
    if(step<4)dialog.append(el('p','first-action-subtitle',subtitles[step]));
    if(step===0){const grid=el('div','first-action-options goals');goals.forEach(g=>grid.append(option(g.name,g.note,g.id,answers.goal,value=>{answers.goal=value;},g.icon)));dialog.append(grid);}
    if(step===1){const grid=el('div','first-action-options');budgets.forEach(n=>grid.append(option(`${n===60?'60+':n} 分钟`,n===10?'小步启动也很好':n===20?'留一小段给自己':n===30?'稳稳推进一点':'有更多时间，也先轻装开始',n,answers.budget,value=>{answers.budget=value;})));dialog.append(grid,el('p','first-action-soft-note','这是你每天大致可用的时间。第一项行动只会取其中 10–15 分钟。'));}
    if(step===2){const grid=el('div','first-action-options');barriers.forEach(b=>grid.append(option(b.name,b.note,b.id,answers.barrier,value=>{answers.barrier=value;})));dialog.append(grid);}
    if(step===3){
      const recommendation=el('div','first-action-recommendation');const tags=el('div','first-action-tags');tags.append(el('span','','主线'),el('span','',`约 ${plan.minutes} 分钟`),el('span','',plan.goalName));recommendation.append(tags);
      const titleLabel=el('label','');titleLabel.append(el('span','','第一项行动 · 可修改'));const input=el('input','');input.value=customTitle;input.maxLength=36;input.disabled=busy;input.oninput=()=>customTitle=input.value;titleLabel.append(input);
      const doneLabel=el('label','');doneLabel.append(el('span','','做到什么就算完成'));const textarea=el('textarea','');textarea.value=customDone;textarea.maxLength=80;textarea.rows=2;textarea.disabled=busy;textarea.oninput=()=>customDone=textarea.value;doneLabel.append(textarea);
      recommendation.append(titleLabel,doneLabel,el('p','first-action-start',`从这里开始：${plan.first}。`));dialog.append(recommendation,el('p','first-action-reason',`为什么推荐：${plan.reason}`));
      dialog.append(el('p','first-action-soft-note',`只创建 1 项主线，并将今日专注起点设为 ${plan.minutes} 分钟。默认从中等精力开始；不会自动开始计时、完成任务或开启付费功能。`));
    }
    if(step===4){
      const success=el('div','first-action-success');success.append(el('span','first-action-success-icon','✓'),el('p','',preview?'预览已生成，没有写入真实账号。':result.existing?'已找到你之前创建的首行动，没有重复添加。':'已保存到你的账号。接下来，从这一项开始就好。'),el('h2','',result.quest.title));dialog.append(success);
      if(plan.template)dialog.append(el('p','first-action-soft-note',`以后需要完整路线时，可以在任务页选择「${plan.template}」场景模板。本次不会自动创建整套任务。`));
      const go=el('button','first-action-primary',preview?'完成预览':'去任务页开始');go.onclick=()=>{close();onDone(result);};dialog.append(go);dialog.focus();return;
    }
    const error=el('p','first-action-error');error.setAttribute('role','alert');dialog.append(error);
    const actions=el('footer','first-action-actions'),back=el('button','first-action-back',step===0?'稍后再选':'上一步');back.disabled=busy;back.onclick=()=>{if(step===0)skip();else{step--;render();}};
    const next=el('button','first-action-primary',step===3?(busy?'正在保存…':preview?'生成预览行动':'加入今天的主线'):(step===2?'生成我的第一步':'下一步'));next.disabled=busy||(step===0&&!answers.goal)||(step===1&&!answers.budget)||(step===2&&!answers.barrier);next.onclick=()=>{if(step===3){void save();return;}if(step===2){plan=makeFirstAction(answers);customTitle=plan.title;customDone=plan.done;}step++;render();dialog.focus();};actions.append(back,next);dialog.append(actions);
    const skipButton=el('button','first-action-skip','跳过，不影响正常使用');skipButton.disabled=busy;skipButton.onclick=skip;dialog.append(skipButton,el('p','first-action-privacy',preview?'预览模式：不注册、不保存账号数据，不发送任务请求。':'选择仅用于生成这一步；确认后，行动说明随任务保存到你的账号。使用方法可随时在「指南」查看。'));
  }
  render();backdrop.append(dialog);document.body.append(backdrop);document.addEventListener('keydown',onKey);dialog.focus();
  return {close};
}
