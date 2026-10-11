import {taskGuidance,taskMetadata} from './system-task-meta.mjs';
import {validDate,shiftCalendarDate} from './starlane-data.mjs';
export const gentleReasons=[['energy','今天精力不够'],['time','时间不够'],['goal','与当前方向不匹配'],['environment','当前环境不方便'],['done','做过类似行动'],['other','今天不适合']];
function hash(text){let value=2166136261;for(const char of text)value=Math.imul(value^char.charCodeAt(0),16777619);return (value>>>0).toString(16);}
export const lightActions=taskGuidance.map(([title,_range,_energy,start,_benefit,goals],i)=>({key:hash(title),title:`轻装 · ${title}`,minutes:i%2?5:3,detail:`完成这个起步动作：${start} 再记下一句下一步打算。`,start,goals}));
export function readReplacement(q){const m=String(q.detail||'').match(/^\[轻装v1\|(\d{4}-\d{2}-\d{2})\|(\d+)\|([a-f0-9]+)\|([a-z]+)\]/);return m?{date:m[1],originalId:Number(m[2]),key:m[3],reason:m[4]}:null;}
export function eligibleSystemTask(task,date){return !!task&&!task.done&&/^system-daily-(easy|medium|hard)$/.test(task.source||'')&&String(task.dueAt||'').slice(0,10)===date;}
export function gentleCandidates(data,{taskId,date,goal,exclude=[]},limit=3){
  if(!validDate(date)||!eligibleSystemTask(data.quests.find(q=>q.id===taskId),date))return [];
  const after=shiftCalendarDate(date,-14),used=new Set(data.quests.flatMap(q=>{const mark=readReplacement(q);return mark&&mark.date>=after&&mark.date<=date?[mark.key]:[];}));
  return lightActions.filter(a=>!used.has(a.key)&&!exclude.includes(a.key)&&(a.goals.includes('all')||a.goals.includes(goal)||!goal))
    .sort((a,b)=>Number(b.goals.includes(goal))-Number(a.goals.includes(goal))||parseInt(hash(`${date}:${taskId}:${a.key}`),16)-parseInt(hash(`${date}:${taskId}:${b.key}`),16)).slice(0,limit);
}
export function gentleFocus(data,context,date,preferredId,deferred=[]){
  const preferred=data.quests.find(q=>q.id===preferredId);if(preferred)return preferred;
  const candidates=data.quests.filter(q=>eligibleSystemTask(q,date)&&!deferred.includes(q.id));
  return candidates.sort((a,b)=>{const ma=taskMetadata(a,context),mb=taskMetadata(b,context);return Number(mb?.energy==='low')-Number(ma?.energy==='low')||(ma?.range?.[0]||999)-(mb?.range?.[0]||999);})[0]||null;
}
export async function persistGentleReplacement(gateway,input){
  if(!validDate(input.date)||!gentleReasons.some(([key])=>key===input.reason))throw new Error('日期或替换原因无效');
  const candidate=lightActions.find(a=>a.key===input.key);if(!candidate)throw new Error('请选择有效的小行动');
  let data=await gateway.get(input.date);
  const existing=data.quests.find(q=>{const r=readReplacement(q);return r?.date===input.date&&r.originalId===input.taskId;});
  if(existing){const mark=readReplacement(existing),saved=lightActions.find(a=>a.key===mark.key);if(saved&&!existing.done){const detail=`[轻装v1|${mark.date}|${mark.originalId}|${mark.key}|${mark.reason}]\n预计全程：${saved.minutes} 分钟\n完成标准：${saved.detail}`.slice(0,180);if(existing.detail!==detail)data=await gateway.act({action:'editQuest',questId:existing.id,title:existing.title,type:existing.type,detail,clientDate:input.date});}return {data,quest:data.quests.find(q=>q.id===existing.id),existing:true};}
  const original=data.quests.find(q=>q.id===input.taskId);if(!eligibleSystemTask(original,input.date))throw new Error('只能改选今天尚未完成的系统任务，原记录未改动');
  const after=shiftCalendarDate(input.date,-14);
  if(data.quests.some(q=>{const r=readReplacement(q);return r?.key===input.key&&r.date>=after&&r.date<=input.date;}))throw new Error('最近 14 天已采用这项小行动，请换一个');
  const marker=`[轻装v1|${input.date}|${input.taskId}|${candidate.key}|${input.reason}]`,detail=`${marker}\n预计全程：${candidate.minutes} 分钟\n完成标准：${candidate.detail}`;
  data=await gateway.act({action:'createQuest',title:candidate.title,type:'日常',detail:detail.slice(0,100),clientDate:input.date});
  const quest=data.quests.find(q=>String(q.detail||'').startsWith(marker));if(!quest)throw new Error('创建结果尚未确认，请重试；会先核对已有记录');
  if(quest.detail!==detail){data=await gateway.act({action:'editQuest',questId:quest.id,title:quest.title,type:'日常',detail:detail.slice(0,180),clientDate:input.date});}
  // Original task, past completion records, XP and coins are deliberately untouched.
  return {data,quest:data.quests.find(q=>q.id===quest.id),existing:false};
}
