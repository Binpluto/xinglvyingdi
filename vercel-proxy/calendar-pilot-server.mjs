import {createHmac,createHash} from 'node:crypto';
import {PILOT_OWNER,mergedPilot,unavailablePilot,pilotMutation,isPilotQuest} from './calendar-pilot-core.mjs';
export const productionOrigin='https://starcamp-life-adventure.vercel.app';
const upstream='https://starcamp-life-adventure.tianyuanzhaodg.chatgpt.site';
export const enabled=()=>process.env.CALENDAR_OWNER_PILOT==='enabled'&&Boolean(process.env.OWNER_PILOT_BRIDGE_KEY);
function sessionCookie(req){return (req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('starcamp_session='))||'';}
export async function bridge(op,input={}){
  if(!enabled())throw new Error('日历试运行尚未开启');
  const body=JSON.stringify({actor:PILOT_OWNER,op,...input}),stamp=String(Date.now());
  const signature=createHmac('sha256',process.env.OWNER_PILOT_BRIDGE_KEY).update(`${stamp}\n${body}`).digest('hex');
  const response=await fetch('https://starcamp-calendar-test.vercel.app/api/owner-bridge',{method:'POST',headers:{'Content-Type':'application/json','x-starcamp-timestamp':stamp,'x-starcamp-signature':signature},body,redirect:'error',signal:AbortSignal.timeout(45000)});
  const data=await response.json();if(!response.ok)throw new Error('日历服务暂不可用，未确认的操作不会自动重做');return data;
}
export function gateway(req){let input={};try{input=typeof req.body==='string'?JSON.parse(req.body):req.body||{};}catch{}const candidate=input.clientDate||input.date||req.query?.clientDate,day=/^\d{4}-\d{2}-\d{2}$/.test(candidate||'')?candidate:null;return {get:()=>call(),act:body=>call(body)};async function call(body){const r=await fetch(upstream+'/api/game'+(!body&&day?'?clientDate='+day:''),{method:body?'POST':'GET',headers:{cookie:sessionCookie(req),'Content-Type':'application/json',origin:productionOrigin,'x-forwarded-host':'starcamp-life-adventure.vercel.app'},body:body?JSON.stringify({...body,...(day&&!body.clientDate?{clientDate:day}:{})}):undefined,redirect:'manual',signal:AbortSignal.timeout(20000)});const data=await r.json();if(!r.ok){const e=new Error(data.error||'任务接口不可用');e.status=r.status;throw e;}return data;}}
const authCache=new Map();
export async function isOwner(req){
  if(!enabled())return false;const cookie=sessionCookie(req);if(!cookie)return false;const key=createHash('sha256').update(cookie).digest('hex'),cached=authCache.get(key);if(cached&&Date.now()-cached.at<15000)return cached.owner;
  const r=await fetch(upstream+'/api/auth',{headers:{cookie},redirect:'manual',signal:AbortSignal.timeout(10000)});const d=r.ok?await r.json():{};const owner=d?.user?.email===PILOT_OWNER;if(authCache.size>100)authCache.clear();authCache.set(key,{owner,at:Date.now()});return owner;
}
export async function augment(data){if(!enabled()||data?.user?.email!==PILOT_OWNER||!Array.isArray(data.quests))return data;try{return mergedPilot(data,(await bridge('snapshot')).events);}catch{return unavailablePilot(data);}}
export async function mutation(req,body){const g=gateway(req);return pilotMutation(g,bridge,body);}
export async function sequenceGateway(req){const g=gateway(req);if(req.headers['x-starcamp-calendar-pilot']!=='1'||!await isOwner(req))return g;return {get:async()=>augment(await g.get()),act:body=>pilotMutation(g,bridge,body)};}
