import test from 'node:test';import assert from 'node:assert/strict';
import {overlappingBlocks,overlapConsent,overlapKey,overlapLayout} from '../vercel-proxy/overlap-policy.mjs';
import {persistSequence} from '../vercel-proxy/sequence-records.mjs';
const a={id:1,date:'2026-10-11',start:600,end:660,title:'A'};
test('adjacent ranges and the current block are not conflicts',()=>{assert.deepEqual(overlappingBlocks(a,[a,{...a,id:2,start:660,end:720},{...a,id:3,date:'2026-10-12'}]),[]);});
test('consent requires current conflict keys and explicit true',()=>{assert.equal(overlapConsent({},[a]),false);assert.equal(overlapConsent({allowOverlap:true,overlapKeys:[overlapKey(a)]},[a]),true);assert.equal(overlapConsent({allowOverlap:true,overlapKeys:[overlapKey(a)]},[{...a,end:680}]),false);});
test('overlapping cards share width while nonoverlapping groups use full width',()=>{const layout=overlapLayout([a,{...a,id:2,start:630,end:700},{...a,id:3,start:700,end:720}]);assert.deepEqual(layout.get(1),{column:0,columns:2});assert.deepEqual(layout.get(2),{column:1,columns:2});assert.deepEqual(layout.get(3),{column:0,columns:1});});
test('unconfirmed overlaps cannot write; confirmed overlaps can be saved',async()=>{
  const state={quests:[{id:1,title:'▥时轨|2026-10-11|600|660',detail:JSON.stringify({t:'A',m:'主线',k:'gold'})},{id:2,title:'B',type:'主线',done:1}]};let writes=0;
  const gateway={get:async()=>structuredClone(state),act:async p=>{writes++;if(p.action==='createQuest')state.quests.push({id:3,title:p.title,type:p.type,detail:p.detail});else if(p.action==='editQuest')Object.assign(state.quests.find(q=>q.id===p.questId),p);return structuredClone(state);}};
  const input={date:a.date,start:630,end:690,title:'B',type:'主线',category:'核心项目',color:'gold',note:'',recordKey:'overlap-test-0001',questId:2};
  await assert.rejects(persistSequence(gateway,input),e=>e.status===409&&e.conflicts.length===1);assert.equal(writes,0);
  await persistSequence(gateway,{...input,allowOverlap:true,overlapKeys:[overlapKey(a)]});assert(writes>0);assert.equal(state.quests.filter(q=>q.title.startsWith('▥时轨')).length,2);
});
