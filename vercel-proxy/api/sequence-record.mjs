import {persistSequence} from '../sequence-records.mjs';
import {validDate} from '../starlane-data.mjs';
import {sequenceGateway} from '../calendar-pilot-server.mjs';
const upstream='https://starcamp-life-adventure.tianyuanzhaodg.chatgpt.site';
export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');
  if(req.method!=='POST'){res.statusCode=405;return res.json({error:'仅支持 POST'});}
  if(req.headers.origin!=='https://starcamp-life-adventure.vercel.app'){res.statusCode=403;return res.json({error:'请求来源无效'});}
  let input;try{input=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{res.statusCode=400;return res.json({error:'数据格式错误'});}
  if(!validDate(input?.date)){res.statusCode=400;return res.json({error:'日期无效'});}
  async function call(body){
    const response=await fetch(`${upstream}/api/game`,{method:body?'POST':'GET',headers:{cookie:req.headers.cookie||'','content-type':'application/json',origin:'https://starcamp-life-adventure.vercel.app','x-forwarded-host':'starcamp-life-adventure.vercel.app'},body:body?JSON.stringify(body):undefined,redirect:'manual'});
    const data=await response.json();if(!response.ok){const error=new Error(data.error||'保存失败');error.status=response.status;throw error;}return data;
  }
  try{return res.json(await persistSequence(req.headers['x-starcamp-calendar-pilot']==='1'?await sequenceGateway(req):{get:()=>call(),act:call},input));}
  catch(error){res.statusCode=error.status||400;return res.json({error:error.message||'记录未完成，请重试',...(error.conflicts?{code:'overlap_confirmation_required',conflicts:error.conflicts}:{})});}
}
