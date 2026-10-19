import {open} from './security.mjs';
import {readableRole} from './calendar-events.mjs';
export async function googleJson(url,options={}){
  const r=await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(12000)});let j;try{j=await r.json();}catch{throw new Error('invalid_google_response');}
  if(!r.ok){const code=r.status===401||j.error==='invalid_grant'?'google_reconnect_required':r.status===403?'google_permission_denied':r.status===429?'google_rate_limited':'google_request_failed';const e=new Error(code);e.status=r.status;throw e;}return j;
}
export async function googleAccess(db,c,user){
  const connection=(await db.query("SELECT * FROM calendar_bridge_test.connections WHERE user_id=$1 AND status='active' ORDER BY created_at LIMIT 1",[user.id])).rows[0];
  if(!connection)throw new Error('google_reconnect_required');
  const refresh=open(connection.refresh_token_ciphertext,c.key,`refresh:${user.id}:${connection.google_subject}`);
  const token=await googleJson('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:c.clientId,client_secret:c.clientSecret,refresh_token:refresh,grant_type:'refresh_token'})});
  if(!token.access_token)throw new Error('google_reconnect_required');
  return {connection,getJson:url=>googleJson(url,{headers:{Authorization:`Bearer ${token.access_token}`}})};
}
export async function listGoogleCalendars(getJson){
  const items=new Map(),seen=new Set();let next='';
  do{if(seen.has(next)||seen.size>=100)throw new Error('pagination_failed');seen.add(next);
    const q=new URLSearchParams({maxResults:'250',showHidden:'true'});if(next)q.set('pageToken',next);
    const data=await getJson(`https://www.googleapis.com/calendar/v3/users/me/calendarList?${q}`);
    for(const item of data.items||[])if(!item.deleted)items.set(item.id,{id:item.id,name:item.summaryOverride||item.summary||'未命名日历',timeZone:item.timeZone||'UTC',primary:!!item.primary,accessRole:item.accessRole,readable:readableRole(item.accessRole)});
    next=data.nextPageToken||'';
  }while(next);return [...items.values()];
}
