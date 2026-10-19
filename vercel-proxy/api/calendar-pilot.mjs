import {enabled,isOwner,gateway,bridge,productionOrigin,augment} from '../calendar-pilot-server.mjs';
import {materializeEvents,PILOT_OWNER} from '../calendar-pilot-core.mjs';
import {hasPaidTools} from '../premium-policy.mjs';
export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');
  try{
    if(!enabled()||!await isOwner(req)){res.statusCode=404;return res.json({error:'功能未开放'});}
    const g=gateway(req),data=await g.get();if(data.user?.email!==PILOT_OWNER||!hasPaidTools(data)){res.statusCode=403;return res.json({error:'当前账号无权使用此日历功能'});}
    if(req.method==='GET'){return res.json({enabled:true,...await bridge('saved'),pilot:data.calendarPilot});}
    if(req.method!=='POST'||req.headers.origin!==productionOrigin){res.statusCode=403;return res.json({error:'请求来源无效'});}
    const input=typeof req.body==='string'?JSON.parse(req.body):req.body;
    if(input?.op==='link'){const result=await materializeEvents(g,bridge,{limit:3});return res.json({results:result.results});}
    if(input?.op==='sync'){return res.json(await bridge('sync',{input:{calendarId:input.calendarId}}));}
    if(input?.op==='calendars')return res.json(await bridge('calendars'));
    if(input?.op==='selection')return res.json(await bridge('selection',{input:input.input}));
    if(input?.op==='events')return res.json(await bridge('events',{input:input.input}));
    res.statusCode=400;return res.json({error:'无效操作'});
  }catch(e){res.statusCode=e.status||503;return res.json({error:e.message||'日历试运行操作未完成'});}
}
