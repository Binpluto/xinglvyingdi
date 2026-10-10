import {hasPaidTools, PREMIUM_MESSAGE} from '../premium-policy.mjs';
import {validDate, filterRange, exportTimeline} from '../starlane-data.mjs';

export default async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store');
  if(req.method!=='GET'){res.statusCode=405;res.setHeader('Allow','GET');return res.json({error:'仅支持 GET'});}
  const {start,end,format}=req.query||{};
  if(!validDate(start)||!validDate(end)||start>end||!['csv','ics'].includes(format)){res.statusCode=400;return res.json({error:'请选择有效日期范围和格式'});}
  try {
    const upstream=await fetch('https://starcamp-life-adventure.tianyuanzhaodg.chatgpt.site/api/game',{
      headers:{cookie:req.headers.cookie||'','x-forwarded-host':'starcamp-life-adventure.vercel.app'},redirect:'manual',signal:AbortSignal.timeout(15000)
    });
    if(upstream.status===401){res.statusCode=401;return res.json({error:'请先登录'});}
    if(!upstream.ok)throw new Error('membership unavailable');
    const data=await upstream.json();
    if(!hasPaidTools(data)){res.statusCode=403;return res.json({error:PREMIUM_MESSAGE,code:'premium_required'});}
    const blocks=(data.quests||[]).filter(q=>q.title.startsWith('▥时轨|')).flatMap(q=>{
      try{const [,date,s,e]=q.title.split('|'),b=JSON.parse(q.detail);return [{id:q.id,date,start:Number(s),end:Number(e),title:b.t,type:b.m,category:b.c,color:b.k,note:b.n||''}];}catch{return [];}
    });
    const rows=filterRange(blocks,start,end);
    if(!rows.length){res.statusCode=400;return res.json({error:'所选范围暂无时间块'});}
    res.setHeader('Content-Type',format==='csv'?'text/csv; charset=utf-8':'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition',`attachment; filename="starcamp-${start}_${end}.${format}"`);
    return res.send(exportTimeline(rows,format));
  }catch{res.statusCode=503;return res.json({error:'暂时无法核实会员权限，请稍后重试'});}
}
