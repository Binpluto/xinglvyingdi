import {createHash} from 'node:crypto';
export function validDay(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;}
export function shiftDay(day,n){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function validateRange({from,to,timeZone}){
  if(!validDay(from)||!validDay(to)||to<from||(Date.parse(to)-Date.parse(from))/86400000>365)throw new Error('invalid_date_range');
  try{new Intl.DateTimeFormat('en-CA',{timeZone}).format(new Date());}catch{throw new Error('invalid_time_zone');}
  if(typeof timeZone!=='string'||!timeZone)throw new Error('invalid_time_zone');return {from,to,timeZone};
}
export function eventDay(start,zone){
  if(start?.date){if(!validDay(start.date))throw new Error('invalid_event_date');return start.date;}
  if(!start?.dateTime||!/(Z|[+-]\d\d:\d\d)$/.test(start.dateTime)||!Number.isFinite(Date.parse(start.dateTime)))throw new Error('invalid_event_time');
  return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(start.dateTime));
}
export function normalizeEvent(e,range){
  if(typeof e.id!=='string'||!e.id)throw new Error('missing_event_id');
  if(e.status==='cancelled')return {google_event_id:e.id,status:'cancelled'};
  const day=eventDay(e.start,range.timeZone),allDay=!!e.start.date;
  const start=allDay?e.start.date:e.start.dateTime,end=allDay?e.end?.date:e.end?.dateTime;
  if(!end||!Number.isFinite(Date.parse(end))||Date.parse(end)<=Date.parse(start))throw new Error('invalid_event_end');
  if(allDay&&!validDay(end))throw new Error('invalid_event_end');
  if(!allDay&&!/(Z|[+-]\d\d:\d\d)$/.test(end))throw new Error('invalid_event_end');
  return {google_event_id:e.id,title:e.summary||'未命名日程',description:e.description||'',all_day:allDay,starts_at:allDay?null:new Date(start).toISOString(),ends_at:allDay?null:new Date(end).toISOString(),start_date:allDay?start:null,end_date:allDay?end:null,recurring_event_id:e.recurringEventId||null,original_start:e.originalStartTime||null,source_updated_at:e.updated||null,source_etag:e.etag||null,status:day>=range.from&&day<=range.to?'active':'out_of_range'};
}
export async function readEventSnapshot(getJson,calendarId,range,{pageSize=2500,deadline=Date.now()+25000}={}){
  validateRange(range);const events=new Map(),tokens=new Set();let pageToken='',pages=0,received=0;
  do{
    if(Date.now()>deadline||pages>=100)throw new Error('sync_range_too_large');
    if(tokens.has(pageToken))throw new Error('pagination_failed');tokens.add(pageToken);
    // Broaden by one day to include all possible UTC offsets, then filter by user-local start date.
    const query=new URLSearchParams({singleEvents:'true',showDeleted:'true',showHiddenInvitations:'true',maxResults:String(pageSize),timeZone:range.timeZone,timeMin:shiftDay(range.from,-1)+'T00:00:00Z',timeMax:shiftDay(range.to,2)+'T00:00:00Z'});
    if(pageToken)query.set('pageToken',pageToken);
    const page=await getJson(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${query}`);
    if(!Array.isArray(page.items))throw new Error('invalid_google_response');pages++;received+=page.items.length;
    for(const item of page.items){const normalized=normalizeEvent(item,range);events.set(normalized.google_event_id,normalized);}
    if(events.size>20000)throw new Error('sync_range_too_large');
    pageToken=page.nextPageToken||'';
  }while(pageToken);
  const rows=[...events.values()],eligible=rows.filter(e=>e.status==='active');
  return {rows,proof:{pages,received,unique:rows.length,eligible:eligible.length,skipped:rows.filter(e=>e.status==='out_of_range').length,cancelled:rows.filter(e=>e.status==='cancelled').length,allPagesRead:true,sourceFingerprint:idsFingerprint(eligible.map(e=>e.google_event_id))}};
}
export function idsFingerprint(ids){return createHash('sha256').update(JSON.stringify([...ids].sort())).digest('hex');}
export const readableRole=role=>['owner','writer','reader','writerWithoutPrivateAccess'].includes(role);
