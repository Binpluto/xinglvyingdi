import {randomUUID} from 'node:crypto';
import {transaction} from './db.mjs';
import {readEventSnapshot,validateRange,idsFingerprint} from './calendar-events.mjs';
const S='calendar_bridge_test';
const dateExpr="CASE WHEN e.all_day THEN e.start_date ELSE (e.starts_at AT TIME ZONE $4)::date END";
export async function savedCalendars(db,user){return (await db.query(`SELECT c.id,c.google_calendar_id,c.summary,c.selected,c.sync_from_date,c.sync_query,c.last_attempt_at,c.last_success_at,c.last_error_code,c.sync_lease_until FROM ${S}.calendars c WHERE c.user_id=$1 ORDER BY c.summary`,[user.id])).rows;}
export async function saveCalendarSelection(db,user,connection,remote,input){
  const range=validateRange(input);if(!Array.isArray(input.ids)||input.ids.length>100||input.ids.some(id=>typeof id!=='string'))throw new Error('invalid_selection');
  const ids=[...new Set(input.ids)],chosen=ids.map(id=>remote.find(c=>c.id===id&&c.readable));if(chosen.some(c=>!c))throw new Error('calendar_not_readable');
  await transaction(db,async tx=>{
    await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[user.id]);
    if((await tx.query(`SELECT id FROM ${S}.calendars WHERE user_id=$1 AND sync_lease_until>now() LIMIT 1`,[user.id])).rowCount)throw new Error('sync_in_progress');
    await tx.query(`UPDATE ${S}.calendars SET selected=false WHERE user_id=$1`,[user.id]);
    for(const c of chosen)await tx.query(`INSERT INTO ${S}.calendars(user_id,connection_id,google_calendar_id,summary,time_zone,access_role,selected,sync_from_date,sync_query) VALUES($1,$2,$3,$4,$5,$6,true,$7,$8) ON CONFLICT(connection_id,google_calendar_id) DO UPDATE SET summary=excluded.summary,time_zone=excluded.time_zone,access_role=excluded.access_role,selected=true,sync_from_date=excluded.sync_from_date,sync_query=CASE WHEN calendars.sync_query->>'from'=excluded.sync_query->>'from' AND calendars.sync_query->>'to'=excluded.sync_query->>'to' AND calendars.sync_query->>'timeZone'=excluded.sync_query->>'timeZone' THEN calendars.sync_query ELSE excluded.sync_query END`,[user.id,connection.id,c.id,c.name,range.timeZone,c.accessRole,range.from,JSON.stringify(range)]);
  });
}
export async function syncOneCalendar(db,user,calendarId,connection,getJson){
  const runId=randomUUID();let cal;
  await transaction(db,async tx=>{
    await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[user.id]);
    cal=(await tx.query(`UPDATE ${S}.calendars SET sync_lease_owner=$3,sync_lease_until=now()+interval '2 minutes',last_attempt_at=now() WHERE id=$1 AND user_id=$2 AND connection_id=$4 AND selected=true AND (sync_lease_until IS NULL OR sync_lease_until<now()) RETURNING *`,[calendarId,user.id,runId,connection.id])).rows[0];
    if(!cal)throw new Error('calendar_unselected_or_busy');
    await tx.query(`INSERT INTO ${S}.sync_runs(id,user_id,calendar_id,status,mode) VALUES($1,$2,$3,'running','full')`,[runId,user.id,cal.id]);
  });
  try{
    const range=validateRange(cal.sync_query),snapshot=await readEventSnapshot(getJson,cal.google_calendar_id,range);
    const proof=await transaction(db,async tx=>{
      const locked=(await tx.query(`SELECT id FROM ${S}.calendars WHERE id=$1 AND user_id=$2 AND selected=true AND sync_lease_owner=$3 AND sync_lease_until>now() FOR UPDATE`,[cal.id,user.id,runId])).rows[0];if(!locked)throw new Error('sync_lease_expired');
      const counters={added:0,updated:0,archived:0,unchanged:0};
      // Bulk JSON input keeps PostgreSQL writes proportional to pages, not individual events.
      for(let offset=0;offset<snapshot.rows.length;offset+=500){
        const batch=snapshot.rows.slice(offset,offset+500);
        const ids=batch.map(e=>e.google_event_id);
        const existing=(await tx.query(`SELECT google_event_id,title,description,starts_at,ends_at,start_date,end_date,all_day,status,source_etag FROM ${S}.events WHERE user_id=$1 AND calendar_id=$2 AND google_event_id=ANY($3::text[])`,[user.id,cal.id,ids])).rows;
        const old=new Map(existing.map(e=>[e.google_event_id,e]));
        const toWrite=batch.filter(e=>e.status==='active'||old.has(e.google_event_id));
        for(const e of toWrite){const previous=old.get(e.google_event_id);if(!previous)counters.added++;else if(e.status!=='active'){if(previous.status!==e.status)counters.archived++;else counters.unchanged++;}else if(previous.source_etag===e.source_etag&&e.source_etag&&previous.status===e.status)counters.unchanged++;else counters.updated++;}
        const active=toWrite.filter(e=>e.status!=='cancelled');
        if(active.length)await tx.query(`INSERT INTO ${S}.events(user_id,calendar_id,google_event_id,title,description,starts_at,ends_at,start_date,end_date,all_day,status,recurring_event_id,original_start,source_updated_at,source_etag,last_seen_run_id)
          SELECT $1,$2,x.google_event_id,x.title,x.description,x.starts_at,x.ends_at,x.start_date,x.end_date,x.all_day,x.status,x.recurring_event_id,x.original_start,x.source_updated_at,x.source_etag,$4 FROM jsonb_to_recordset($3::jsonb) AS x(google_event_id text,title text,description text,starts_at timestamptz,ends_at timestamptz,start_date date,end_date date,all_day boolean,status text,recurring_event_id text,original_start jsonb,source_updated_at timestamptz,source_etag text)
          ON CONFLICT(calendar_id,google_event_id) DO UPDATE SET title=excluded.title,description=excluded.description,starts_at=excluded.starts_at,ends_at=excluded.ends_at,start_date=excluded.start_date,end_date=excluded.end_date,all_day=excluded.all_day,status=excluded.status,recurring_event_id=excluded.recurring_event_id,original_start=excluded.original_start,source_updated_at=excluded.source_updated_at,source_etag=excluded.source_etag,last_seen_run_id=excluded.last_seen_run_id,updated_at=now()`,[user.id,cal.id,JSON.stringify(active),runId]);
        const cancelled=toWrite.filter(e=>e.status==='cancelled').map(e=>e.google_event_id);
        if(cancelled.length)await tx.query(`UPDATE ${S}.events SET status='cancelled',last_seen_run_id=$4,updated_at=now() WHERE user_id=$1 AND calendar_id=$2 AND google_event_id=ANY($3::text[])`,[user.id,cal.id,cancelled,runId]);
      }
      const removed=await tx.query(`UPDATE ${S}.events e SET status='out_of_range',updated_at=now() WHERE e.user_id=$1 AND e.calendar_id=$2 AND e.status='active' AND e.last_seen_run_id IS DISTINCT FROM $3 AND ${dateExpr}>=$5::date AND ${dateExpr}<=$6::date`,[user.id,cal.id,runId,range.timeZone,range.from,range.to]);counters.archived+=removed.rowCount;
      const saved=(await tx.query(`SELECT google_event_id FROM ${S}.events e WHERE e.user_id=$1 AND e.calendar_id=$2 AND e.status='active' AND ${dateExpr}>=$3::date AND ${dateExpr}<=$5::date`,[user.id,cal.id,range.from,range.timeZone,range.to])).rows.map(r=>r.google_event_id);
      if(idsFingerprint(saved)!==snapshot.proof.sourceFingerprint)throw new Error('sync_verification_failed');
      const result={...snapshot.proof,...counters,stored:saved.length,verified:true,range,finishedAt:new Date().toISOString(),mode:'full-window'};
      await tx.query(`UPDATE ${S}.calendars SET last_success_at=now(),last_error_code=NULL,sync_token=NULL,sync_query=$4,sync_lease_owner=NULL,sync_lease_until=NULL WHERE id=$1 AND user_id=$2 AND sync_lease_owner=$3`,[cal.id,user.id,runId,JSON.stringify({...range,result})]);
      await tx.query(`UPDATE ${S}.sync_runs SET status='success',finished_at=now(),added_count=$2,updated_count=$3,archived_count=$4,unchanged_count=$5 WHERE id=$1`,[runId,counters.added,counters.updated,counters.archived,counters.unchanged]);
      return result;
    });return {calendarId:cal.id,name:cal.summary,status:'success',...proof};
  }catch(error){
    const safe=['sync_range_too_large','pagination_failed','invalid_google_response','missing_event_id','invalid_event_time','invalid_event_date','invalid_event_end','sync_verification_failed','sync_lease_expired','google_permission_denied','google_rate_limited','google_reconnect_required','google_request_failed'];
    const code=safe.includes(error.message)?error.message:'sync_failed';
    await transaction(db,async tx=>{await tx.query(`UPDATE ${S}.calendars SET last_error_code=$4,sync_lease_owner=NULL,sync_lease_until=NULL WHERE id=$1 AND user_id=$2 AND sync_lease_owner=$3`,[cal.id,user.id,runId,code]);await tx.query(`UPDATE ${S}.sync_runs SET status='failed',finished_at=now(),error_code=$2 WHERE id=$1`,[runId,code]);});
    return {calendarId:cal.id,name:cal.summary,status:'failed',error:code};
  }
}
export async function eventPage(db,user,{calendarId,from,to,timeZone,offset=0,limit=100,q=''}){
  validateRange({from,to,timeZone});offset=Number(offset);limit=Number(limit);
  if(!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>200||typeof q!=='string'||q.length>100)throw new Error('invalid_event_page');
  const filter=`e.user_id=$1 AND e.calendar_id=$2 AND e.status='active' AND ${dateExpr}>=$3::date AND ${dateExpr}<=$5::date AND ($6='' OR position(lower($6) in lower(e.title))>0)`;
  const params=[user.id,calendarId,from,timeZone,to,q];
  const total=Number((await db.query(`SELECT count(*) AS count FROM ${S}.events e WHERE ${filter}`,params)).rows[0].count);
  const rows=(await db.query(`SELECT e.id,e.title,e.starts_at,e.ends_at,e.start_date,e.end_date,e.all_day,e.recurring_event_id,${dateExpr}::text AS local_date FROM ${S}.events e WHERE ${filter} ORDER BY ${dateExpr},e.starts_at NULLS FIRST,e.id LIMIT $7 OFFSET $8`,[...params,limit,offset])).rows;
  return {events:rows,total,offset,nextOffset:offset+rows.length<total?offset+rows.length:null};
}
