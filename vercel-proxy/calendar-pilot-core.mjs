export const PILOT_OWNER='pluto.hanna@gmail.com';
export const marker=e=>`SCAL:${e.id}`;
export const isPilotQuest=q=>/^SCAL:[a-f0-9-]{36}(?:\s|$)/i.test(q?.detail||'');
export const visibleEvent=e=>e.selected&&e.inRange&&e.status==='active'&&e.link_state!=='suppressed';
export function mergedPilot(data,events){
  if(data?.user?.email!==PILOT_OWNER)return data;
  const byId=new Map(events.filter(e=>e.quest_id).map(e=>[Number(e.quest_id),e]));
  const byMarker=new Map(events.map(e=>[marker(e),e]));
  const quests=data.quests.flatMap(q=>{const e=byId.get(q.id)||byMarker.get((q.detail||'').split(/\s/)[0]);if(!e)return [q];
    if(!visibleEvent(e)&&!q.done)return [];
    return [{...q,title:e.title_override||e.title,detail:e.detail_override??e.description??'',dueAt:e.dueAt,source:'google-sync',calendarPilotEventId:e.id,calendarPilotArchived:!visibleEvent(e)}];
  });
  return {...data,quests,calendarPilot:{enabled:true,linked:events.filter(e=>e.quest_id&&e.link_state==='linked').length,total:events.filter(visibleEvent).length}};
}
export function unavailablePilot(data){if(data?.user?.email!==PILOT_OWNER)return data;return {...data,quests:data.quests.filter(q=>!isPilotQuest(q)||q.done),calendarPilot:{enabled:true,unavailable:true}};}
export function possibleDuplicate(data,e){return data.quests.some(q=>!isPilotQuest(q)&&q.title===e.title&&q.dueAt&&(q.dueAt===e.dueAt||Date.parse(q.dueAt)===Date.parse(e.dueAt)));}
export async function materializeEvents(gateway,bridge,{limit=5,calendarName=null}={}){
  let data=await gateway.get();if(data?.user?.email!==PILOT_OWNER)throw new Error('pilot_not_allowed');
  const {events}=await bridge('snapshot');const results=[];
  for(const e of events.filter(e=>visibleEvent(e)&&(!calendarName||e.calendar_name===calendarName))){
    let task=e.quest_id?data.quests.find(q=>q.id===e.quest_id):null;
    if(e.link_state==='suppressed')continue;
    if(!task){
      const matches=data.quests.filter(q=>(q.detail||'').split(/\s/)[0]===marker(e));
      if(matches.length>1){results.push({eventId:e.id,status:'needs_review'});continue;}
      if(matches[0]){task=matches[0];await bridge('receipt',{eventId:e.id,questId:task.id});}
      else if(e.quest_id){results.push({eventId:e.id,status:'missing_linked_task'});continue;}
    }
    if(task){results.push({eventId:e.id,status:'linked',questId:task.id});continue;}
    if(possibleDuplicate(data,e)){results.push({eventId:e.id,status:'possible_duplicate'});continue;}
    if(results.filter(r=>r.status==='created').length>=limit){results.push({eventId:e.id,status:'pending'});continue;}
    const claim=await bridge('claim',{eventId:e.id});
    if(!claim.mayCreate){results.push({eventId:e.id,status:claim.state==='linked'?'linked':'needs_reconciliation'});continue;}
    try{data=await gateway.act({action:'createQuest',title:(e.title.length<2?e.title+' 日程':e.title).slice(0,40),detail:marker(e)+'\n'+(e.description||'日历同步任务').slice(0,50),type:'日常'});}
    catch{data=await gateway.get();}
    const found=data.quests.filter(q=>(q.detail||'').split(/\s/)[0]===marker(e));
    if(found.length!==1){results.push({eventId:e.id,status:'needs_reconciliation'});continue;}
    await bridge('receipt',{eventId:e.id,questId:found[0].id});results.push({eventId:e.id,status:'created',questId:found[0].id});
  }
  return {results,data:mergedPilot(data,(await bridge('snapshot')).events)};
}
export async function pilotMutation(gateway,bridge,body){
  let data=await gateway.get();if(data?.user?.email!==PILOT_OWNER)return gateway.act(body);
  const {events}=await bridge('snapshot'),ids=body.action==='batchDeleteQuests'?body.questIds||[]:[body.questId];
  const linked=events.filter(e=>ids.includes(e.quest_id));
  let completing=null;
  if(body.action==='completeQuest'&&linked.length){const e=linked[0],q=data.quests.find(q=>q.id===e.quest_id);if(!q)throw new Error('关联任务不存在');const date=body.clientDate||new Intl.DateTimeFormat('en-CA',{timeZone:e.time_zone||'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    if(q.done){await bridge('confirm-completion',{eventId:e.id,questId:q.id,date,completedAt:q.completedAt});return mergedPilot(data,events);}if(!visibleEvent(e))throw new Error('日历任务已取消或暂停，不能计分');
    const claim=await bridge('begin-completion',{eventId:e.id,questId:q.id,date});if(!claim.mayComplete)throw new Error('上一次完成结果仍待核对，请刷新；不会再次发放积分');completing={e,date};
    const title=(e.title_override||e.title).slice(0,80);if(q.title!==title)data=await gateway.act({action:'editQuest',questId:q.id,title,detail:q.detail,type:q.type});
  }
  if(['deleteQuest','batchDeleteQuests'].includes(body.action)){
    // Calendar deletions are a reversible pilot suppression. Never delete completion history.
    for(const e of linked)await bridge('suppress',{eventId:e.id});
    if(body.action==='deleteQuest'&&linked.length)return mergedPilot(data,(await bridge('snapshot')).events);
    if(body.action==='batchDeleteQuests'){body={...body,questIds:ids.filter(id=>!linked.some(e=>e.quest_id===id))};if(!body.questIds.length)return mergedPilot(data,(await bridge('snapshot')).events);}
  }
  if(body.action==='editQuest'&&linked.length){const e=linked[0],q=data.quests.find(q=>q.id===e.quest_id);if(!q)throw new Error('关联任务不存在');
    await bridge('override',{eventId:e.id,title:body.title,detail:body.detail});body={...body,detail:marker(e)+'\n'+String(body.detail||'').slice(0,135)};
  }
  try{data=await gateway.act(body);}catch(error){if(!completing)throw error;data=await gateway.get();if(!data.quests.find(q=>q.id===completing.e.quest_id)?.done)throw new Error('完成结果未确认，暂不重试以避免重复积分');}
  if(completing){const q=data.quests.find(q=>q.id===completing.e.quest_id);if(!q?.done)throw new Error('完成状态未确认，请刷新后核对');await bridge('confirm-completion',{eventId:completing.e.id,questId:q.id,date:completing.date,completedAt:q.completedAt});}
  return mergedPilot(data,(await bridge('snapshot')).events);
}
