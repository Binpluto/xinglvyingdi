import test from 'node:test';
import assert from 'node:assert/strict';
import {hasPaidTools} from '../vercel-proxy/premium-policy.mjs';
import exportHandler from '../vercel-proxy/api/starlane-export.mjs';
import proxyHandler from '../vercel-proxy/api/proxy.mjs';

const paid={premiumProgram:{isFreeMember:false},calendarAccess:{active:true,status:'paid',accessUntil:'2099-01-01T00:00:00Z'}};
const free={premiumProgram:{isFreeMember:false},calendarAccess:{active:false,status:'free'}};
function response(){return {headers:{},statusCode:200,setHeader(key,value){this.headers[key]=value;},json(value){this.body=value;return this;},send(value){this.body=value;return this;}};}
const req={method:'GET',headers:{cookie:'test-only'},query:{start:'2026-10-01',end:'2026-10-31',format:'ics'}};
const quests=[{id:10,title:'▥时轨|2026-10-10|540|600',detail:JSON.stringify({t:'测试任务',m:'主线',c:'学习',k:'gold',n:''})}];
test('only active paid subscriptions and server-confirmed VIP slots qualify',()=>{
  assert.equal(hasPaidTools(paid),true);
  assert.equal(hasPaidTools(free),false);
  assert.equal(hasPaidTools({premiumProgram:{isFreeMember:true}}),true);
  assert.equal(hasPaidTools({premiumProgram:{isFreeMember:'true'}}),false);
  for(const status of ['free','trial','level_reward','expired','founder']) assert.equal(hasPaidTools({...paid,calendarAccess:{...paid.calendarAccess,status}}),false);
  assert.equal(hasPaidTools({...paid,calendarAccess:{...paid.calendarAccess,accessUntil:'2000-01-01'}}),false);
});
test('export refuses ordinary accounts even with a forged VIP query',async t=>{
  const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);
  globalThis.fetch=async()=>Response.json({...free,quests});
  const res=response();await exportHandler({...req,query:{...req.query,isFreeMember:true}},res);
  assert.equal(res.statusCode,403);assert.equal(res.body.code,'premium_required');assert.match(res.headers['Cache-Control'],/no-store/);
});
test('VIP and paid accounts receive a scoped calendar attachment',async t=>{
  const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);
  for(const membership of [paid,{premiumProgram:{isFreeMember:true}}]){
    globalThis.fetch=async()=>Response.json({...membership,quests});
    const res=response();await exportHandler(req,res);
    assert.equal(res.statusCode,200);assert.match(res.body,/BEGIN:VEVENT/);assert.match(res.body,/测试任务/);assert.match(res.headers['Content-Disposition'],/attachment/);
  }
});
test('membership failures and unauthenticated exports fail closed',async t=>{
  const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);
  globalThis.fetch=async()=>new Response('',{status:401});const unauthorized=response();await exportHandler(req,unauthorized);assert.equal(unauthorized.statusCode,401);
  globalThis.fetch=async()=>{throw new Error('offline');};const unavailable=response();await exportHandler(req,unavailable);assert.equal(unavailable.statusCode,503);
});
test('calendar import and encoded paths cannot bypass the Vercel membership guard',async t=>{
  const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);let calls=0;
  globalThis.fetch=async()=>{calls++;return Response.json(free);};
  for(const path of ['api/game','api/game/','api/%67ame']){
    const res=response();await proxyHandler({method:'POST',url:'/api/game',query:{path},headers:{cookie:'test-only'},body:{action:'importCalendar',isFreeMember:true}},res);assert.equal(res.statusCode,403);
  }
  for(const path of ['api/google-calendar/connect','api/google-calendar/callback']){
    const res=response();await proxyHandler({method:'GET',url:'/'+path,query:{path},headers:{}},res);assert.equal(res.statusCode,403);
  }
  assert.equal(calls,5);
});
test('VIP calendar operation is forwarded and manual task use stays free',async t=>{
  const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);
  const calls=[];globalThis.fetch=async(url)=>{calls.push(url);return Response.json(String(url).endsWith('/api/game')&&calls.length===1?{premiumProgram:{isFreeMember:true}}:{ok:true});};
  const res=response();await proxyHandler({method:'POST',url:'/api/game',query:{path:'api/game'},headers:{cookie:'test-only'},body:{action:'importCalendar'}},res);assert.equal(res.statusCode,200);assert.equal(calls.length,2);
  calls.length=0;await proxyHandler({method:'POST',url:'/api/game',query:{path:'api/game'},headers:{},body:{action:'createQuest',title:'手动任务'}},response());assert.equal(calls.length,1);
});
