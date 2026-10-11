import {makeFirstAction,goals,barriers,firstActionMarker} from './first-action-plan.mjs';
import {validDate} from './starlane-data.mjs';
export function reviewNeeded(profile,date){return Array.isArray(profile?.active)&&profile.active.length>0&&Array.isArray(profile.history)&&validDate(date)&&profile.reviewedMonth<date.slice(0,7);}
export function firstLaunchProfile(answers,quest,plan,date){return {version:1,reviewedMonth:date.slice(0,7),answers:{...answers},active:[{questId:quest.id,title:quest.title,done:plan.done,minutes:plan.minutes}],history:[]};}
export function recoverLaunchProfile(data){
  const first=data.quests?.find(q=>String(q.detail||'').startsWith(firstActionMarker));if(!first||!validDate(first.dueAt))return null;
  const goal=goals.find(g=>first.detail.includes(`· ${g.name} ·`)),barrier=barriers.find(b=>first.detail.includes(b.name)),budget=Number(first.detail.match(/每日(\d+)分钟/)?.[1]);
  if(!goal||!barrier||![10,20,30,60].includes(budget))return null;
  const answers={goal:goal.id,budget,barrier:barrier.id},plan=makeFirstAction(answers);let profile=firstLaunchProfile(answers,first,plan,first.dueAt);
  [...data.quests].sort((a,b)=>String(a.detail).localeCompare(String(b.detail))).forEach(q=>{const m=String(q.detail||'').match(/^\[月启动:(\d{4}-\d{2})\]\|(add|replace)\|([^|]+)\|(\d+)\|([^\n]+)/);if(!m||m[1]<profile.reviewedMonth)return;profile=applyMonthlyDecision(profile,m[2],{month:m[1],answers:{goal:m[3],budget:Number(m[4]),barrier:m[5]},action:{questId:q.id,title:q.title,done:q.detail.match(/完成标准：([^\n]+)/)?.[1]||'',minutes:Number(q.detail.match(/本次\s*(\d+)\s*分钟/)?.[1])||10}});});return profile;
}
const nextActions={
  thesis:['选择一段论文草稿，补充三条要点','选一段需要推进的草稿，写出三个待补充的观点或依据。','打开上一份论文草稿'],
  exam:['选一处薄弱知识点，做一次小复习','选一个最近容易忘记的知识点，回忆三条内容并核对。','打开最近一次复习记录'],
  job:['改进一段与目标岗位相关的经历描述','选择简历中的一段经历，补充一项具体成果。','打开当前简历和一个目标岗位'],
  work:['为本月的一项交付写下下一步','选定本月一项成果，写出一个今天可以推进的小步骤。','打开本月项目清单'],
  fitness:['调整一项适合当前状态的活动安排','回看上月安排，选一种适合当前状态的活动，写下下一次开始时间。','回看自己上月愿意重复的活动'],
  sleep:['调整一个适合本月节奏的睡前动作','回看上月的睡前安排，保留有效的部分，写下一个可尝试的小调整。','回想最近几天的睡前安排'],
  other:['为本月选一件重要的事，写下第一步','写下本月一件重要的事，以及今天可以开始的具体动作。','打开便签或拿出纸笔'],
};
export function makeMonthlyAction(answers,profile,mode){
  if(!['add','replace'].includes(mode))throw new Error('请选择保留并新增或开启新行动');
  const plan=makeFirstAction(answers),[title,done,first]=nextActions[plan.goal];
  const reserved=mode==='add'?profile.active.reduce((sum,a)=>sum+Number(a.minutes||0),0):0;
  if(plan.budget-reserved<5)throw new Error(`原行动约需 ${reserved} 分钟。请增加本月时间预算，或返回选择“直接开启新行动”。`);
  return {...plan,title,done,first,minutes:Math.min(plan.minutes,plan.budget-reserved),reserved,mode};
}
export function applyMonthlyDecision(profile,choice,{month,action,answers}={}){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||!['keep','add','replace'].includes(choice))throw new Error('月度选择无效');
  if(choice!=='keep'&&!action)throw new Error('请先确认新行动');
  const next=structuredClone(profile);
  next.history.push({month,choice,previous:structuredClone(profile.active)});
  if(choice==='add')next.active=[...next.active,...(next.active.some(a=>a.questId===action.questId)?[]:[action])];
  if(choice==='replace')next.active=[action];
  if(answers)next.answers={...answers};next.reviewedMonth=month;return next;
}
export async function persistMonthlyAction(gateway,{profile,mode,answers,title,done,date}){
  const plan=makeMonthlyAction(answers,profile,mode);if(!validDate(date))throw new Error('日期无效');
  title=String(title||plan.title).trim();done=String(done||plan.done).trim();if(title.length<2||title.length>36||done.length<2||done.length>80)throw new Error('请检查任务名称和完成标准');
  const month=date.slice(0,7),marker=`[月启动:${month}]`,detail=`${marker}|${mode}|${answers.goal}|${answers.budget}|${answers.barrier}\n完成标准：${done}\n本次 ${plan.minutes} 分钟`;
  let data=await gateway.get(date),task=data.quests.find(q=>String(q.detail||'').startsWith(marker));
  if(task&&!task.detail.startsWith(`${marker}|${mode}|`))throw new Error('本月已有另一种调整记录，请刷新后确认，未重复创建');
  if(!task){data=await gateway.act({action:'createQuest',title:`本月 · ${title}`,type:'主线',detail:detail.slice(0,100),clientDate:date});task=data.quests.find(q=>String(q.detail||'').startsWith(`${marker}|${mode}|`));}
  if(!task)throw new Error('创建结果未确认，请重试');
  if(task.detail!==detail){data=await gateway.act({action:'editQuest',questId:task.id,title:task.title,type:'主线',detail,clientDate:date});task=data.quests.find(q=>q.id===task.id);}
  const action={questId:task.id,title:task.title,done,minutes:plan.minutes};
  return {data,quest:task,profile:applyMonthlyDecision(profile,mode,{month,action,answers}),existing:false};
}
