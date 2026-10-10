import test from 'node:test';
import assert from 'node:assert/strict';
import {sequenceCategories,categoryMutation,CATEGORY_TYPES} from '../vercel-proxy/sequence-categories.mjs';
const record=(id,payload)=>({id,title:payload.title,detail:payload.detail});
test('all built-in subcategories can be renamed and recolored without changing parent',()=>{
  for(const type of CATEGORY_TYPES){
    const original=sequenceCategories([],type)[0];
    const patch=categoryMutation(original,'我的分类','rose');
    const categories=sequenceCategories([record(1,patch)],type);
    assert.equal(categories.length,3);assert.equal(categories[0].name,'我的分类');assert.equal(categories[0].color,'rose');assert.equal(categories[0].type,type);
    const again=categoryMutation(categories[0],'重新命名','azure');
    assert.equal(again.action,'editQuest');assert.equal(again.questId,1);assert.equal(JSON.parse(again.detail).d,original.name);
  }
});
test('deletion is durable for builtins and never targets time records',()=>{
  const original=sequenceCategories([],'主线')[0],history={id:9,title:'▥时轨|2026-10-10|600|630',detail:'{"c":"核心项目"}'};
  const payload=categoryMutation(original,original.name,original.color,true);
  assert.equal(payload.action,'createQuest');
  const quests=[history,record(1,payload)];
  assert.equal(sequenceCategories(quests,'主线').length,2);assert.equal(history.detail,'{"c":"核心项目"}');
  const all=sequenceCategories([],'主线').map((c,i)=>record(i+1,categoryMutation(c,c.name,c.color,true)));
  assert.deepEqual(sequenceCategories(all,'主线'),[]);
});
test('custom categories edit in place, delete by own ID and validate input',()=>{
  const custom={id:4,type:'日常',name:'习惯日程',color:'azure'};
  assert.equal(categoryMutation(custom,'每日整理','jade').action,'editQuest');
  assert.deepEqual(categoryMutation(custom,custom.name,custom.color,true),{action:'deleteQuest',questId:4});
  assert.throws(()=>categoryMutation({...custom,type:'其他'},'新分类','jade'));
  assert.throws(()=>categoryMutation(custom,'','jade'));
  assert.throws(()=>categoryMutation(custom,'新分类','bad'));
  assert.equal(categoryMutation({...custom,native:true},'每日整理','jade').action,'saveTimeCategory');
});
