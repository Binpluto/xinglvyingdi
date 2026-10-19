import {createHmac,timingSafeEqual,randomUUID} from 'node:crypto';
import {transaction} from './db.mjs';
import {googleAccess,listGoogleCalendars} from './google-calendar.mjs';
import {savedCalendars,saveCalendarSelection,syncOneCalendar,eventPage} from './calendar-store.mjs';
export const PILOT_OWNER='pluto.hanna@gmail.com';
export function verifyBridge(body,headers,key,now=Date.now()){
  if(!key||key.length<40)return false;
  const stamp=headers['x-starcamp-timestamp'],signature=headers['x-starcamp-signature'];
  if(!/^\d{13}$/.test(String(stamp))||Math.abs(now-Number(stamp))>60000||!/^[a-f0-9]{64}$/.test(String(signature)))return false;
  const expected=createHmac('sha256',key).update(`${stamp}\n${body}`).digest('hex');
  return timingSafeEqual(Buffer.from(expected),Buffer.from(signature));
}
export async function ownerSnapshot(db,user){
  return (await db.query(`SELECT e.id,e.title,e.description,e.starts_at,e.start_date::text,e.all_day,e.status,c.selected,c.summary AS calendar_name,c.time_zone,c.sync_query,l.quest_id,l.state AS link_state,l.claim_id,l.title_override,l.detail_override FROM calendar_bridge_test.events e JOIN calendar_bridge_test.calendars c ON c.id=e.calendar_id AND c.user_id=e.user_id LEFT JOIN calendar_bridge_test.pilot_links l ON l.event_id=e.id AND l.user_id=e.user_id WHERE e.user_id=$1 ORDER BY e.created_at`,[user.id])).rows.map(e=>({...e,quest_id:e.quest_id?Number(e.quest_id):null,dueAt:e.all_day?e.start_date:e.starts_at.toISOString(),inRange:(e.all_day?e.start_date:new Intl.DateTimeFormat('en-CA',{timeZone:e.time_zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(e.starts_at))>=e.sync_query.from&&(e.all_day?e.start_date:new Intl.DateTimeFormat('en-CA',{timeZone:e.time_zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(e.starts_at))<=e.sync_query.to}));
}
export async function ownerOperation(db,c,body){
  if(body.actor!==PILOT_OWNER)throw new Error('pilot_not_allowed');
  const user=(await db.query('SELECT id,email FROM calendar_bridge_test.users WHERE email=$1',[PILOT_OWNER])).rows[0];if(!user)throw new Error('pilot_google_not_connected');
  if(body.op==='snapshot')return {events:await ownerSnapshot(db,user)};
  if(body.op==='saved')return {calendars:await savedCalendars(db,user)};
  if(['calendars','selection','sync'].includes(body.op)){
    const {connection,getJson}=await googleAccess(db,c,user);
    if(body.op==='calendars')return {calendars:await listGoogleCalendars(getJson),saved:await savedCalendars(db,user)};
    if(body.op==='selection'){await saveCalendarSelection(db,user,connection,await listGoogleCalendars(getJson),body.input);return {calendars:await savedCalendars(db,user)};}
    return syncOneCalendar(db,user,body.input.calendarId,connection,getJson);
  }
  if(body.op==='events'){
    const cal=(await db.query('SELECT sync_query FROM calendar_bridge_test.calendars WHERE id=$1 AND user_id=$2',[body.input.calendarId,user.id])).rows[0];if(!cal)throw new Error('calendar_not_found');
    return eventPage(db,user,{...cal.sync_query,...body.input});
  }
  if(!['claim','receipt','suppress','override','begin-completion','confirm-completion'].includes(body.op))throw new Error('invalid_bridge_operation');
  return transaction(db,async tx=>{
    const event=(await tx.query('SELECT e.id,e.status,c.selected FROM calendar_bridge_test.events e JOIN calendar_bridge_test.calendars c ON c.id=e.calendar_id WHERE e.id=$1 AND e.user_id=$2 FOR UPDATE OF e',[body.eventId,user.id])).rows[0];if(!event)throw new Error('event_not_found');
    if(body.op==='claim'&&(event.status!=='active'||!event.selected))throw new Error('event_inactive');
    await tx.query('INSERT INTO calendar_bridge_test.pilot_links(user_id,event_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[user.id,event.id]);
    let link=(await tx.query('SELECT * FROM calendar_bridge_test.pilot_links WHERE user_id=$1 AND event_id=$2 FOR UPDATE',[user.id,event.id])).rows[0];
    if(body.op==='begin-completion'||body.op==='confirm-completion'){
      if(!link.quest_id||Number(link.quest_id)!==body.questId||!/^\d{4}-\d{2}-\d{2}$/.test(body.date||''))throw new Error('completion_link_invalid');
      if(body.op==='begin-completion'){
        if(event.status!=='active'||!event.selected||link.state==='suppressed')throw new Error('event_inactive');
        const created=await tx.query("INSERT INTO calendar_bridge_test.task_completions(user_id,event_id,completed_local_date,reward_status,upstream_quest_id) VALUES($1,$2,$3,'pending',$4) ON CONFLICT DO NOTHING RETURNING event_id",[user.id,event.id,body.date,body.questId]);return {mayComplete:created.rowCount===1};
      }
      await tx.query("INSERT INTO calendar_bridge_test.task_completions(user_id,event_id,completed_local_date,reward_status,upstream_quest_id,completed_at) VALUES($1,$2,$3,'confirmed',$4,$5) ON CONFLICT(user_id,event_id) DO UPDATE SET reward_status='confirmed',upstream_quest_id=excluded.upstream_quest_id,completed_at=excluded.completed_at",[user.id,event.id,body.date,body.questId,body.completedAt||new Date().toISOString()]);return {confirmed:true};
    }
    if(body.op==='claim'){
      if(link.state!=='new')return {mayCreate:false,questId:link.quest_id?Number(link.quest_id):null,state:link.state};
      const claim=randomUUID();await tx.query("UPDATE calendar_bridge_test.pilot_links SET state='creating',claim_id=$3,claimed_at=now(),updated_at=now() WHERE user_id=$1 AND event_id=$2",[user.id,event.id,claim]);return {mayCreate:true,claimId:claim};
    }
    if(body.op==='receipt'){
      if(!Number.isSafeInteger(body.questId)||body.questId<=0)throw new Error('invalid_quest_id');
      if(link.quest_id&&Number(link.quest_id)!==body.questId)throw new Error('link_conflict');
      if(link.state==='suppressed')throw new Error('link_suppressed');
      await tx.query("UPDATE calendar_bridge_test.pilot_links SET state='linked',quest_id=$3,updated_at=now() WHERE user_id=$1 AND event_id=$2",[user.id,event.id,body.questId]);return {linked:true};
    }
    if(body.op==='suppress'){await tx.query("UPDATE calendar_bridge_test.pilot_links SET state='suppressed',updated_at=now() WHERE user_id=$1 AND event_id=$2",[user.id,event.id]);return {suppressed:true};}
    await tx.query('UPDATE calendar_bridge_test.pilot_links SET title_override=$3,detail_override=$4,updated_at=now() WHERE user_id=$1 AND event_id=$2',[user.id,event.id,String(body.title).slice(0,80),String(body.detail||'').slice(0,180)]);return {updated:true};
  });
}
