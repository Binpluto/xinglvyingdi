import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const ctx=vm.createContext({URL,Response,Set,Map,Date,Promise,Error,location:{origin:'https://starcamp.local'}});
vm.runInContext(readFileSync(new URL('../vercel-proxy/game-transport.js',import.meta.url),'utf8'),ctx);
const make=ctx.createStarcampTransport;
const data={user:{email:'test@example.com'},quests:[]};
const response=()=>Response.json(data);
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
test('parallel dashboard consumers share one request and receive independent bodies',async()=>{
  let calls=0,now=0;const gate=deferred();const client=make(async()=>{calls++;await gate.promise;return response();},{now:()=>now});
  const a=client.fetch('/api/game?clientDate=2026-10-11'),b=client.fetch('/api/game?clientDate=2026-10-11');gate.resolve();
  const results=await Promise.all([a,b]);assert.equal(calls,1);assert.deepEqual(await results[0].json(),await results[1].json());
  await client.fetch('/api/game?clientDate=2026-10-11');assert.equal(calls,1);
  now=8001;await client.fetch('/api/game?clientDate=2026-10-11');assert.equal(calls,2);
});
test('manual refresh bypasses cache; timeline/export requests never reuse dashboard data',async()=>{
  let calls=0;const client=make(async()=>{calls++;return response();});
  await client.fetch('/api/game');await client.fetch('/api/game',{cache:'no-store'});
  await client.fetch('/api/game?timelineDate=2026-10-10');await client.fetch('/api/game?timelineDate=2026-10-10');
  assert.equal(calls,4);
});
test('writes invalidate reads and expose only a server-confirmed snapshot',async()=>{
  let calls=0;const client=make(async()=>{calls++;return response();});
  await client.fetch('/api/game');await client.fetch('/api/game',{method:'POST',body:'{"action":"deleteQuest","questId":1}'});
  assert.deepEqual(client.peek(),data);await client.fetch('/api/game');assert.equal(calls,3);
  await client.fetch('/api/sequence-record',{method:'POST',body:'{}'});await client.fetch('/api/game');assert.equal(calls,5);
});
test('slow pre-delete reads cannot resurrect deleted tasks',async()=>{
  const stale=deferred();let calls=0;const client=make(async(_,options={})=>{calls++;if(calls===1){await stale.promise;return Response.json({...data,quests:[{id:1}]});}return response();});
  const read=client.fetch('/api/game');await client.fetch('/api/game',{method:'POST',body:'{"action":"deleteQuest"}'});stale.resolve();
  assert.deepEqual((await (await read).json()).quests,[]);assert.equal(calls,3);
});
test('auth changes clear cache and reject in-flight data from a previous account',async()=>{
  const stale=deferred();let calls=0;const client=make(async()=>{if(++calls===1)await stale.promise;return response();});
  const read=client.fetch('/api/game');await client.fetch('/api/auth',{method:'POST',body:'{}'});stale.resolve();await assert.rejects(read,/账号状态/);assert.equal(client.peek(),null);
});
test('failed reads are not cached and failed deletion invokes rollback',async()=>{
  let calls=0,finished;const client=make(async()=>{calls++;return Response.json({error:'failed'},{status:500});},{onWrite:()=>ok=>{finished=ok;}});
  await client.fetch('/api/game');await client.fetch('/api/game');assert.equal(calls,2);
  await client.fetch('/api/game',{method:'POST',body:'{"action":"deleteQuest"}'});assert.equal(finished,false);assert.equal(client.peek(),null);
});
test('network failure during deletion returns an actionable error and clears pending state',async()=>{
  let rolledBack=false;const client=make(async()=>{throw new Error('offline');},{onWrite:()=>ok=>{rolledBack=!ok;}});
  const result=await client.fetch('/api/game',{method:'POST',body:'{"action":"deleteQuest"}'});
  assert.equal(result.status,503);assert.match((await result.json()).error,/未确认/);assert.equal(rolledBack,true);assert.equal(client.peek(),null);
});
test('task edit feedback starts before the request completes and has the unmodified server snapshot',async()=>{
  const initial={...data,quests:[{id:1,title:'测试任务',detail:'说明',type:'主线'}]},gate=deferred();let feedback,settled;
  const client=make(async(_,options={})=>{if(options.method==='POST'){await gate.promise;return Response.json({...initial,quests:[{...initial.quests[0],type:'支线'}]});}return Response.json(initial);},{onWrite:(payload,previous)=>{feedback={payload,previous};return ok=>{settled=ok;};}});
  await client.fetch('/api/game');const saving=client.fetch('/api/game',{method:'POST',body:JSON.stringify({action:'editQuest',questId:1,title:'测试任务',detail:'说明',type:'支线'})});
  assert.equal(feedback.previous.quests[0].type,'主线');assert.equal(feedback.payload.type,'支线');assert.equal(settled,undefined);assert.equal(client.peek(),null);
  gate.resolve();await saving;assert.equal(settled,true);assert.equal(client.peek().quests[0].type,'支线');assert.equal(initial.quests[0].type,'主线');
});
test('failed task edit returns an error and restores feedback rather than reporting success',async()=>{
  let settled;const client=make(async()=>{throw new Error('offline');},{onWrite:()=>ok=>{settled=ok;}});
  const result=await client.fetch('/api/game',{method:'POST',body:'{"action":"editQuest","type":"日常"}'});
  assert.equal(result.status,503);assert.match((await result.json()).error,/修改结果未确认/);assert.equal(settled,false);
});
