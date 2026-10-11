import {sequenceColor,defaultTaskColor} from './sequence-colors.mjs';
import {overlappingBlocks,overlapConsent} from './overlap-policy.mjs';
export const BLOCK_PREFIX='▥时轨|'; // Keep existing cloud records readable after the display-name change.
const types=['主线','支线','日常'];
const defaults={主线:['核心项目','gold'],支线:['创作','azure'],日常:['生活整理','jade']};
export function isInternal(q){return /^(▥时轨\||▥分类\||☾ 月度航向 )/.test(q.title||'');}
export function sequenceBlocks(quests){
  const tasks=quests.filter(q=>!isInternal(q));
  return quests.filter(q=>q.title.startsWith(BLOCK_PREFIX)).flatMap(record=>{
    try{
      const [,date,start,end]=record.title.split('|'),detail=JSON.parse(record.detail);
      const matches=detail.q?tasks.filter(q=>q.id===detail.q):tasks.filter(q=>q.title===detail.t);
      const task=matches.length===1?matches[0]:null;
      const type=task?.type||detail.m||record.type||'日常';
      const changed=task&&type!==detail.m;
      const appearance=sequenceColor(type,detail.m||record.type,detail.k,detail.u);
      return [{id:record.id,date,start:Number(start),end:Number(end),title:task?.title||detail.t||'未命名',type,
        category:changed?defaults[type]?.[0]||'未分类':detail.c||'未分类',...appearance,note:detail.n||'',questId:task?.id||null,recordKey:detail.r||null}];
    }catch{return [];}
  });
}

// The gateway always reads and writes through the authenticated user's existing API.
// Durable record keys and task markers let a interrupted save resume without duplicate tasks.
export async function persistSequence(gateway,input){
  if(!input.title?.trim()||!types.includes(input.type)||!Number.isInteger(input.start)||!Number.isInteger(input.end)||input.start<0||input.end>1440||input.end-input.start<10)throw new Error('请填写有效名称和时间（至少 10 分钟）');
  if(typeof input.category!=='string'||!['jade','gold','azure','coral','violet','rose','amber','slate'].includes(input.color))throw new Error('分类或颜色无效');
  if(!/^[a-zA-Z0-9-]{8,36}$/.test(input.recordKey||''))throw new Error('记录标识无效，请重新打开编辑窗口');
  let data=await gateway.get();
  const find=()=>data.quests.find(q=>q.title.startsWith(BLOCK_PREFIX)&&(input.id?q.id===input.id:(()=>{try{return JSON.parse(q.detail).r===input.recordKey;}catch{return false;}})()));
  let record=find();if(input.id&&!record)throw new Error('记录不存在或无权修改');
  const blocks=sequenceBlocks(data.quests);
  const conflicts=overlappingBlocks({...input,id:record?.id},blocks);
  if(!overlapConsent(input,conflicts)){const error=new Error('检测到时间重叠，需要确认是否允许');error.status=409;error.conflicts=conflicts;throw error;}
  let meta=record?JSON.parse(record.detail):{};
  let questId=input.questId||meta.q||blocks.find(b=>b.id===record?.id)?.questId;
  if(questId&&!data.quests.some(q=>q.id===questId&&!isInternal(q)))throw new Error('关联任务不存在或无权操作');
  const title=`${BLOCK_PREFIX}${input.date}|${input.start}|${input.end}`;
  const custom=input.colorCustom??sequenceColor(input.type,meta.m||input.type,meta.k,meta.u).colorCustom;
  // Preserve a title snapshot so deleting the linked task does not erase history.
  const detailFor=taskId=>JSON.stringify({q:taskId,r:input.recordKey,t:input.title.slice(0,24),m:input.type,c:input.category.slice(0,12),k:custom?input.color:defaultTaskColor(input.type),u:custom?1:0,n:(input.note||'').slice(0,24)});
  if(detailFor(questId||999999999).length>180)throw new Error('记录说明太长，请缩短备注');
  if(!record){
    const linkedDetail=questId?detailFor(questId):null;
    data=await gateway.act({action:'createQuest',title,type:input.type,detail:linkedDetail&&linkedDetail.length<=100?linkedDetail:JSON.stringify({r:input.recordKey,m:input.type})});
    record=find();if(!record)throw new Error('记录保存结果未确认，请重试');
  }
  const marker=`时序记录 #${record.id}`;
  let task=data.quests.find(q=>q.id===questId&&!isInternal(q))||data.quests.find(q=>!isInternal(q)&&q.detail?.split('\n')[0]===marker);
  if(!task){
    data=await gateway.act({action:'createQuest',title:input.title.slice(0,40),type:input.type,detail:`${marker}\n${input.note||''}`.slice(0,100)});
    task=data.quests.find(q=>!isInternal(q)&&q.detail?.split('\n')[0]===marker);
    if(!task)throw new Error('任务保存结果未确认，请重试');
  }
  if(task.type!==input.type){data=await gateway.act({action:'editQuest',questId:task.id,title:task.title,detail:task.detail,type:input.type});}
  const detail=detailFor(task.id);
  if(detail.length>180)throw new Error('记录说明太长，请缩短备注');
  if(record.title!==title||record.type!==input.type||record.detail!==detail)data=await gateway.act({action:'editQuest',questId:record.id,title,type:input.type,detail});
  // Every mutation returns the authenticated server snapshot, including completion status.
  // Reuse it instead of rebuilding the entire dashboard through another GET.
  if(!data.quests.find(q=>q.id===task.id)?.done)data=await gateway.act({action:'completeQuest',questId:task.id,clientDate:input.date});
  return data;
}
