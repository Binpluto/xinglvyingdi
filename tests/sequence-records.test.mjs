import test from 'node:test';import assert from 'node:assert/strict';
import {persistSequence,sequenceBlocks} from '../vercel-proxy/sequence-records.mjs';
const input={date:'2026-10-10',start:540,end:600,title:'学习',type:'主线',category:'核心项目',color:'gold',note:'复习',recordKey:'record-test-0001'};
function fake(initial=[]){let id=100,points=0,fail=false;const state={quests:structuredClone(initial)};return {state,get points(){return points;},failNextCompletion(){fail=true;},async get(){return structuredClone(state);},async act(p){
  if(p.action==='createQuest')state.quests.push({id:++id,title:p.title.slice(0,40),detail:p.detail.slice(0,100),type:p.type,done:0});
  if(p.action==='editQuest')Object.assign(state.quests.find(q=>q.id===p.questId),{title:p.title,detail:p.detail.slice(0,180),type:p.type});
  if(p.action==='completeQuest'){const task=state.quests.find(q=>q.id===p.questId);if(!task.done){task.done=1;points+=80;}if(fail){fail=false;throw new Error('response lost');}}
  return structuredClone(state);
}};}
test('dragged task completes once and survives a lost completion response',async()=>{
  const g=fake([{id:1,title:'学习',detail:'原任务说明',type:'主线',done:0}]);g.failNextCompletion();
  await assert.rejects(persistSequence(g,{...input,questId:1}));
  await persistSequence(g,{...input,questId:1});
  assert.equal(g.points,80);assert.equal(g.state.quests.length,2);
  const block=sequenceBlocks(g.state.quests)[0];assert.equal(block.questId,1);
  await persistSequence(g,{...input,...block,end:660});assert.equal(g.points,80);
});
test('manual record creates a completed task and retries do not duplicate it',async()=>{
  const g=fake();await persistSequence(g,input);await persistSequence(g,input);
  assert.equal(g.state.quests.length,2);assert.equal(g.state.quests.filter(q=>q.done).length,1);assert.equal(g.points,80);
});
test('task category edits immediately flow into sequence records and exports',async()=>{
  const g=fake([{id:1,title:'学习',detail:'原任务说明',type:'主线',done:0}]);await persistSequence(g,{...input,questId:1});
  g.state.quests.find(q=>q.id===1).type='日常';
  const b=sequenceBlocks(g.state.quests)[0];assert.equal(b.type,'日常');assert.equal(b.color,'jade');assert.equal(b.category,'生活整理');
});
test('ambiguous old names and foreign task ids are not silently linked',async()=>{
  const legacy={id:3,title:'▥时轨|2026-10-10|540|600',type:'主线',detail:JSON.stringify({t:'学习',m:'主线'})};
  const g=fake([{id:1,title:'学习',type:'日常'},{id:2,title:'学习',type:'支线'},legacy]);
  assert.equal(sequenceBlocks(g.state.quests)[0].questId,null);
  await assert.rejects(persistSequence(g,{...input,questId:999}));assert.equal(g.state.quests.length,3);
});
