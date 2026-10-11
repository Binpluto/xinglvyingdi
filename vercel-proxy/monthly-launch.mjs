import {openFirstAction} from './first-action.mjs?v=18';
import {applyMonthlyDecision,reviewNeeded,recoverLaunchProfile} from './monthly-launch-state.mjs?v=18';
const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=text;return n;};
const nowDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export function openMonthlyLaunch({profile,month=nowDate().slice(0,7),preview=false,email='',onDone=()=>{},onLater=()=>{},gateway,initialStage='ask'}={}){
  if(document.querySelector('.first-action-backdrop'))return;
  let stage=initialStage;const previousFocus=document.activeElement,overlay=el('div','traveler-onboarding first-action-backdrop'),card=el('section','first-action-card');card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');card.setAttribute('aria-label','本月启动行动调整');card.tabIndex=-1;
  const close=()=>{overlay.remove();document.removeEventListener('keydown',onKey);previousFocus?.focus?.();};
  const later=()=>{close();onLater();};
  const onKey=e=>{if(e.key==='Escape')later();if(e.key==='Tab'){const items=[...card.querySelectorAll('button')];if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0].focus();}}};
  const commit=next=>{if(!preview)try{localStorage.setItem('starcamp:launch-profile:'+email,JSON.stringify(next));}catch{}close();onDone(next);};
  function choose(mode){close();openFirstAction({preview,email,gateway,monthly:{profile,mode,month},onBack:()=>{openMonthlyLaunch({profile,month,preview,email,onDone,onLater,gateway,initialStage:'mode'});},onSkip:onLater,onDone:result=>{if(!preview)try{localStorage.setItem('starcamp:launch-profile:'+email,JSON.stringify(result.profile));}catch{}onDone(result.profile,result);}});}
  function render(){card.replaceChildren();const x=el('button','first-action-close','×');x.setAttribute('aria-label','稍后调整');x.onclick=later;card.append(x,el('small','monthly-launch-eyebrow',`${month} · ${preview?'模拟月初预览':'每月一次的轻量确认'}`),el('h1','',stage==='ask'?'本月的启动行动，需要调整吗？':'原行动，要一起带上吗？'),el('p','first-action-subtitle',stage==='ask'?'节奏变了，行动也可以调整。沿用有效的部分，不必每个月重新开始。':'只调整本月的启动方向，不删除旧任务，也不清除历史记录。'));
    const list=el('div','monthly-launch-current');list.append(el('small','','当前启动行动'));profile.active.forEach(a=>{const row=el('p','');row.append(el('b','',a.title),el('span','',`约 ${a.minutes} 分钟`));list.append(row);});card.append(list);
    const actions=el('div','monthly-launch-options');
    const button=(title,body,handler)=>{const b=el('button','first-action-option');b.append(el('span','',title),el('small','',body));b.onclick=handler;return b;};
    if(stage==='ask'){
      actions.append(button('本月沿用，不调整','不重复添加任务，也不重置已有完成状态。',()=>commit(applyMonthlyDecision(profile,'keep',{month}))),button('我想调整一下','继续选择保留并新增，或直接开启新行动。',()=>{stage='mode';render();card.focus();}));
    }else{
      actions.append(button('保留原行动，并加上新行动','原行动继续保留；重新回答三问，只新增一项。',()=>choose('add')),button('直接开启新行动','本月只采用新行动；旧任务和历史记录仍保留。',()=>choose('replace')));
      const back=el('button','first-action-back','返回');back.onclick=()=>{stage='ask';render();};actions.append(back);
    }
    card.append(actions);const skip=el('button','first-action-skip','稍后再说，本次访问暂不提醒');skip.onclick=later;card.append(skip,el('p','first-action-privacy',preview?'模拟月初，不改写真实任务。可分别体验沿用、新增、替换。':'本月确认按账号保存在当前浏览器；新增任务保存到云端，换设备可能再次询问。'));
  }
  render();overlay.append(card);document.body.append(overlay);document.addEventListener('keydown',onKey);card.focus();
}
const checked=new Set();
export function maybeMonthlyLaunch(data){
  const email=data?.user?.email;if(!email||document.visibilityState==='hidden'||document.querySelector('.auth-page,.traveler-onboarding,.traveler-guide-page,.starlane-compat-editor-backdrop'))return;
  let profile;try{profile=JSON.parse(localStorage.getItem('starcamp:launch-profile:'+email)||'null');}catch{return;}
  if(!profile){profile=recoverLaunchProfile(data);if(profile)try{localStorage.setItem('starcamp:launch-profile:'+email,JSON.stringify(profile));}catch{}}
  const date=nowDate(),key=`${email}:${date.slice(0,7)}`;
  if(!reviewNeeded(profile,date)||checked.has(key))return;
  checked.add(key);openMonthlyLaunch({email,profile,onDone:(_next,result)=>{if(result?.data)location.reload();},onLater:()=>{}});
}
