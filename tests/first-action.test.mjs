import test from 'node:test';
import assert from 'node:assert/strict';
import {goals,budgets,barriers,makeFirstAction,persistFirstAction,firstActionMarker} from '../vercel-proxy/first-action-plan.mjs';
const answers={goal:'thesis',budget:30,barrier:'start'};
const input={answers,date:'2026-10-11'};
function gateway(){let id=0,fail='';const state={user:{email:'test@example.com'},quests:[],dailyDeparture:null};const calls=[];return {state,calls,failNext:action=>fail=action,get:async()=>structuredClone(state),act:async body=>{calls.push(body);if(body.action==='startDailyDeparture'){state.dailyDeparture={mainGoal:body.mainGoal,focusGoalMinutes:body.focusGoalMinutes};let task=state.quests.find(q=>q.source==='daily-departure'&&q.dueAt===body.clientDate);if(!task){task={id:++id,source:'daily-departure',dueAt:body.clientDate,done:0};state.quests.push(task);}Object.assign(task,{title:body.mainGoal,type:'主线',detail:'今日启程'});}else if(body.action==='editQuest'){Object.assign(state.quests.find(q=>q.id===body.questId),{title:body.title,detail:body.detail,type:body.type});}if(fail===body.action){fail='';throw new Error('response lost');}return structuredClone(state);}};}
test('every valid combination yields exactly one small, specific action within the daily budget',()=>{
  for(const goal of goals)for(const budget of budgets)for(const barrier of barriers){const plan=makeFirstAction({goal:goal.id,budget,barrier:barrier.id});assert(plan.title.length>=2&&plan.title.length<=36);assert(plan.done.length<=80);assert(plan.minutes<=budget&&plan.minutes>=5&&plan.minutes<=15);assert(plan.first&&plan.reason);}
  assert.equal(makeFirstAction(answers).minutes,10);
  assert.throws(()=>makeFirstAction({...answers,goal:'unknown'}));
  assert.throws(()=>makeFirstAction({...answers,budget:0}));
});
test('confirmation creates one real main task, saves selection context, and does not mark it completed',async()=>{
  const g=gateway(),result=await persistFirstAction(g,input);assert.equal(g.state.quests.length,1);assert.equal(result.quest.type,'主线');assert.equal(result.quest.done,0);assert(result.quest.detail.startsWith(firstActionMarker));assert.match(result.quest.detail,/论文.*每日30分钟/);assert.equal(g.state.dailyDeparture.focusGoalMinutes,10);
  assert.deepEqual(g.calls.map(c=>c.action),['startDailyDeparture','editQuest']);
  await persistFirstAction(g,input);assert.equal(g.state.quests.length,1);assert.equal(g.calls.length,2);
});
test('lost create or edit responses can retry without duplicate tasks or rewards',async()=>{
  for(const action of ['startDailyDeparture','editQuest']){const g=gateway();g.failNext(action);await assert.rejects(persistFirstAction(g,input));const recovered=await persistFirstAction(g,input);assert.equal(g.state.quests.length,1);assert.equal(recovered.quest.done,0);assert(recovered.quest.detail.startsWith(firstActionMarker));}
});
test('existing daily goals are preserved, and malformed inputs never write',async()=>{
  const g=gateway();g.state.dailyDeparture={mainGoal:'完成已有工作'};await assert.rejects(persistFirstAction(g,input),/不会覆盖/);assert.equal(g.calls.length,0);
  await assert.rejects(persistFirstAction(g,{...input,date:'2026-99-99'}),/日期/);await assert.rejects(persistFirstAction(g,{...input,title:'a'}),/任务名称/);assert.equal(g.calls.length,0);
});
test('user-edited title and completion criteria are kept',async()=>{
  const g=gateway(),r=await persistFirstAction(g,{...input,title:'写引言的三个小标题',done:'列出背景、问题、意义三个标题'});assert.equal(r.quest.title,'启程 · 写引言的三个小标题');assert.match(r.quest.detail,/列出背景、问题、意义三个标题/);
});
