import {env} from 'cloudflare:workers';
import {getAppUser} from '../../app-auth';
import {paidToolsAccess} from '../../paid-tools';
import {PREMIUM_MESSAGE} from '../../../vercel-proxy/premium-policy.mjs';
import {validDate,exportTimeline} from '../../../vercel-proxy/starlane-data.mjs';
export async function GET(request:Request){
  const headers={'Cache-Control':'private, no-store'};
  try{
    const user=await getAppUser(request);if(!user)return Response.json({error:'请先登录'},{status:401,headers});
    if(!await paidToolsAccess(user.email))return Response.json({error:PREMIUM_MESSAGE,code:'premium_required'},{status:403,headers});
    const params=new URL(request.url).searchParams,start=params.get('start')||'',end=params.get('end')||'',format=params.get('format')||'';
    if(!validDate(start)||!validDate(end)||start>end||!['csv','ics'].includes(format))return Response.json({error:'请选择有效日期范围和格式'},{status:400,headers});
    const rows=await env.DB.prepare(`SELECT id,block_date AS date,start_minute AS start,end_minute AS end,title,type,category_name AS category,color_key AS color,note FROM time_blocks WHERE user_email=? AND block_date BETWEEN ? AND ? ORDER BY block_date,start_minute`).bind(user.email,start,end).all();
    if(!rows.results.length)return Response.json({error:'所选范围暂无时间块'},{status:400,headers});
    return new Response(exportTimeline(rows.results,format),{headers:{...headers,'Content-Type':format==='csv'?'text/csv; charset=utf-8':'text/calendar; charset=utf-8','Content-Disposition':`attachment; filename="starcamp-${start}_${end}.${format}"`}});
  }catch{return Response.json({error:'暂时无法核实权限或导出，请稍后重试'},{status:503,headers});}
}
